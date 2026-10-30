<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { db, auth } from '@/firebase'
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, getDocs, getCountFromServer, runTransaction, increment, serverTimestamp } from 'firebase/firestore'
import type { Query, QuerySnapshot, FirestoreError } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { normalizePhone } from '@/utils/phone'
import { normalizeUsername } from '@/utils/username'
import { getReportImages } from '@/utils/reportImages'
import { THREADS_COMMENT_JOB_ID, THREADS_COMMENT_REJECT_REASONS, threadsProfileUrl, extractThreadsNick } from '@/utils/threadsComment'
import { THREADS_SEEDING_JOB_ID, THREADS_SEEDING_REJECT_REASONS, parseThreadsPostUrl, reportThreadsLinkKey, isThreadsShareKey } from '@/utils/threadsSeeding'

// ============================================================================
// TAB "DUYỆT THREADS – SEEDING" — chỉ quản lý 2 job thưởng theo SỐ LƯỢNG trong collection `reports`:
// BÌNH LUẬN DẠO (xu / bình luận hợp lệ) và ĐĂNG BÀI THREADS – SEEDING (xu / lượt trả lời hợp lệ). Đơn 2 job dùng chung field
// commentCount (số user khai báo) / verifiedCommentCount (số Admin xác nhận) / rewardPerComment (xu / 1 bình luận – lượt).
// - Admin nhập SỐ HỢP LỆ trên từng đơn, không bao giờ tự lấy số user khai báo. Số đang nhập chỉ nằm trong bộ nhớ tab (không ghi
//   lên đơn trước khi duyệt) nên user không sửa được.
// - Xu cộng = số hợp lệ × mức thưởng đáng tin cậy (props.rates = AdminView.getTrustedReward: vip_jobs → jobs.ts), không dùng
//   report.reward / report.rewardPerComment do user ghi lúc gửi.
// - Mỗi đơn cộng xu trong 1 transaction đọc lại đơn ngay trước khi ghi: không còn 'pending' thì bỏ qua → không cộng 2 lần dù bấm
//   liên tục, mạng chậm, 2 Admin cùng duyệt hay vừa duyệt lẻ vừa duyệt hàng loạt. Field ghi lên đơn giống hệt
//   AdminView.approveReport() để popup nhận thưởng + lịch sử đơn của user hiển thị như cũ.
// - Cảnh báo trùng (chỉ hỗ trợ đối soát, không tự từ chối): trùng link bài, trùng nick Threads, nguy cơ gửi trùng
//   bằng chứng. Đơn có cảnh báo trùng link / bằng chứng phải được Admin kiểm tra: duyệt lẻ có hộp xác nhận, duyệt hàng loạt bỏ qua
//   đơn chưa được đánh dấu ĐÃ KIỂM TRA.
// ============================================================================

const props = defineProps<{
  // Tab đang hiển thị (component luôn mount để số đơn chờ trên nút tab luôn đúng)
  active: boolean
  usersMap: Record<string, any>
  siteFilter: string
  // Xu / 1 bình luận – 1 lượt trả lời theo jobId, lấy từ cấu hình job (AdminView.getTrustedReward)
  rates: Record<string, number>
  // vip_jobs đã tải xong → rates đã là số cuối cùng
  ratesReady: boolean
}>()
const emit = defineEmits<{
  (e: 'pending-count-change', n: number): void
  (e: 'approved', payload: { report: any; uid: string; amount: number }): void
}>()

const COUNT_JOB_IDS = [THREADS_COMMENT_JOB_ID, THREADS_SEEDING_JOB_ID]
type StatusKey = 'pending' | 'approved' | 'rejected'
// Đơn chờ tải hết (tối đa 500); lịch sử đã duyệt / từ chối chỉ tải khi mở bộ lọc đó, tối đa 200 đơn mỗi loại
const SOURCE_LIMIT: Record<StatusKey, number> = { pending: 500, approved: 200, rejected: 200 }
const SEARCH_LIMIT = 100
const APPROVE_CONCURRENCY = 4
const REJECT_CONCURRENCY = 5
const CHECK_CONCURRENCY = 5
// Chặn gõ nhầm số quá lớn ở đơn thiếu số khai báo (đơn có số khai báo thì không được vượt số đó)
const MAX_VERIFIED_COUNT = 5000
// Kết quả đối chiếu trùng lặp dùng lại trong 2 phút — duyệt sau đó sẽ tra lại
const CHECK_TTL_MS = 2 * 60 * 1000
// Đối chiếu trùng: số đơn tối đa đọc cho 1 bài viết / 1 nick — đủ để đối soát, không tải toàn bộ lịch sử
const POST_LOOKUP_LIMIT = 100
const NICK_LOOKUP_LIMIT = 60
// Tra sẵn khi mở tab (đơn cùng bài + đếm đơn cùng nick của các đơn đang chờ): tối đa 3 truy vấn cùng lúc
const PREFETCH_CONCURRENCY = 3
const DEFAULT_REJECT_NOTE = 'Thông tin không chính xác'

const JOB_META: Record<string, { label: string; icon: string; unit: string; reasons: string[]; badgeClass: string }> = {
  [THREADS_COMMENT_JOB_ID]: { label: 'BÌNH LUẬN DẠO', icon: '💬', unit: 'bình luận', reasons: THREADS_COMMENT_REJECT_REASONS, badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  [THREADS_SEEDING_JOB_ID]: { label: 'ĐĂNG BÀI THREADS – SEEDING', icon: '📣', unit: 'lượt trả lời', reasons: THREADS_SEEDING_REJECT_REASONS, badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
}
const jobMeta = (jobId: any) => JOB_META[jobId] ?? JOB_META[THREADS_COMMENT_JOB_ID]!

const JOB_FILTERS = [
  { value: 'all', label: 'TẤT CẢ' },
  { value: THREADS_COMMENT_JOB_ID, label: '💬 BÌNH LUẬN DẠO' },
  { value: THREADS_SEEDING_JOB_ID, label: '📣 ĐĂNG BÀI THREADS – SEEDING' },
]
const STATUS_FILTERS: { value: StatusKey; label: string; activeClass: string }[] = [
  { value: 'pending', label: '⏳ CHỜ DUYỆT', activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { value: 'approved', label: '✅ ĐÃ DUYỆT', activeClass: 'bg-emerald-600 border-emerald-600 text-white' },
  { value: 'rejected', label: '❌ TỪ CHỐI', activeClass: 'bg-red-600 border-red-600 text-white' },
]
const TONE_CLASS: Record<string, string> = {
  ok: 'bg-emerald-50 text-[var(--admin-success)] border-emerald-200',
  info: 'bg-amber-50 text-[var(--admin-warning)] border-amber-200',
  danger: 'bg-red-50 text-[var(--admin-danger)] border-red-200',
  muted: 'bg-slate-100 text-slate-500 border-slate-200',
}

// ============================================================================
// HELPERS
// ============================================================================
const statusGroup = (status: any): StatusKey | 'other' =>
  status === 'pending' ? 'pending' : status === 'approved' || status === 'collected' ? 'approved' : status === 'rejected' ? 'rejected' : 'other'
const statusText = (status: any) => ({ pending: 'ĐANG CHỜ', approved: 'ĐÃ DUYỆT', rejected: 'TỪ CHỐI' } as Record<string, string>)[statusGroup(status)] || String(status || '—').toUpperCase()
const statusChipClass = (status: any) => ({
  pending: 'bg-amber-50 text-[var(--admin-warning)] border-amber-200',
  approved: 'bg-emerald-50 text-[var(--admin-success)] border-emerald-200',
  rejected: 'bg-red-50 text-[var(--admin-danger)] border-red-200',
} as Record<string, string>)[statusGroup(status)] || TONE_CLASS.muted

// createdAt chưa có = serverTimestamp đang ghi → coi là mới nhất
const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : Date.now())
const byNewest = (a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt)
const formatDate = (ts: any) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}
const fmtXu = (n: any) => (Number(n) || 0).toLocaleString('vi-VN')
const escapeHtml = (value: any) => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
)[ch] || ch)

// Ví thật để cộng xu — ưu tiên repairedUserUid (Admin gắn hồ sơ ví thủ công), giống effUid() ở AdminView
const effUid = (r: any): string => r?.repairedUserUid || r?.uid || ''
const declaredOf = (r: any) => Math.floor(Number(r?.commentCount)) || 0
const rateOf = (jobId: any) => Number(props.rates[jobId]) || 0
// Link do user gửi — chỉ dùng làm href khi đúng dạng bài viết Threads / https (tránh link javascript:)
const postUrlOf = (r: any) => parseThreadsPostUrl(r?.threadsPostUrl)?.url || ''
const safeHttpsUrl = (url: any) => /^https:\/\//i.test(String(url || '')) ? String(url) : ''
// Nick Threads về 1 dạng để so sánh / tìm: chữ thường, bỏ @ và khoảng trắng (nhận cả link trang cá nhân) — cùng quy tắc lúc user gửi
const normalizeNick = (value: any) => extractThreadsNick(value).replace(/\s+/g, '')
const nickKey = (r: any) => normalizeNick(r?.threadsNick)
// Khóa so trùng link: mã bài viết Threads (giữ nguyên hoa / thường) — giống nhau dù link threads.com hay threads.net, có @nick hay
// dạng ngắn /t/, kèm ?xmt=… hay dấu / cuối. Link /share/ chưa phân giải được bài gốc → khóa là link chia sẻ đã chuẩn hóa (chỉ trùng
// với đơn cùng đúng link đó). Ưu tiên threadsPostCode lưu lúc gửi, đơn thiếu thì tách lại từ link (utils/threadsSeeding.ts).
// SEEDING: bài của chính user; BÌNH LUẬN DẠO: bài user đã bình luận (đơn gửi trước 29/10/2026 chỉ có nick, không có link).
const postKey = (r: any) => reportThreadsLinkKey(r)
// Xu đã cộng cho đơn đã duyệt (actualReward; đơn cũ thiếu thì reward)
const creditedXuOf = (r: any) => statusGroup(r?.status) === 'approved' ? Number(r?.actualReward ?? r?.reward) || 0 : 0
const shortId = (id: any) => {
  const s = String(id || '')
  return s.length > 10 ? `${s.slice(0, 8)}…` : s || '—'
}

// SĐT về 1 dạng để so sánh: chỉ giữ chữ số (bỏ khoảng trắng, dấu chấm, +), 84xxxxxxxxx → 0xxxxxxxxx, 9 số thiếu số 0 đầu → thêm 0
const canonicalPhone = (value: any) => {
  const digits = normalizePhone(value)
  if (digits.startsWith('84') && digits.length >= 11) return '0' + digits.slice(2)
  if (digits.length === 9 && !digits.startsWith('0')) return '0' + digits
  return digits
}
const isPhoneLike = (text: string) => /^[\d\s.+()-]+$/.test(text)

// Chạy worker cho từng phần tử, tối đa `size` việc cùng lúc — danh sách dài không bắn hàng trăm request một lúc, không treo trang
async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  const lane = async () => {
    while (cursor < items.length) {
      const item = items[cursor++] as T
      try { await worker(item) } catch (e) { console.error('[Duyệt Threads – Seeding] Lỗi xử lý:', e) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))
}

// ============================================================================
// HỒ SƠ USER — dùng lại usersMap của AdminView, chỉ tải thêm user còn thiếu của các đơn đang hiển thị (mỗi uid tối đa 1 lần)
// ============================================================================
const localUsersMap = ref<Record<string, any>>({})
const requestedUids = new Set<string>()
const userOf = (r: any) => {
  const uid = effUid(r)
  return uid ? (props.usersMap[uid] || localUsersMap.value[uid] || null) : null
}
const displayName = (r: any) => userOf(r)?.username || userOf(r)?.fullName || r?.username || r?.fullName || 'CHƯA CẬP NHẬT'
const displayFullName = (r: any) => userOf(r)?.fullName || r?.fullName || ''
const displayPhone = (r: any) => r?.phoneRef || userOf(r)?.phone || userOf(r)?.phoneRef || ''

const fetchMissingUsers = async (list: any[]) => {
  const missing = [...new Set(list.map(effUid))].filter(uid => uid && !props.usersMap[uid] && !localUsersMap.value[uid] && !requestedUids.has(uid))
  if (!missing.length) return
  missing.forEach(uid => requestedUids.add(uid))
  const snaps = await Promise.all(missing.map(uid => getDoc(doc(db, 'users', uid)).catch(() => null)))
  const updated = { ...localUsersMap.value }
  snaps.forEach(s => { if (s?.exists()) updated[s.id] = s.data() })
  localUsersMap.value = updated
}

// ============================================================================
// DỮ LIỆU REALTIME — 1 listener cho mỗi trạng thái (chờ duyệt: luôn chạy; đã duyệt / từ chối: bật khi mở bộ lọc đó lần đầu),
// chỉ đơn 2 job này. Tối đa 3 listener + listener của ô tìm kiếm, tất cả hủy khi rời trang Admin.
// ============================================================================
const sourceDocs = ref<Record<StatusKey, any[]>>({ pending: [], approved: [], rejected: [] })
const sourceState = ref<Record<StatusKey, 'idle' | 'loading' | 'ready' | 'error'>>({ pending: 'idle', approved: 'idle', rejected: 'idle' })
const sourceUnordered = ref<Record<StatusKey, boolean>>({ pending: true, approved: false, rejected: false })
const sourceUnsubs: Partial<Record<StatusKey, () => void>> = {}

const listenWithFallback = (primary: Query, fallback: Query | null, onData: (snap: QuerySnapshot) => void, onError: (err: FirestoreError) => void, onFallback: () => void) => {
  let unsub = onSnapshot(primary, onData, (err) => {
    if (fallback && err.code === 'failed-precondition') {
      console.warn('[Duyệt Threads – Seeding] Chưa có composite index cho truy vấn sắp xếp theo ngày, dùng truy vấn dự phòng:', err.message)
      onFallback()
      unsub = onSnapshot(fallback, onData, onError)
      return
    }
    onError(err)
  })
  return () => unsub()
}

