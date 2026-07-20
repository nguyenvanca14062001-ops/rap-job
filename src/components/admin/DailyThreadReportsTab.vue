<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { db, auth } from '@/firebase'
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, increment, serverTimestamp, runTransaction, limit } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { normalizePhone } from '@/utils/phone'
import {
  DAILY_THREAD_COLLECTION, DAILY_THREAD_MAX_PENDING_PER_DAY, DAILY_THREAD_LOW_VIEW_THRESHOLD,
  DAILY_THREAD_REJECT_REASONS, getDateKey, normalizeThreadNick, normalizePostUrl,
  getDailyThreadSuggestedReward, dailyThreadStatusLabel
} from '@/utils/dailyThreads'

// Đơn cũ có thể chưa có report.suggestedReward — tính lại từ qrViews nếu thiếu.
const getDisplaySuggestedReward = (report: any): number =>
  report.suggestedReward ?? getDailyThreadSuggestedReward(report.qrViews)

const props = defineProps<{ usersMap: Record<string, any>; searchQuery: string }>()
const emit = defineEmits<{ (e: 'count-change', n: number): void }>()

const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()
const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

// ============================================================================
// FILTERS
// ============================================================================
const dateMode = ref<'today' | 'yesterday' | 'custom'>('today')
const customDate = ref(getDateKey())
const statusFilter = ref<'pending' | 'paid' | 'rejected' | 'all'>('pending')
const warningFilter = ref<'all' | 'has_warning' | 'duplicate_link' | 'duplicate_nick'>('all')

const effectiveDateKey = computed(() => {
  if (dateMode.value === 'today') return getDateKey()
  if (dateMode.value === 'yesterday') { const d = new Date(); d.setDate(d.getDate() - 1); return getDateKey(d) }
  return customDate.value
})
const isSearchMode = computed(() => props.searchQuery.trim() !== '')

// ============================================================================
// DATA LOADING — collection riêng, tách biệt hoàn toàn với `reports`
// ============================================================================
const isLoading = ref(false)
const reportsRaw = ref<any[]>([])
const localUsersMap = ref<Record<string, any>>({})
const mergedUsersMap = computed(() => ({ ...props.usersMap, ...localUsersMap.value }))

const fetchMissingUsers = async (data: any[]) => {
  const missing = [...new Set(data.map((r: any) => r.uid).filter((uid: string) => uid && !mergedUsersMap.value[uid]))]
  if (!missing.length) return
  const results = await Promise.all(missing.map((uid: string) => getDoc(doc(db, 'users', uid))))
  const updated = { ...localUsersMap.value }
  results.forEach(d => { if (d.exists()) updated[d.id] = d.data() })
  localUsersMap.value = updated
}

let unsub: any = null

const loadByDate = () => {
  if (unsub) { unsub(); unsub = null }
  isLoading.value = true
  const clauses: any[] = [where('dateKey', '==', effectiveDateKey.value)]
  if (statusFilter.value !== 'all') clauses.push(where('status', '==', statusFilter.value))
  const q = query(collection(db, DAILY_THREAD_COLLECTION), ...clauses, limit(300))
  unsub = onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
    data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    reportsRaw.value = data
    isLoading.value = false
    fetchMissingUsers(data)
  }, () => { isLoading.value = false })
}

