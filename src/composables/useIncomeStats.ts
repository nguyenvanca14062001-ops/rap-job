import { ref, computed } from 'vue'
import { db } from '@/firebase'
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
import type { Query, QuerySnapshot, FirestoreError } from 'firebase/firestore'
import { DAILY_THREAD_COLLECTION } from '@/utils/dailyThreads'
import { getVnPeriods, reportIncomeEntry, dailyThreadIncomeEntry, summarizeIncome, type IncomeEntry, type IncomeStats } from '@/utils/incomeStats'

// --- Singleton state (module-level) — 1 bộ listener cho cả tab. App.vue start/stop cùng chỗ với các listener
// user/reports/withdrawals (initFirebaseSync) nên sống theo phiên đăng nhập: quay lại trang chủ không đọc lại Firestore.
const periods = ref(getVnPeriods())
const reportEntries = ref<IncomeEntry[] | null>(null) // null = chưa nhận snapshot đầu tiên
const threadEntries = ref<IncomeEntry[] | null>(null)
const hasError = ref(false)

let currentUid: string | null = null
let unsubs: (() => void)[] = []
let clockTimer: ReturnType<typeof setInterval> | null = null

export const incomeStats = computed<IncomeStats>(() => {
  const reports = reportEntries.value
  const threads = threadEntries.value
  // Đang tải / lỗi → không trả số 0 giả, UI hiện trạng thái tương ứng
  if (hasError.value || !reports || !threads) {
    return { status: hasError.value ? 'error' : 'loading', periods: periods.value, ...summarizeIncome([], periods.value) }
  }
  return { status: 'ready', periods: periods.value, ...summarizeIncome([...reports, ...threads], periods.value) }
})

// Truy vấn chính chỉ đọc đơn được cộng xu từ đầu tuần (uid + approvedAt/paidAt >= đầu tuần) — cần composite index
// (uid ASC, approvedAt ASC) / (uid ASC, paidAt ASC). Project chưa có index → Firestore báo 'failed-precondition'
// → tự chuyển sang truy vấn dự phòng chỉ dùng "==" (uid + status, cùng kiểu các modal nộp đơn đang dùng, không cần
// index mới) rồi lọc theo thời điểm cộng xu ở client. Lỗi khác (quyền, ...) → báo lỗi, không hiển thị 0.
function listen(primary: Query, fallback: Query, onData: (snap: QuerySnapshot) => void): () => void {
  // Bỏ qua snapshot dựng từ cache cục bộ (VD đơn listener myReports đã tải — có thể thiếu đơn) cho tới khi server
  // trả kết quả lần đầu. Cần includeMetadataChanges để vẫn nhận snapshot lúc chuyển cache → server khi danh sách không đổi.
  let synced = false
  const handle = (snap: QuerySnapshot) => {
    if (!synced && snap.metadata.fromCache) return
    synced = true
    onData(snap)
  }
  const onError = (err: FirestoreError) => {
    console.error('[Firestore] Lỗi listener thống kê thu nhập:', err)
    hasError.value = true
  }
  let unsub = onSnapshot(primary, { includeMetadataChanges: true }, handle, (err) => {
    if (err.code !== 'failed-precondition') return onError(err)
    console.warn('[Firestore] Thống kê thu nhập: chưa có composite index, dùng truy vấn dự phòng.', err.message)
    unsub = onSnapshot(fallback, { includeMetadataChanges: true }, handle, onError)
  })
  return () => unsub()
}

export function startIncomeStats(uid: string) {
  stopIncomeStats()
  currentUid = uid
  periods.value = getVnPeriods()
  const since = Timestamp.fromMillis(periods.value.weekStart)
  const reportsCol = collection(db, 'reports')
  const threadsCol = collection(db, DAILY_THREAD_COLLECTION)

  if (import.meta.env.DEV) console.log('[Firestore] START income stats listeners — reports approvedAt / daily_thread_reports paidAt >=', since.toDate())
  unsubs = [
    listen(
      query(reportsCol, where('uid', '==', uid), where('approvedAt', '>=', since)),
      query(reportsCol, where('uid', '==', uid), where('status', '==', 'approved')),
      (snap) => { reportEntries.value = snap.docs.flatMap(d => reportIncomeEntry(d.data(), uid) ?? []) }
    ),
    listen(
      query(threadsCol, where('uid', '==', uid), where('paidAt', '>=', since)),
      query(threadsCol, where('uid', '==', uid), where('status', '==', 'paid')),
      (snap) => { threadEntries.value = snap.docs.flatMap(d => dailyThreadIncomeEntry(d.data()) ?? []) }
    ),
  ]

  clockTimer = setInterval(syncClock, 60_000)
  document.addEventListener('visibilitychange', syncClock)
}

export function stopIncomeStats() {
  unsubs.forEach(unsub => unsub())
  unsubs = []
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
  document.removeEventListener('visibilitychange', syncClock)
  currentUid = null
  reportEntries.value = null
  threadEntries.value = null
  hasError.value = false
}

// Qua 00:00 giờ VN: card Hôm nay tự sang kỳ mới (tính lại từ dữ liệu đang có, không đọc lại Firestore).
// Qua 00:00 Thứ Hai: mở lại listener vì truy vấn chính đang lọc theo đầu tuần cũ.
// Kiểm tra mỗi phút + khi tab hiện lại (điện thoại ngủ qua nửa đêm).
function syncClock() {
  const next = getVnPeriods()
  if (next.dayStart === periods.value.dayStart) return
  if (next.weekStart !== periods.value.weekStart && currentUid) startIncomeStats(currentUid)
  else periods.value = next
}