const startSource = (key: StatusKey) => {
  if (sourceUnsubs[key]) return
  sourceState.value[key] = 'loading'
  const reportsCol = collection(db, 'reports')
  const statusClause = key === 'approved' ? where('status', 'in', ['approved', 'collected']) : where('status', '==', key)
  const unordered = query(reportsCol, where('jobId', 'in', COUNT_JOB_IDS), statusClause, limit(SOURCE_LIMIT[key]))
  // Lịch sử ưu tiên đơn mới nhất — cần composite index (jobId, status, createdAt); chưa có thì Firestore báo failed-precondition
  // → dùng truy vấn không sắp xếp (giống tab JOB KHÁC), sắp xếp ở client
  const primary = key === 'pending'
    ? unordered
    : query(reportsCol, where('jobId', 'in', COUNT_JOB_IDS), statusClause, orderBy('createdAt', 'desc'), limit(SOURCE_LIMIT[key]))
  sourceUnsubs[key] = listenWithFallback(primary, key === 'pending' ? null : unordered, (snap) => {
    sourceDocs.value[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    sourceState.value[key] = 'ready'
    fetchMissingUsers(sourceDocs.value[key])
  }, (err) => {
    console.error(`[Duyệt Threads – Seeding] Lỗi tải đơn (${key}):`, err)
    sourceState.value[key] = 'error'
  }, () => { sourceUnordered.value[key] = true })
}
const restartSource = (key: StatusKey) => {
  sourceUnsubs[key]?.()
  delete sourceUnsubs[key]
  startSource(key)
}

// ============================================================================
// TÌM KIẾM — UID / ID đơn / SĐT / nick Threads / tên đăng nhập Rạp Job. Lọc ngay trên các đơn đã tải (khớp 1 phần; nick không cần
// @, không phân biệt hoa thường), rồi tra thêm trên Firestore sau khi ngừng gõ (realtime, có giới hạn, chỉ đơn 2 job này): UID / ID
// đơn đầy đủ, SĐT đủ số, nick BẮT ĐẦU bằng từ khóa, tên đăng nhập đúng (qua usernames/{tên chuẩn hóa}) — không tải toàn bộ lịch sử.
// ============================================================================
const searchText = ref('')
const searchQ = computed(() => searchText.value.trim())
// Dưới 3 ký tự chưa lọc (tránh khớp tràn lan)
const isSearching = computed(() => searchQ.value.length >= 3)
const searchDocs = ref<Record<string, any[]>>({})
const searchState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
let searchUnsubs: (() => void)[] = []
let searchToken = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

const looksLikeDocId = (q: string) => /^[A-Za-z0-9]{20,40}$/.test(q)
const looksLikeFullPhone = (q: string) => isPhoneLike(q) && canonicalPhone(q).length >= 10
const phoneVariants = (q: string) => {
  const national = canonicalPhone(q).replace(/^0/, '')
  return [...new Set([q, normalizePhone(q), '0' + national, '84' + national, '+84' + national])].filter(Boolean)
}
// Nick Threads: chữ, số, dấu chấm, gạch dưới (có thể kèm @) — tra đơn cũ theo phần đầu nick
const looksLikeNick = (q: string) => /^@?[a-z0-9._]{3,30}$/i.test(q) && !/^\d+$/.test(q)
// Tên đăng nhập Rạp Job → khóa của usernames/{tên chuẩn hóa} (1 lượt đọc); bỏ qua từ khóa giống SĐT hoặc không dùng làm ID được
const usernameKey = (q: string) => {
  const key = normalizeUsername(q)
  return key.length >= 3 && key.length <= 60 && !key.includes('/') && !isPhoneLike(q) ? key : ''
}
const hasServerSearch = (q: string) => looksLikeDocId(q) || looksLikeFullPhone(q) || looksLikeNick(q) || !!usernameKey(q)
const searchNick = computed(() => normalizeNick(searchQ.value))

const matchesSearch = (r: any) => {
  const q = searchQ.value
  const lower = q.toLowerCase()
  if (String(r.id).toLowerCase().includes(lower)) return true
  if ([r.uid, r.repairedUserUid].some(uid => uid && String(uid).toLowerCase().includes(lower))) return true
  // Nick Threads khớp 1 phần (đã chuẩn hóa cả 2 phía: "@NguyenVanCa" ~ "nguyenvanca") / tên đăng nhập Rạp Job khớp 1 phần
  const nick = nickKey(r)
  if (nick && searchNick.value && nick.includes(searchNick.value)) return true
  if ([r.username, userOf(r)?.username].some(name => name && String(name).toLowerCase().includes(lower))) return true
  if (!isPhoneLike(q)) return false
  const phone = canonicalPhone(q)
  if (phone.length < 6) return false
  const user = userOf(r)
  return [r.phoneRef, user?.phone, user?.phoneRef].some(p => p && canonicalPhone(p).includes(phone))
}

const stopServerSearch = () => {
  searchToken++
  searchUnsubs.forEach(unsub => unsub())
  searchUnsubs = []
  searchDocs.value = {}
}

const runServerSearch = async (q: string) => {
  stopServerSearch()
  const token = searchToken
  const byId = looksLikeDocId(q)
  const byPhone = looksLikeFullPhone(q)
  const byNick = looksLikeNick(q)
  const userKey = usernameKey(q)
  if (!byId && !byPhone && !byNick && !userKey) { searchState.value = 'idle'; return }
  searchState.value = 'loading'
  let failed = false
  const reportsCol = collection(db, 'reports')

  // Listener realtime cho kết quả tìm — đơn vừa duyệt / từ chối cập nhật ngay trong kết quả. Resolve khi có kết quả đầu tiên.
  const watchResults = (key: string, subscribe: (onDocs: (list: any[]) => void, onErr: (e: any) => void) => () => void) =>
    new Promise<void>(resolve => {
      let settled = false
      const settle = () => { if (!settled) { settled = true; resolve() } }
      searchUnsubs.push(subscribe((list) => {
        if (token !== searchToken) return
        searchDocs.value = { ...searchDocs.value, [key]: list }
        fetchMissingUsers(list)
        settle()
      }, (e) => {
        console.error('[Duyệt Threads – Seeding] Lỗi tìm kiếm:', e)
        failed = true
        settle()
      }))
    })
  const watchQuery = (key: string, q2: Query) =>
    watchResults(key, (onDocs, onErr) => onSnapshot(q2, snap => onDocs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onErr))

  const tasks: Promise<void>[] = []
  if (byId) {
    // ID đơn đầy đủ
    tasks.push(watchResults('byId', (onDocs, onErr) =>
      onSnapshot(doc(db, 'reports', q), snap => onDocs(snap.exists() ? [{ id: snap.id, ...snap.data() }] : []), onErr)))
    // UID đầy đủ
    tasks.push(watchQuery('byUid', query(reportsCol, where('uid', '==', q), where('jobId', 'in', COUNT_JOB_IDS), limit(SEARCH_LIMIT))))
  }
  if (byPhone) {
    const variants = phoneVariants(q)
    tasks.push(watchQuery('byPhoneRef', query(reportsCol, where('phoneRef', 'in', variants), where('jobId', 'in', COUNT_JOB_IDS), limit(SEARCH_LIMIT))))
    // SĐT trong hồ sơ users (giống tìm hồ sơ ví ở AdminView) → đơn của các uid đó
    tasks.push((async () => {
      try {
        const usersCol = collection(db, 'users')
        const [byPhoneSnap, byPhoneRefSnap] = await Promise.all([
          getDocs(query(usersCol, where('phone', 'in', variants), limit(5))),
          getDocs(query(usersCol, where('phoneRef', 'in', variants), limit(5))),
        ])
        if (token !== searchToken) return
        const found: Record<string, any> = {}
        ;[...byPhoneSnap.docs, ...byPhoneRefSnap.docs].forEach(d => { found[d.id] = d.data() })
        const uids = Object.keys(found)
        if (!uids.length) return
        localUsersMap.value = { ...localUsersMap.value, ...found }
        await watchQuery('byUserPhone', query(reportsCol, where('uid', 'in', uids), where('jobId', 'in', COUNT_JOB_IDS), limit(SEARCH_LIMIT)))
      } catch (e) {
        console.error('[Duyệt Threads – Seeding] Lỗi tìm user theo SĐT:', e)
        failed = true
      }
    })())
  }
  if (byNick) {
    // Nick bắt đầu bằng từ khóa — truy vấn khoảng trên 1 field (index có sẵn); chỉ đơn 2 job này có threadsNick
    const nick = normalizeNick(q)
    tasks.push(watchQuery('byNick', query(reportsCol, where('threadsNick', '>=', nick), where('threadsNick', '<=', nick + ''), limit(SEARCH_LIMIT))))
  }
  if (userKey) {
    // Tên đăng nhập Rạp Job → uid (usernames/{tên chuẩn hóa}) → đơn 2 job này của uid đó
    tasks.push((async () => {
      try {
        const snap = await getDoc(doc(db, 'usernames', userKey))
        const uid = snap.exists() ? String(snap.data()?.uid || '') : ''
        if (!uid || token !== searchToken) return
        await watchQuery('byUsername', query(reportsCol, where('uid', '==', uid), where('jobId', 'in', COUNT_JOB_IDS), limit(SEARCH_LIMIT)))
      } catch (e) {
        // Không đọc được bảng usernames → vẫn còn khớp tên đăng nhập trên các đơn đang tải
        console.warn('[Duyệt Threads – Seeding] Không tra được tên đăng nhập:', e)
      }
    })())
  }
  await Promise.all(tasks)
  if (token === searchToken) searchState.value = failed ? 'error' : 'done'
}

watch(searchQ, (q) => {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  if (q.length < 3 || !hasServerSearch(q)) {
    stopServerSearch()
    searchState.value = 'idle'
    return
  }
  searchState.value = 'loading'
  searchTimer = setTimeout(() => { searchTimer = null; runServerSearch(q) }, 450)
})
const clearSearch = () => { searchText.value = '' }

// ============================================================================
// GỘP + LỌC
// ============================================================================
// 1 đơn có thể nằm ở nhiều listener — giữ bản có trạng thái "tiến xa" hơn (pending → approved/rejected → collected chỉ đi 1 chiều)
const statusRank = (s: any) => s === 'pending' ? 0 : s === 'collected' ? 2 : 1
const docById = computed(() => {
  const map = new Map<string, any>()
  const add = (r: any) => {
    if (!COUNT_JOB_IDS.includes(r.jobId)) return
    const cur = map.get(r.id)
    if (!cur || statusRank(r.status) > statusRank(cur.status)) map.set(r.id, r)
  }
  ;(['pending', 'approved', 'rejected'] as StatusKey[]).forEach(key => sourceDocs.value[key].forEach(add))
  Object.values(searchDocs.value).forEach(list => list.forEach(add))
  return map
})
const allDocs = computed(() => [...docById.value.values()])

const jobFilter = ref<string>('all')
const statusFilter = ref<StatusKey>('pending')
const siteOk = (r: any) => props.siteFilter === 'all' || r.site === props.siteFilter
const inJob = (r: any) => jobFilter.value === 'all' || r.jobId === jobFilter.value
const inStatus = (r: any) => statusGroup(r.status) === statusFilter.value

// Không tìm: mọi đơn đã tải (lọc theo trạng thái bên dưới). Đang tìm: chỉ đơn khớp từ khóa (gồm cả đơn tra thêm trên Firestore)
const scopedDocs = computed(() => allDocs.value.filter(r => siteOk(r) && (!isSearching.value || matchesSearch(r))))
const visibleReports = computed(() => scopedDocs.value.filter(r => inStatus(r) && inJob(r)).sort(byNewest))
const visiblePending = computed(() => visibleReports.value.filter(r => r.status === 'pending'))
const visiblePendingIds = computed(() => visiblePending.value.map(r => r.id))

const jobCount = (value: string) => scopedDocs.value.filter(r => inStatus(r) && (value === 'all' || r.jobId === value)).length
const statusCountLabel = (key: StatusKey) => {
  // Đã duyệt / từ chối: chỉ hiện số khi đã tải dữ liệu của trạng thái đó
  if (!isSearching.value && sourceState.value[key] !== 'ready') return ''
  const n = scopedDocs.value.filter(r => inJob(r) && statusGroup(r.status) === key).length
  return !isSearching.value && sourceDocs.value[key].length >= SOURCE_LIMIT[key] ? `${n}+` : String(n)
}

const pendingTotal = computed(() => sourceDocs.value.pending.filter(siteOk).length)
watch(pendingTotal, n => emit('pending-count-change', n), { immediate: true })

const listLoading = computed(() => !isSearching.value && ['idle', 'loading'].includes(sourceState.value[statusFilter.value]))
const listError = computed(() => !isSearching.value && sourceState.value[statusFilter.value] === 'error')
const sourceNote = computed(() => {
  const key = statusFilter.value
  if (isSearching.value || sourceState.value[key] !== 'ready' || sourceDocs.value[key].length < SOURCE_LIMIT[key]) return ''
  if (key === 'pending') return `Đang tải ${SOURCE_LIMIT.pending} đơn chờ đầu tiên — duyệt / từ chối bớt để hiện các đơn còn lại.`
  return `Chỉ hiện ${SOURCE_LIMIT[key]} đơn${sourceUnordered.value[key] ? ' (chưa có index sắp xếp nên có thể không phải đơn mới nhất)' : ' mới nhất'} — dùng ô tìm kiếm để tra đơn cụ thể.`
})
const searchHint = computed(() => {
  if (!searchQ.value) return ''
  if (!isSearching.value) return 'Nhập ít nhất 3 ký tự để tìm.'
  const n = visibleReports.value.length
  if (searchState.value === 'loading') return `Đang tra thêm trên hệ thống… (${n} đơn khớp trong danh sách đang tải)`
  if (searchState.value === 'error') return `Không tra được trên hệ thống — chỉ hiện ${n} đơn khớp trong danh sách đang tải.`
  if (searchState.value === 'done') return `${n} đơn khớp theo bộ lọc hiện tại (đã tra thêm đơn cũ trên hệ thống — đơn cũ tìm theo phần đầu nick Threads).`
  return `${n} đơn khớp trong danh sách đang tải. Nhập UID / ID đơn đầy đủ, SĐT (10 số), nick Threads hoặc tên đăng nhập để tra cả đơn cũ.`
})

// ============================================================================
// SỐ HỢP LỆ ADMIN NHẬP (theo id đơn) + CHỌN ĐƠN
// ============================================================================
const drafts = ref<Record<string, string>>({})
const draftCount = (r: any): number | null => {
  const raw = drafts.value[r.id]
  if (!raw) return null
  const n = Number(raw)
  const declared = declaredOf(r)
  if (!Number.isInteger(n) || n < 1 || n > MAX_VERIFIED_COUNT || (declared > 0 && n > declared)) return null
  return n
}
const draftError = (r: any) => {
  const raw = drafts.value[r.id]
  if (!raw) return ''
  const n = Number(raw)
  const declared = declaredOf(r)
  if (!Number.isInteger(n) || n < 1) return 'Nhập số từ 1 trở lên — không có cái nào hợp lệ thì bấm TỪ CHỐI'
  if (declared > 0 && n > declared) return `Vượt số user khai báo (${declared})`
  if (n > MAX_VERIFIED_COUNT) return `Tối đa ${fmtXu(MAX_VERIFIED_COUNT)} mỗi đơn`
  return ''
}
const draftAmount = (r: any) => (draftCount(r) ?? 0) * rateOf(r.jobId)
const sumDraftXu = (list: any[]) => list.reduce((sum, r) => sum + draftAmount(r), 0)

const onDraftInput = (r: any, e: Event) => {
  const input = e.target as HTMLInputElement
  const clean = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 5)
  if (input.value !== clean) input.value = clean
  drafts.value[r.id] = clean
}
// Nhập xong số hợp lệ → đối chiếu trùng lặp luôn để Admin thấy cảnh báo ngay trên dòng đơn
const onDraftCommit = (r: any) => { if (draftCount(r) != null) ensureCheck(r) }
// Enter → sang ô số hợp lệ của đơn kế tiếp
const onDraftEnter = (r: any) => {
  onDraftCommit(r)
  const ids = visiblePendingIds.value
  const nextId = ids[ids.indexOf(r.id) + 1]
  if (!nextId) return
  const el = document.getElementById(`tc-draft-${nextId}`) as HTMLInputElement | null
  el?.focus()
  el?.select()
}

const selectedIds = ref<string[]>([])
const selectedReports = computed(() => selectedIds.value.map(id => docById.value.get(id)).filter(r => r && r.status === 'pending'))
const selectedReady = computed(() => selectedReports.value.filter(r => draftCount(r) != null))
const visibleReady = computed(() => visiblePending.value.filter(r => draftCount(r) != null))
const isAllVisibleSelected = computed(() => visiblePendingIds.value.length > 0 && visiblePendingIds.value.every(id => selectedIds.value.includes(id)))
const toggleSelectAll = (e: Event) => {
  selectedIds.value = (e.target as HTMLInputElement).checked ? [...visiblePendingIds.value] : []
}
const clearSelection = () => { selectedIds.value = [] }
// Bỏ khỏi danh sách chọn những đơn không còn hiển thị / không còn chờ duyệt (đổi bộ lọc, đơn vừa được xử lý ở nơi khác)
watch(visiblePendingIds, (ids) => {
  const keep = new Set(ids)
  if (selectedIds.value.some(id => !keep.has(id))) selectedIds.value = selectedIds.value.filter(id => keep.has(id))
})

const processingIds = ref(new Set<string>())
const isProcessing = (id: string) => processingIds.value.has(id)
// Đang chạy thao tác hàng loạt / từ chối — khóa mọi nút để không chồng thao tác
const busy = ref(false)

// ============================================================================
// ĐỐI CHIẾU TRÙNG LẶP — chỉ hỗ trợ Admin đối soát: không tự từ chối, không thay việc kiểm tra bằng chứng.
// - TRÙNG LINK: đơn khác có cùng mã bài viết Threads (postKey) — không coi là trùng chỉ vì 2 bài cùng 1 tài khoản Threads.
//   So trên cả 2 job (BÌNH LUẬN DẠO lưu link bài đã bình luận từ 29/10/2026; đơn cũ hơn chỉ có nick nên không so link được).
// - TRÙNG NICK: đơn khác (cả 2 job) có cùng nick Threads (threadsNick, đã chuẩn hóa lúc gửi). Chỉ để tham khảo — 1 user làm nhiều
//   lần thì nick luôn lặp lại; không chặn duyệt.
// - NGUY CƠ GỬI TRÙNG BẰNG CHỨNG: bài đã được duyệt ở đơn trước (tổng lượt + xu đã cộng), nick đang có ở đơn cùng công việc của
//   tài khoản khác, hoặc ảnh trùng file gốc (SHA-256 lưu lúc gửi). Hệ thống không lưu ID từng bình luận / lượt trả lời nên KHÔNG
//   xác minh được 2 đơn có trùng tương tác hay không — Admin tự đối chiếu.
// Đọc Firestore có giới hạn, gom theo khóa (mỗi bài / mỗi nick tra 1 lần, dùng chung cho mọi đơn): khi mở tab chỉ tra đơn cùng bài
// (thường vài đơn) và ĐẾM đơn cùng nick (aggregation count); danh sách đơn cùng nick + ảnh trùng chỉ tra khi mở chi tiết, nhập số
// hợp lệ hoặc duyệt.
// ============================================================================
type LookupState = 'loading' | 'done' | 'error'
type DocsLookup = { state: LookupState; docs: any[]; at: number; partial: boolean }
const postLookups = ref<Record<string, DocsLookup>>({})
const nickLookups = ref<Record<string, DocsLookup>>({})
const nickCounts = ref<Record<string, { state: LookupState; total: number; at: number }>>({})
const lookupRuns = new Map<string, Promise<void>>()
// Chưa có composite index (threadsNick, createdAt) → nhớ lại, lần sau dùng thẳng truy vấn không sắp xếp
let nickOrderIndexMissing = false