const loadBySearch = async () => {
  if (unsub) { unsub(); unsub = null }
  isLoading.value = true
  const text = props.searchQuery.trim()
  const lower = text.toLowerCase()

  const matchedUids = Object.keys(mergedUsersMap.value).filter(uid => {
    const u = mergedUsersMap.value[uid]
    const uname = (u?.username || '').toLowerCase()
    const fname = (u?.fullName || '').toLowerCase()
    return (uname && uname.includes(lower)) || (fname && fname.includes(lower))
  }).slice(0, 10)

  const phoneNorm = normalizePhone(text)
  const nickNorm = normalizeThreadNick(text)
  const urlNorm = normalizePostUrl(text)

  const tasks: Promise<any>[] = []
  if (matchedUids.length) tasks.push(getDocs(query(collection(db, DAILY_THREAD_COLLECTION), where('uid', 'in', matchedUids), limit(200))))
  tasks.push(getDocs(query(collection(db, DAILY_THREAD_COLLECTION), where('uid', '==', text), limit(200))))
  if (phoneNorm.length >= 6) tasks.push(getDocs(query(collection(db, DAILY_THREAD_COLLECTION), where('phoneNormalized', '==', phoneNorm), limit(200))))
  if (nickNorm) tasks.push(getDocs(query(collection(db, DAILY_THREAD_COLLECTION), where('threadNickLower', '==', nickNorm), limit(200))))
  if (urlNorm) tasks.push(getDocs(query(collection(db, DAILY_THREAD_COLLECTION), where('postUrlNormalized', '==', urlNorm), limit(200))))

  try {
    const snaps = await Promise.all(tasks)
    const map = new Map<string, any>()
    snaps.forEach(snap => snap.docs.forEach((d: any) => map.set(d.id, { id: d.id, ...d.data() })))
    const data = Array.from(map.values())
    data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    reportsRaw.value = data
    fetchMissingUsers(data)
  } catch (e) { console.error('[DailyThreadReportsTab] search error:', e) }
  isLoading.value = false
}

const refresh = () => { isSearchMode.value ? loadBySearch() : loadByDate() }

watch(() => props.searchQuery, () => { selectedIds.value = []; refresh() })
watch([dateMode, customDate, statusFilter], () => { selectedIds.value = []; if (!isSearchMode.value) refresh() })

onMounted(refresh)
onUnmounted(() => { if (unsub) unsub() })

// ============================================================================
// CẢNH BÁO — chỉ tham khảo, không tự từ chối
// ============================================================================
const reportsWithWarnings = computed(() => {
  const urlCount: Record<string, number> = {}
  const nickCount: Record<string, number> = {}
  const userPendingCount: Record<string, number> = {}
  reportsRaw.value.forEach(r => {
    if (r.postUrlNormalized) urlCount[r.postUrlNormalized] = (urlCount[r.postUrlNormalized] || 0) + 1
    if (r.threadNickLower) nickCount[r.threadNickLower] = (nickCount[r.threadNickLower] || 0) + 1
    if (r.status === 'pending') userPendingCount[r.uid] = (userPendingCount[r.uid] || 0) + 1
  })
  return reportsRaw.value.map(r => {
    const warnings: string[] = []
    if (r.postUrlNormalized && (urlCount[r.postUrlNormalized] || 0) > 1) warnings.push('duplicate_link')
    if (r.threadNickLower && (nickCount[r.threadNickLower] || 0) > 1) warnings.push('duplicate_nick')
    if (Number(r.qrViews) < DAILY_THREAD_LOW_VIEW_THRESHOLD) warnings.push('low_view')
    if (r.status === 'pending' && (userPendingCount[r.uid] || 0) > DAILY_THREAD_MAX_PENDING_PER_DAY) warnings.push('too_many')
    return { ...r, warnings, displaySuggestedReward: getDisplaySuggestedReward(r) }
  })
})

const filteredReports = computed(() => {
  let list = reportsWithWarnings.value
  if (warningFilter.value === 'has_warning') list = list.filter(r => r.warnings.length > 0)
  else if (warningFilter.value === 'duplicate_link') list = list.filter(r => r.warnings.includes('duplicate_link'))
  else if (warningFilter.value === 'duplicate_nick') list = list.filter(r => r.warnings.includes('duplicate_nick'))
  return list
})

watch(filteredReports, (list) => emit('count-change', list.length), { immediate: true })

const groupedByUser = computed(() => {
  const groups: Record<string, any> = {}
  filteredReports.value.forEach(r => {
    if (!groups[r.uid]) groups[r.uid] = { uid: r.uid, items: [] as any[] }
    groups[r.uid].items.push(r)
  })
  const today = getDateKey()
  return Object.values(groups).map((g: any) => ({
    ...g,
    pendingToday: g.items.filter((r: any) => r.status === 'pending' && r.dateKey === today).length,
    pendingTotal: g.items.filter((r: any) => r.status === 'pending').length,
    hasWarning: g.items.some((r: any) => r.warnings.length > 0),
    user: mergedUsersMap.value[g.uid]
  })).sort((a: any, b: any) => getTime(b.items[0]?.createdAt) - getTime(a.items[0]?.createdAt))
})

// ============================================================================
// CHỌN ĐƠN
// ============================================================================
const selectedIds = ref<string[]>([])
const pendingIdsVisible = computed(() => filteredReports.value.filter(r => r.status === 'pending').map(r => r.id))
const isAllPendingSelected = computed(() => pendingIdsVisible.value.length > 0 && pendingIdsVisible.value.every(id => selectedIds.value.includes(id)))
const toggleAllPending = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked
  selectedIds.value = checked ? [...pendingIdsVisible.value] : []
}
const clearSelected = () => { selectedIds.value = [] }

// ============================================================================
// CỘNG XU — transaction chống cộng trùng (chỉ xử lý nếu report vẫn còn pending)
// ============================================================================
const payOne = async (reportId: string, uid: string, actualReward: number): Promise<'ok' | 'skipped' | 'error'> => {
  try {
    return await runTransaction(db, async (tx) => {
      const reportRef = doc(db, DAILY_THREAD_COLLECTION, reportId)
      const snap = await tx.get(reportRef)
      if (!snap.exists() || snap.data().status !== 'pending') return 'skipped'
      const userRef = doc(db, 'users', uid)
      tx.update(userRef, { balance: increment(actualReward) })
      tx.update(reportRef, {
        status: 'paid',
        actualReward,
        paidAt: serverTimestamp(),
        paidBy: auth.currentUser?.uid || '',
        updatedAt: serverTimestamp()
      })
      return 'ok'
    })
  } catch (e) {
    console.error('[DailyThreadReportsTab] payOne error:', e)
    return 'error'
  }
}

const approveOne = async (report: any) => {
  const defaultReward = getDisplaySuggestedReward(report)
  const lowViewWarning = defaultReward === 0
    ? `<p style="color:#fb923c;font-weight:700;margin-top:6px;">⚠️ Đơn này view thấp, vui lòng kiểm tra kỹ trước khi cộng xu.</p>`
    : ''
  const { value: rewardInput, isConfirmed } = await Swal.fire({
    title: 'CỘNG XU ĐƠN NÀY',
    html: `Nick: <b>${report.threadNick}</b><br/>View QR: <b>${report.qrViews}</b><br/>Đề xuất: <b>${defaultReward.toLocaleString()} xu</b>${lowViewWarning}`,
    input: 'number',
    inputValue: defaultReward,
    inputLabel: 'Số xu cộng (có thể sửa)',
    showCancelButton: true,
    confirmButtonText: 'CỘNG XU ✅',
    confirmButtonColor: '#14b8a6',
    cancelButtonText: 'HỦY'
  })
  if (!isConfirmed) return
  const actualReward = Math.max(0, Number(rewardInput) || 0)
  const result = await payOne(report.id, report.uid, actualReward)
  if (result === 'ok') Swal.fire({ icon: 'success', title: 'ĐÃ CỘNG XU!', timer: 1200, showConfirmButton: false })
  else if (result === 'skipped') Swal.fire({ icon: 'info', title: 'ĐƠN NÀY ĐÃ ĐƯỢC XỬ LÝ TRƯỚC ĐÓ', timer: 1500, showConfirmButton: false })
  else Swal.fire('LỖI!', 'Không thể cộng xu, vui lòng thử lại.', 'error')
}

const bulkApprove = async () => {
  const ids = [...selectedIds.value]
  if (!ids.length) return

  const candidates = ids.map(id => reportsRaw.value.find(r => r.id === id)).filter(Boolean) as any[]
  const payable = candidates.filter(r => getDisplaySuggestedReward(r) > 0)
  const lowView = candidates.filter(r => getDisplaySuggestedReward(r) === 0)
  const totalExpected = payable.reduce((sum, r) => sum + getDisplaySuggestedReward(r), 0)

  const { isConfirmed } = await Swal.fire({
    title: `CỘNG XU ${ids.length} ĐƠN ĐÃ CHỌN?`,
    html: `Bạn sắp cộng xu cho <b>${payable.length}</b> đơn.<br/>Tổng xu dự kiến: <b>${totalExpected.toLocaleString()} xu</b>.<br/>Đơn view thấp bị bỏ qua: <b>${lowView.length}</b> đơn.`,
    icon: 'question', showCancelButton: true, confirmButtonColor: '#14b8a6', cancelButtonText: 'HỦY', confirmButtonText: 'CỘNG XU 🚀'
  })
  if (!isConfirmed) return

  Swal.fire({ title: `ĐANG XỬ LÝ 0/${payable.length} ĐƠN...`, allowOutsideClick: false, didOpen: () => Swal.showLoading() })
  let success = 0, skipped = 0, failed = 0, done = 0
  for (const report of payable) {
    const result = await payOne(report.id, report.uid, getDisplaySuggestedReward(report))
    if (result === 'ok') success++
    else if (result === 'skipped') skipped++
    else failed++
    done++
    Swal.update({ title: `ĐANG XỬ LÝ ${done}/${payable.length} ĐƠN...` } as any)
  }
  selectedIds.value = []
  Swal.fire({ icon: 'success', title: 'HOÀN TẤT!', html: `Thành công: ${success}<br/>Bỏ qua: ${skipped}<br/>Lỗi: ${failed}<br/>View thấp không cộng tự động: ${lowView.length}` })
}