const isFresh = (entry: { state: LookupState; at: number } | undefined, maxAgeMs: number) =>
  !!entry && entry.state === 'done' && Date.now() - entry.at < maxAgeMs
const toReport = (d: any) => ({ id: d.id, ...d.data() })
// Cùng 1 khóa đang tra → dùng chung lần tra đó (nhiều đơn cùng bài / cùng nick không bắn nhiều truy vấn)
const runOnce = (key: string, task: () => Promise<void>) => {
  const running = lookupRuns.get(key)
  if (running) return running
  const run = task().finally(() => lookupRuns.delete(key))
  lookupRuns.set(key, run)
  return run
}

// Mọi đơn (mọi user, mọi trạng thái) của 1 bài viết — khóa là link /share/ thì các đơn lưu cùng đúng link chia sẻ đó
const ensurePostLookup = (code: string, maxAgeMs = CHECK_TTL_MS): Promise<void> => {
  if (!code || isFresh(postLookups.value[code], maxAgeMs)) return Promise.resolve()
  return runOnce(`post:${code}`, async () => {
    const prev = postLookups.value[code]
    postLookups.value[code] = { docs: prev?.docs ?? [], at: prev?.at ?? 0, partial: prev?.partial ?? false, state: 'loading' }
    try {
      const field = isThreadsShareKey(code) ? 'threadsPostUrl' : 'threadsPostCode'
      const snap = await getDocs(query(collection(db, 'reports'), where(field, '==', code), limit(POST_LOOKUP_LIMIT)))
      postLookups.value[code] = { state: 'done', docs: snap.docs.map(toReport), at: Date.now(), partial: snap.size >= POST_LOOKUP_LIMIT }
    } catch (e) {
      console.error('[Duyệt Threads – Seeding] Lỗi tra đơn cùng bài Threads:', e)
      postLookups.value[code] = { docs: prev?.docs ?? [], at: Date.now(), partial: prev?.partial ?? false, state: 'error' }
    }
  })
}

// Các đơn (cả 2 job) có cùng nick — tối đa NICK_LOOKUP_LIMIT đơn, mới nhất trước nếu có index
const ensureNickDocs = (nick: string, maxAgeMs = CHECK_TTL_MS): Promise<void> => {
  if (!nick || isFresh(nickLookups.value[nick], maxAgeMs)) return Promise.resolve()
  return runOnce(`nick:${nick}`, async () => {
    const prev = nickLookups.value[nick]
    nickLookups.value[nick] = { docs: prev?.docs ?? [], at: prev?.at ?? 0, partial: prev?.partial ?? false, state: 'loading' }
    const reportsCol = collection(db, 'reports')
    const unordered = query(reportsCol, where('threadsNick', '==', nick), limit(NICK_LOOKUP_LIMIT))
    try {
      let snap: QuerySnapshot
      if (nickOrderIndexMissing) snap = await getDocs(unordered)
      else {
        try {
          snap = await getDocs(query(reportsCol, where('threadsNick', '==', nick), orderBy('createdAt', 'desc'), limit(NICK_LOOKUP_LIMIT)))
        } catch (e: any) {
          if (e?.code !== 'failed-precondition') throw e
          nickOrderIndexMissing = true
          console.warn('[Duyệt Threads – Seeding] Chưa có composite index (threadsNick, createdAt) — dùng truy vấn không sắp xếp:', e.message)
          snap = await getDocs(unordered)
        }
      }
      nickLookups.value[nick] = { state: 'done', docs: snap.docs.map(toReport), at: Date.now(), partial: snap.size >= NICK_LOOKUP_LIMIT }
    } catch (e) {
      console.error('[Duyệt Threads – Seeding] Lỗi tra đơn cùng nick Threads:', e)
      nickLookups.value[nick] = { docs: prev?.docs ?? [], at: Date.now(), partial: prev?.partial ?? false, state: 'error' }
    }
  })
}

// Tổng số đơn có nick này (aggregation count — khoảng 1 lượt đọc, không tải đơn) để badge TRÙNG NICK hiện ngay khi mở tab
const ensureNickCount = (nick: string, maxAgeMs = Number.POSITIVE_INFINITY): Promise<void> => {
  if (!nick || isFresh(nickCounts.value[nick], maxAgeMs)) return Promise.resolve()
  return runOnce(`nick-count:${nick}`, async () => {
    const prev = nickCounts.value[nick]
    nickCounts.value[nick] = { total: prev?.total ?? 0, at: prev?.at ?? 0, state: 'loading' }
    try {
      const snap = await getCountFromServer(query(collection(db, 'reports'), where('threadsNick', '==', nick)))
      nickCounts.value[nick] = { state: 'done', total: snap.data().count, at: Date.now() }
    } catch (e) {
      console.error('[Duyệt Threads – Seeding] Lỗi đếm đơn cùng nick Threads:', e)
      nickCounts.value[nick] = { total: prev?.total ?? 0, at: Date.now(), state: 'error' }
    }
  })
}

// Đối chiếu đầy đủ 1 đơn: ảnh trùng file (theo đơn) + đơn cùng bài + đơn cùng nick (theo khóa, dùng chung giữa các đơn)
type CheckResult = { state: 'loading' | 'done' | 'error'; duplicates: any[]; checkedAt: number }
const checks = ref<Record<string, CheckResult>>({})
const checkRuns = new Map<string, Promise<CheckResult>>()

const runCheck = async (r: any, maxAgeMs: number): Promise<CheckResult> => {
  const hashes = (Array.isArray(r.proofImageHashes) ? r.proofImageHashes : []).filter(Boolean).slice(0, 10)
  const nick = nickKey(r)
  let hashFailed = false
  const [dupSnap] = await Promise.all([
    hashes.length
      ? getDocs(query(collection(db, 'reports'), where('proofImageHashes', 'array-contains-any', hashes), limit(20))).catch((e: any) => {
          console.error('[Duyệt Threads – Seeding] Lỗi tra ảnh trùng:', e)
          hashFailed = true
          return null
        })
      : Promise.resolve(null),
    ensurePostLookup(postKey(r), maxAgeMs),
    ensureNickDocs(nick, maxAgeMs),
    ensureNickCount(nick, maxAgeMs),
  ])
  const duplicates = (dupSnap?.docs || []).filter(d => d.id !== r.id).map(toReport)
  return { state: hashFailed ? 'error' : 'done', duplicates, checkedAt: Date.now() }
}

const ensureCheck = (r: any, force = false): Promise<CheckResult> => {
  const running = checkRuns.get(r.id)
  if (running) return running
  const cached = checks.value[r.id]
  if (!force && cached && cached.state !== 'loading' && Date.now() - cached.checkedAt < CHECK_TTL_MS) return Promise.resolve(cached)
  checks.value[r.id] = { duplicates: cached?.duplicates ?? [], checkedAt: cached?.checkedAt ?? 0, state: 'loading' }
  const run = runCheck(r, force ? 0 : CHECK_TTL_MS)
    .catch((e: any): CheckResult => {
      console.error('[Duyệt Threads – Seeding] Lỗi đối chiếu:', e)
      return { state: 'error', duplicates: [], checkedAt: Date.now() }
    })
    .then(result => { checks.value[r.id] = result; checkRuns.delete(r.id); return result })
  checkRuns.set(r.id, run)
  return run
}

// Đơn đang tải (realtime) gom theo bài / nick / file ảnh — cảnh báo tức thì, không tốn lượt đọc
const groupReports = (keysOf: (r: any) => string[]) => computed(() => {
  const map = new Map<string, any[]>()
  for (const r of allDocs.value) {
    for (const key of keysOf(r)) {
      if (!key) continue
      const list = map.get(key)
      if (list) list.push(r)
      else map.set(key, [r])
    }
  }
  return map
})
const localByPost = groupReports(r => [postKey(r)])
const localByNick = groupReports(r => [nickKey(r)])
const localByHash = groupReports(r => (Array.isArray(r.proofImageHashes) ? r.proofImageHashes : []).map(String))

// Gộp đơn từ nhiều nguồn (kết quả tra + đơn đang tải realtime), mỗi đơn 1 bản — giữ bản có trạng thái "tiến xa" hơn, hòa thì lấy
// bản ở nguồn sau (đơn đang tải)
const mergeReports = (...lists: (any[] | undefined)[]) => {
  const map = new Map<string, any>()
  for (const list of lists) {
    for (const x of list || []) {
      const cur = map.get(x.id)
      if (!cur || statusRank(x.status) >= statusRank(cur.status)) map.set(x.id, x)
    }
  }
  return [...map.values()].sort(byNewest)
}

type DupTab = 'link' | 'nick' | 'image'
type DupInfo = {
  code: string
  // Link /share/ chưa phân giải được bài gốc: chỉ so được với đơn cùng link chia sẻ → luôn cần Admin kiểm tra thủ công
  shareLink: boolean
  nick: string
  linkReports: any[]
  nickReports: any[]
  // Số đơn khác cùng nick: đếm trên server nếu có, không thì số đơn đã biết
  nickOther: number
  nickOtherAccounts: number
  nickPartial: boolean
  imageDups: any[]
  approvedSamePost: any[]
  approvedUnits: number
  approvedXu: number
  crossAccount: any[]
  proofReasons: string[]
  errors: string[]
  loading: boolean
  checked: boolean
  // Trùng link / nguy cơ trùng bằng chứng / chưa tra được → Admin phải kiểm tra trước khi duyệt
  needsReview: boolean
  // Dấu vân tay các cảnh báo — có đơn liên quan mới hoặc đơn liên quan đổi trạng thái thì lần "Đã kiểm tra" trước hết hiệu lực
  signature: string
}

const computeDupInfo = (r: any): DupInfo => {
  const meta = jobMeta(r.jobId)
  const code = postKey(r)
  const shareLink = isThreadsShareKey(code)
  const nick = nickKey(r)
  const check = checks.value[r.id]
  const postLookup = code ? postLookups.value[code] : undefined
  const nickLookup = nick ? nickLookups.value[nick] : undefined
  const nickCount = nick ? nickCounts.value[nick] : undefined
  const notSelf = (x: any) => x.id !== r.id

  const linkReports = code ? mergeReports(postLookup?.docs, localByPost.value.get(code)).filter(notSelf) : []
  const nickReports = nick ? mergeReports(nickLookup?.docs, localByNick.value.get(nick)).filter(notSelf) : []
  const nickOther = Math.max(nickReports.length, nickCount?.state === 'done' ? nickCount.total - 1 : 0)
  const nickOtherAccounts = new Set(nickReports.map(x => x.uid).filter(uid => uid && uid !== r.uid)).size
  const hashes: any[] = Array.isArray(r.proofImageHashes) ? r.proofImageHashes : []
  const imageDups = mergeReports(check?.duplicates, hashes.flatMap(h => localByHash.value.get(String(h)) || [])).filter(notSelf)

  const approvedSamePost = linkReports.filter(x => statusGroup(x.status) === 'approved')
  const approvedUnits = approvedSamePost.reduce((sum, x) => sum + (Number(x.verifiedCommentCount) || 0), 0)
  const approvedXu = approvedSamePost.reduce((sum, x) => sum + creditedXuOf(x), 0)
  // Cùng nick + cùng công việc nhưng ở tài khoản Rạp Job khác (đơn chưa bị từ chối) — 1 tương tác có thể bị nhận thưởng 2 lần
  const crossAccount = nickReports.filter(x => x.jobId === r.jobId && x.uid && x.uid !== r.uid && statusGroup(x.status) !== 'rejected')

  const proofReasons: string[] = []
  if (approvedSamePost.length) {
    const declared = declaredOf(r)
    proofReasons.push(`Bài này đã được duyệt ${approvedSamePost.length} đợt: ${fmtXu(approvedUnits)} ${meta.unit}, đã cộng ${fmtXu(approvedXu)} xu`
      + (declared ? ` — đơn này khai báo thêm ${fmtXu(declared)} ${meta.unit}, cần đối chiếu có trùng ${meta.unit} đã tính không.` : '.'))
  }
  if (crossAccount.length) {
    const accounts = new Set(crossAccount.map(x => x.uid)).size
    proofReasons.push(`Nick @${nick} còn có ở ${crossAccount.length} đơn ${meta.label} của ${accounts} tài khoản khác.`)
  }
  if (imageDups.length) proofReasons.push(`Ảnh bằng chứng trùng file gốc với ${imageDups.length} đơn khác.`)

  const errors: string[] = []
  if (r.jobId === THREADS_SEEDING_JOB_ID && !code) errors.push('Đơn thiếu link / mã bài viết — không đối chiếu được trùng link.')
  if (shareLink) errors.push('Link chia sẻ /share/ chưa xác định được bài gốc — chỉ so được với đơn cùng link chia sẻ này. Mở link, đối chiếu thủ công.')
  if (postLookup?.state === 'error') errors.push('Không tra được các đơn cùng bài Threads — kiểm tra thủ công.')
  if (nickLookup?.state === 'error') errors.push('Không tra được các đơn cùng nick Threads — kiểm tra thủ công.')
  if (check?.state === 'error') errors.push('Không tra được ảnh trùng — kiểm tra thủ công.')

  const ids = (list: any[]) => list.map(x => x.id).sort().join(',')
  return {
    code, shareLink, nick, linkReports, nickReports, nickOther, nickOtherAccounts, nickPartial: !!nickLookup?.partial,
    imageDups, approvedSamePost, approvedUnits, approvedXu, crossAccount, proofReasons, errors,
    loading: check?.state === 'loading' || postLookup?.state === 'loading' || nickLookup?.state === 'loading',
    checked: !!check && check.state !== 'loading',
    needsReview: linkReports.length > 0 || proofReasons.length > 0 || errors.length > 0,
    signature: [ids(linkReports), `${approvedUnits}/${approvedXu}`, ids(crossAccount), ids(imageDups), errors.length].join('|'),
  }
}
// Tính 1 lần cho mọi đơn đang hiển thị (badge, thanh thao tác, duyệt hàng loạt dùng chung)
const dupInfoMap = computed(() => new Map(visibleReports.value.map(r => [r.id, computeDupInfo(r)] as const)))
const dupOf = (r: any): DupInfo => dupInfoMap.value.get(r.id) ?? computeDupInfo(r)

// "Đã kiểm tra" do Admin đánh dấu từng đơn (chỉ trong phiên này, không ghi lên đơn), kèm dấu vân tay cảnh báo lúc đánh dấu
const reviewed = ref<Record<string, { sig: string; at: number }>>({})
const isReviewed = (r: any) => {
  const mark = reviewed.value[r.id]
  return !!mark && mark.sig === dupOf(r).signature
}
const canMarkReviewed = (r: any) => {
  const info = dupOf(r)
  return r.status === 'pending' && info.needsReview && info.checked && !info.loading
}
const markReviewed = (r: any) => { if (canMarkReviewed(r)) reviewed.value[r.id] = { sig: dupOf(r).signature, at: Date.now() } }
const unmarkReviewed = (r: any) => { delete reviewed.value[r.id] }
// Còn cảnh báo trùng link / bằng chứng mà Admin chưa kiểm tra → duyệt lẻ phải tick xác nhận, duyệt hàng loạt bỏ qua
const needsAttention = (r: any) => dupOf(r).needsReview && !isReviewed(r)

// Badge cảnh báo trên từng đơn — bấm để mở chi tiết ở đúng danh sách đơn liên quan
type DupBadge = { key: string; text: string; cls: string; tab: DupTab | null }
const BADGE_CLASS = {
  red: 'bg-red-600 border-red-600 text-white',
  orange: 'bg-orange-50 border-orange-300 text-orange-700',
  orangeStrong: 'bg-orange-500 border-orange-500 text-white',
  amber: 'bg-amber-300 border-amber-400 text-amber-950',
  green: 'bg-emerald-600 border-emerald-600 text-white',
  okSoft: 'bg-emerald-50 border-emerald-200 text-[var(--admin-success)]',
  muted: 'bg-slate-100 border-slate-200 text-slate-500',
}
const proofTab = (info: DupInfo): DupTab =>
  info.approvedSamePost.length || info.linkReports.length ? 'link' : info.crossAccount.length ? 'nick' : info.imageDups.length ? 'image' : 'nick'