// ============================================================================
// TỪ CHỐI
// ============================================================================
const showRejectModal = ref(false)
const rejectTargetIds = ref<string[]>([])
const rejectReasonSelected = ref('')
const rejectNoteText = ref('')

const openRejectOne = (report: any) => { rejectTargetIds.value = [report.id]; rejectReasonSelected.value = ''; rejectNoteText.value = ''; showRejectModal.value = true }
const openRejectBulk = () => { if (!selectedIds.value.length) return; rejectTargetIds.value = [...selectedIds.value]; rejectReasonSelected.value = ''; rejectNoteText.value = ''; showRejectModal.value = true }
const closeRejectModal = () => { showRejectModal.value = false }

const confirmReject = async () => {
  if (!rejectReasonSelected.value) { alert('⚠️ VUI LÒNG CHỌN LÝ DO TỪ CHỐI!'); return }
  const ids = [...rejectTargetIds.value]
  showRejectModal.value = false
  Swal.fire({ title: 'ĐANG XỬ LÝ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
  let success = 0, skipped = 0
  for (const id of ids) {
    try {
      const reportRef = doc(db, DAILY_THREAD_COLLECTION, id)
      const snap = await getDoc(reportRef)
      if (!snap.exists() || snap.data()?.status !== 'pending') { skipped++; continue }
      await updateDoc(reportRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: auth.currentUser?.uid || '',
        rejectReason: rejectReasonSelected.value,
        rejectNote: rejectNoteText.value.trim(),
        updatedAt: serverTimestamp()
      })
      success++
    } catch (e) { console.error('[DailyThreadReportsTab] reject error:', e) }
  }
  selectedIds.value = []
  Swal.fire({ icon: 'success', title: 'ĐÃ TỪ CHỐI!', html: `Thành công: ${success}<br/>Bỏ qua: ${skipped}` })
}

const openLink = (url: string) => { if (url) window.open(url, '_blank') }
</script>

<template>
  <div class="p-6 space-y-5">

    <!-- FILTERS -->
    <div class="flex flex-wrap gap-3 items-center">
      <div class="flex items-center gap-1 bg-[#0d121f] p-1.5 rounded-xl border border-slate-800">
        <button :class="['px-3 py-2 rounded-lg text-[10px] font-black transition-all', dateMode === 'today' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-white']" @click="dateMode = 'today'">HÔM NAY</button>
        <button :class="['px-3 py-2 rounded-lg text-[10px] font-black transition-all', dateMode === 'yesterday' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-white']" @click="dateMode = 'yesterday'">HÔM QUA</button>
        <button :class="['px-3 py-2 rounded-lg text-[10px] font-black transition-all', dateMode === 'custom' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-white']" @click="dateMode = 'custom'">CHỌN NGÀY</button>
        <input v-if="dateMode === 'custom'" v-model="customDate" type="date" class="bg-[#111726] text-white text-[10px] py-2 px-2 rounded-lg border border-slate-700 outline-none font-sans" />
      </div>

      <select v-model="statusFilter" class="bg-[#0d121f] text-white text-[10px] py-2.5 px-3 rounded-xl border border-slate-800 outline-none cursor-pointer">
        <option value="pending">⏳ Chờ cộng xu</option>
        <option value="paid">✅ Đã cộng xu</option>
        <option value="rejected">❌ Đã từ chối</option>
        <option value="all">📚 Tất cả</option>
      </select>

      <select v-model="warningFilter" class="bg-[#0d121f] text-white text-[10px] py-2.5 px-3 rounded-xl border border-slate-800 outline-none cursor-pointer">
        <option value="all">Tất cả cảnh báo</option>
        <option value="has_warning">⚠️ Có cảnh báo</option>
        <option value="duplicate_link">🔗 Link trùng</option>
        <option value="duplicate_nick">👤 Nick trùng</option>
      </select>

      <span v-if="isSearchMode" class="text-[10px] text-teal-400 tracking-widest font-sans">🔎 ĐANG TÌM "{{ props.searchQuery }}" — KHÔNG GIỚI HẠN THEO NGÀY</span>
    </div>

    <!-- BULK ACTION BAR -->
    <Transition name="fade">
      <div v-if="selectedIds.length" class="bg-teal-900/40 border border-teal-500/30 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
        <span class="text-teal-400 text-sm tracking-widest">ĐÃ CHỌN: <span class="text-white text-lg">{{ selectedIds.length }}</span> ĐƠN</span>
        <div class="flex gap-2 flex-wrap">
          <button class="bg-teal-500 hover:bg-teal-400 text-teal-950 px-5 py-2.5 rounded-xl text-xs font-black" @click="bulkApprove">✅ CỘNG XU ĐƠN ĐÃ CHỌN</button>
          <button class="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-black" @click="openRejectBulk">❌ TỪ CHỐI ĐƠN ĐÃ CHỌN</button>
          <button class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-black" @click="clearSelected">BỎ CHỌN</button>
        </div>
      </div>
    </Transition>

    <div v-if="isLoading" class="p-20 text-center text-teal-500 animate-pulse tracking-widest">ĐANG TẢI...</div>
    <div v-else-if="!groupedByUser.length" class="p-20 text-center text-slate-700 text-xs">KHÔNG CÓ DỮ LIỆU.</div>

    <div v-else class="space-y-4">
      <div class="flex items-center gap-2 px-1" v-if="pendingIdsVisible.length">
        <input type="checkbox" class="w-4 h-4 accent-teal-500 rounded cursor-pointer" :checked="isAllPendingSelected" @change="toggleAllPending" />
        <span class="text-[10px] text-slate-500 tracking-widest">CHỌN TẤT CẢ ĐƠN CHỜ ĐANG HIỂN THỊ ({{ pendingIdsVisible.length }})</span>
      </div>

      <div v-for="group in groupedByUser" :key="group.uid" class="bg-[#0d121f] border border-slate-800 rounded-2xl overflow-hidden">
        <!-- Group header -->
        <div class="p-4 flex flex-wrap justify-between items-center gap-2 bg-[#111726] border-b border-slate-800">
          <div class="font-sans not-italic normal-case">
            <div class="flex items-center gap-2">
              <span class="text-white text-sm font-black">{{ group.user?.username || group.user?.fullName || 'CHƯA CẬP NHẬT' }}</span>
              <span v-if="group.hasWarning" class="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-black">⚠️ NGHI VẤN</span>
            </div>
            <span class="text-slate-600 text-[9px]">UID: {{ group.uid?.slice(0, 8) }}…</span>
          </div>
          <div class="flex items-center gap-3 text-[10px] font-sans not-italic normal-case font-bold">
            <span class="text-yellow-400">Chờ kiểm tra {{ group.pendingToday }}/{{ DAILY_THREAD_MAX_PENDING_PER_DAY }}</span>
            <span class="text-slate-400">Chờ: {{ group.pendingTotal }}</span>
          </div>
        </div>

        <!-- Rows -->
        <div class="divide-y divide-slate-800/60">
          <div v-for="rp in group.items" :key="rp.id" class="p-4 flex flex-wrap items-center gap-3">
            <input v-if="rp.status === 'pending'" type="checkbox" class="w-4 h-4 accent-teal-500 rounded cursor-pointer shrink-0" :value="rp.id" v-model="selectedIds" />
            <div v-else class="w-4 shrink-0"></div>

            <div class="min-w-[130px] font-sans not-italic normal-case">
              <p class="text-white text-[12px] font-bold">🧵 {{ rp.threadNick }}</p>
              <p class="text-slate-500 text-[10px]">View QR: <span :class="rp.warnings.includes('low_view') ? 'text-orange-400 font-bold' : 'text-white'">{{ rp.qrViews }}</span></p>
              <p v-if="rp.displaySuggestedReward > 0" class="text-emerald-400 text-[10px] font-bold">Đề xuất: {{ rp.displaySuggestedReward.toLocaleString() }} xu</p>
              <p v-else class="text-orange-400 text-[10px] font-bold">View thấp - chưa đề xuất xu</p>
            </div>

            <button @click="openLink(rp.postUrl)" class="text-teal-400 text-[10px] underline decoration-dotted hover:text-teal-300 font-sans not-italic normal-case truncate max-w-[180px]">
              Mở bài viết ↗
            </button>

            <span class="text-slate-500 text-[10px] font-sans not-italic">{{ formatDate(rp.createdAt) }}</span>

            <div class="flex flex-wrap gap-1" v-if="rp.warnings.length">
              <span v-if="rp.warnings.includes('duplicate_link')" class="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-black">LINK TRÙNG</span>
              <span v-if="rp.warnings.includes('duplicate_nick')" class="text-[8px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-black">NICK TRÙNG</span>
              <span v-if="rp.warnings.includes('low_view')" class="text-[8px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-black">VIEW THẤP</span>
              <span v-if="rp.warnings.includes('too_many')" class="text-[8px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-black">QUÁ 5 ĐƠN</span>
            </div>

            <span class="text-[9px] px-2 py-1 rounded-full border font-sans not-italic normal-case ml-auto shrink-0"
                  :class="rp.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : rp.status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'">
              {{ rp.status === 'paid' ? `ĐÃ CỘNG ${(rp.actualReward || 0).toLocaleString()} XU` : dailyThreadStatusLabel(rp.status).toUpperCase() }}
            </span>

            <div class="flex gap-2 shrink-0 w-full md:w-auto" v-if="rp.status === 'pending'">
              <button class="bg-teal-500 hover:bg-teal-400 text-teal-950 text-[9px] px-3 py-2 rounded-lg font-black" @click="approveOne(rp)">CỘNG XU</button>
              <button class="bg-red-600 hover:bg-red-500 text-white text-[9px] px-3 py-2 rounded-lg font-black" @click="openRejectOne(rp)">TỪ CHỐI</button>
            </div>
            <div v-else-if="rp.status === 'rejected'" class="text-rose-400 text-[9px] font-sans not-italic normal-case max-w-[160px] shrink-0">
              {{ rp.rejectReason }}<span v-if="rp.rejectNote"> — {{ rp.rejectNote }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- REJECT MODAL -->
    <Transition name="fade">
      <div v-if="showRejectModal" class="fixed inset-0 z-[7000] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="closeRejectModal"></div>
        <div class="relative bg-[#111726] border border-red-500/30 w-full max-w-md rounded-[30px] p-6 shadow-2xl">
          <h3 class="text-white text-base tracking-tight mb-4 font-sans not-italic normal-case font-black">
            TỪ CHỐI {{ rejectTargetIds.length }} ĐƠN
          </h3>
          <div class="grid grid-cols-2 gap-2 mb-4">
            <button v-for="reason in DAILY_THREAD_REJECT_REASONS" :key="reason"
              @click="rejectReasonSelected = reason"
              :class="['text-[10px] py-2.5 px-3 rounded-xl font-sans not-italic normal-case font-bold transition-all', rejectReasonSelected === reason ? 'bg-red-600 text-white' : 'bg-[#0d121f] text-slate-400 border border-slate-700 hover:border-red-500/50']">
              {{ reason }}
            </button>
          </div>
          <textarea v-model="rejectNoteText" rows="2" placeholder="Ghi chú thêm (không bắt buộc)"
            class="w-full bg-[#0d121f] text-white border border-slate-700 rounded-xl p-3 mb-4 font-sans normal-case not-italic text-sm outline-none focus:border-red-500 resize-none placeholder:text-slate-600"></textarea>
          <div class="flex gap-3 justify-end font-sans not-italic normal-case">
            <button class="px-5 py-2.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-black" @click="closeRejectModal">HỦY</button>
            <button class="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black" @click="confirmReject">XÁC NHẬN TỪ CHỐI</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