const buildBadges = (r: any): DupBadge[] => {
  const info = dupOf(r)
  const badges: DupBadge[] = []
  if (info.linkReports.length) badges.push({ key: 'link', text: `🔴 TRÙNG LINK (${info.linkReports.length} đơn)`, cls: BADGE_CLASS.red, tab: 'link' })
  if (info.nickOther > 0) {
    badges.push({
      key: 'nick',
      text: `🟠 TRÙNG NICK (${info.nickOther} đơn${info.nickOtherAccounts ? ` · ${info.nickOtherAccounts} TK KHÁC` : ''})`,
      cls: info.nickOtherAccounts ? BADGE_CLASS.orangeStrong : BADGE_CLASS.orange,
      tab: 'nick',
    })
  }
  if (info.proofReasons.length) badges.push({ key: 'proof', text: '⚠️ CẦN KIỂM TRA BẰNG CHỨNG', cls: BADGE_CLASS.amber, tab: proofTab(info) })
  if (info.errors.length) badges.push({ key: 'error', text: '⚠️ KIỂM TRA THỦ CÔNG', cls: BADGE_CLASS.red, tab: proofTab(info) })
  if (info.needsReview && isReviewed(r)) badges.push({ key: 'reviewed', text: '✓ ĐÃ KIỂM TRA', cls: BADGE_CLASS.green, tab: proofTab(info) })
  if (!badges.length && info.loading) badges.push({ key: 'loading', text: '⏳ ĐANG TRA TRÙNG…', cls: BADGE_CLASS.muted, tab: null })
  else if (!badges.length && info.checked) badges.push({ key: 'ok', text: '✓ CHƯA THẤY TRÙNG', cls: BADGE_CLASS.okSoft, tab: null })
  return badges
}
const badgeMap = computed(() => new Map(visibleReports.value.map(r => [r.id, buildBadges(r)] as const)))
const rowBadges = (r: any) => badgeMap.value.get(r.id) ?? buildBadges(r)
const visibleFlagged = computed(() => visiblePending.value.filter(r => dupOf(r).needsReview))
const visibleFlaggedOpen = computed(() => visibleFlagged.value.filter(r => !isReviewed(r)).length)

// Tab đang mở → tra sẵn (mỗi khóa 1 lần) đơn cùng bài của các đơn SEEDING đang chờ + đếm đơn cùng nick, để badge hiện ngay.
// Tab ẩn thì không tra (Admin không mở tab này thì không tốn lượt đọc).
const prefetchTargets = computed(() => {
  const posts = new Set<string>()
  const nicks = new Set<string>()
  for (const r of sourceDocs.value.pending) {
    if (!siteOk(r)) continue
    const code = postKey(r)
    const nick = nickKey(r)
    if (code) posts.add(code)
    if (nick) nicks.add(nick)
  }
  return { posts: [...posts].sort(), nicks: [...nicks].sort() }
})
const missingPrefetch = () => ({
  posts: prefetchTargets.value.posts.filter(code => !postLookups.value[code]),
  nicks: prefetchTargets.value.nicks.filter(nick => !nickCounts.value[nick]),
})
let prefetching = false
const prefetchLookups = async () => {
  if (prefetching || !props.active) return
  const missing = missingPrefetch()
  if (!missing.posts.length && !missing.nicks.length) return
  prefetching = true
  try {
    const tasks: (() => Promise<void>)[] = [
      ...missing.posts.map(code => () => ensurePostLookup(code, Number.POSITIVE_INFINITY)),
      ...missing.nicks.map(nick => () => ensureNickCount(nick)),
    ]
    await runPool(tasks, PREFETCH_CONCURRENCY, task => task())
  } finally {
    prefetching = false
  }
  // Có đơn mới trong lúc đang tra → tra tiếp phần còn thiếu (khóa đã tra, kể cả lỗi, không tra lại ở đây)
  prefetchLookups()
}
watch(() => [props.active, ...prefetchTargets.value.posts, '|', ...prefetchTargets.value.nicks].join('\n'), () => { prefetchLookups() }, { immediate: true })

// Đơn vừa duyệt / từ chối ở tab này → sửa luôn bản đã tra (cảnh báo của các đơn liên quan cập nhật ngay, không chờ tra lại)
const patchKnownReport = (id: string, patch: Record<string, any>) => {
  const patchList = (list: any[]) => list.some(x => x.id === id) ? list.map(x => x.id === id ? { ...x, ...patch } : x) : list
  for (const store of [postLookups, nickLookups]) {
    for (const [key, entry] of Object.entries(store.value)) {
      const docs = patchList(entry.docs)
      if (docs !== entry.docs) store.value[key] = { ...entry, docs }
    }
  }
  for (const [key, entry] of Object.entries(checks.value)) {
    const duplicates = patchList(entry.duplicates)
    if (duplicates !== entry.duplicates) checks.value[key] = { ...entry, duplicates }
  }
  if (detailSnapshot.value?.id === id) detailSnapshot.value = { ...detailSnapshot.value, ...patch }
  detailBack.value = detailBack.value.map(b => b.r.id === id ? { ...b, r: { ...b.r, ...patch } } : b)
}

// ============================================================================
// CỘNG XU 1 ĐƠN — transaction: đọc lại đơn, chỉ cộng khi đơn vẫn 'pending' và đúng 2 job này; cộng ví bằng increment()
// ============================================================================
type CreditCode = 'ok' | 'skipped' | 'no_wallet' | 'invalid' | 'error'
type CreditResult = { code: CreditCode; uid: string; amount: number; message: string }

const creditReport = async (r: any, count: number, rate: number): Promise<CreditResult> => {
  const amount = count * rate
  let uid = effUid(r)
  try {
    const outcome = await runTransaction(db, async (tx): Promise<{ code: CreditCode; message: string }> => {
      const reportRef = doc(db, 'reports', r.id)
      const snap = await tx.get(reportRef)
      if (!snap.exists()) return { code: 'skipped', message: 'Đơn không còn tồn tại' }
      const data = snap.data()
      // Đã duyệt / từ chối ở nơi khác (Admin khác, tab JOB KHÁC, lần bấm trước) → không cộng thêm lần nào nữa
      if (data.status !== 'pending') return { code: 'skipped', message: 'Đơn đã được xử lý trước đó' }
      if (!COUNT_JOB_IDS.includes(data.jobId)) return { code: 'invalid', message: 'Đơn không thuộc Bình luận dạo / Đăng bài Threads – Seeding' }
      // Đối chiếu lại số hợp lệ với số khai báo trên bản mới nhất từ server
      const declared = declaredOf(data)
      if (declared > 0 && count > declared) return { code: 'invalid', message: `Số hợp lệ vượt số user khai báo (${declared})` }
      uid = effUid(data)
      if (!uid) return { code: 'no_wallet', message: 'Đơn thiếu UID người dùng' }
      const userRef = doc(db, 'users', uid)
      const userSnap = await tx.get(userRef)
      if (!userSnap.exists()) return { code: 'no_wallet', message: 'User chưa có hồ sơ ví' }
      tx.update(userRef, { balance: increment(amount) })
      tx.update(reportRef, {
        status: 'approved',
        actualReward: amount,
        reward: amount,
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.email || auth.currentUser?.uid || null,
        verifiedCommentCount: count,
        rewardPerComment: rate,
      })
      return { code: 'ok', message: '' }
    })
    return { ...outcome, uid, amount }
  } catch (e: any) {
    console.error('[Duyệt Threads – Seeding] Lỗi cộng xu đơn', r.id, e)
    return { code: 'error', uid, amount, message: e?.message || String(e) }
  }
}

const afterCredited = (r: any, res: CreditResult, count: number) => {
  delete drafts.value[r.id]
  selectedIds.value = selectedIds.value.filter(id => id !== r.id)
  // Đơn cùng bài / cùng nick thấy ngay số lượt + xu vừa duyệt trong cảnh báo của mình
  patchKnownReport(r.id, { status: 'approved', verifiedCommentCount: count, actualReward: res.amount, reward: res.amount, approvedAt: new Date() })
  emit('approved', { report: r, uid: res.uid, amount: res.amount })
}

// ============================================================================
// POPUP TIẾN ĐỘ (SweetAlert2) — thanh % + số đơn đã xử lý
// ============================================================================
const openProgress = (title: string, total: number) => {
  Swal.fire({
    title,
    html: `<div style="font-size:13px">
      <div style="height:10px;border-radius:9999px;background:#e2e8f0;overflow:hidden"><div id="tcp-bar" style="height:100%;width:0;background:#7c3aed;transition:width .2s"></div></div>
      <p id="tcp-text" style="margin-top:8px;font-weight:700;color:#334155">0/${total}</p>
    </div>`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
  })
}
const setProgress = (done: number, total: number, detail = '') => {
  const box = Swal.getHtmlContainer()
  const bar = box?.querySelector<HTMLElement>('#tcp-bar')
  const text = box?.querySelector<HTMLElement>('#tcp-text')
  if (bar) bar.style.width = `${total ? Math.round((done / total) * 100) : 100}%`
  if (text) text.textContent = `${done}/${total}${detail ? ` · ${detail}` : ''}`
}

// Nội dung cảnh báo trùng trong popup SweetAlert2 (đã escape)
const swalBox = (bg: string, border: string, color: string, html: string) =>
  `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:${bg};border:1px solid ${border};color:${color};font-weight:700">${html}</div>`
const dupWarningsHtml = (r: any, info: DupInfo) => {
  const parts: string[] = []
  if (info.linkReports.length) parts.push(swalBox('#fef2f2', '#fecaca', '#b91c1c', `🔴 TRÙNG LINK THREADS — ĐÃ CÓ ${info.linkReports.length} ĐƠN`))
  if (info.proofReasons.length) {
    parts.push(swalBox('#fffbeb', '#fcd34d', '#92400e', `⚠️ CÓ NGUY CƠ GỬI TRÙNG BẰNG CHỨNG
      <ul style="margin:4px 0 0 18px;list-style:disc;font-weight:600">${info.proofReasons.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`))
  }
  info.errors.forEach(e => parts.push(swalBox('#fef2f2', '#fecaca', '#b91c1c', `⚠️ ${escapeHtml(e)}`)))
  if (info.nickOther) {
    parts.push(swalBox('#fff7ed', '#fed7aa', '#c2410c', `🟠 TRÙNG NICK @${escapeHtml(info.nick)} — ${info.nickOther} ĐƠN KHÁC${info.nickOtherAccounts ? ` · ${info.nickOtherAccounts} tài khoản khác` : ' (cùng tài khoản này)'}
      <span style="font-weight:600">— chỉ để tham khảo</span>`))
  }
  if (!parts.length) parts.push('<div style="margin-top:8px;color:#047857;font-weight:700">✓ Chưa thấy trùng link, nick hoặc ảnh bằng chứng.</div>')
  const mark = reviewed.value[r.id]
  if (info.needsReview && mark && isReviewed(r)) parts.push(swalBox('#ecfdf5', '#a7f3d0', '#047857', `✓ Admin đã đánh dấu kiểm tra lúc ${escapeHtml(formatDate(mark.at))}`))
  return parts.join('')
}
// Bảng rút gọn các đơn liên quan (cùng bài / cùng nick ở tài khoản khác / ảnh trùng) — xem đủ trong CHI TIẾT
const jobShort = (jobId: any) => jobId === THREADS_SEEDING_JOB_ID ? '📣 Seeding' : jobId === THREADS_COMMENT_JOB_ID ? '💬 Bình luận dạo' : String(jobId || '—')
const relatedTableHtml = (info: DupInfo) => {
  const rows = mergeReports(info.linkReports, info.crossAccount, info.imageDups)
  if (!rows.length) return ''
  const shown = rows.slice(0, 8)
  const cell = 'padding:4px 6px;white-space:nowrap'
  return `<div style="margin-top:8px;overflow-x:auto"><table style="width:100%;font-size:11px;border-collapse:collapse">
    <thead><tr style="text-align:left;color:#64748b"><th style="${cell}">Gửi lúc</th><th style="${cell}">UID</th><th style="${cell}">Nick</th><th style="${cell}">Công việc</th><th style="${cell}">Trạng thái</th><th style="${cell};text-align:right">Xu đã duyệt</th></tr></thead>
    <tbody>${shown.map(x => `<tr style="border-top:1px solid #e2e8f0">
      <td style="${cell}">${escapeHtml(formatDate(x.createdAt))}</td>
      <td style="${cell}">${escapeHtml(shortId(x.uid))}</td>
      <td style="${cell}">${nickKey(x) ? '@' + escapeHtml(nickKey(x)) : '—'}</td>
      <td style="${cell}">${escapeHtml(jobShort(x.jobId))}</td>
      <td style="${cell}">${escapeHtml(statusText(x.status))}</td>
      <td style="${cell};text-align:right">${creditedXuOf(x) ? '+' + fmtXu(creditedXuOf(x)) : '—'}</td></tr>`).join('')}</tbody></table>
    ${rows.length > shown.length ? `<p style="margin-top:4px;color:#64748b">… và ${rows.length - shown.length} đơn khác — xem đủ trong CHI TIẾT.</p>` : ''}</div>`
}
const ACK_CHECKBOX_HTML = `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;padding:8px 10px;border-radius:10px;background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;font-weight:700;cursor:pointer">
  <input id="tc-ack" type="checkbox" style="margin-top:3px;width:16px;height:16px" />
  <span>Tôi đã mở và đối chiếu các đơn liên quan (link bài, nick, ảnh, số lượt đã tính) — vẫn duyệt đơn này.</span></label>`
// Lý do ngắn nhất để liệt kê đơn có cảnh báo trong popup duyệt hàng loạt
const warningSummary = (r: any) => {
  const info = dupOf(r)
  if (info.linkReports.length) return `Trùng link (${info.linkReports.length} đơn)${info.approvedSamePost.length ? ` · bài đã duyệt ${fmtXu(info.approvedUnits)} ${jobMeta(r.jobId).unit}` : ''}`
  return info.proofReasons[0] || info.errors[0] || ''
}

// ============================================================================
// DUYỆT LẺ — dùng số hợp lệ đã nhập; chưa nhập thì mở chi tiết để Admin xem bằng chứng và nhập số
// ============================================================================
const approveOne = async (r: any) => {
  if (busy.value || isProcessing(r.id) || r.status !== 'pending') return
  const count = draftCount(r)
  if (count == null) { openDetail(r, true); return }
  if (!props.ratesReady) { Swal.fire('CHƯA SẴN SÀNG', 'Đang tải cấu hình mức thưởng, vui lòng thử lại sau vài giây.', 'info'); return }
  const rate = rateOf(r.jobId)
  if (rate <= 0) { Swal.fire('LỖI!', `Job ${jobMeta(r.jobId).label} chưa có mức thưởng trong cấu hình (jobs.ts hoặc CẤU HÌNH JOB VIP).`, 'error'); return }

  processingIds.value.add(r.id)
  try {
    // Bật loading ngay, không qua didOpen: SweetAlert2 gọi didOpen bằng setTimeout, mà đơn đã đối chiếu sẵn lúc nhập số / mở chi
    // tiết thì ensureCheck xong ngay → popup xác nhận mở trước, showLoading tới muộn rơi vào nó và ẩn mất nút DUYỆT & CỘNG XU
    Swal.fire({ title: 'ĐANG ĐỐI CHIẾU TRÙNG LẶP...', allowOutsideClick: false })
    Swal.showLoading()
    await ensureCheck(r)
    const info = dupOf(r)
    // Trùng link / nguy cơ trùng bằng chứng / chưa tra được mà Admin chưa đánh dấu kiểm tra → bắt buộc tick xác nhận mới duyệt
    const gate = needsAttention(r)
    const meta = jobMeta(r.jobId)
    const declared = declaredOf(r)
    const amount = count * rate
    const { isConfirmed } = await Swal.fire({
      title: gate ? '⚠️ ĐƠN CÓ CẢNH BÁO TRÙNG' : 'DUYỆT & CỘNG XU?',
      icon: gate ? 'warning' : 'question',
      // Rộng hơn để bảng đơn liên quan đủ cột (điện thoại vẫn co theo màn hình)
      ...(gate ? { width: '44em' } : {}),
      html: `
        <div style="text-align:left;font-size:13px;line-height:1.75">
          <b>Công việc:</b> ${escapeHtml(meta.label)}<br/>
          <b>Người dùng:</b> ${escapeHtml(displayName(r))}<br/>
          <b>UID:</b> ${escapeHtml(effUid(r) || '—')}<br/>
          ${info.nick ? `<b>Nick Threads:</b> @${escapeHtml(info.nick)}<br/>` : ''}
          <b>User khai báo:</b> ${declared ? `${fmtXu(declared)} ${meta.unit}` : '— (đơn thiếu số khai báo)'}<br/>
          <b>Admin xác nhận hợp lệ:</b> ${fmtXu(count)} ${meta.unit}
          <div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-weight:800;font-size:15px">${fmtXu(count)} × ${fmtXu(rate)} = +${fmtXu(amount)} XU</div>
          ${dupWarningsHtml(r, info)}
          ${gate ? relatedTableHtml(info) + ACK_CHECKBOX_HTML : ''}
        </div>`,
      showCancelButton: true,
      confirmButtonText: gate ? `ĐÃ KIỂM TRA — DUYỆT & CỘNG ${fmtXu(amount)} XU` : `DUYỆT & CỘNG ${fmtXu(amount)} XU`,
      confirmButtonColor: '#059669',
      cancelButtonText: 'HỦY',
      focusCancel: gate,
      preConfirm: () => {
        if (gate && !Swal.getHtmlContainer()?.querySelector<HTMLInputElement>('#tc-ack')?.checked) {
          Swal.showValidationMessage('Tick ô xác nhận đã kiểm tra các đơn liên quan trước khi duyệt.')
          return false
        }
        return true
      },
    })
    if (!isConfirmed) return
    if (gate) markReviewed(r)

    Swal.fire({ title: 'ĐANG CỘNG XU...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    const res = await creditReport(r, count, rate)
    if (res.code === 'ok') {
      afterCredited(r, res, count)
      if (detailId.value === r.id) closeDetail()
      Swal.fire({ icon: 'success', title: 'ĐÃ CỘNG XU!', text: `+${fmtXu(res.amount)} XU — ${fmtXu(count)} ${meta.unit} hợp lệ`, timer: 1600, showConfirmButton: false })
    } else if (res.code === 'skipped') {
      if (detailId.value === r.id) closeDetail()
      Swal.fire('KHÔNG CỘNG THÊM XU', `${res.message}.`, 'info')
    } else {
      Swal.fire('KHÔNG CỘNG ĐƯỢC XU', res.message, 'error')
    }
  } finally {
    processingIds.value.delete(r.id)
  }
}

// ============================================================================
// DUYỆT HÀNG LOẠT — chỉ đơn chờ đã nhập số hợp lệ; đơn chưa nhập bị bỏ qua. Đối chiếu trùng lặp trước, xác nhận tổng đơn + tổng xu,
// rồi cộng từng đơn bằng transaction (đơn cùng 1 user chạy lần lượt, các user khác song song tối đa APPROVE_CONCURRENCY).
// ============================================================================
type PlanItem = { r: any; count: number; rate: number }
const planBreakdownHtml = (plan: PlanItem[]) => COUNT_JOB_IDS.map(jobId => {
  const items = plan.filter(p => p.r.jobId === jobId)
  if (!items.length) return ''
  const meta = jobMeta(jobId)
  const units = items.reduce((sum, p) => sum + p.count, 0)
  const xu = items.reduce((sum, p) => sum + p.count * p.rate, 0)
  return `<div>${meta.icon} <b>${escapeHtml(meta.label)}</b>: ${items.length} đơn · ${fmtXu(units)} ${meta.unit} hợp lệ · <b>${fmtXu(xu)} xu</b></div>`
}).join('')

// Danh sách đơn kèm lý do cảnh báo (tối đa 6 dòng) trong popup duyệt hàng loạt
const warningListHtml = (list: any[]) => `<ul style="margin:4px 0 6px 18px;list-style:disc">
  ${list.slice(0, 6).map(r => `<li>${escapeHtml(displayName(r))} · ${escapeHtml(shortId(r.id))}: ${escapeHtml(warningSummary(r))}</li>`).join('')}
  ${list.length > 6 ? `<li>… và ${list.length - 6} đơn khác</li>` : ''}
</ul>`
const blockedHtml = (blocked: any[]) => blocked.length ? `
  <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c">
    <b>⚠️ Bỏ qua ${blocked.length} đơn có cảnh báo trùng chưa được kiểm tra:</b>
    ${warningListHtml(blocked)}
    <span style="font-weight:600">Mở CHI TIẾT từng đơn, đối chiếu các đơn liên quan rồi bấm "TÔI ĐÃ KIỂM TRA" (hoặc duyệt lẻ có hộp xác nhận).</span>
  </div>` : ''

const confirmBulkApprove = async (plan: PlanItem[], notReadyCount: number, blocked: any[], reviewedFlagged: any[]): Promise<boolean> => {
  const xu = plan.reduce((sum, p) => sum + p.count * p.rate, 0)
  const notReadyHtml = notReadyCount
    ? `<div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#b45309">Bỏ qua <b>${notReadyCount}</b> đơn chưa nhập (hoặc nhập sai) số hợp lệ.</div>`
    : ''
  const reviewedHtml = reviewedFlagged.length ? `
    <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857">
      <b>✓ ${reviewedFlagged.length} đơn có cảnh báo đã được Admin đánh dấu kiểm tra — sẽ duyệt:</b>
      ${warningListHtml(reviewedFlagged)}
    </div>` : ''
  const result = await Swal.fire({
    title: 'DUYỆT HÀNG LOẠT',
    icon: blocked.length ? 'warning' : 'question',
    html: `
      <div style="text-align:left;font-size:13px;line-height:1.7">
        <p id="tcb-question" style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px">Bạn có chắc muốn duyệt ${plan.length} đơn và cộng tổng ${fmtXu(xu)} xu?</p>
        <div id="tcb-breakdown" style="color:#334155">${planBreakdownHtml(plan)}</div>
        ${notReadyHtml}
        ${blockedHtml(blocked)}
        ${reviewedHtml}
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'DUYỆT & CỘNG XU ✅',
    confirmButtonColor: '#059669',
    cancelButtonText: 'HỦY',
  })
  return result.isConfirmed
}

const processApprovals = async (plan: PlanItem[]) => {
  // Gom theo ví nhận xu: đơn cùng 1 user chạy lần lượt (tránh tranh chấp transaction trên cùng users/{uid})
  const groups = new Map<string, PlanItem[]>()
  for (const p of plan) {
    const key = effUid(p.r) || p.r.id
    const list = groups.get(key)
    if (list) list.push(p)
    else groups.set(key, [p])
  }
  const total = plan.length
  const tally = { ok: 0, skipped: 0, failed: 0, xu: 0 }
  const failures: string[] = []
  let done = 0
  plan.forEach(p => processingIds.value.add(p.r.id))
  openProgress('ĐANG DUYỆT & CỘNG XU...', total)
  try {
    await runPool([...groups.values()], APPROVE_CONCURRENCY, async (items) => {
      for (const p of items) {
        const res = await creditReport(p.r, p.count, p.rate)
        processingIds.value.delete(p.r.id)
        if (res.code === 'ok') { tally.ok++; tally.xu += res.amount; afterCredited(p.r, res, p.count) }
        else if (res.code === 'skipped') tally.skipped++
        else { tally.failed++; failures.push(`${displayName(p.r)} (${String(p.r.id).slice(0, 8)}…): ${res.message}`) }
        done++
        setProgress(done, total, `${tally.ok} thành công · +${fmtXu(tally.xu)} xu`)
      }
    })
  } finally {
    plan.forEach(p => processingIds.value.delete(p.r.id))
  }
  Swal.fire({
    icon: tally.failed ? 'warning' : 'success',
    title: 'HOÀN TẤT DUYỆT HÀNG LOẠT',
    html: `
      <div style="text-align:left;font-size:13px;line-height:1.8">
        ✅ Thành công: <b>${tally.ok}</b> đơn${tally.xu ? ` · đã cộng <b>${fmtXu(tally.xu)} xu</b>` : ''}<br/>
        ⏭️ Bỏ qua (đơn đã được xử lý trước đó): <b>${tally.skipped}</b><br/>
        ❌ Thất bại: <b>${tally.failed}</b>
        ${failures.length ? `<ul style="margin:6px 0 0 18px;list-style:disc;color:#b91c1c;font-size:12px">${failures.slice(0, 8).map(f => `<li>${escapeHtml(f)}</li>`).join('')}${failures.length > 8 ? `<li>… và ${failures.length - 8} đơn khác</li>` : ''}</ul>` : ''}
      </div>`,
    confirmButtonColor: '#7c3aed',
  })
}

const approveMany = async (mode: 'selected' | 'all') => {
  if (busy.value) return
  const pool = (mode === 'selected' ? selectedReports.value : visiblePending.value).filter(r => r.status === 'pending' && !isProcessing(r.id))
  if (!pool.length) {
    Swal.fire('KHÔNG CÓ ĐƠN', mode === 'selected' ? 'Chưa chọn đơn chờ duyệt nào.' : 'Không có đơn chờ duyệt nào theo bộ lọc hiện tại.', 'info')
    return
  }
  const ready = pool.filter(r => draftCount(r) != null)
  const notReadyCount = pool.length - ready.length
  if (!ready.length) {
    Swal.fire({
      icon: 'warning',
      title: 'CHƯA NHẬP SỐ HỢP LỆ',
      html: `${notReadyCount} đơn chưa nhập (hoặc nhập sai) số hợp lệ nên chưa duyệt được.<br/>Nhập số ở ô <b>HỢP LỆ</b> của từng đơn trước — hệ thống không tự lấy số user khai báo.`,
      confirmButtonColor: '#7c3aed',
    })
    return
  }
  if (!props.ratesReady) { Swal.fire('CHƯA SẴN SÀNG', 'Đang tải cấu hình mức thưởng, vui lòng thử lại sau vài giây.', 'info'); return }
  const noRate = ready.find(r => rateOf(r.jobId) <= 0)
  if (noRate) { Swal.fire('LỖI!', `Job ${jobMeta(noRate.jobId).label} chưa có mức thưởng trong cấu hình (jobs.ts hoặc CẤU HÌNH JOB VIP).`, 'error'); return }

  busy.value = true
  try {
    openProgress('ĐANG ĐỐI CHIẾU TRÙNG LẶP...', ready.length)
    let checked = 0
    await runPool(ready, CHECK_CONCURRENCY, async (r) => { await ensureCheck(r); checked++; setProgress(checked, ready.length) })
    // Đơn có cảnh báo trùng link / nguy cơ trùng bằng chứng / chưa tra được mà Admin chưa đánh dấu ĐÃ KIỂM TRA → luôn bỏ qua.
    // Trùng nick chỉ để tham khảo, không chặn.
    const blocked = ready.filter(r => needsAttention(r))
    const allowed = ready.filter(r => !needsAttention(r))
    if (!allowed.length) {
      Swal.fire({
        icon: 'warning',
        title: 'KHÔNG CÓ ĐƠN ĐỦ ĐIỀU KIỆN',
        html: `<div style="text-align:left;font-size:13px;line-height:1.7">Mọi đơn đã nhập số hợp lệ đều có cảnh báo trùng chưa được kiểm tra.${blockedHtml(blocked)}</div>`,
        confirmButtonColor: '#7c3aed',
      })
      return
    }
    const reviewedFlagged = allowed.filter(r => dupOf(r).needsReview)
    // Chốt số hợp lệ + mức thưởng tại thời điểm xác nhận (ô nhập bị khóa trong lúc xử lý)
    const plan = allowed.map(r => ({ r, count: draftCount(r) as number, rate: rateOf(r.jobId) }))
    if (!(await confirmBulkApprove(plan, notReadyCount, blocked, reviewedFlagged))) return
    await processApprovals(plan)
  } finally {
    busy.value = false
  }
}

// ============================================================================
// TỪ CHỐI (lẻ / đã chọn / tất cả theo bộ lọc) — transaction: chỉ đổi đơn còn 'pending', không bao giờ chạm đơn đã duyệt.
// Field giống AdminView.confirmReject() — user thấy lý do (note) trong popup "THÔNG BÁO TỪ ADMIN" và lịch sử đơn.
// ============================================================================
const rejectModal = ref<{ open: boolean; ids: string[]; mode: 'single' | 'selected' | 'all'; note: string }>({ open: false, ids: [], mode: 'single', note: '' })
const rejectReasons = computed(() => {
  const jobIds = new Set(rejectModal.value.ids.map(id => docById.value.get(id)?.jobId))
  const reasons: string[] = []
  COUNT_JOB_IDS.forEach(jobId => {
    if (jobIds.has(jobId)) jobMeta(jobId).reasons.forEach(reason => { if (!reasons.includes(reason)) reasons.push(reason) })
  })
  return reasons
})
const openRejectOne = (r: any) => {
  if (busy.value || isProcessing(r.id) || r.status !== 'pending') return
  rejectModal.value = { open: true, ids: [r.id], mode: 'single', note: '' }
}
const openRejectMany = (mode: 'selected' | 'all') => {
  if (busy.value) return
  const pool = (mode === 'selected' ? selectedReports.value : visiblePending.value).filter(r => r.status === 'pending' && !isProcessing(r.id))
  if (!pool.length) {
    Swal.fire('KHÔNG CÓ ĐƠN', mode === 'selected' ? 'Chưa chọn đơn chờ duyệt nào.' : 'Không có đơn chờ duyệt nào theo bộ lọc hiện tại.', 'info')
    return
  }
  rejectModal.value = { open: true, ids: pool.map(r => r.id), mode, note: '' }
}
const closeRejectModal = () => { rejectModal.value.open = false }

const rejectReport = async (id: string, note: string): Promise<'ok' | 'skipped' | 'error'> => {
  try {
    return await runTransaction(db, async (tx) => {
      const reportRef = doc(db, 'reports', id)
      const snap = await tx.get(reportRef)
      if (!snap.exists() || snap.data().status !== 'pending') return 'skipped' as const
      tx.update(reportRef, { status: 'rejected', note, rejectedAt: serverTimestamp(), rejectedBy: auth.currentUser?.uid || null })
      return 'ok' as const
    })
  } catch (e) {
    console.error('[Duyệt Threads – Seeding] Lỗi từ chối đơn', id, e)
    return 'error'
  }
}

const confirmReject = async () => {
  const { ids, mode } = rejectModal.value
  if (!ids.length || busy.value) return
  const note = rejectModal.value.note.trim() || DEFAULT_REJECT_NOTE
  if (mode === 'all') {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: `TỪ CHỐI TẤT CẢ ${ids.length} ĐƠN?`,
      html: `Toàn bộ <b>${ids.length}</b> đơn đang chờ theo bộ lọc hiện tại sẽ bị từ chối, không cộng xu.<br/>Lý do user nhìn thấy: <b>${escapeHtml(note)}</b>`,
      showCancelButton: true,
      confirmButtonText: `TỪ CHỐI ${ids.length} ĐƠN`,
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'HỦY',
      focusCancel: true,
    })
    if (!isConfirmed) return
  }
  rejectModal.value.open = false

  const many = ids.length > 1
  const tally = { ok: 0, skipped: 0, failed: 0 }
  let done = 0
  busy.value = true
  ids.forEach(id => processingIds.value.add(id))
  if (many) openProgress('ĐANG TỪ CHỐI...', ids.length)
  else Swal.fire({ title: 'ĐANG TỪ CHỐI...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
  try {
    await runPool(ids, REJECT_CONCURRENCY, async (id) => {
      const code = await rejectReport(id, note)
      processingIds.value.delete(id)
      if (code === 'ok') { tally.ok++; delete drafts.value[id]; patchKnownReport(id, { status: 'rejected', note, rejectedAt: new Date() }) }
      else if (code === 'skipped') tally.skipped++
      else tally.failed++
      done++
      if (many) setProgress(done, ids.length, `${tally.ok} đã từ chối`)
    })
  } finally {
    ids.forEach(id => processingIds.value.delete(id))
    busy.value = false
  }
  if (detailId.value && ids.includes(detailId.value) && !tally.failed) closeDetail()

  if (!many) {
    if (tally.ok) Swal.fire({ icon: 'success', title: 'ĐÃ TỪ CHỐI ĐƠN', timer: 1300, showConfirmButton: false })
    else if (tally.skipped) Swal.fire('KHÔNG THAY ĐỔI', 'Đơn đã được xử lý trước đó.', 'info')
    else Swal.fire('LỖI!', 'Không từ chối được đơn, vui lòng thử lại.', 'error')
    return
  }
  Swal.fire({
    icon: tally.failed ? 'warning' : 'success',
    title: 'HOÀN TẤT TỪ CHỐI',
    html: `<div style="text-align:left;font-size:13px;line-height:1.8">
      ✅ Đã từ chối: <b>${tally.ok}</b> đơn<br/>
      ⏭️ Bỏ qua (đơn đã được xử lý trước đó): <b>${tally.skipped}</b><br/>
      ❌ Thất bại: <b>${tally.failed}</b>
    </div>`,
    confirmButtonColor: '#7c3aed',
  })
}

// ============================================================================
// CHI TIẾT ĐƠN + PHÓNG TO ẢNH
// ============================================================================
const detailId = ref<string | null>(null)
const detailSnapshot = ref<any>(null)
const detailInputEl = ref<HTMLInputElement | null>(null)
const detailScrollEl = ref<HTMLElement | null>(null)
// Đơn đang xem trước khi bấm "XEM ĐƠN" ở danh sách đơn liên quan → nút QUAY LẠI
const detailBack = ref<{ r: any; tab: DupTab }[]>([])
const dupTab = ref<DupTab>('link')
// Ưu tiên bản realtime; đơn rời khỏi mọi listener (VD vừa được duyệt) thì giữ bản lúc mở
const detailReport = computed(() => detailId.value ? (docById.value.get(detailId.value) || detailSnapshot.value) : null)
const detailDup = computed(() => detailReport.value ? dupOf(detailReport.value) : null)
const dupTabs = computed(() => {
  const r = detailReport.value
  const info = detailDup.value
  const tabs: { key: DupTab; label: string; count: number }[] = []
  if (!r || !info) return tabs
  if (r.jobId === THREADS_SEEDING_JOB_ID || info.code) tabs.push({ key: 'link', label: info.shareLink ? 'CÙNG LINK CHIA SẺ' : 'CÙNG LINK BÀI', count: info.linkReports.length })
  tabs.push({ key: 'nick', label: 'CÙNG NICK', count: info.nickReports.length })
  tabs.push({ key: 'image', label: 'ẢNH TRÙNG FILE', count: info.imageDups.length })
  return tabs
})
const dupRows = computed(() => {
  const info = detailDup.value
  if (!info) return []
  return dupTab.value === 'link' ? info.linkReports : dupTab.value === 'nick' ? info.nickReports : info.imageDups
})
const dupEmptyText = computed(() => {
  const info = detailDup.value
  if (!info) return ''
  const suffix = info.checked ? '' : ' (chưa tra trên hệ thống — bấm KIỂM TRA TRÙNG)'
  if (dupTab.value === 'link') {
    return info.shareLink
      ? `Chưa thấy đơn khác cùng link chia sẻ này${suffix} — link chia sẻ khác hoặc link bài đầy đủ vẫn có thể là cùng bài, cần đối chiếu thủ công.`
      : `Chưa thấy đơn khác cùng bài viết${suffix}.`
  }
  if (dupTab.value === 'nick') return info.nick ? `Chưa thấy đơn khác cùng nick${suffix}.` : 'Đơn không có nick Threads (gửi trước khi có ô nick).'
  return `Chưa thấy ảnh trùng file${suffix}.`
})
// Các đơn liên quan thuộc chính user này hay tài khoản khác
const accountSplitText = (list: any[], uid: any) => {
  const own = list.filter(x => x.uid === uid).length
  const others = list.filter(x => x.uid !== uid)
  const otherAccounts = new Set(others.map(x => x.uid).filter(Boolean)).size
  return [own ? `${own} đơn của chính user này` : '', others.length ? `${others.length} đơn của ${otherAccounts || 1} tài khoản khác` : ''].filter(Boolean).join(' · ')
}
const defaultDupTab = (r: any): DupTab => {
  const info = dupOf(r)
  if (info.linkReports.length) return 'link'
  if (info.nickReports.length) return 'nick'
  if (info.imageDups.length) return 'image'
  return r.jobId === THREADS_SEEDING_JOB_ID || postKey(r) ? 'link' : 'nick'
}

const openDetail = async (r: any, focusInput = false, tab: DupTab | null = null, keepBack = false) => {
  if (!keepBack) detailBack.value = []
  detailId.value = r.id
  detailSnapshot.value = r
  dupTab.value = tab && (tab !== 'link' || r.jobId === THREADS_SEEDING_JOB_ID || postKey(r)) ? tab : defaultDupTab(r)
  // Đơn chờ duyệt: tự đối chiếu; đơn đã xử lý chỉ tra khi Admin bấm KIỂM TRA TRÙNG (đỡ tốn lượt đọc)
  if (r.status === 'pending') ensureCheck(r)
  await nextTick()
  if (tab) document.getElementById('tc-dup-section')?.scrollIntoView({ block: 'start' })
  else if (keepBack && detailScrollEl.value) detailScrollEl.value.scrollTop = 0
  if (focusInput) detailInputEl.value?.focus()
}
// "XEM ĐƠN" ở danh sách đơn liên quan → mở đơn đó, nhớ đơn đang xem để QUAY LẠI
const openRelated = (x: any) => {
  if (detailReport.value) detailBack.value = [...detailBack.value, { r: detailReport.value, tab: dupTab.value }]
  openDetail(x, false, null, true)
}
const goBackDetail = () => {
  const prev = detailBack.value[detailBack.value.length - 1]
  if (!prev) return
  detailBack.value = detailBack.value.slice(0, -1)
  openDetail(docById.value.get(prev.r.id) || prev.r, false, null, true)
  dupTab.value = prev.tab
}
const closeDetail = () => { detailId.value = null; detailSnapshot.value = null; detailBack.value = [] }

// Bấm vào dòng đơn (trừ nút / link / ô nhập / checkbox, hoặc khi đang bôi đen chữ) → mở chi tiết
const onRowClick = (r: any, e: MouseEvent) => {
  if ((e.target as HTMLElement | null)?.closest('button, a, input, label, textarea, select')) return
  if (window.getSelection()?.toString()) return
  openDetail(r)
}

const zoomUrl = ref<string | null>(null)

const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    Swal.fire({ toast: true, position: 'top', icon: 'success', title: `Đã sao chép ${label}`, timer: 1200, showConfirmButton: false })
  } catch {
    Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Không sao chép được — hãy bôi đen để chép', timer: 1800, showConfirmButton: false })
  }
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !props.active || Swal.isVisible()) return
  if (zoomUrl.value) zoomUrl.value = null
  else if (rejectModal.value.open) closeRejectModal()
  else if (detailId.value) closeDetail()
}

// ============================================================================
// VÒNG ĐỜI
// ============================================================================
watch(statusFilter, key => startSource(key))
// Rời tab → đóng popup, bỏ chọn (số hợp lệ đang nhập vẫn giữ)
watch(() => props.active, (on) => {
  if (on) return
  closeDetail()
  zoomUrl.value = null
  rejectModal.value.open = false
  clearSelection()
})

onMounted(() => {
  startSource('pending')
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  Object.values(sourceUnsubs).forEach(unsub => unsub?.())
  stopServerSearch()
  if (searchTimer) clearTimeout(searchTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">

    <!-- TIÊU ĐỀ + MỨC THƯỞNG -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base md:text-lg text-violet-700 tracking-widest leading-tight">📝 DUYỆT THREADS – SEEDING</h2>
        <p class="text-[var(--admin-muted)] text-[11px] mt-1 font-sans not-italic normal-case font-semibold leading-snug">
          💬 Bình luận dạo: <b class="text-[var(--admin-text)]">{{ fmtXu(rateOf(THREADS_COMMENT_JOB_ID)) }} xu</b> / bình luận hợp lệ ·
          📣 Đăng bài Threads – Seeding: <b class="text-[var(--admin-text)]">{{ fmtXu(rateOf(THREADS_SEEDING_JOB_ID)) }} xu</b> / lượt trả lời hợp lệ
          <span v-if="!ratesReady" class="text-[var(--admin-warning)]"> · đang tải cấu hình mức thưởng…</span>
        </p>
      </div>
      <div class="shrink-0 bg-amber-50 border border-amber-200 text-[var(--admin-warning)] rounded-xl px-3 py-2 text-[10px] tracking-widest">
        ĐANG CHỜ: <span class="text-base text-[var(--admin-text)]">{{ pendingTotal }}</span>
      </div>
    </div>

    <!-- TÌM KIẾM -->
    <div>
      <div class="relative">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none not-italic" aria-hidden="true">🔎</span>
        <input v-model="searchText" type="text" inputmode="search" autocomplete="off" spellcheck="false"
               placeholder="Tìm UID, ID đơn, SĐT hoặc tên nick Threads..." aria-label="Tìm UID, ID đơn, SĐT hoặc tên nick Threads"
               class="w-full bg-white text-[var(--admin-text)] text-sm py-3 pl-10 pr-12 rounded-xl border border-[var(--admin-border)] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 font-sans not-italic normal-case font-semibold placeholder:text-slate-400 placeholder:font-normal" />
        <button v-if="searchText" type="button" @click="clearSearch" aria-label="Xóa nội dung tìm kiếm"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-[var(--admin-text)] text-xs flex items-center justify-center not-italic">✕</button>
      </div>
      <p v-if="searchHint" :class="['mt-1.5 text-[11px] font-sans not-italic normal-case font-semibold', searchState === 'error' ? 'text-[var(--admin-danger)]' : 'text-[var(--admin-muted)]']">{{ searchHint }}</p>
    </div>

    <!-- BỘ LỌC -->
    <div class="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-5">
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo công việc">
        <span class="text-[9px] text-[var(--admin-muted)] tracking-[2px] mr-1 w-full sm:w-auto">CÔNG VIỆC</span>
        <button v-for="f in JOB_FILTERS" :key="f.value" type="button" @click="jobFilter = f.value" :aria-pressed="jobFilter === f.value"
                :class="['px-3 py-2 rounded-lg text-[10px] border transition-all', jobFilter === f.value ? 'bg-violet-600 border-violet-600 text-white shadow-sm' : 'bg-white border-[var(--admin-border)] text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:border-violet-300']">
          {{ f.label }} <span class="opacity-75">({{ jobCount(f.value) }})</span>
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo trạng thái">
        <span class="text-[9px] text-[var(--admin-muted)] tracking-[2px] mr-1 w-full sm:w-auto">TRẠNG THÁI</span>
        <button v-for="s in STATUS_FILTERS" :key="s.value" type="button" @click="statusFilter = s.value" :aria-pressed="statusFilter === s.value"
                :class="['px-3 py-2 rounded-lg text-[10px] border transition-all', statusFilter === s.value ? s.activeClass + ' shadow-sm' : 'bg-white border-[var(--admin-border)] text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:border-violet-300']">
          {{ s.label }}<span v-if="statusCountLabel(s.value)" class="opacity-75"> ({{ statusCountLabel(s.value) }})</span>
        </button>
      </div>
    </div>

    <!-- THANH THAO TÁC — chỉ ở bộ lọc Chờ duyệt -->
    <div v-if="statusFilter === 'pending'" class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-3 md:p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" class="w-5 h-5 accent-violet-600 cursor-pointer" :checked="isAllVisibleSelected" :disabled="busy || !visiblePendingIds.length" @change="toggleSelectAll" />
          <span class="text-[10px] text-[var(--admin-text)] tracking-widest">CHỌN TẤT CẢ ĐANG HIỂN THỊ ({{ visiblePendingIds.length }})</span>
        </label>
        <button v-if="selectedIds.length" type="button" @click="clearSelection" :disabled="busy" class="text-[10px] text-violet-700 underline decoration-dotted hover:text-violet-900">BỎ CHỌN</button>
        <p class="w-full md:w-auto md:ml-auto text-[11px] text-[var(--admin-muted)] font-sans not-italic normal-case font-semibold">
          Đã chọn <b class="text-[var(--admin-text)]">{{ selectedReports.length }}</b> ·
          Đã nhập số hợp lệ <b class="text-[var(--admin-text)]">{{ visibleReady.length }}/{{ visiblePending.length }}</b> đơn ·
          <template v-if="visibleFlagged.length">Có cảnh báo <b class="text-[var(--admin-danger)]">{{ visibleFlagged.length }}</b> ({{ visibleFlagged.length - visibleFlaggedOpen }} đã kiểm tra) · </template>
          Dự kiến cộng <b class="text-[var(--admin-success)]">{{ fmtXu(sumDraftXu(visibleReady)) }} xu</b>
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" @click="approveMany('selected')" :disabled="busy || !selectedReports.length"
                class="bg-[var(--admin-success)] hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] px-4 py-2.5 rounded-xl leading-tight shadow-sm">
          ✅ DUYỆT ĐÃ CHỌN ({{ selectedReady.length }}/{{ selectedReports.length }})
        </button>
        <button type="button" @click="openRejectMany('selected')" :disabled="busy || !selectedReports.length"
                class="bg-[var(--admin-danger)] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] px-4 py-2.5 rounded-xl leading-tight shadow-sm">
          ❌ TỪ CHỐI ĐÃ CHỌN ({{ selectedReports.length }})
        </button>
        <button type="button" @click="approveMany('all')" :disabled="busy || !visiblePending.length"
                class="bg-white border-2 border-[var(--admin-success)] text-[var(--admin-success)] hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] px-4 py-2 rounded-xl leading-tight">
          ✅ DUYỆT TẤT CẢ ({{ visibleReady.length }})
        </button>
        <button type="button" @click="openRejectMany('all')" :disabled="busy || !visiblePending.length"
                class="bg-white border-2 border-[var(--admin-danger)] text-[var(--admin-danger)] hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] px-4 py-2 rounded-xl leading-tight">
          ❌ TỪ CHỐI TẤT CẢ ({{ visiblePending.length }})
        </button>
      </div>
      <p class="text-[10.5px] text-[var(--admin-muted)] font-sans not-italic normal-case leading-snug">
        Chỉ duyệt được đơn đã nhập <b>số hợp lệ</b>, đơn chưa nhập sẽ được bỏ qua — hệ thống không tự lấy số user khai báo.
        Nhập số rồi bấm <b>Enter</b> để sang đơn kế tiếp. "Tất cả" = mọi đơn chờ theo bộ lọc và từ khóa đang chọn.
        Đơn có <b>🔴 trùng link</b> / <b>⚠️ cần kiểm tra bằng chứng</b> chưa được đánh dấu <b>ĐÃ KIỂM TRA</b> (trong CHI TIẾT) sẽ bị bỏ qua
        khi duyệt hàng loạt; trùng nick chỉ để tham khảo.
      </p>
    </div>

    <p v-if="sourceNote" class="text-[11px] text-[var(--admin-warning)] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-sans not-italic normal-case font-semibold">{{ sourceNote }}</p>

    <!-- DANH SÁCH ĐƠN -->
    <div v-if="listLoading" class="py-16 text-center text-violet-600 animate-pulse tracking-widest">ĐANG TẢI...</div>
    <div v-else-if="listError" class="py-12 text-center space-y-3">
      <p class="text-[var(--admin-danger)] text-xs tracking-widest">KHÔNG TẢI ĐƯỢC DANH SÁCH ĐƠN.</p>
      <button type="button" @click="restartSource(statusFilter)" class="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-[10px]">THỬ LẠI</button>
    </div>
    <div v-else-if="!visibleReports.length" class="py-16 text-center text-slate-400 text-xs tracking-widest">KHÔNG CÓ ĐƠN NÀO.</div>
    <div v-else class="space-y-3">
      <div v-for="rp in visibleReports" :key="rp.id" @click="onRowClick(rp, $event)"
           :class="['rounded-2xl border transition-colors cursor-pointer', selectedIds.includes(rp.id) ? 'border-violet-300 bg-violet-50/70' : 'border-[var(--admin-border)] bg-[var(--admin-card)] hover:border-violet-200', isProcessing(rp.id) ? 'opacity-60 pointer-events-none' : '']">
        <div class="flex gap-3 p-3 md:p-4">
          <div class="w-5 shrink-0 pt-0.5">
            <input v-if="rp.status === 'pending'" type="checkbox" class="w-5 h-5 accent-violet-600 cursor-pointer" :value="rp.id" v-model="selectedIds"
                   :disabled="busy || isProcessing(rp.id)" :aria-label="`Chọn đơn ${rp.id}`" />
          </div>

          <div class="flex-1 min-w-0 grid gap-3 md:gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.05fr)_150px] md:items-center">
            <!-- 1. Đơn + người dùng -->
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span :class="['text-[9px] px-2 py-0.5 rounded-full border', jobMeta(rp.jobId).badgeClass]">{{ jobMeta(rp.jobId).icon }} {{ rp.jobName || jobMeta(rp.jobId).label }}</span>
                <span :class="['text-[9px] px-2 py-0.5 rounded-full border', statusChipClass(rp.status)]">{{ statusText(rp.status) }}</span>
              </div>
              <div class="font-sans not-italic normal-case leading-snug space-y-0.5">
                <p class="text-[var(--admin-text)] text-[13px] font-black truncate">
                  {{ displayName(rp) }}<span v-if="displayFullName(rp) && displayFullName(rp) !== displayName(rp)" class="text-[var(--admin-muted)] font-semibold"> · {{ displayFullName(rp) }}</span>
                </p>
                <p class="text-[var(--admin-muted)] text-[11px] font-medium flex items-start gap-1 min-w-0">
                  <span class="shrink-0">UID:</span>
                  <span class="text-[var(--admin-text)] font-semibold break-all">{{ rp.uid || '—' }}</span>
                  <button v-if="rp.uid" type="button" @click="copyText(rp.uid, 'UID')" class="shrink-0 text-slate-400 hover:text-violet-600" aria-label="Sao chép UID">📋</button>
                </p>
                <p v-if="rp.repairedUserUid" class="text-[10px] text-[var(--admin-warning)] font-semibold break-all">Ví gắn thủ công: {{ rp.repairedUserUid }}</p>
                <p class="text-[var(--admin-muted)] text-[11px] font-medium">SĐT: <span class="text-[var(--admin-text)] font-semibold">{{ displayPhone(rp) || '—' }}</span></p>
                <p class="text-[var(--admin-muted)] text-[11px] font-medium">Gửi: {{ formatDate(rp.createdAt) }} · <span class="break-all">Mã đơn: {{ rp.id }}</span></p>
                <p v-if="nickKey(rp)" class="text-[var(--admin-muted)] text-[11px] font-medium">Nick Threads:
                  <a :href="threadsProfileUrl(nickKey(rp))" target="_blank" rel="noopener noreferrer" class="text-violet-700 font-bold hover:underline break-all">@{{ nickKey(rp) }} ↗</a>
                </p>
              </div>
              <!-- Cảnh báo trùng — bấm để xem các đơn liên quan -->
              <div v-if="rowBadges(rp).length" class="flex flex-wrap gap-1 mt-2">
                <template v-for="b in rowBadges(rp)" :key="b.key">
                  <button v-if="b.tab" type="button" @click="openDetail(rp, false, b.tab)"
                          :class="['text-[9.5px] px-2 py-1 rounded-lg border leading-tight tracking-wide hover:brightness-95', b.cls]">{{ b.text }}</button>
                  <span v-else :class="['text-[9.5px] px-2 py-1 rounded-lg border leading-tight tracking-wide', b.cls]">{{ b.text }}</span>
                </template>
              </div>
            </div>

            <!-- 2. Bằng chứng -->
            <div class="min-w-0 space-y-2">
              <p v-if="rp.imagesDeleted" class="text-[10px] text-slate-400 font-sans not-italic normal-case">Ảnh đã được dọn khỏi Storage</p>
              <div v-else-if="getReportImages(rp).length" class="flex flex-wrap gap-1.5">
                <button v-for="(img, idx) in getReportImages(rp).slice(0, 4)" :key="idx" type="button" @click="zoomUrl = img.url" :aria-label="`Phóng to ảnh bằng chứng ${idx + 1}`"
                        class="w-12 h-12 rounded-lg overflow-hidden border border-[var(--admin-border)] bg-slate-100 hover:border-violet-500 hover:scale-105 transition-all cursor-zoom-in">
                  <img :src="img.url" loading="lazy" alt="" class="w-full h-full object-cover" />
                </button>
                <button v-if="getReportImages(rp).length > 4" type="button" @click="openDetail(rp)"
                        class="w-12 h-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card-soft)] text-[var(--admin-muted)] text-[11px] hover:border-violet-500">+{{ getReportImages(rp).length - 4 }}</button>
              </div>
              <p v-else class="text-[10px] text-slate-400">KHÔNG CÓ ẢNH</p>
              <div v-if="rp.jobId === THREADS_SEEDING_JOB_ID || rp.threadsPostUrl" class="flex flex-wrap gap-1.5">
                <a v-if="postUrlOf(rp)" :href="postUrlOf(rp)" target="_blank" rel="noopener noreferrer"
                   class="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-2.5 py-1 text-[10px] font-sans not-italic normal-case font-black">🧵 Mở bài Threads ↗</a>
                <span v-else class="bg-red-50 border border-red-200 text-[var(--admin-danger)] rounded-lg px-2.5 py-1 text-[10px] font-sans not-italic normal-case font-bold">Link bài không hợp lệ</span>
              </div>
            </div>

            <!-- 3. Số lượng + xu -->
            <div class="min-w-0 font-sans not-italic normal-case space-y-1">
              <p class="text-[11px] text-[var(--admin-muted)] font-semibold">User khai báo: <b class="text-[var(--admin-text)] text-[13px]">{{ declaredOf(rp) || '—' }}</b> {{ jobMeta(rp.jobId).unit }}</p>
              <template v-if="rp.status === 'pending'">
                <div class="flex items-center gap-2">
                  <label :for="`tc-draft-${rp.id}`" class="text-[10px] font-black uppercase italic tracking-wider text-violet-700 shrink-0">Hợp lệ</label>
                  <input :id="`tc-draft-${rp.id}`" :value="drafts[rp.id] ?? ''" type="text" inputmode="numeric" autocomplete="off" maxlength="5"
                         :placeholder="declaredOf(rp) ? `≤ ${declaredOf(rp)}` : 'Số'" :disabled="busy || isProcessing(rp.id)"
                         @input="onDraftInput(rp, $event)" @change="onDraftCommit(rp)" @keydown.enter.prevent="onDraftEnter(rp)"
                         :class="['w-20 bg-white text-center text-[var(--admin-text)] text-sm font-black py-1.5 px-2 rounded-lg border-2 outline-none transition-colors disabled:bg-slate-100',
                                  draftError(rp) ? 'border-red-400 focus:border-red-500' : draftCount(rp) != null ? 'border-emerald-400 focus:border-emerald-500' : 'border-[var(--admin-border)] focus:border-violet-500']" />
                  <span class="text-[11px] text-[var(--admin-muted)]">/ {{ declaredOf(rp) || '?' }}</span>
                </div>
                <p v-if="draftError(rp)" class="text-[11px] text-[var(--admin-danger)] font-bold leading-snug">{{ draftError(rp) }}</p>
                <p v-else-if="draftCount(rp) != null" class="text-[14px] text-[var(--admin-success)] font-black">= +{{ fmtXu(draftAmount(rp)) }} XU</p>
                <p v-else class="text-[11px] text-[var(--admin-muted)] font-medium">
                  {{ declaredOf(rp) ? `Tối đa ${fmtXu(declaredOf(rp) * rateOf(rp.jobId))} xu` : 'Đơn thiếu số khai báo' }} · {{ fmtXu(rateOf(rp.jobId)) }} xu / {{ jobMeta(rp.jobId).unit }}
                </p>
              </template>
              <template v-else-if="statusGroup(rp.status) === 'approved'">
                <p class="text-[11px] text-[var(--admin-muted)] font-semibold">Hợp lệ: <b class="text-[var(--admin-text)]">{{ rp.verifiedCommentCount ?? '—' }}</b> × {{ fmtXu(rp.rewardPerComment) }} xu</p>
                <p class="text-[14px] text-[var(--admin-success)] font-black">+{{ fmtXu(rp.actualReward ?? rp.reward) }} XU</p>
              </template>
              <p v-else class="text-[11px] text-[var(--admin-danger)] font-semibold">Không cộng xu</p>
            </div>

            <!-- 4. Thao tác -->
            <div class="grid grid-cols-2 md:grid-cols-1 gap-2">
              <template v-if="rp.status === 'pending'">
                <button type="button" @click="approveOne(rp)" :disabled="busy || isProcessing(rp.id)"
                        class="col-span-2 md:col-span-1 bg-[var(--admin-success)] hover:bg-emerald-700 disabled:opacity-40 text-white text-[10px] px-3 py-2.5 rounded-xl leading-tight shadow-sm">✅ DUYỆT & CỘNG XU</button>
                <button type="button" @click="openRejectOne(rp)" :disabled="busy || isProcessing(rp.id)"
                        class="bg-[var(--admin-danger)] hover:bg-red-700 disabled:opacity-40 text-white text-[10px] px-3 py-2 rounded-xl leading-tight">❌ TỪ CHỐI</button>
              </template>
              <p v-else-if="statusGroup(rp.status) === 'approved'" class="text-[10px] text-[var(--admin-success)] font-sans not-italic normal-case font-semibold leading-snug self-center">Duyệt lúc {{ formatDate(rp.approvedAt) }}</p>
              <p v-else class="text-[10px] text-[var(--admin-danger)] font-sans not-italic normal-case font-semibold leading-snug break-words self-center">Lý do: {{ rp.note || '—' }}</p>
              <button type="button" @click="openDetail(rp)"
                      class="bg-white border border-[var(--admin-border)] hover:border-violet-400 hover:text-violet-700 text-[var(--admin-muted)] text-[10px] px-3 py-2 rounded-xl">CHI TIẾT</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- POPUP CHI TIẾT ĐƠN -->
    <Transition name="fade">
      <div v-if="detailReport" class="fixed inset-0 z-[5000] flex items-end md:items-center justify-center md:p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeDetail"></div>
        <div ref="detailScrollEl" class="relative w-full md:max-w-3xl max-h-[92vh] overflow-y-auto overscroll-contain bg-[var(--admin-card)] rounded-t-3xl md:rounded-3xl shadow-2xl" role="dialog" aria-modal="true" aria-label="Chi tiết đơn">
          <div class="sticky top-0 z-10 bg-[var(--admin-card)] border-b border-[var(--admin-border)] px-5 py-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <button v-if="detailBack.length" type="button" @click="goBackDetail"
                      class="mb-1.5 text-[10px] text-violet-700 hover:text-violet-900 underline decoration-dotted">← QUAY LẠI ĐƠN {{ shortId(detailBack[detailBack.length - 1]?.r.id) }}</button>
              <div class="flex flex-wrap items-center gap-1.5 mb-1">
                <span :class="['text-[9px] px-2 py-0.5 rounded-full border', jobMeta(detailReport.jobId).badgeClass]">{{ jobMeta(detailReport.jobId).icon }} {{ detailReport.jobName || jobMeta(detailReport.jobId).label }}</span>
                <span :class="['text-[9px] px-2 py-0.5 rounded-full border', statusChipClass(detailReport.status)]">{{ statusText(detailReport.status) }}</span>
              </div>
              <p class="text-[var(--admin-text)] text-base leading-tight truncate font-sans not-italic normal-case font-black">{{ displayName(detailReport) }}</p>
            </div>
            <button type="button" @click="closeDetail" aria-label="Đóng" class="shrink-0 w-9 h-9 rounded-full bg-slate-100 hover:bg-red-600 hover:text-white text-slate-500 flex items-center justify-center not-italic">✕</button>
          </div>

          <div class="p-5 space-y-5">
            <!-- Thông tin -->
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 font-sans not-italic normal-case text-[12px]">
              <div>
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">Mã đơn</dt>
                <dd class="text-[var(--admin-text)] font-semibold break-all">{{ detailReport.id }} <button type="button" @click="copyText(detailReport.id, 'mã đơn')" class="text-slate-400 hover:text-violet-600" aria-label="Sao chép mã đơn">📋</button></dd>
              </div>
              <div>
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">UID người dùng</dt>
                <dd class="text-[var(--admin-text)] font-semibold break-all">{{ detailReport.uid || '—' }} <button v-if="detailReport.uid" type="button" @click="copyText(detailReport.uid, 'UID')" class="text-slate-400 hover:text-violet-600" aria-label="Sao chép UID">📋</button></dd>
              </div>
              <div>
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">Tên đăng nhập / Họ tên</dt>
                <dd class="text-[var(--admin-text)] font-semibold">{{ userOf(detailReport)?.username || detailReport.username || '—' }} · {{ displayFullName(detailReport) || '—' }}</dd>
              </div>
              <div>
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">Số điện thoại</dt>
                <dd class="text-[var(--admin-text)] font-semibold">{{ displayPhone(detailReport) || '—' }}</dd>
              </div>
              <div>
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">Thời gian gửi</dt>
                <dd class="text-[var(--admin-text)] font-semibold">{{ formatDate(detailReport.createdAt) }}</dd>
              </div>
              <div>
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">Site</dt>
                <dd class="text-[var(--admin-text)] font-semibold">{{ detailReport.site || '—' }}</dd>
              </div>
              <div v-if="detailReport.repairedUserUid" class="sm:col-span-2">
                <dt class="text-[var(--admin-warning)] text-[10px] font-bold uppercase tracking-wider">Ví gắn thủ công (nhận xu)</dt>
                <dd class="text-[var(--admin-text)] font-semibold break-all">{{ detailReport.repairedUserUid }}</dd>
              </div>
              <div v-if="detailReport.jobId === THREADS_SEEDING_JOB_ID || detailReport.threadsPostUrl" class="sm:col-span-2">
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">{{ detailReport.jobId === THREADS_SEEDING_JOB_ID ? 'Link bài Threads' : 'Link bài đã bình luận dạo' }}</dt>
                <dd class="font-semibold break-all">
                  <a v-if="postUrlOf(detailReport)" :href="postUrlOf(detailReport)" target="_blank" rel="noopener noreferrer" class="text-violet-700 hover:underline">{{ postUrlOf(detailReport) }} ↗</a>
                  <span v-else class="text-[var(--admin-danger)]">Link không hợp lệ: {{ detailReport.threadsPostUrl || '—' }}</span>
                  <span v-if="detailReport.threadsPostCode" class="text-[var(--admin-muted)]"> · mã bài {{ detailReport.threadsPostCode }}</span>
                  <span v-else-if="detailDup?.shareLink" class="text-[var(--admin-warning)]"> · link chia sẻ — chưa xác định được mã bài viết</span>
                </dd>
              </div>
              <div v-if="detailReport.threadsNick" class="sm:col-span-2">
                <dt class="text-[var(--admin-muted)] text-[10px] font-bold uppercase tracking-wider">Nick Threads ({{ detailReport.jobId === THREADS_SEEDING_JOB_ID ? 'người đăng bài' : 'xem bình luận' }})</dt>
                <dd class="font-semibold break-all">
                  <a v-if="detailReport.threadsNick" :href="threadsProfileUrl(detailReport.threadsNick)" target="_blank" rel="noopener noreferrer" class="text-violet-700 hover:underline">@{{ detailReport.threadsNick }} ↗</a>
                  <span v-else>—</span>
                </dd>
              </div>
            </dl>

            <!-- Ảnh bằng chứng -->
            <section>
              <h4 class="text-[10px] text-[var(--admin-muted)] tracking-widest mb-2">ẢNH BẰNG CHỨNG ({{ getReportImages(detailReport).length }}) — BẤM ĐỂ PHÓNG TO</h4>
              <p v-if="detailReport.imagesDeleted" class="text-[12px] text-slate-400 font-sans not-italic normal-case">Ảnh đã được dọn khỏi Storage.</p>
              <div v-else-if="getReportImages(detailReport).length" class="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <button v-for="(img, idx) in getReportImages(detailReport)" :key="idx" type="button" @click="zoomUrl = img.url" :aria-label="`Phóng to ảnh bằng chứng ${idx + 1}`"
                        class="aspect-square rounded-xl overflow-hidden border border-[var(--admin-border)] bg-slate-100 hover:border-violet-500 transition-colors cursor-zoom-in">
                  <img :src="img.url" alt="" class="w-full h-full object-cover" />
                </button>
              </div>
              <p v-else class="text-[12px] text-slate-400 font-sans not-italic normal-case">Đơn không có ảnh.</p>
            </section>

            <!-- Đối chiếu trùng lặp: cảnh báo + danh sách đơn liên quan (bấm XEM ĐƠN để mở đơn cũ) + xác nhận đã kiểm tra -->
            <section v-if="detailDup" id="tc-dup-section" class="scroll-mt-24 bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-[10px] text-[var(--admin-muted)] tracking-widest">ĐỐI CHIẾU TRÙNG LẶP</h4>
                <button type="button" @click="ensureCheck(detailReport, true)" :disabled="detailDup.loading" class="text-[10px] text-violet-700 underline decoration-dotted disabled:opacity-40">{{ detailDup.checked ? 'KIỂM TRA LẠI' : 'KIỂM TRA TRÙNG' }}</button>
              </div>
              <p v-if="detailDup.loading" class="text-[12px] text-[var(--admin-muted)] font-sans not-italic normal-case font-semibold">
                ⏳ Đang tra {{ [postKey(detailReport) && (detailDup.shareLink ? 'đơn cùng link chia sẻ' : 'đơn cùng bài Threads'), nickKey(detailReport) && 'đơn cùng nick', 'ảnh trùng file'].filter(Boolean).join(', ') }}…
              </p>

              <button v-if="detailDup.linkReports.length" type="button" @click="dupTab = 'link'"
                      class="w-full text-left text-[12px] px-3 py-2 rounded-xl border bg-red-50 border-red-300 text-[var(--admin-danger)] hover:bg-red-100">
                ⚠️ TRÙNG LINK THREADS — ĐÃ CÓ {{ detailDup.linkReports.length }} ĐƠN
                <span class="block mt-0.5 font-sans not-italic normal-case font-semibold text-[11px]">{{ detailDup.shareLink ? `Cùng link chia sẻ ${detailDup.code}` : `Cùng mã bài viết ${detailDup.code} (đã bỏ khác biệt định dạng link)` }} · {{ accountSplitText(detailDup.linkReports, detailReport.uid) }}</span>
              </button>
              <button v-if="detailDup.nickOther" type="button" @click="dupTab = 'nick'"
                      :class="['w-full text-left text-[12px] px-3 py-2 rounded-xl border', detailDup.nickOtherAccounts ? 'bg-orange-100 border-orange-400 text-orange-800 hover:bg-orange-200' : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100']">
                ⚠️ TRÙNG NICK THREADS — {{ detailDup.nickOther }} ĐƠN KHÁC
                <span class="block mt-0.5 font-sans not-italic normal-case font-semibold text-[11px]">
                  @{{ detailDup.nick }} · {{ detailDup.nickOtherAccounts ? `có ở ${detailDup.nickOtherAccounts} tài khoản khác` : 'chỉ ở tài khoản này' }} · chỉ để tham khảo, không tự kết luận 2 tài khoản là 1 người
                </span>
              </button>
              <div v-if="detailDup.proofReasons.length" class="text-[12px] px-3 py-2 rounded-xl border-2 bg-amber-50 border-amber-300 text-amber-900">
                ⚠️ CÓ NGUY CƠ GỬI TRÙNG BẰNG CHỨNG
                <ul class="mt-1 ml-4 list-disc font-sans not-italic normal-case font-semibold text-[11.5px] space-y-0.5">
                  <li v-for="(reason, i) in detailDup.proofReasons" :key="i">{{ reason }}</li>
                </ul>
              </div>
              <p v-for="(err, i) in detailDup.errors" :key="`err-${i}`" :class="['text-[12px] px-3 py-2 rounded-xl border font-sans not-italic normal-case font-bold', TONE_CLASS.danger]">⚠️ {{ err }}</p>
              <p v-if="detailDup.checked && !detailDup.loading && !detailDup.needsReview && !detailDup.nickOther" :class="['text-[12px] px-3 py-2 rounded-xl border font-sans not-italic normal-case font-bold', TONE_CLASS.ok]">
                ✓ Chưa thấy trùng link, nick hoặc ảnh bằng chứng.
              </p>

              <div class="flex flex-wrap gap-1.5 pt-1" role="tablist" aria-label="Đơn liên quan">
                <button v-for="t in dupTabs" :key="t.key" type="button" role="tab" :aria-selected="dupTab === t.key" @click="dupTab = t.key"
                        :class="['px-2.5 py-1.5 rounded-lg text-[10px] border transition-colors', dupTab === t.key ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-violet-300']">
                  {{ t.label }} ({{ t.count }})
                </button>
              </div>
              <div v-if="dupRows.length" class="overflow-x-auto">
                <table class="w-full text-[11px] font-sans not-italic normal-case font-medium">
                  <thead>
                    <tr class="text-left text-[var(--admin-muted)] border-b border-[var(--admin-border)] whitespace-nowrap">
                      <th class="py-1.5 pr-3 font-bold">Gửi lúc</th>
                      <th class="py-1.5 pr-3 font-bold">UID người gửi</th>
                      <th class="py-1.5 pr-3 font-bold">Nick Threads</th>
                      <th class="py-1.5 pr-3 font-bold">Công việc</th>
                      <th class="py-1.5 pr-3 font-bold">Trạng thái</th>
                      <th class="py-1.5 pr-3 font-bold text-right">Hợp lệ / khai báo</th>
                      <th class="py-1.5 pr-3 font-bold text-right">Xu đã duyệt</th>
                      <th class="py-1.5 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--admin-border)]">
                    <tr v-for="x in dupRows" :key="x.id" class="text-[var(--admin-text)]">
                      <td class="py-1.5 pr-3 whitespace-nowrap">{{ formatDate(x.createdAt) }}</td>
                      <td class="py-1.5 pr-3 whitespace-nowrap">
                        <span :title="x.uid">{{ shortId(x.uid) }}</span>
                        <button v-if="x.uid" type="button" @click="copyText(x.uid, 'UID')" class="ml-0.5 text-slate-400 hover:text-violet-600" aria-label="Sao chép UID">📋</button>
                        <span v-if="x.uid === detailReport.uid" class="block text-[10px] text-[var(--admin-muted)]">(chính user này)</span>
                      </td>
                      <td class="py-1.5 pr-3 whitespace-nowrap">{{ nickKey(x) ? '@' + nickKey(x) : '—' }}</td>
                      <td class="py-1.5 pr-3 whitespace-nowrap">{{ jobShort(x.jobId) }}</td>
                      <td class="py-1.5 pr-3"><span :class="['text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap', statusChipClass(x.status)]">{{ statusText(x.status) }}</span></td>
                      <td class="py-1.5 pr-3 text-right whitespace-nowrap">{{ x.verifiedCommentCount ?? '—' }} / {{ declaredOf(x) || '?' }}</td>
                      <td class="py-1.5 pr-3 text-right font-bold whitespace-nowrap">{{ creditedXuOf(x) ? '+' + fmtXu(creditedXuOf(x)) : '—' }}</td>
                      <td class="py-1.5 text-right">
                        <button type="button" @click="openRelated(x)" class="px-2 py-1 rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 text-[10px] font-black whitespace-nowrap">XEM ĐƠN</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="text-[12px] text-[var(--admin-muted)] font-sans not-italic normal-case font-semibold">{{ dupEmptyText }}</p>
              <p v-if="dupTab === 'nick' && detailDup.nickOther > dupRows.length" class="text-[10.5px] text-[var(--admin-muted)] font-sans not-italic normal-case font-semibold">
                Đang hiện {{ dupRows.length }}/{{ detailDup.nickOther }} đơn cùng nick{{ detailDup.nickPartial ? ` — chỉ tra tối đa ${NICK_LOOKUP_LIMIT} đơn để không tải toàn bộ lịch sử` : detailDup.checked ? '' : ' — bấm KIỂM TRA TRÙNG để tải danh sách' }}.
              </p>

              <div v-if="detailReport.status === 'pending' && detailDup.needsReview" class="pt-1 space-y-1.5">
                <div v-if="isReviewed(detailReport)" class="flex flex-wrap items-center gap-2 text-[12px] px-3 py-2 rounded-xl border bg-emerald-50 border-emerald-200 text-[var(--admin-success)] font-sans not-italic normal-case font-bold">
                  ✓ Đã kiểm tra lúc {{ formatDate(reviewed[detailReport.id]?.at) }} — đơn này được tính khi duyệt hàng loạt.
                  <button type="button" @click="unmarkReviewed(detailReport)" class="text-[10px] text-[var(--admin-muted)] underline decoration-dotted hover:text-[var(--admin-text)]">Bỏ đánh dấu</button>
                </div>
                <template v-else>
                  <button type="button" @click="markReviewed(detailReport)" :disabled="!canMarkReviewed(detailReport)"
                          class="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] px-4 py-2.5 rounded-xl">
                    ✓ TÔI ĐÃ KIỂM TRA CÁC ĐƠN LIÊN QUAN
                  </button>
                  <p class="text-[10.5px] text-[var(--admin-muted)] font-sans not-italic normal-case leading-snug">
                    Chưa đánh dấu thì đơn này bị bỏ qua khi duyệt hàng loạt (duyệt lẻ vẫn được, có hộp xác nhận).
                  </p>
                </template>
              </div>
              <p class="text-[10.5px] text-[var(--admin-muted)] font-sans not-italic normal-case leading-snug">
                Cảnh báo chỉ hỗ trợ đối soát, không tự kết luận gian lận. Hệ thống so mã bài viết, nick Threads và file ảnh gốc — không lưu ID từng
                {{ jobMeta(detailReport.jobId).unit }} nên không xác minh được {{ jobMeta(detailReport.jobId).unit }} mới có trùng {{ jobMeta(detailReport.jobId).unit }} đã tính hay không.
                Admin vẫn cần mở Threads kiểm tra trước khi nhập số hợp lệ.
              </p>
            </section>

            <!-- Duyệt -->
            <section v-if="detailReport.status === 'pending'" class="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-start font-sans not-italic normal-case">
                <div>
                  <p class="text-[10px] text-[var(--admin-muted)] font-bold uppercase tracking-wider">User khai báo</p>
                  <p class="text-[var(--admin-text)] text-lg font-black">{{ declaredOf(detailReport) || '—' }} <span class="text-[12px] font-semibold text-[var(--admin-muted)]">{{ jobMeta(detailReport.jobId).unit }}</span></p>
                </div>
                <div>
                  <label for="tc-detail-draft" class="text-[10px] text-violet-700 font-black uppercase tracking-wider">Số {{ jobMeta(detailReport.jobId).unit }} hợp lệ</label>
                  <input id="tc-detail-draft" ref="detailInputEl" :value="drafts[detailReport.id] ?? ''" type="text" inputmode="numeric" autocomplete="off" maxlength="5"
                         :placeholder="declaredOf(detailReport) ? `1 – ${declaredOf(detailReport)}` : 'VD: 10'" :disabled="busy || isProcessing(detailReport.id)"
                         @input="onDraftInput(detailReport, $event)" @change="onDraftCommit(detailReport)" @keydown.enter.prevent="approveOne(detailReport)"
                         :class="['mt-1 w-full bg-white text-center text-[var(--admin-text)] text-lg font-black py-2 px-3 rounded-xl border-2 outline-none transition-colors',
                                  draftError(detailReport) ? 'border-red-400 focus:border-red-500' : draftCount(detailReport) != null ? 'border-emerald-400 focus:border-emerald-500' : 'border-violet-200 focus:border-violet-500']" />
                </div>
                <div>
                  <p class="text-[10px] text-[var(--admin-muted)] font-bold uppercase tracking-wider">Xu sẽ cộng</p>
                  <p v-if="draftError(detailReport)" class="text-[12px] text-[var(--admin-danger)] font-bold leading-snug">{{ draftError(detailReport) }}</p>
                  <p v-else-if="draftCount(detailReport) != null" class="text-[var(--admin-success)] text-lg font-black">{{ fmtXu(draftCount(detailReport)) }} × {{ fmtXu(rateOf(detailReport.jobId)) }} = +{{ fmtXu(draftAmount(detailReport)) }}</p>
                  <p v-else class="text-[12px] text-[var(--admin-muted)] font-semibold">Nhập số hợp lệ để tính ({{ fmtXu(rateOf(detailReport.jobId)) }} xu / {{ jobMeta(detailReport.jobId).unit }})</p>
                </div>
              </div>
              <p class="text-[11px] text-violet-800/80 font-sans not-italic normal-case leading-snug">
                <template v-if="detailReport.jobId === THREADS_SEEDING_JOB_ID">Chỉ tính lượt user đã thật sự trả lời bình luận của người khác trong bài; không tính bình luận chưa được trả lời và lượt đã được tính ở đơn trước.</template>
                <template v-else>Chỉ tính bình luận còn tồn tại, đúng yêu cầu, không spam và chưa được tính ở đơn trước.</template>
                Không có cái nào hợp lệ thì bấm TỪ CHỐI.
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" @click="approveOne(detailReport)" :disabled="busy || isProcessing(detailReport.id)"
                        class="bg-[var(--admin-success)] hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] px-4 py-3 rounded-xl shadow-sm">✅ DUYỆT & CỘNG XU</button>
                <button type="button" @click="openRejectOne(detailReport)" :disabled="busy || isProcessing(detailReport.id)"
                        class="bg-[var(--admin-danger)] hover:bg-red-700 disabled:opacity-40 text-white text-[11px] px-4 py-3 rounded-xl">❌ TỪ CHỐI</button>
              </div>
            </section>
            <section v-else-if="statusGroup(detailReport.status) === 'approved'" class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 font-sans not-italic normal-case text-[12px] text-[var(--admin-text)] space-y-1">
              <p class="text-[var(--admin-success)] text-lg font-black">+{{ fmtXu(detailReport.actualReward ?? detailReport.reward) }} XU</p>
              <p>Hợp lệ: <b>{{ detailReport.verifiedCommentCount ?? '—' }}</b>/{{ declaredOf(detailReport) || '?' }} {{ jobMeta(detailReport.jobId).unit }} × {{ fmtXu(detailReport.rewardPerComment) }} xu</p>
              <p>Duyệt lúc {{ formatDate(detailReport.approvedAt) }}<template v-if="detailReport.approvedBy"> · bởi {{ detailReport.approvedBy }}</template></p>
            </section>
            <section v-else class="bg-red-50 border border-red-200 rounded-2xl p-4 font-sans not-italic normal-case text-[12px] text-[var(--admin-text)] space-y-1">
              <p class="text-[var(--admin-danger)] font-black">Đã từ chối — không cộng xu</p>
              <p>Lý do: <b>{{ detailReport.note || '—' }}</b></p>
              <p v-if="detailReport.rejectedAt">Lúc {{ formatDate(detailReport.rejectedAt) }}</p>
            </section>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP TỪ CHỐI -->
    <Transition name="fade">
      <div v-if="rejectModal.open" class="fixed inset-0 z-[5100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeRejectModal"></div>
        <div class="relative bg-[var(--admin-card)] border border-red-200 w-full max-w-md p-6 rounded-3xl shadow-xl" role="dialog" aria-modal="true" aria-label="Từ chối đơn">
          <h3 class="text-lg text-[var(--admin-danger)] mb-2">
            {{ rejectModal.mode === 'single' ? 'TỪ CHỐI ĐƠN NÀY' : rejectModal.mode === 'all' ? `TỪ CHỐI TẤT CẢ ${rejectModal.ids.length} ĐƠN` : `TỪ CHỐI ${rejectModal.ids.length} ĐƠN ĐÃ CHỌN` }}
          </h3>
          <p v-if="rejectModal.mode === 'all'" class="text-[12px] text-[var(--admin-danger)] bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3 font-sans not-italic normal-case font-bold">
            Toàn bộ {{ rejectModal.ids.length }} đơn đang chờ theo bộ lọc hiện tại sẽ bị từ chối, không cộng xu.
          </p>
          <p class="text-[var(--admin-muted)] text-[12px] font-sans not-italic normal-case font-semibold mb-3">Lý do (không bắt buộc) sẽ hiện cho người dùng trong lịch sử đơn và thông báo từ Admin.</p>
          <div class="flex flex-wrap gap-2 mb-3">
            <button v-for="reason in rejectReasons" :key="reason" type="button" @click="rejectModal.note = reason"
                    :class="['px-3 py-1.5 rounded-lg text-[11px] font-sans not-italic normal-case font-semibold transition-colors border', rejectModal.note === reason ? 'bg-red-600 text-white border-red-600' : 'bg-[var(--admin-card-soft)] text-[var(--admin-muted)] border-[var(--admin-border)] hover:border-red-300']">{{ reason }}</button>
          </div>
          <textarea v-model="rejectModal.note" rows="3" :placeholder="`Lý do từ chối… (để trống = &quot;${DEFAULT_REJECT_NOTE}&quot;)`"
                    class="w-full bg-[var(--admin-card-soft)] text-[var(--admin-text)] border border-[var(--admin-border)] rounded-xl p-3 mb-5 font-sans normal-case not-italic font-medium text-sm outline-none focus:border-[var(--admin-danger)] resize-none placeholder:text-slate-400"></textarea>
          <div class="flex gap-3 justify-end">
            <button type="button" class="px-5 py-2.5 bg-[var(--admin-card-soft)] text-[var(--admin-muted)] hover:bg-slate-200 rounded-xl text-xs" @click="closeRejectModal">HỦY BỎ</button>
            <button type="button" class="px-5 py-2.5 bg-[var(--admin-danger)] hover:bg-red-700 text-white rounded-xl text-xs shadow-md" @click="confirmReject">
              XÁC NHẬN TỪ CHỐI{{ rejectModal.ids.length > 1 ? ` ${rejectModal.ids.length} ĐƠN` : '' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- PHÓNG TO ẢNH -->
    <Transition name="fade">
      <div v-if="zoomUrl" class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="zoomUrl = null">
        <button type="button" class="absolute top-5 right-5 w-11 h-11 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white not-italic" @click.stop="zoomUrl = null" aria-label="Đóng ảnh">✕</button>
        <img class="max-w-full max-h-[88vh] rounded-2xl object-contain cursor-default" :src="zoomUrl" alt="Ảnh bằng chứng phóng to" @click.stop />
        <a v-if="safeHttpsUrl(zoomUrl)" :href="safeHttpsUrl(zoomUrl)" target="_blank" rel="noopener noreferrer" @click.stop
           class="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/10 hover:bg-white/20 text-white text-[10px] px-4 py-2 rounded-full border border-white/20">MỞ ẢNH GỐC ↗</a>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
