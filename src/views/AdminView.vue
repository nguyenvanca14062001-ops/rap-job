<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "firebase/auth"
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc, increment, limit, where, getDocs, addDoc, serverTimestamp, Timestamp, getCountFromServer, runTransaction } from "firebase/firestore"
import Swal from 'sweetalert2'
import { jobsData } from '@/data/jobs'
import { getReportImages } from '@/utils/reportImages'
import { normalizePhone } from '@/utils/phone'
import { LPBANK_REFERRAL_JOB_ID, getLpbankReferralRewardByCount } from '@/utils/referralLpbank'
import DailyThreadReportsTab from '@/components/admin/DailyThreadReportsTab.vue'
import DailyThreadsGuideConfigTab from '@/components/admin/DailyThreadsGuideConfigTab.vue'
import StorageCleanupTab from '@/components/admin/StorageCleanupTab.vue'

const dailyThreadReportsCount = ref(0)

const reports = ref<any[]>([])
const withdrawals = ref<any[]>([])
const dailyNotes = ref<any[]>([])
const usersMap = ref<Record<string, any>>({})
const isLoading = ref(true)
const isCheckingAuth = ref(true)
const isLoggedIn = ref(false)
const loginEmail = ref('')
const loginPassword = ref('')
const loginError = ref('')
const isLoginLoading = ref(false)
const router = useRouter()

const loginAdmin = async () => {
  loginError.value = ''
  if (!loginEmail.value || !loginPassword.value) {
    loginError.value = 'Vui lòng nhập đầy đủ email và mật khẩu.'
    return
  }
  isLoginLoading.value = true
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value)
  } catch (e: any) {
    const code = e.code || ''
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      loginError.value = 'Email hoặc mật khẩu không đúng.'
    } else if (code === 'auth/too-many-requests') {
      loginError.value = 'Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau.'
    } else {
      loginError.value = 'Đăng nhập thất bại: ' + e.message
    }
  } finally {
    isLoginLoading.value = false
  }
}

const activeTab = ref('app_jobs')
const siteFilter = ref('all')
const statusFilter = ref('pending')

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const selectedReportId = ref<string | null>(null)
const showRejectPopup = ref(false)
const rejectReason = ref('')

// ============================================================================
// 1. DASHBOARD THỐNG KÊ
// ============================================================================
const statsTodayTotal = ref(0)
const statsTodayAppTotal = ref(0)
type AppBreakdownKey = 'CK SỐ 1 (Kafi)' | 'CK SỐ 2 (DNSE)' | 'CK SỐ 3 (KIS)' | 'MSB BANK' | 'VP BANK' | 'TP BANK'
const statsAppBreakdown = ref<Record<AppBreakdownKey, { today: number }>>({
  'CK SỐ 1 (Kafi)': { today: 0 },
  'CK SỐ 2 (DNSE)': { today: 0 },
  'CK SỐ 3 (KIS)': { today: 0 },
  'MSB BANK': { today: 0 },
  'VP BANK': { today: 0 },
  'TP BANK': { today: 0 }
})
const isStatsLoading = ref(false)

const loadDashboardStats = async () => {
  isStatsLoading.value = true
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    statsTodayTotal.value = 0
    statsTodayAppTotal.value = 0
    Object.keys(statsAppBreakdown.value).forEach(k => statsAppBreakdown.value[k as AppBreakdownKey].today = 0)
    const qBase = query(collection(db, "reports"), where("createdAt", ">=", Timestamp.fromDate(startOfDay)), where("status", "in", ["approved", "collected"]))
    const [countSnap, detailSnap] = await Promise.all([
      getCountFromServer(qBase),
      getDocs(query(qBase, orderBy("createdAt", "desc"), limit(100)))
    ])
    statsTodayTotal.value = countSnap.data().count
    detailSnap.forEach(doc => {
      const data = doc.data()
      if (isAppJob(data.jobName)) {
        statsTodayAppTotal.value++
        const nameLower = (data.jobName || '').toLowerCase()
        if (nameLower.includes('chứng khoán số 1') || nameLower.includes('kafi')) statsAppBreakdown.value['CK SỐ 1 (Kafi)'].today++
        else if (nameLower.includes('chứng khoán số 2') || nameLower.includes('dnse')) statsAppBreakdown.value['CK SỐ 2 (DNSE)'].today++
        else if (nameLower.includes('chứng khoán số 3') || nameLower.includes('kis')) statsAppBreakdown.value['CK SỐ 3 (KIS)'].today++
        else if (nameLower.includes('msb')) statsAppBreakdown.value['MSB BANK'].today++
        else if (nameLower.includes('vpbank') || nameLower.includes('vp bank')) statsAppBreakdown.value['VP BANK'].today++
        else if (nameLower.includes('tpbank') || nameLower.includes('tp bank')) statsAppBreakdown.value['TP BANK'].today++
      }
    })
  } catch (err) { console.error("Lỗi tải thống kê:", err) }
  finally { isStatsLoading.value = false }
}

const updateLocalStatsOnApprove = (jobName: string) => {
  statsTodayTotal.value++
  if (isAppJob(jobName)) {
    statsTodayAppTotal.value++
    const n = (jobName || '').toLowerCase()
    if (n.includes('chứng khoán số 1') || n.includes('kafi')) statsAppBreakdown.value['CK SỐ 1 (Kafi)'].today++
    else if (n.includes('chứng khoán số 2') || n.includes('dnse')) statsAppBreakdown.value['CK SỐ 2 (DNSE)'].today++
    else if (n.includes('chứng khoán số 3') || n.includes('kis')) statsAppBreakdown.value['CK SỐ 3 (KIS)'].today++
    else if (n.includes('msb')) statsAppBreakdown.value['MSB BANK'].today++
    else if (n.includes('vpbank') || n.includes('vp bank')) statsAppBreakdown.value['VP BANK'].today++
    else if (n.includes('tpbank') || n.includes('tp bank')) statsAppBreakdown.value['TP BANK'].today++
  }
}

// ============================================================================
// 2. SỔ TAY ĐỐI SOÁT
// ============================================================================
const saveDailyNote = async () => {
  const now = new Date()
  const dateStr = `Ngày ${now.getDate()}/${now.getMonth() + 1}`
  let detailArr: string[] = []
  for (const [name, val] of Object.entries(statsAppBreakdown.value)) {
    if (val.today > 0) detailArr.push(`${val.today} ${name}`)
  }
  const finalContent = detailArr.length > 0 ? detailArr.join(' - ') : "Chưa có đơn app nào."
  const { isConfirmed } = await Swal.fire({ title: 'CHỐT SỔ HÔM NAY?', text: `${dateStr}: ${finalContent}`, icon: 'question', showCancelButton: true, confirmButtonText: 'LƯU VÀO SỔ TAY', confirmButtonColor: '#10b981' })
  if (isConfirmed) {
    try {
      await addDoc(collection(db, "admin_notes"), { dateLabel: dateStr, content: finalContent, totalToday: statsTodayTotal.value, createdAt: serverTimestamp() })
      Swal.fire('Đã Lưu!', 'Dữ liệu đã được cất vào sổ tay.', 'success')
    } catch (e) { alert("Lỗi lưu note: " + e) }
  }
}

const deleteNote = async (id: string) => {
  if (confirm("Xóa dòng note này?")) await deleteDoc(doc(db, "admin_notes", id))
}

// ============================================================================
// 3. TÌM KIẾM
// ============================================================================
const searchQuery = ref('')

const handleSearch = () => {
  const text = searchQuery.value.trim()
  if (!text) { loadData(statusFilter.value); return }
  isLoading.value = true
  if (unsubReports) unsubReports()
  if (unsubWithdrawals) unsubWithdrawals()
  if (unsubFriendSearch) { unsubFriendSearch(); unsubFriendSearch = null }
  let matchedUids: string[] = []
  const lowerText = text.toLowerCase()
  for (const uid in usersMap.value) {
    const user = usersMap.value[uid]
    const uname = user.username ? String(user.username).toLowerCase() : ''
    const fname = user.fullName ? String(user.fullName).toLowerCase() : ''
    if (uname.includes(lowerText) || fname.includes(lowerText)) matchedUids.push(uid)
  }
  const limitedUids = matchedUids.slice(0, 10)
  let qReports = limitedUids.length > 0
    ? query(collection(db, "reports"), where("uid", "in", limitedUids), limit(200))
    : query(collection(db, "reports"), where("phoneRef", "==", text), limit(200))
  unsubReports = onSnapshot(qReports, async (snapshot) => {
    let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
    const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()
    data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    reports.value = data
    let uidsToSearch = limitedUids.length === 0 && data.length > 0 ? [data[0].uid] : limitedUids
    if (uidsToSearch.length > 0) {
      unsubWithdrawals = onSnapshot(query(collection(db, "withdrawals"), where("uid", "in", uidsToSearch.slice(0, 10))), (snapWith) => {
        let wData = snapWith.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
        wData.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
        withdrawals.value = wData
      })
    } else { withdrawals.value = [] }
    isLoading.value = false
    const missingUids = [...new Set(data.flatMap((r: any) => [r.uid, r.repairedUserUid]).filter((uid: string) => uid && !usersMap.value[uid]))]
    if (missingUids.length > 0) {
      const results = await Promise.all(missingUids.map((uid: string) => getDoc(doc(db, "users", uid))))
      const updated = { ...usersMap.value }
      results.forEach(d => { if (d.exists()) updated[d.id] = d.data() })
      usersMap.value = updated
    }
  }, (error) => { alert("LỖI TÌM KIẾM: " + error.message); isLoading.value = false })

  // Tìm thêm đơn giới thiệu bạn bè LPBank theo SĐT bạn bè được giới thiệu
  const normalizedPhone = normalizePhone(text)
  if (normalizedPhone.length >= 6) {
    unsubFriendSearch = onSnapshot(
      query(collection(db, "reports"), where("friendPhoneNormalized", "==", normalizedPhone), limit(50)),
      (snap) => {
        const extra = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
        if (!extra.length) return
        const existingIds = new Set(reports.value.map(r => r.id))
        const toAdd = extra.filter(r => !existingIds.has(r.id))
        if (!toAdd.length) return
        const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()
        const merged = [...reports.value, ...toAdd]
        merged.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
        reports.value = merged
      }
    )
  }
}

// ============================================================================
// 4. BULK APPROVE / REJECT
// ============================================================================
const selectedOtherJobs = ref<string[]>([])
const selectedAppJobs = ref<string[]>([])

watch(activeTab, () => { selectedOtherJobs.value = []; selectedAppJobs.value = [] })

const isAllOtherJobsSelected = computed(() => {
  const pending = filteredOtherReports.value.filter(r => r.status === 'pending')
  return pending.length > 0 && selectedOtherJobs.value.length === pending.length
})
const isAllAppJobsSelected = computed(() => {
  const pending = filteredAppReports.value.filter(r => r.status === 'pending')
  return pending.length > 0 && selectedAppJobs.value.length === pending.length
})

const toggleAllOtherJobs = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked
  selectedOtherJobs.value = checked ? filteredOtherReports.value.filter(r => r.status === 'pending').map(r => r.id) : []
}
const toggleAllAppJobs = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked
  selectedAppJobs.value = checked ? filteredAppReports.value.filter(r => r.status === 'pending').map(r => r.id) : []
}

const bulkRejectAppJobs = async () => {
  if (!selectedAppJobs.value.length) return
  const { value: reason, isConfirmed } = await Swal.fire({ title: `TỪ CHỐI ${selectedAppJobs.value.length} ĐƠN?`, input: 'text', inputPlaceholder: 'VD: Ảnh mờ, sai thông tin...', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonText: 'HỦY', confirmButtonText: 'TỪ CHỐI TẤT CẢ ❌' })
  if (isConfirmed) {
    try {
      Swal.fire({ title: 'ĐANG XỬ LÝ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
      for (const id of selectedAppJobs.value) {
        const rp = reports.value.find(r => r.id === id)
        if (!rp || rp.status !== 'pending') continue
        await updateDoc(doc(db, "reports", id), { status: 'rejected', note: reason || 'Thông tin không chính xác' })
      }
      selectedAppJobs.value = []
      Swal.fire('HOÀN TẤT!', 'Đã từ chối tất cả đơn đã chọn!', 'success')
    } catch (e) { Swal.fire('LỖI!', '' + e, 'error') }
  }
}

const bulkApproveOtherJobs = async () => {
  if (!selectedOtherJobs.value.length) return
  const { isConfirmed } = await Swal.fire({ title: `DUYỆT ${selectedOtherJobs.value.length} ĐƠN?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#3b82f6', cancelButtonText: 'HỦY', confirmButtonText: 'DUYỆT LUÔN 🚀' })
  if (isConfirmed) {
    try {
      Swal.fire({ title: 'ĐANG XỬ LÝ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
      for (const id of selectedOtherJobs.value) {
        const rp = reports.value.find(r => r.id === id)
        if (!rp || rp.status !== 'pending') continue
        const reward = Number(String(rp.reward || '0').replace(/\D/g, '')) || 0
        await setDoc(doc(db, "users", rp.uid), { balance: increment(reward) }, { merge: true })
        await updateDoc(doc(db, "reports", id), { status: 'approved', approvedAt: serverTimestamp() })
        updateLocalStatsOnApprove(rp.jobName)
      }
      selectedOtherJobs.value = []
      Swal.fire('THÀNH CÔNG!', 'Đã duyệt xong!', 'success')
    } catch (e) { Swal.fire('LỖI!', '' + e, 'error') }
  }
}

// ============================================================================
// 5. KÉO DỮ LIỆU FIREBASE
// ============================================================================
let unsubReports: any = null
let unsubWithdrawals: any = null
let unsubAdminNotes: any = null
let unsubFriendSearch: any = null

const loadData = (newStatus: string) => {
  if (searchQuery.value.trim() !== '') return
  isLoading.value = true
  if (unsubReports) { if (import.meta.env.DEV) console.log('[Firestore] STOP reports/withdrawals/admin_notes listeners'); unsubReports() }
  if (unsubWithdrawals) unsubWithdrawals()
  if (unsubAdminNotes) unsubAdminNotes()
  if (unsubFriendSearch) { unsubFriendSearch(); unsubFriendSearch = null }
  if (import.meta.env.DEV) console.log(`[Firestore] START admin listeners — reports limit(${newStatus === 'all' ? 200 : 300}), withdrawals limit(${newStatus === 'all' ? 100 : 150}), status: ${newStatus}`)
  const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : Date.now() + 15000)
  let qReports = newStatus === 'all'
    ? query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(200))
    : newStatus === 'approved'
      ? query(collection(db, "reports"), where("status", "in", ["approved", "collected"]), limit(300))
      : query(collection(db, "reports"), where("status", "==", newStatus), limit(300))
  unsubReports = onSnapshot(qReports, async (snap) => {
    let data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
    data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    reports.value = data; isLoading.value = false
    const missingUids = [...new Set(data.flatMap((r: any) => [r.uid, r.repairedUserUid]).filter((uid: string) => uid && !usersMap.value[uid]))]
    if (missingUids.length > 0) {
      const results = await Promise.all(missingUids.map((uid: string) => getDoc(doc(db, "users", uid))))
      const updated = { ...usersMap.value }
      results.forEach(d => { if (d.exists()) updated[d.id] = d.data() })
      usersMap.value = updated
    }
  }, (e) => { console.error(e); isLoading.value = false })
  let qWith = newStatus === 'all'
    ? query(collection(db, "withdrawals"), orderBy("createdAt", "desc"), limit(100))
    : query(collection(db, "withdrawals"), where("status", "==", newStatus), limit(150))
  unsubWithdrawals = onSnapshot(qWith, async (snap) => {
    let data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    data.sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt))
    withdrawals.value = data
    const missingUids = [...new Set(data.map((w: any) => w.uid).filter((uid: string) => uid && !usersMap.value[uid]))]
    if (missingUids.length > 0) {
      const results = await Promise.all(missingUids.map((uid: string) => getDoc(doc(db, "users", uid))))
      const updated = { ...usersMap.value }
      results.forEach(d => { if (d.exists()) updated[d.id] = d.data() })
      usersMap.value = updated
    }
  })
  unsubAdminNotes = onSnapshot(query(collection(db, "admin_notes"), limit(50)), (snap) => {
    let notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    notes.sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt))
    dailyNotes.value = notes
  })
}

watch(statusFilter, (val) => { if (!isCheckingAuth.value) { searchQuery.value = ''; loadData(val) } })

// ============================================================================
// 6. VIDEO TAB — Firebase Storage MP4
// ============================================================================
const videoReports = ref<any[]>([])
const videoStatusFilter = ref('pending')
const isVideoLoading = ref(false)
const playingVideoUrl = ref<string | null>(null)
let unsubVideos: any = null

const loadVideoReports = () => {
  isVideoLoading.value = true
  if (unsubVideos) unsubVideos()
  const q = videoStatusFilter.value === 'all'
    ? query(collection(db, "video_reports"), orderBy("createdAt", "desc"), limit(100))
    : query(collection(db, "video_reports"), where("status", "==", videoStatusFilter.value), orderBy("createdAt", "desc"), limit(100))
  unsubVideos = onSnapshot(q, (snap) => {
    videoReports.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    isVideoLoading.value = false
  }, (e) => { console.error("LỖI VIDEO:", e); isVideoLoading.value = false })
}

watch(videoStatusFilter, () => { if (activeTab.value === 'videos') loadVideoReports() })
watch(activeTab, (tab) => { if (tab === 'videos') loadVideoReports() })

const filteredVideoReports = computed(() =>
  videoReports.value.filter(v => siteFilter.value === 'all' || v.site === siteFilter.value)
)

const approveVideoReport = async (vr: any) => {
  const reward = Number(String(vr.reward || '0').replace(/\D/g, '')) || 0
  const { isConfirmed } = await Swal.fire({
    title: 'DUYỆT VIDEO NÀY?',
    text: `Cộng ${reward.toLocaleString()} XU cho ${vr.fullName || 'khách hàng'}?`,
    icon: 'question', showCancelButton: true,
    confirmButtonColor: '#10b981', confirmButtonText: 'DUYỆT ✅', cancelButtonText: 'HỦY'
  })
  if (!isConfirmed) return
  try {
    await updateDoc(doc(db, "users", vr.uid), { balance: increment(reward) })
    await updateDoc(doc(db, "video_reports", vr.id), { status: 'approved', approvedAt: serverTimestamp() })
    Swal.fire('ĐÃ DUYỆT!', `Đã cộng ${reward.toLocaleString()} XU.`, 'success')
  } catch (e) { alert("LỖI: " + e) }
}

const rejectVideoReport = async (vr: any) => {
  const { value: reason, isConfirmed } = await Swal.fire({
    title: 'TỪ CHỐI VIDEO?', input: 'text', inputPlaceholder: 'Lý do từ chối...',
    icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'TỪ CHỐI ❌'
  })
  if (!isConfirmed) return
  try {
    await updateDoc(doc(db, "video_reports", vr.id), { status: 'rejected', note: reason || 'Video không hợp lệ' })
  } catch (e) { alert("LỖI: " + e) }
}

const deleteVideoReport = async (id: string) => {
  if (!confirm("XÓA VIDEO REPORT NÀY?")) return
  try { await deleteDoc(doc(db, "video_reports", id)) } catch (e) { alert("LỖI: " + e) }
}

// ============================================================================
// 7. VIP JOBS MANAGEMENT
// ============================================================================
const vipJobs = ref<any[]>([])
const isVipJobsLoading = ref(false)
const isSeedingVipJobs = ref(false)
const editingVipJob = ref<Record<string, any>>({})
const newVipJobId = ref('')
let unsubVipJobs: any = null

const VIP_JOB_IDS = ['liobank', 'app-chung-khoan-3', 'app-chung-khoan-4', 'msb-bank', 'vpbank', 'app-chung-khoan', 'app-chung-khoan-2', 'abbank', 'lpbank-plus']

const loadVipJobs = () => {
  if (unsubVipJobs) unsubVipJobs()
  isVipJobsLoading.value = true
  unsubVipJobs = onSnapshot(
    query(collection(db, 'vip_jobs'), orderBy('order', 'asc')),
    snap => {
      vipJobs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Khởi tạo editingVipJob cho các job mới load
      snap.docs.forEach(d => {
        if (!editingVipJob.value[d.id]) {
          editingVipJob.value[d.id] = { ...d.data() }
        }
      })
      isVipJobsLoading.value = false
    },
    (e) => { console.error('LỖI VIP JOBS:', e); isVipJobsLoading.value = false }
  )
}

const saveVipJob = async (jobId: string) => {
  const data = { ...editingVipJob.value[jobId], updatedAt: serverTimestamp() }
  delete data.id
  try {
    await setDoc(doc(db, 'vip_jobs', jobId), data, { merge: true })
    Swal.fire('Đã Lưu!', `Đã cập nhật job "${jobId}"`, 'success')
  } catch (e) { Swal.fire('LỖI!', '' + e, 'error') }
}

const deleteVipJob = async (id: string) => {
  const { isConfirmed } = await Swal.fire({
    title: `XÓA VIP JOB "${id}"?`,
    text: 'Job sẽ fallback về dữ liệu tĩnh trong jobs.ts.',
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', confirmButtonText: 'XÓA', cancelButtonText: 'HỦY'
  })
  if (!isConfirmed) return
  try {
    await deleteDoc(doc(db, 'vip_jobs', id))
    delete editingVipJob.value[id]
  } catch (e) { alert('LỖI XÓA: ' + e) }
}

const setVipJobStatus = async (jobId: string, status: string) => {
  try {
    await updateDoc(doc(db, 'vip_jobs', jobId), { status, updatedAt: serverTimestamp() })
    if (editingVipJob.value[jobId]) editingVipJob.value[jobId].status = status
  } catch (e) { alert('LỖI: ' + e) }
}

const addNewVipJob = async () => {
  const id = newVipJobId.value.trim()
  if (!id) { alert('Nhập Job ID trước!'); return }
  const exists = vipJobs.value.find(v => v.id === id)
  if (exists) { alert('Job ID này đã tồn tại!'); return }
  try {
    await setDoc(doc(db, 'vip_jobs', id), {
      title: id, reward: '0 xu', badge: 'NEW', color: 'text-blue-400',
      warning: '', status: 'open', order: vipJobs.value.length + 1,
      updatedAt: serverTimestamp()
    })
    editingVipJob.value[id] = { title: id, reward: '0 xu', badge: 'NEW', color: 'text-blue-400', warning: '', status: 'open', order: vipJobs.value.length + 1 }
    newVipJobId.value = ''
    Swal.fire('Đã Thêm!', `Job "${id}" đã được tạo. Hãy chỉnh sửa thông tin.`, 'success')
  } catch (e) { Swal.fire('LỖI!', '' + e, 'error') }
}

const seedVipJobs = async () => {
  const existingIds = new Set(vipJobs.value.map((v: any) => v.id))
  const toCreate = VIP_JOB_IDS.filter(id => !existingIds.has(id))
  if (toCreate.length === 0) {
    Swal.fire('Đã đủ!', 'Tất cả VIP jobs đã có trong Firestore.', 'info')
    return
  }
  isSeedingVipJobs.value = true
  let created = 0
  for (const [idx, id] of toCreate.entries()) {
    const s = (jobsData as Record<string, any>)[id]
    if (!s) continue
    const newOrder = vipJobs.value.length + idx + 1
    await setDoc(doc(db, 'vip_jobs', id), {
      title: s.title,
      reward: s.reward,
      badge: s.badge || 'VIP',
      color: s.color || 'text-amber-400',
      warning: s.warning || '',
      ageRequirement: s.ageRequirement ?? null,
      status: 'open',
      order: newOrder,
      updatedAt: serverTimestamp()
    })
    editingVipJob.value[id] = {
      title: s.title, reward: s.reward,
      badge: s.badge || 'VIP', color: s.color || 'text-amber-400',
      warning: s.warning || '', ageRequirement: s.ageRequirement ?? null,
      status: 'open', order: newOrder
    }
    created++
  }
  isSeedingVipJobs.value = false
  Swal.fire('Seed hoàn tất!', `Đã tạo ${created} VIP job mới vào Firestore.`, 'success')
}

// ============================================================================
// 8. APP CONFIG MANAGEMENT
// ============================================================================
const appConfig = ref({ appVersion: 0, forceRefreshEnabled: false, refreshMessage: '' })
const isSavingConfig = ref(false)
let unsubAppConfig: any = null

const loadAppConfig = () => {
  if (unsubAppConfig) unsubAppConfig()
  unsubAppConfig = onSnapshot(doc(db, 'app_config', 'overall'), snap => {
    if (snap.exists()) {
      const data = snap.data()
      appConfig.value = {
        appVersion: data.appVersion || 0,
        forceRefreshEnabled: data.forceRefreshEnabled || false,
        refreshMessage: data.refreshMessage || ''
      }
    }
  })
}

const saveAppConfig = async () => {
  isSavingConfig.value = true
  try {
    await setDoc(doc(db, 'app_config', 'overall'), {
      appVersion: appConfig.value.appVersion,
      forceRefreshEnabled: appConfig.value.forceRefreshEnabled,
      refreshMessage: appConfig.value.refreshMessage,
      updatedAt: serverTimestamp()
    })
    Swal.fire('Đã Lưu!', 'Cấu hình web đã được cập nhật.', 'success')
  } catch (e) { Swal.fire('LỖI!', '' + e, 'error') }
  finally { isSavingConfig.value = false }
}

const bumpAppVersion = () => {
  appConfig.value.appVersion = (appConfig.value.appVersion || 0) + 1
}

// ============================================================================
// 8.2. SUPPORT CONFIG MANAGEMENT
// ============================================================================
const supportConfigAdmin = ref({
  enabled: true,
  autoPopupEnabled: false,
  announcementVersion: 1,
  title: 'Hỗ trợ',
  message: 'Cần hỗ trợ? Vui lòng nhắn tin Fanpage để được xử lý.',
})
const isSavingSupportConfig = ref(false)
let unsubSupportConfig: any = null

const loadSupportConfig = () => {
  if (unsubSupportConfig) unsubSupportConfig()
  unsubSupportConfig = onSnapshot(doc(db, 'support_config', 'overall'), snap => {
    if (snap.exists()) {
      const data = snap.data()
      supportConfigAdmin.value = {
        enabled: data.enabled ?? true,
        autoPopupEnabled: data.autoPopupEnabled ?? false,
        announcementVersion: Number(data.announcementVersion ?? 1),
        title: (data.title as string) ?? 'Hỗ trợ',
        message: (data.message as string) ?? '',
      }
    }
  })
}

const saveSupportConfig = async () => {
  isSavingSupportConfig.value = true
  try {
    await setDoc(doc(db, 'support_config', 'overall'), {
      enabled: supportConfigAdmin.value.enabled,
      autoPopupEnabled: supportConfigAdmin.value.autoPopupEnabled,
      announcementVersion: supportConfigAdmin.value.announcementVersion,
      title: supportConfigAdmin.value.title,
      message: supportConfigAdmin.value.message,
      updatedAt: serverTimestamp(),
    })
    Swal.fire('Đã Lưu!', 'Cấu hình hỗ trợ đã được cập nhật.', 'success')
  } catch (e) { Swal.fire('LỖI!', '' + e, 'error') }
  finally { isSavingSupportConfig.value = false }
}

const bumpAnnouncementVersion = () => {
  supportConfigAdmin.value.announcementVersion = (supportConfigAdmin.value.announcementVersion || 1) + 1
}

// ============================================================================
// 9. CÁC HÀM XỬ LÝ
// ============================================================================

// EXIF HELPERS
const toMs = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()
const parseExifDate = (d: any) => { if (!d) return null; const dt = new Date(d); return isNaN(dt.getTime()) ? null : dt }
const isOldPhoto = (dateTaken: any, createdAt: any) => { const shot = parseExifDate(dateTaken); if (!shot) return false; return (toMs(createdAt) - shot.getTime()) / 86400000 > 7 }
const fmtDate = (d: any) => { const dt = parseExifDate(d); if (!dt) return ''; return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
const hasOldPhoto = (arr: any[], createdAt: any) => Array.isArray(arr) && arr.some(e => isOldPhoto(e?.dateTaken, createdAt))

const openRejectPopup = (id: string) => { selectedReportId.value = id; rejectReason.value = ''; showRejectPopup.value = true }
const closeRejectPopup = () => { showRejectPopup.value = false; selectedReportId.value = null; rejectReason.value = '' }
const selectedReportForReject = computed(() => reports.value.find(r => r.id === selectedReportId.value))
const lpbankRejectReasons = ['Ảnh không hợp lệ', 'Không thấy mã giới thiệu', 'Không đủ 2 ảnh', 'Thông tin không đúng', 'Bạn nhắn tin Fanpage đi ạ', 'Khác']
const confirmReject = async () => {
  if (!selectedReportId.value) return
  try {
    await updateDoc(doc(db, "reports", selectedReportId.value), {
      status: 'rejected',
      note: rejectReason.value || "Thông tin không chính xác",
      rejectedAt: serverTimestamp(),
      rejectedBy: auth.currentUser?.uid || null
    })
    closeRejectPopup()
  }
  catch (e) { alert("LỖI: " + e) }
}

const showMessagePopup = ref(false)
const messageText = ref('')
const openMessagePopup = (id: string) => { selectedReportId.value = id; messageText.value = ''; showMessagePopup.value = true }
const closeMessagePopup = () => { showMessagePopup.value = false; selectedReportId.value = null; messageText.value = '' }
const confirmMessage = async () => {
  if (!selectedReportId.value) return
  try { await updateDoc(doc(db, "reports", selectedReportId.value), { note: messageText.value || "Vui lòng liên hệ Admin" }); closeMessagePopup() }
  catch (e) { alert("LỖI: " + e) }
}

// ============================================================================
// GẮN HỒ SƠ VÍ THỦ CÔNG — dùng khi report.uid không khớp hồ sơ users/{uid} nào
// (VD: user cài lại app / đổi máy trước khi có hệ thống liên kết). Admin tìm hồ sơ
// thật theo UID / SĐT / tên đăng nhập / họ tên — KHÔNG BAO GIỜ dùng friendName/friendPhone
// vì đó là bạn bè được giới thiệu, không phải chủ ví nhận xu.
// ============================================================================
const walletLinkModal = ref<{ open: boolean; report: any | null }>({ open: false, report: null })
const walletLinkQuery = ref('')
const walletLinkResults = ref<Array<{ uid: string; data: any }>>([])
const walletLinkLoading = ref(false)
const walletLinkError = ref('')

const openWalletLinkModal = (rp: any) => {
  walletLinkModal.value = { open: true, report: rp }
  walletLinkQuery.value = ''
  walletLinkResults.value = []
  walletLinkError.value = ''
}
const closeWalletLinkModal = () => { walletLinkModal.value = { open: false, report: null } }

const searchUsersToLink = async () => {
  const text = walletLinkQuery.value.trim()
  if (!text) return
  walletLinkLoading.value = true
  walletLinkError.value = ''
  const found: Record<string, { uid: string; data: any }> = {}
  try {
    try {
      const directSnap = await getDoc(doc(db, 'users', text))
      if (directSnap.exists()) found[directSnap.id] = { uid: directSnap.id, data: directSnap.data() }
    } catch {}

    const normalized = normalizePhone(text)
    if (normalized.length >= 6) {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', normalized), limit(5)))
        snap.docs.forEach(d => { found[d.id] = { uid: d.id, data: d.data() } })
      } catch {}
      if (normalized !== text) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', text), limit(5)))
          snap.docs.forEach(d => { found[d.id] = { uid: d.id, data: d.data() } })
        } catch {}
      }
    }

    for (const field of ['username', 'fullName']) {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where(field, '==', text), limit(5)))
        snap.docs.forEach(d => { found[d.id] = { uid: d.id, data: d.data() } })
      } catch {}
    }

    walletLinkResults.value = Object.values(found)
    if (walletLinkResults.value.length === 0) walletLinkError.value = 'Không tìm thấy user nào khớp SĐT/tên/UID.'
  } catch (e) {
    walletLinkError.value = 'Lỗi tìm kiếm: ' + e
  } finally {
    walletLinkLoading.value = false
  }
}

const confirmWalletLink = async (candidate: { uid: string; data: any }) => {
  const rp = walletLinkModal.value.report
  if (!rp) return
  const candidateName = candidate.data?.fullName || candidate.data?.username || 'Chưa cập nhật'
  if (!confirm(`Gắn đơn này (UID gốc: ${rp.uid}) vào hồ sơ ví UID: ${candidate.uid} (${candidateName})?`)) return
  try {
    await updateDoc(doc(db, 'reports', rp.id), {
      repairedUserUid: candidate.uid,
      originalReportUid: rp.uid,
      repairedByAdmin: true,
      repairedAt: serverTimestamp(),
    })
    usersMap.value = { ...usersMap.value, [candidate.uid]: candidate.data }
    alert('🎉 Đã gắn hồ sơ ví thành công!')
    closeWalletLinkModal()
  } catch (e) { alert('Lỗi gắn hồ sơ ví: ' + e) }
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isBoss = user.email === 'nguyenvanca14062001@gmail.com'
      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (!isBoss && userDoc.data()?.role !== 'admin') {
        isCheckingAuth.value = false
        isLoggedIn.value = false
        await signOut(auth)
        loginError.value = 'Tài khoản này không có quyền truy cập Admin.'
        return
      }
      isLoggedIn.value = true
      isCheckingAuth.value = false
      if (import.meta.env.DEV) console.log('[Firestore] Admin auth OK — bắt đầu load dữ liệu, usersMap lazy-load qua snapshot callbacks')
      loadData(statusFilter.value)
      loadDashboardStats()
      loadVipJobs()
      loadAppConfig()
      loadSupportConfig()
    } else {
      isLoggedIn.value = false
      isCheckingAuth.value = false
    }
  })
})

const isAppJob = (jobName: string) => {
  if (!jobName) return false
  const n = jobName.toLowerCase()
  return ['app', 'ngân hàng', 'chứng khoán', 'vpbank', 'tpbank', 'mbbank', 'msb', 'cake', 'tnex', 'kafi', 'dnse', 'kis'].some(kw => n.includes(kw))
}

// Ví thật để cộng/trừ xu — ưu tiên repairedUserUid (gắn thủ công bởi admin khi report.uid
// không khớp hồ sơ user nào). KHÔNG bao giờ dùng friendPhone/friendName (đó là bạn bè được
// giới thiệu, không phải chủ ví).
const effUid = (rp: any) => rp?.repairedUserUid || rp?.uid

const checkReportStatus = (status: string) => {
  if (statusFilter.value === 'all') return true
  if (statusFilter.value === 'approved') return status === 'approved' || status === 'collected'
  return status === statusFilter.value
}

const filteredAppReports = computed(() => reports.value.filter(r => (siteFilter.value === 'all' || r.site === siteFilter.value) && (searchQuery.value.trim() ? true : checkReportStatus(r.status)) && isAppJob(r.jobName)))
const filteredOtherReports = computed(() => reports.value.filter(r => (siteFilter.value === 'all' || r.site === siteFilter.value) && (searchQuery.value.trim() ? true : checkReportStatus(r.status)) && !isAppJob(r.jobName)))
const filteredWithdrawals = computed(() => withdrawals.value.filter(w => (siteFilter.value === 'all' || w.site === siteFilter.value) && (searchQuery.value.trim() ? true : (statusFilter.value === 'all' || w.status === statusFilter.value))))

const getXuAmount = (wd: any) => { let x = wd.amountXu || wd.amount || wd.xu || 0; if (typeof x === 'string') x = Number(x.replace(/\D/g, '')); return Number(x) || 0 }
const getVndAmount = (wd: any) => { let v = wd.realMoney || wd.money || 0; if (typeof v === 'string') v = Number(v.replace(/\D/g, '')); let fv = Number(v) || 0; let fx = getXuAmount(wd); if (fv === 0 && fx > 0) fv = fx / 10; else if (fv === fx && fx > 0) fv = fx / 10; return fv }

const fixUserWallet = async (uid: string) => {
  const cur = usersMap.value[uid]?.balance || 0
  const newVal = prompt(`Ví hiện tại: ${cur} XU.\nNhập số mới:`, "0")
  if (newVal !== null) {
    const clean = Number(newVal.replace(/\D/g, '')) || 0
    try { await updateDoc(doc(db, "users", uid), { balance: clean }); alert(`Đã sửa ví: ${clean} XU`) } catch (e) { alert("Lỗi: " + e) }
  }
}

// Cộng xu tự do vào ví user — độc lập với mọi report/job, admin muốn cộng bao nhiêu cũng được.
// Luôn dùng increment() (không setDoc/ghi đè balance) để không làm mất số xu hiện có của user.
const addXuToUser = async (uid: string) => {
  if (!uid) { Swal.fire('LỖI!', 'Không tìm thấy UID user.', 'error'); return }
  const user = usersMap.value[uid] || {}
  const curBalance = Number(user?.balance) || 0

  const { value: amountInput, isConfirmed } = await Swal.fire({
    title: '💰 CỘNG XU CHO VÍ',
    html: `
      <div style="text-align:left;font-size:12.5px;line-height:1.8">
        <b>User:</b> ${user.username || user.fullName || '—'}<br/>
        <b>UID:</b> ${uid}<br/>
        <b>Ví hiện tại:</b> ${curBalance.toLocaleString()} XU
      </div>`,
    input: 'number',
    inputLabel: 'Số xu muốn cộng (nhập số âm để trừ)',
    inputPlaceholder: 'VD: 50000',
    showCancelButton: true,
    confirmButtonText: 'Xác nhận cộng xu ✅',
    confirmButtonColor: '#10b981',
    cancelButtonText: 'Huỷ',
    inputValidator: (v) => (v === '' || Number.isNaN(Number(v)) || Number(v) === 0) ? 'Vui lòng nhập số xu hợp lệ (khác 0)' : undefined
  })
  if (!isConfirmed) return
  const amount = Math.round(Number(amountInput))

  try {
    await updateDoc(doc(db, "users", uid), { balance: increment(amount) })
    usersMap.value = { ...usersMap.value, [uid]: { ...usersMap.value[uid], balance: curBalance + amount } }
    Swal.fire('THÀNH CÔNG!', `${amount > 0 ? '+' : ''}${amount.toLocaleString()} XU. Ví mới: ${(curBalance + amount).toLocaleString()} XU`, 'success')
  } catch (e: any) {
    Swal.fire('LỖI!', e.message || String(e), 'error')
  }
}

// ============================================================================
// CỘNG XU CHO ĐƠN reports (job thường / VIP / referral LPBANK) — bấm 1 nút duy nhất.
// Dùng Firestore transaction: đọc lại report + user ngay trước khi ghi, chặn cộng trùng
// nếu report không còn 'pending', và chỉ update field balance (increment) — không bao giờ
// setDoc ghi đè toàn bộ user hay ép balance về một số cố định.
// ============================================================================
const approveReport = async (report: any) => {
  const targetUid = effUid(report)
  const isReferral = report.jobId === LPBANK_REFERRAL_JOB_ID
  const user = usersMap.value[targetUid] || {}

  let suggestedReward = Number(String(report.reward || report.suggestedReward || '0').replace(/\D/g, '')) || 0
  if (isReferral) {
    const rawCount = Number(user?.lpbankReferralPaidCount)
    let successCountBefore = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : NaN
    if (!Number.isFinite(successCountBefore)) {
      // Ước tính fallback ngoài transaction — chỉ dùng để hiển thị số đề xuất khi user chưa có counter
      const fallbackSnap = await getDocs(query(
        collection(db, "reports"),
        where("uid", "==", targetUid),
        where("jobId", "==", LPBANK_REFERRAL_JOB_ID),
        where("status", "in", ["approved", "paid", "collected", "completed"])
      ))
      successCountBefore = fallbackSnap.size
    }
    suggestedReward = getLpbankReferralRewardByCount(successCountBefore)
  }

  const { value: rewardInput, isConfirmed } = await Swal.fire({
    title: '💰 CỘNG XU ĐƠN NÀY',
    html: `
      <div style="text-align:left;font-size:12.5px;line-height:1.8">
        <b>Tên user:</b> ${user.fullName || user.username || report.fullName || '—'}<br/>
        <b>SĐT:</b> ${report.phoneRef || user.phoneRef || user.phone || '—'}<br/>
        <b>UID:</b> ${targetUid || '—'}<br/>
        <b>Tên job:</b> ${report.jobName || '—'}<br/>
        <b>Mã đơn:</b> ${report.id}<br/>
        <b>Trạng thái hiện tại:</b> ${report.status}
      </div>`,
    input: 'number',
    inputValue: suggestedReward,
    inputLabel: `Số xu cộng (đề xuất ${suggestedReward.toLocaleString()} xu)`,
    showCancelButton: true,
    confirmButtonText: 'Xác nhận cộng xu ✅',
    confirmButtonColor: '#10b981',
    cancelButtonText: 'Huỷ'
  })
  if (!isConfirmed) return
  const amount = Math.max(0, Math.round(Number(rewardInput) || 0))

  try {
    let newSuccessNumber = 0
    await runTransaction(db, async (tx) => {
      const reportRef = doc(db, "reports", report.id)
      const reportSnap = await tx.get(reportRef)
      if (!reportSnap.exists()) throw new Error('Đơn không tồn tại.')
      if (reportSnap.data().status !== 'pending') throw new Error('Đơn này đã được xử lý trước đó.')

      const userRef = doc(db, "users", targetUid)
      const userSnap = await tx.get(userRef)
      if (!userSnap.exists()) throw new Error('User chưa có hồ sơ ví.')

      const reportUpdates: any = {
        status: 'approved',
        actualReward: amount,
        reward: amount,
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.email || auth.currentUser?.uid || null
      }

      if (isReferral) {
        const rawCount = Number(userSnap.data()?.lpbankReferralPaidCount)
        const successCountBefore = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0
        newSuccessNumber = successCountBefore + 1
        reportUpdates.referralSuccessNumber = newSuccessNumber
        reportUpdates.referralProgram = 'lpbank'
        // merge:true — chỉ ghi 2 field này, không đụng tới phần còn lại của user doc
        tx.set(userRef, { balance: increment(amount), lpbankReferralPaidCount: newSuccessNumber }, { merge: true })
      } else {
        tx.update(userRef, { balance: increment(amount) })
      }

      tx.update(reportRef, reportUpdates)
    })

    const curBal = Number(usersMap.value[targetUid]?.balance) || 0
    usersMap.value = {
      ...usersMap.value,
      [targetUid]: {
        ...usersMap.value[targetUid],
        balance: curBal + amount,
        ...(isReferral ? { lpbankReferralPaidCount: newSuccessNumber } : {})
      }
    }
    Swal.fire('ĐÃ CỘNG XU!', `+${amount.toLocaleString()} XU${isReferral ? ` — Lần giới thiệu #${newSuccessNumber}` : ''}`, 'success')
    updateLocalStatsOnApprove(report.jobName)
  } catch (e: any) {
    Swal.fire('LỖI!', e.message || String(e), 'error')
  }
}

const deleteReport = async (id: string) => {
  if (confirm("XÓA VĨNH VIỄN?")) try { await deleteDoc(doc(db, "reports", id)) } catch (e) { alert("LỖI: " + e) }
}

const approveWithdrawal = async (item: any) => {
  const { isConfirmed } = await Swal.fire({ title: 'XÁC NHẬN ĐÃ CHUYỂN KHOẢN?', text: `${getVndAmount(item).toLocaleString('vi-VN')} VNĐ`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ĐÃ CHUYỂN', confirmButtonColor: '#10b981', cancelButtonText: 'HỦY' })
  if (isConfirmed) {
    try {
      await updateDoc(doc(db, "withdrawals", item.id), { status: 'approved', paidAt: serverTimestamp() })
      await updateDoc(doc(db, "users", item.uid), { hasPendingWithdraw: false })
      Swal.fire('HOÀN TẤT! 🎉', 'Duyệt rút tiền thành công!', 'success')
    } catch (e: any) { Swal.fire('Lỗi!', e.message, 'error') }
  }
}

const rejectWithdrawal = async (item: any) => {
  const { value: note, isConfirmed } = await Swal.fire({ title: 'TỪ CHỐI RÚT TIỀN', input: 'text', inputPlaceholder: 'Lý do...', showCancelButton: true, confirmButtonColor: '#ef4444' })
  if (isConfirmed) {
    try {
      await updateDoc(doc(db, "withdrawals", item.id), { status: 'rejected', adminNote: note || 'Từ chối' })
      await updateDoc(doc(db, "users", item.uid), { balance: increment(getXuAmount(item)), hasPendingWithdraw: false })
      Swal.fire('Đã hủy & Hoàn xu!', `Hoàn ${getXuAmount(item).toLocaleString()} XU.`, 'success')
    } catch (e: any) { Swal.fire('Lỗi!', e.message, 'error') }
  }
}

const deleteWithdrawal = async (id: string) => {
  if (confirm("XÓA? KHÔNG HOÀN TIỀN!")) try { await deleteDoc(doc(db, "withdrawals", id)) } catch (e) { alert("LỖI: " + e) }
}

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const handleAdminLogout = async () => {
  if (confirm('XÁC NHẬN THOÁT?')) { await signOut(auth); router.push('/') }
}
</script>

<template>
  <div class="admin-theme min-h-screen bg-[var(--admin-bg)] flex flex-col items-center justify-center" v-if="isCheckingAuth">
    <div class="w-16 h-16 border-4 border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin"></div>
    <p class="mt-4 text-[var(--admin-primary)] font-black italic uppercase tracking-widest text-sm">Đang xác minh Admin...</p>
  </div>

  <!-- LOGIN FORM -->
  <div class="admin-theme min-h-screen bg-[var(--admin-bg)] flex items-center justify-center p-4" v-else-if="!isLoggedIn">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-black italic uppercase text-[var(--admin-text)] tracking-tighter">ADMIN <span class="text-[var(--admin-primary)]">LOGIN</span></h1>
        <p class="text-[var(--admin-muted)] text-[10px] tracking-[3px] mt-2 font-black italic uppercase">MMO PRO · FREELANCE · RAP JOB</p>
      </div>
      <div class="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-3xl p-8 shadow-lg">
        <div class="space-y-4">
          <div>
            <label class="text-[10px] text-[var(--admin-muted)] font-black italic uppercase tracking-widest block mb-2">EMAIL</label>
            <input
              class="w-full bg-[var(--admin-card-soft)] text-[var(--admin-text)] text-sm py-3 px-4 rounded-xl border border-[var(--admin-border)] outline-none focus:border-[var(--admin-primary)] transition-colors font-sans not-italic normal-case placeholder:text-slate-400"
              type="email" v-model="loginEmail" placeholder="admin@example.com" @keyup.enter="loginAdmin"
            />
          </div>
          <div>
            <label class="text-[10px] text-[var(--admin-muted)] font-black italic uppercase tracking-widest block mb-2">MẬT KHẨU</label>
            <input
              class="w-full bg-[var(--admin-card-soft)] text-[var(--admin-text)] text-sm py-3 px-4 rounded-xl border border-[var(--admin-border)] outline-none focus:border-[var(--admin-primary)] transition-colors font-sans not-italic normal-case placeholder:text-slate-400"
              type="password" v-model="loginPassword" placeholder="••••••••" @keyup.enter="loginAdmin"
            />
          </div>
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3" v-if="loginError">
            <p class="text-[var(--admin-danger)] text-xs font-sans not-italic normal-case font-bold">{{ loginError }}</p>
          </div>
          <button
            class="w-full bg-[var(--admin-primary)] hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black italic uppercase tracking-widest py-3.5 rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 mt-2"
            @click="loginAdmin" :disabled="isLoginLoading"
          >
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" v-if="isLoginLoading"></div>
            <span>{{ isLoginLoading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="admin-theme min-h-screen bg-[var(--admin-bg)] p-4 md:p-10 font-black italic uppercase text-left selection:bg-blue-200 relative" v-else>

    <!-- ZOOM ẢNH -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" v-if="selectedImage" @click="closeImage">
        <button class="absolute top-6 right-6 w-12 h-12 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[6010]" @click.stop="closeImage">✕</button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain z-[6005] cursor-default" :src="selectedImage" @click.stop />
      </div>
    </Transition>

    <!-- POPUP XEM VIDEO -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" v-if="playingVideoUrl" @click="playingVideoUrl = null">
        <button class="absolute top-6 right-6 w-12 h-12 bg-slate-800 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[6010]" @click.stop="playingVideoUrl = null">✕</button>
        <video class="max-w-full max-h-[85vh] rounded-2xl z-[6005]" :src="playingVideoUrl" controls autoplay @click.stop></video>
      </div>
    </Transition>

    <!-- POPUP HỦY -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[5000] flex items-center justify-center px-4" v-if="showRejectPopup">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeRejectPopup"></div>
        <div class="admin-theme relative bg-[var(--admin-card)] border border-red-200 w-full max-w-md p-6 rounded-2xl shadow-xl text-center">
          <h3 class="text-xl text-[var(--admin-danger)] mb-4">TỪ CHỐI BẰNG CHỨNG</h3>
          <p class="text-[var(--admin-muted)] text-xs normal-case not-italic font-bold mb-4">Vui lòng nhập lý do từ chối để khách hàng biết.</p>
          <div class="flex flex-wrap gap-2 mb-4 justify-center" v-if="selectedReportForReject?.jobId === LPBANK_REFERRAL_JOB_ID">
            <button v-for="r in lpbankRejectReasons" :key="r"
                    class="px-3 py-1.5 bg-[var(--admin-card-soft)] hover:bg-[var(--admin-danger)] text-[var(--admin-muted)] hover:text-white rounded-lg text-[10px] font-sans not-italic normal-case transition-colors"
                    @click="rejectReason = r">{{ r }}</button>
          </div>
          <textarea class="w-full bg-[var(--admin-card-soft)] text-[var(--admin-text)] border border-[var(--admin-border)] rounded-xl p-3 mb-6 font-sans normal-case not-italic text-sm outline-none focus:border-[var(--admin-danger)]" v-model="rejectReason" rows="3" placeholder="Ví dụ: Ảnh mờ, Sai thông tin..."></textarea>
          <div class="flex gap-3 justify-end">
            <button class="px-5 py-2 bg-[var(--admin-card-soft)] text-[var(--admin-muted)] hover:bg-slate-200 rounded-xl text-xs" @click="closeRejectPopup">HỦY BỎ</button>
            <button class="px-5 py-2 bg-[var(--admin-danger)] hover:bg-red-700 text-white rounded-xl text-xs shadow-md" @click="confirmReject">XÁC NHẬN TỪ CHỐI</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP NHẮN TIN -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[5000] flex items-center justify-center px-4" v-if="showMessagePopup">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeMessagePopup"></div>
        <div class="admin-theme relative bg-[var(--admin-card)] border border-blue-200 w-full max-w-md p-6 rounded-2xl shadow-xl text-center">
          <h3 class="text-xl text-[var(--admin-primary)] mb-4">GỬI LỜI NHẮN (ĐƠN VẪN CHỜ)</h3>
          <p class="text-[var(--admin-muted)] text-xs normal-case not-italic font-bold mb-4">Lời nhắn sẽ hiển thị cho khách nhưng đơn không bị Hủy.</p>
          <textarea class="w-full bg-[var(--admin-card-soft)] text-[var(--admin-text)] border border-[var(--admin-border)] rounded-xl p-3 mb-6 font-sans normal-case not-italic text-sm outline-none focus:border-[var(--admin-primary)]" v-model="messageText" rows="3" placeholder="Ví dụ: Bạn nhắn tin cho Admin để kiểm tra lại nhé..."></textarea>
          <div class="flex gap-3 justify-end">
            <button class="px-5 py-2 bg-[var(--admin-card-soft)] text-[var(--admin-muted)] hover:bg-slate-200 rounded-xl text-xs" @click="closeMessagePopup">HỦY BỎ</button>
            <button class="px-5 py-2 bg-[var(--admin-primary)] hover:bg-blue-700 text-white rounded-xl text-xs shadow-md" @click="confirmMessage">GỬI LỜI NHẮN</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- GẮN HỒ SƠ VÍ THỦ CÔNG -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[5000] flex items-center justify-center px-4" v-if="walletLinkModal.open">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeWalletLinkModal"></div>
        <div class="admin-theme relative bg-[var(--admin-card)] border border-blue-200 w-full max-w-md p-6 rounded-2xl shadow-xl">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-[var(--admin-primary)] text-base font-black tracking-widest">GẮN HỒ SƠ VÍ THỦ CÔNG</h3>
            <button class="text-[var(--admin-muted)] hover:text-[var(--admin-danger)] text-lg leading-none" @click="closeWalletLinkModal">✕</button>
          </div>
          <p class="text-[var(--admin-muted)] text-[11px] mb-3 font-sans not-italic normal-case">Đơn UID gốc: {{ walletLinkModal.report?.uid }}</p>
          <div class="flex gap-2 mb-2">
            <input v-model="walletLinkQuery" @keyup.enter="searchUsersToLink" type="text" placeholder="SĐT / Tên đăng nhập / Họ tên / UID"
                   class="flex-1 bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-sm text-[var(--admin-text)] placeholder-slate-400 outline-none focus:border-[var(--admin-primary)] font-sans not-italic normal-case" />
            <button @click="searchUsersToLink" :disabled="walletLinkLoading"
                    class="bg-[var(--admin-primary)] hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-black uppercase transition-all active:scale-95">
              {{ walletLinkLoading ? '...' : 'Tìm' }}
            </button>
          </div>
          <p v-if="walletLinkError" class="text-[var(--admin-danger)] text-[11px] mb-2 font-sans not-italic normal-case">{{ walletLinkError }}</p>
          <div class="max-h-64 overflow-y-auto space-y-2">
            <div v-for="r in walletLinkResults" :key="r.uid" class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-lg p-3 flex justify-between items-center gap-2">
              <div class="text-xs min-w-0 font-sans not-italic normal-case">
                <div class="text-[var(--admin-text)] font-bold truncate">{{ r.data?.fullName || r.data?.username || 'Chưa cập nhật' }}</div>
                <div class="text-[var(--admin-muted)] text-[10px] truncate">UID: {{ r.uid?.slice(0, 8) }}… · SĐT: {{ r.data?.phone || '—' }} · Ví: {{ (r.data?.balance || 0).toLocaleString('vi-VN') }} XU</div>
              </div>
              <button @click="confirmWalletLink(r)"
                      class="bg-[var(--admin-success)] hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 shrink-0">
                Chọn
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- HEADER -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <h1 class="text-3xl md:text-5xl text-[var(--admin-text)] tracking-tighter leading-none">HỆ THỐNG <span class="text-[var(--admin-primary)]">ADMIN</span></h1>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1 bg-[var(--admin-card)] p-1.5 rounded-xl border border-[var(--admin-border)] shadow-sm">
          <input class="bg-white text-[var(--admin-text)] text-[10px] py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none w-[170px] md:w-[200px] placeholder:text-slate-400 font-sans not-italic normal-case" v-model="searchQuery" @keyup.enter="handleSearch" type="text" placeholder="🔎 Tìm Username hoặc SĐT..." />
          <button class="bg-[var(--admin-primary)] hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-[10px] font-black" @click="handleSearch">TÌM</button>
          <button class="bg-slate-200 hover:bg-slate-300 text-[var(--admin-text)] px-2 py-2 rounded-lg text-[10px] font-black" v-if="searchQuery" @click="searchQuery = ''; handleSearch()">✕</button>
        </div>
        <div class="flex items-center gap-2 bg-[var(--admin-card)] p-1.5 rounded-xl border border-[var(--admin-border)] shadow-sm">
          <span class="text-[10px] text-[var(--admin-success)] tracking-[2px] ml-2 hidden md:inline">TRẠNG THÁI:</span>
          <select class="bg-white text-[var(--admin-text)] text-[10px] py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none cursor-pointer" v-model="statusFilter">
            <option value="pending">⏳ ĐANG CHỜ DUYỆT</option>
            <option value="all">📚 TẤT CẢ LỊCH SỬ</option>
            <option value="approved">✅ ĐÃ DUYỆT</option>
            <option value="rejected">❌ BỊ HỦY</option>
          </select>
        </div>
        <div class="flex items-center gap-2 bg-[var(--admin-card)] p-1.5 rounded-xl border border-[var(--admin-border)] shadow-sm">
          <span class="text-[10px] text-[var(--admin-muted)] tracking-[2px] ml-2 hidden md:inline">LỌC SITE:</span>
          <select class="bg-white text-[var(--admin-text)] text-[10px] py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none cursor-pointer" v-model="siteFilter">
            <option value="all">TẤT CẢ</option>
            <option value="mmo">MMO PRO</option>
            <option value="freelance">FREELANCE</option>
            <option value="rapjob">RAP JOB</option>
          </select>
        </div>
        <button class="bg-slate-200 text-[var(--admin-text)] px-6 py-2.5 rounded-xl text-[10px] hover:bg-[var(--admin-danger)] hover:text-white transition-colors" @click="handleAdminLogout">THOÁT</button>
      </div>
    </div>

    <!-- THỐNG KÊ -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
      <div class="md:col-span-4 flex flex-col gap-4">
        <div class="flex-1 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-7xl opacity-5 group-hover:scale-110 transition-transform">📊</div>
          <div class="flex justify-between items-start mb-2">
            <p class="text-[var(--admin-muted)] text-[10px] font-black tracking-widest uppercase">TỔNG DUYỆT HÔM NAY</p>
            <div class="flex gap-2">
              <button class="bg-[var(--admin-success)] hover:bg-emerald-700 text-white px-4 py-2 rounded-xl tracking-widest text-xs font-black shadow-sm active:scale-95" @click="saveDailyNote">📝 CHỐT SỔ</button>
              <button class="text-[var(--admin-muted)] hover:text-[var(--admin-primary)] active:scale-90 bg-[var(--admin-card-soft)] p-2 rounded-xl border border-[var(--admin-border)]" @click="loadDashboardStats">
                <svg :class="['w-5 h-5', isStatsLoading ? 'animate-spin text-[var(--admin-primary)]' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
            </div>
          </div>
          <div class="text-4xl text-[var(--admin-success)] font-black">
            {{ isStatsLoading ? '...' : statsTodayTotal }} <span class="text-sm text-[var(--admin-muted)] font-bold uppercase tracking-widest">Đơn</span>
          </div>
        </div>
        <div class="flex-1 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-7xl opacity-5 group-hover:scale-110 transition-transform">📱</div>
          <p class="text-[var(--admin-muted)] text-[10px] font-black tracking-widest mb-2 uppercase">APP NGÂN HÀNG HÔM NAY</p>
          <div class="text-4xl text-[var(--admin-primary)] font-black">
            {{ isStatsLoading ? '...' : statsTodayAppTotal }} <span class="text-sm text-[var(--admin-muted)] font-bold uppercase tracking-widest">Đơn</span>
          </div>
        </div>
      </div>
      <div class="md:col-span-8 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-5 shadow-sm">
        <p class="text-[var(--admin-muted)] text-[10px] font-black tracking-widest mb-4 uppercase flex items-center gap-2">
          <span>CHI TIẾT ĐỐI SOÁT</span>
          <span class="bg-blue-100 text-[var(--admin-primary)] px-2 py-0.5 rounded text-[8px] border border-blue-200">LIVE</span>
        </p>
        <div class="flex justify-center items-center py-6" v-if="isStatsLoading">
          <div class="w-6 h-6 border-2 border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3" v-else>
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-xl p-4 flex flex-col gap-2" v-for="(data, name) in statsAppBreakdown" :key="name">
            <div class="text-[10px] text-[var(--admin-primary)] font-black tracking-widest uppercase border-b border-[var(--admin-border)] pb-2">{{ name }}</div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-[var(--admin-muted)] text-[10px] uppercase font-bold">Hôm nay:</span>
              <span :class="['text-base font-black', data.today > 0 ? 'text-[var(--admin-success)]' : 'text-[var(--admin-muted)]']">{{ data.today }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SỔ TAY -->
    <div class="mb-8">
      <p class="text-[var(--admin-primary)] text-[10px] font-black tracking-[3px] mb-3 ml-2">📒 SỔ TAY ĐỐI SOÁT LỊCH SỬ</p>
      <div class="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-3xl p-4 overflow-x-auto shadow-sm">
        <table class="w-full text-left">
          <tbody class="divide-y divide-[var(--admin-border)] italic">
            <tr class="group hover:bg-slate-50" v-for="note in dailyNotes" :key="note.id">
              <td class="py-3 px-4 whitespace-nowrap text-[var(--admin-success)] text-xs font-black">{{ note.dateLabel }}</td>
              <td class="py-3 px-4 text-[var(--admin-text)] text-[11px] normal-case font-bold w-full">{{ note.content }}</td>
              <td class="py-3 px-4 text-right whitespace-nowrap text-[var(--admin-muted)] text-[10px] font-black uppercase">Tổng: <span class="text-[var(--admin-text)]">{{ note.totalToday }}</span> đơn</td>
              <td class="py-3 px-4 text-right"><button class="text-slate-300 group-hover:text-[var(--admin-danger)] transition-colors text-lg" @click="deleteNote(note.id)">✕</button></td>
            </tr>
            <tr v-if="dailyNotes.length === 0">
              <td class="py-10 text-center text-slate-400 text-[10px] tracking-[2px]" colspan="4">CHƯA CÓ LỊCH SỬ ĐỐI SOÁT NÀO.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TABS -->
    <div class="flex gap-3 mb-6 flex-wrap">
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'app_jobs' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'app_jobs'">
        APP NGÂN HÀNG ({{ filteredAppReports.length }})
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'other_jobs' ? 'bg-[var(--admin-primary)] text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'other_jobs'">
        JOB KHÁC ({{ filteredOtherReports.length }})
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'withdrawals' ? 'bg-[var(--admin-success)] text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'withdrawals'">
        RÚT TIỀN ({{ filteredWithdrawals.length }})
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'daily_threads' ? 'bg-teal-600 text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'daily_threads'">
        🧵 THREAD HẰNG NGÀY ({{ dailyThreadReportsCount }})
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'vip_jobs' ? 'bg-[var(--admin-warning)] text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'vip_jobs'">
        ⚙️ CẤU HÌNH JOB VIP ({{ vipJobs.length }})
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'app_config' ? 'bg-slate-500 text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'app_config'">
        ⚙️ CẤU HÌNH WEB
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'support_config' ? 'bg-rose-600 text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'support_config'">
        💬 HỖ TRỢ
      </button>
      <button :class="['px-5 py-3 rounded-xl tracking-widest transition-all text-xs', activeTab === 'storage_clean' ? 'bg-rose-700 text-white shadow-sm' : 'bg-[var(--admin-card)] text-[var(--admin-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-card-soft)]']" @click="activeTab = 'storage_clean'">
        🧹 DỌN ẢNH STORAGE
      </button>
    </div>

    <!-- BẢNG CHÍNH -->
    <div class="admin-theme bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-[30px] overflow-hidden shadow-sm">
      <div class="p-20 text-center text-[var(--admin-primary)] animate-pulse tracking-widest" v-if="isLoading && activeTab !== 'vip_jobs' && activeTab !== 'app_config' && activeTab !== 'support_config' && activeTab !== 'daily_threads' && activeTab !== 'storage_clean'">ĐANG TẢI...</div>

      <!-- APP JOBS & OTHER JOBS -->
      <div class="overflow-x-auto" v-else-if="activeTab === 'app_jobs' || activeTab === 'other_jobs'">
        <Transition name="fade">
          <div class="bg-blue-50 border-b border-blue-200 p-4 flex justify-between items-center px-6" v-if="activeTab === 'other_jobs' && selectedOtherJobs.length">
            <span class="text-[var(--admin-primary)] text-sm tracking-widest">ĐÃ CHỌN: <span class="text-[var(--admin-text)] text-lg">{{ selectedOtherJobs.length }}</span> ĐƠN</span>
            <button class="bg-[var(--admin-primary)] hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-black" @click="bulkApproveOtherJobs">DUYỆT TẤT CẢ 🚀</button>
          </div>
        </Transition>
        <Transition name="fade">
          <div class="bg-red-50 border-b border-red-200 p-4 flex justify-between items-center px-6" v-if="activeTab === 'app_jobs' && selectedAppJobs.length">
            <span class="text-[var(--admin-danger)] text-sm tracking-widest">ĐÃ CHỌN: <span class="text-[var(--admin-text)] text-lg">{{ selectedAppJobs.length }}</span> ĐƠN</span>
            <button class="bg-[var(--admin-danger)] hover:bg-red-700 text-white px-6 py-3 rounded-xl text-xs font-black" @click="bulkRejectAppJobs">TỪ CHỐI TẤT CẢ ❌</button>
          </div>
        </Transition>
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[var(--admin-card-soft)] text-[var(--admin-primary)] text-[10px] tracking-[2px] border-b border-[var(--admin-border)]">
              <th class="p-6 text-center w-12">
                <input class="w-5 h-5 cursor-pointer accent-blue-600 rounded" v-if="activeTab === 'other_jobs'" type="checkbox" :checked="isAllOtherJobsSelected" @change="toggleAllOtherJobs" />
                <input class="w-5 h-5 cursor-pointer accent-red-600 rounded" v-if="activeTab === 'app_jobs'" type="checkbox" :checked="isAllAppJobsSelected" @change="toggleAllAppJobs" />
              </th>
              <th class="p-6 min-w-[250px]">NGƯỜI NỘP</th>
              <th class="p-6 min-w-[150px]">CÔNG VIỆC</th>
              <th class="p-6 text-center min-w-[150px]">BẰNG CHỨNG</th>
              <th class="p-6 text-center min-w-[120px]">TRẠNG THÁI</th>
              <th class="p-6 text-right min-w-[200px]">HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--admin-border)]">
            <tr v-for="rp in (activeTab === 'app_jobs' ? filteredAppReports : filteredOtherReports)" :key="rp.id" :class="['hover:bg-slate-50 group', selectedOtherJobs.includes(rp.id) ? 'bg-blue-50' : '', selectedAppJobs.includes(rp.id) ? 'bg-red-50' : '']">
              <td class="p-6 text-center">
                <input class="w-5 h-5 cursor-pointer accent-blue-600 rounded" v-if="rp.status === 'pending' && activeTab === 'other_jobs'" type="checkbox" :value="rp.id" v-model="selectedOtherJobs" />
                <input class="w-5 h-5 cursor-pointer accent-red-600 rounded" v-if="rp.status === 'pending' && activeTab === 'app_jobs'" type="checkbox" :value="rp.id" v-model="selectedAppJobs" />
              </td>
              <td class="p-6">
                <div class="mb-2 pb-2 border-b border-[var(--admin-border)] flex justify-between items-start">
                  <div>
                    <span class="text-[9px] text-[var(--admin-success)] tracking-widest block mb-0.5">TÀI KHOẢN GỐC:</span>
                    <div class="text-[var(--admin-text)] text-sm font-black truncate max-w-[200px]">{{ usersMap[effUid(rp)]?.username || usersMap[effUid(rp)]?.fullName || 'CHƯA CẬP NHẬT' }}</div>
                    <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">Ví: <span class="text-[var(--admin-warning)] font-black">{{ usersMap[effUid(rp)]?.balance }} XU</span></div>
                    <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">Ngày sinh: <span class="text-[var(--admin-success)] font-bold">{{ usersMap[effUid(rp)]?.dateOfBirth || usersMap[effUid(rp)]?.dob || usersMap[effUid(rp)]?.ngaysinh || '—' }}</span></div>
                    <div class="text-[9px] text-slate-400 font-sans not-italic" v-if="rp.repairedUserUid">UID gốc: {{ rp.uid?.slice(0, 8) }}… · Ví gắn: {{ rp.repairedUserUid?.slice(0, 8) }}…</div>
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    <span class="bg-pink-100 text-pink-600 border border-pink-200 text-[8px] px-2 py-0.5 rounded" v-if="rp.site === 'freelance'">FREELANCE</span>
                    <span class="bg-violet-100 text-violet-600 border border-violet-200 text-[8px] px-2 py-0.5 rounded" v-else-if="rp.site === 'rapjob'">RAP JOB</span>
                    <span class="bg-blue-100 text-blue-600 border border-blue-200 text-[8px] px-2 py-0.5 rounded" v-else>MMO</span>
                    <button class="bg-amber-50 text-[var(--admin-warning)] hover:bg-[var(--admin-warning)] hover:text-white border border-amber-200 px-2 py-1 rounded-lg text-[8px]" @click="fixUserWallet(effUid(rp))">SỬA VÍ</button>
                    <button class="bg-emerald-50 text-[var(--admin-success)] hover:bg-[var(--admin-success)] hover:text-white border border-emerald-200 px-2 py-1 rounded-lg text-[8px]" @click="addXuToUser(effUid(rp))">💰 CỘNG XU</button>
                  </div>
                </div>
                <div>
                  <span class="text-[9px] text-[var(--admin-primary)] tracking-widest block mb-0.5">ĐƠN NỘP ({{ formatDate(rp.createdAt) }}):</span>
                  <div class="text-[var(--admin-text)] text-xs font-black truncate max-w-[200px]">{{ rp.fullName || 'N/A' }}</div>
                  <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">SĐT: {{ rp.phoneRef || '—' }}</div>
                  <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">
                    Năm sinh: <span class="text-[var(--admin-warning)] font-bold" v-if="rp.birthYear"><span v-if="rp.birthMonth">T{{ rp.birthMonth }}/</span>{{ rp.birthYear }}</span>
                    <span class="text-slate-400" v-else>Đơn cũ</span>
                  </div>
                  <div class="mt-1" v-if="!usersMap[effUid(rp)]">
                    <span class="inline-block bg-red-50 text-[var(--admin-danger)] border border-red-200 text-[9px] px-2 py-0.5 rounded-full font-sans not-italic normal-case font-bold">⚠️ Chưa có hồ sơ ví</span>
                    <button class="ml-1 bg-blue-50 text-[var(--admin-primary)] hover:bg-[var(--admin-primary)] hover:text-white border border-blue-200 px-2 py-0.5 rounded-lg text-[9px] font-sans not-italic normal-case font-bold" @click="openWalletLinkModal(rp)">Gắn hồ sơ ví</button>
                  </div>
                </div>
              </td>
              <td class="p-6">
                <div class="text-[var(--admin-text)] text-[11px] leading-tight mb-1">{{ rp.jobName }}</div>
                <template v-if="rp.jobId === LPBANK_REFERRAL_JOB_ID">
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1 mb-1.5 space-y-0.5 font-sans not-italic normal-case max-w-[220px]">
                    <div class="text-[10px] text-[var(--admin-warning)]">Bạn bè: <span class="text-[var(--admin-text)] font-bold">{{ rp.friendName || '—' }}</span></div>
                    <div class="text-[10px] text-[var(--admin-warning)]">SĐT bạn bè: <span class="text-[var(--admin-text)] font-bold">{{ rp.friendPhone || '—' }}</span></div>
                    <div class="text-[10px] text-[var(--admin-warning)]">Mã đơn: <span class="text-[var(--admin-text)] font-bold break-all">{{ rp.referralOrderCode || '—' }}</span></div>
                    <div class="text-[10px] text-[var(--admin-warning)]" v-if="rp.status === 'pending'">Lần dự kiến: #{{ (usersMap[effUid(rp)]?.lpbankReferralPaidCount || 0) + 1 }}</div>
                  </div>
                  <div class="text-[var(--admin-success)] text-sm font-black" v-if="rp.status === 'pending'">
                    Dự kiến: {{ getLpbankReferralRewardByCount(usersMap[effUid(rp)]?.lpbankReferralPaidCount || 0).toLocaleString() }} XU
                  </div>
                  <div class="text-[var(--admin-success)] text-sm font-black" v-else>
                    +{{ (rp.actualReward || rp.reward || 0).toLocaleString() }} XU
                    <span class="text-[var(--admin-muted)] text-[10px]" v-if="rp.referralSuccessNumber">(Lần #{{ rp.referralSuccessNumber }})</span>
                  </div>
                </template>
                <div class="text-[var(--admin-success)] text-sm font-black" v-else>+{{ String(rp.reward).replace(/\D/g, '') }} XU</div>
              </td>
              <td class="p-6">
                <div class="flex flex-col items-center gap-2">
                  <div class="flex justify-center gap-2 flex-wrap">
                    <a class="bg-[var(--admin-primary)] text-[8px] text-white p-2 rounded" v-if="rp.taskLink" :href="rp.taskLink" target="_blank">LINK BÀI</a>
                    <div class="cursor-pointer" v-for="(img, idx) in getReportImages(rp)" :key="idx" @click="openImage(img.url)">
                      <div class="w-12 h-12 rounded-lg border border-[var(--admin-border)] overflow-hidden hover:scale-110 hover:border-[var(--admin-primary)] transition-all">
                        <img class="w-full h-full object-cover" :src="img.url" />
                      </div>
                    </div>
                    <div class="text-slate-400 text-[9px]" v-if="!getReportImages(rp).length && !rp.taskLink">KHÔNG CÓ ẢNH</div>
                  </div>
                  <!-- EXIF BADGE -->
                  <template v-if="rp.exif && Array.isArray(rp.exif) && rp.exif.length">
                    <div class="w-full space-y-1">
                      <template v-if="rp.exif.some((e: any) => e.suspicious)">
                        <span class="inline-flex items-center gap-1 bg-red-100 border border-red-300 text-[var(--admin-danger)] text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">⚠️ CẢNH BÁO GIAN LẬN · {{ rp.exif.filter((e: any) => e.suspicious).length }}/{{ rp.exif.length }} ẢNH · {{ rp.exif.find((e: any) => e.suspicious)?.software }}</span>
                      </template>
                      <template v-else-if="rp.exif.some((e: any) => !e.hasExif)">
                        <span class="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-[var(--admin-warning)] text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">⚠️ KHÔNG CÓ EXIF · {{ rp.exif.filter((e: any) => !e.hasExif).length }}/{{ rp.exif.length }} ẢNH</span>
                      </template>
                      <template v-else>
                        <span class="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-[var(--admin-success)] text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">✓ {{ rp.exif[0]?.device || 'Thiết bị thật' }}<template v-if="rp.exif[0]?.dateTaken"> · {{ fmtDate(rp.exif[0].dateTaken) }}</template></span>
                      </template>
                      <span v-if="hasOldPhoto(rp.exif, rp.createdAt)" class="inline-flex items-center gap-1 bg-orange-100 border border-orange-300 text-orange-600 text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">⚠️ ẢNH CŨ · {{ fmtDate(rp.exif.find((e: any) => isOldPhoto(e?.dateTaken, rp.createdAt))?.dateTaken) }}</span>
                    </div>
                  </template>
                  <template v-else-if="rp.exif && !Array.isArray(rp.exif)">
                    <div class="w-full space-y-1">
                      <span v-if="rp.exif.suspicious" class="inline-flex bg-red-100 border border-red-300 text-[var(--admin-danger)] text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">⚠️ CẢNH BÁO GIAN LẬN · {{ rp.exif.software }}</span>
                      <span v-else-if="!rp.exif.hasExif" class="inline-flex bg-amber-50 border border-amber-200 text-[var(--admin-warning)] text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">⚠️ KHÔNG CÓ EXIF</span>
                      <span v-else class="inline-flex bg-emerald-50 border border-emerald-200 text-[var(--admin-success)] text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">✓ {{ rp.exif.device || 'Thiết bị thật' }}<template v-if="rp.exif.dateTaken"> · {{ fmtDate(rp.exif.dateTaken) }}</template></span>
                      <span v-if="isOldPhoto(rp.exif.dateTaken, rp.createdAt)" class="inline-flex bg-orange-100 border border-orange-300 text-orange-600 text-[8px] font-black px-2 py-1 rounded-full w-full justify-center">⚠️ ẢNH CŨ · {{ fmtDate(rp.exif.dateTaken) }}</span>
                    </div>
                  </template>
                </div>
              </td>
              <td class="p-6 text-center text-[10px]">
                <span class="bg-amber-50 text-[var(--admin-warning)] px-3 py-1 rounded-full border border-amber-200" v-if="rp.status === 'pending'">ĐANG CHỜ</span>
                <span class="bg-emerald-50 text-[var(--admin-success)] px-3 py-1 rounded-full border border-emerald-200" v-else-if="rp.status === 'approved' || rp.status === 'collected'">ĐÃ DUYỆT</span>
                <span class="bg-red-50 text-[var(--admin-danger)] px-3 py-1 rounded-full border border-red-200" v-else>BỊ HỦY</span>
                <div :class="['text-[8px] mt-2 normal-case leading-tight', rp.status === 'rejected' ? 'text-[var(--admin-danger)] italic' : 'text-[var(--admin-primary)] font-bold']" v-if="rp.note">LỜI NHẮN: {{ rp.note }}</div>
              </td>
              <td class="p-6 text-right">
                <div class="flex flex-col md:flex-row justify-end gap-2">
                  <template v-if="rp.status === 'pending'">
                    <button class="bg-[var(--admin-success)] hover:bg-emerald-700 text-white text-[9px] px-4 py-2 rounded-lg" @click="approveReport(rp)">💰 Cộng xu</button>
                    <button class="bg-[var(--admin-primary)] hover:bg-blue-700 text-white text-[9px] px-4 py-2 rounded-lg" @click="openMessagePopup(rp.id)">NHẮN</button>
                    <button class="bg-[var(--admin-danger)] hover:bg-red-700 text-white text-[9px] px-4 py-2 rounded-lg" @click="openRejectPopup(rp.id)">HỦY</button>
                  </template>
                  <button v-else class="bg-slate-100 text-slate-400 text-[9px] px-4 py-2 rounded-lg cursor-not-allowed" disabled>Đã xử lý</button>
                  <button class="bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[var(--admin-text)] text-[9px] px-4 py-2 rounded-lg" @click="deleteReport(rp.id)">XÓA</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="p-20 text-center text-slate-400 text-xs" v-if="(activeTab === 'app_jobs' && !filteredAppReports.length) || (activeTab === 'other_jobs' && !filteredOtherReports.length)">KHÔNG CÓ DỮ LIỆU.</div>
      </div>

      <!-- RÚT TIỀN -->
      <div class="overflow-x-auto" v-else-if="activeTab === 'withdrawals'">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[var(--admin-card-soft)] text-[var(--admin-success)] text-[10px] tracking-[2px] border-b border-[var(--admin-border)]">
              <th class="p-6 min-w-[200px]">NGƯỜI RÚT</th>
              <th class="p-6 min-w-[250px]">THÔNG TIN NGÂN HÀNG</th>
              <th class="p-6 text-center min-w-[110px]">QR NGÂN HÀNG</th>
              <th class="p-6 text-center min-w-[150px]">SỐ TIỀN</th>
              <th class="p-6 text-center min-w-[120px]">TRẠNG THÁI</th>
              <th class="p-6 text-right min-w-[200px]">HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--admin-border)]">
            <tr class="hover:bg-slate-50 group" v-for="wd in filteredWithdrawals" :key="wd.id">
              <td class="p-6">
                <div class="flex items-center gap-2 mb-1">
                  <span class="bg-pink-100 text-pink-600 border border-pink-200 text-[8px] px-2 py-0.5 rounded" v-if="wd.site === 'freelance'">FREELANCE</span>
                  <span class="bg-violet-100 text-violet-600 border border-violet-200 text-[8px] px-2 py-0.5 rounded" v-else-if="wd.site === 'rapjob'">RAP JOB</span>
                  <span class="bg-blue-100 text-blue-600 border border-blue-200 text-[8px] px-2 py-0.5 rounded" v-else>MMO</span>
                </div>
                <div class="text-[var(--admin-text)] text-sm font-black">{{ usersMap[wd.uid]?.username || 'CHƯA CẬP NHẬT' }}</div>
                <div class="text-[var(--admin-muted)] text-[9px] font-sans not-italic">UID: {{ wd.uid?.slice(0, 8) }}…</div>
                <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">Ví hiện tại: <span class="text-[var(--admin-warning)] font-bold">{{ usersMap[wd.uid]?.balance ?? '—' }} XU</span></div>
                <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">Ngày sinh: <span class="text-[var(--admin-success)] font-bold">{{ usersMap[wd.uid]?.dateOfBirth || usersMap[wd.uid]?.dob || '—' }}</span></div>
                <div class="text-[var(--admin-muted)] text-[10px] font-sans not-italic">{{ formatDate(wd.createdAt) }}</div>
              </td>
              <td class="p-6">
                <div class="text-[var(--admin-text)] text-[11px] font-sans not-italic leading-relaxed max-w-[250px] bg-[var(--admin-card-soft)] p-3 rounded-xl border border-[var(--admin-border)]">{{ wd.bankInfo }}</div>
              </td>
              <td class="p-6 text-center">
                <div v-if="wd.qrImage?.url" @click="openImage(wd.qrImage.url)" class="w-16 h-16 mx-auto rounded-lg overflow-hidden border border-[var(--admin-border)] bg-white cursor-zoom-in hover:border-[var(--admin-success)] hover:scale-105 transition-all">
                  <img :src="wd.qrImage.url" class="w-full h-full object-contain" />
                </div>
                <div v-else class="text-slate-400 text-[9px] normal-case font-sans not-italic">Chưa có QR</div>
              </td>
              <td class="p-6 text-center">
                <div class="text-[var(--admin-success)] text-lg font-black">{{ getVndAmount(wd).toLocaleString('vi-VN') }} VNĐ</div>
                <div class="text-[var(--admin-warning)] text-[9px] mt-1 font-sans tracking-widest">({{ getXuAmount(wd).toLocaleString('vi-VN') }} XU)</div>
              </td>
              <td class="p-6 text-center text-[10px]">
                <span class="bg-amber-50 text-[var(--admin-warning)] px-3 py-1 rounded-full border border-amber-200" v-if="wd.status === 'pending'">ĐANG CHỜ</span>
                <span class="bg-emerald-50 text-[var(--admin-success)] px-3 py-1 rounded-full border border-emerald-200" v-else-if="wd.status === 'approved'">ĐÃ CHUYỂN</span>
                <span class="bg-red-50 text-[var(--admin-danger)] px-3 py-1 rounded-full border border-red-200" v-else>HỦY & HOÀN</span>
              </td>
              <td class="p-6 text-right">
                <div class="flex flex-col md:flex-row justify-end gap-2">
                  <template v-if="wd.status === 'pending'">
                    <button class="bg-[var(--admin-success)] hover:bg-emerald-700 text-white text-[9px] px-4 py-2 rounded-lg" @click="approveWithdrawal(wd)">ĐÃ CHUYỂN</button>
                    <button class="bg-[var(--admin-danger)] hover:bg-red-700 text-white text-[9px] px-4 py-2 rounded-lg" @click="rejectWithdrawal(wd)">TỪ CHỐI & HOÀN XU</button>
                  </template>
                  <button class="bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[var(--admin-text)] text-[9px] px-4 py-2 rounded-lg" @click="deleteWithdrawal(wd.id)">XÓA</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="p-20 text-center text-slate-400 text-xs" v-if="!filteredWithdrawals.length">KHÔNG CÓ DỮ LIỆU.</div>
      </div>

      <!-- THREAD HẰNG NGÀY — collection riêng daily_thread_reports, tách biệt hoàn toàn khỏi reports -->
      <div v-else-if="activeTab === 'daily_threads'">
        <DailyThreadsGuideConfigTab />
        <DailyThreadReportsTab :users-map="usersMap" :search-query="searchQuery" @count-change="dailyThreadReportsCount = $event" />
      </div>

      <StorageCleanupTab v-else-if="activeTab === 'storage_clean'" />

      <!-- VIP JOBS TAB -->
      <div v-else-if="activeTab === 'vip_jobs'" class="p-6">
        <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 class="text-lg text-[var(--admin-warning)] tracking-widest">💎 QUẢN LÝ VIP JOBS REALTIME</h2>
          <div class="flex items-center gap-2 flex-wrap">
            <button @click="seedVipJobs" :disabled="isSeedingVipJobs" class="bg-[var(--admin-success)] hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] px-4 py-2 rounded-xl font-black transition-all">
              {{ isSeedingVipJobs ? '⏳ ĐANG SEED...' : '🌱 SEED JOB VIP CÒN THIẾU' }}
            </button>
            <input v-model="newVipJobId" class="bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-xl border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic placeholder:text-slate-400 w-40" placeholder="Job ID (vd: msb-bank)" @keyup.enter="addNewVipJob" />
            <button class="bg-[var(--admin-warning)] hover:bg-amber-700 text-white text-[10px] px-4 py-2 rounded-xl font-black" @click="addNewVipJob">+ THÊM JOB</button>
          </div>
        </div>
        <div class="flex items-center justify-center py-10" v-if="isVipJobsLoading">
          <div class="w-8 h-8 border-4 border-[var(--admin-warning)] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div class="space-y-4" v-else-if="vipJobs.length">
          <div v-for="job in vipJobs" :key="job.id" class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5 space-y-4">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <span class="text-[var(--admin-warning)] text-xs font-black tracking-widest uppercase">ID: {{ job.id }}</span>
              <div class="flex gap-2 flex-wrap">
                <button @click="setVipJobStatus(job.id, 'open')" :class="['text-[9px] px-3 py-1.5 rounded-lg font-black transition-all', (editingVipJob[job.id]?.status || job.status) === 'open' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-[var(--admin-border)] hover:bg-emerald-50']">OPEN</button>
                <button @click="setVipJobStatus(job.id, 'paused')" :class="['text-[9px] px-3 py-1.5 rounded-lg font-black transition-all', (editingVipJob[job.id]?.status || job.status) === 'paused' ? 'bg-amber-500 text-white' : 'bg-white text-slate-400 border border-[var(--admin-border)] hover:bg-amber-50']">PAUSED</button>
                <button @click="setVipJobStatus(job.id, 'hidden')" :class="['text-[9px] px-3 py-1.5 rounded-lg font-black transition-all', (editingVipJob[job.id]?.status || job.status) === 'hidden' ? 'bg-slate-500 text-white' : 'bg-white text-slate-400 border border-[var(--admin-border)] hover:bg-slate-100']">HIDDEN</button>
                <button @click="setVipJobStatus(job.id, 'soldout')" :class="['text-[9px] px-3 py-1.5 rounded-lg font-black transition-all', (editingVipJob[job.id]?.status || job.status) === 'soldout' ? 'bg-red-500 text-white' : 'bg-white text-slate-400 border border-[var(--admin-border)] hover:bg-red-50']">SOLDOUT</button>
              </div>
            </div>
            <!-- Fields -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" v-if="editingVipJob[job.id]">
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">TITLE</label>
                <input v-model="editingVipJob[job.id].title" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" />
              </div>
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">REWARD (vd: 85.000 xu)</label>
                <input v-model="editingVipJob[job.id].reward" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" />
              </div>
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">BADGE (vd: HOT 🔥)</label>
                <input v-model="editingVipJob[job.id].badge" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" />
              </div>
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">COLOR (vd: text-orange-400)</label>
                <input v-model="editingVipJob[job.id].color" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" />
              </div>
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">ORDER (số thứ tự)</label>
                <input v-model.number="editingVipJob[job.id].order" type="number" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" />
              </div>
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">WARNING (cảnh báo tuổi)</label>
                <input v-model="editingVipJob[job.id].warning" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" placeholder="Vd: Yêu cầu đủ 18 tuổi" />
              </div>
              <div>
                <label class="text-[9px] text-[var(--admin-muted)] tracking-widest block mb-1">YÊU CẦU TUỔI (số, vd: 18)</label>
                <input v-model.number="editingVipJob[job.id].ageRequirement" type="number" min="0" max="99" class="w-full bg-white text-[var(--admin-text)] text-xs py-2 px-3 rounded-lg border border-[var(--admin-border)] outline-none focus:border-[var(--admin-warning)] font-sans normal-case not-italic" placeholder="Không điền = không hiện badge" />
              </div>
            </div>
            <!-- Actions -->
            <div class="flex justify-end gap-3">
              <button @click="deleteVipJob(job.id)" class="bg-red-50 hover:bg-[var(--admin-danger)] text-[var(--admin-danger)] hover:text-white text-[10px] px-4 py-2 rounded-lg border border-red-200 transition-all">XÓA JOB</button>
              <button @click="saveVipJob(job.id)" class="bg-[var(--admin-warning)] hover:bg-amber-700 text-white text-[10px] px-6 py-2 rounded-lg font-black transition-all">LƯU THAY ĐỔI</button>
            </div>
          </div>
        </div>
        <div class="py-20 text-center text-slate-400 text-xs tracking-widest" v-else>
          CHƯA CÓ VIP JOB NÀO.<br/>
          <span class="text-slate-400 text-[10px] normal-case font-sans not-italic mt-2 block">Nhập Job ID và bấm "+ THÊM JOB" để tạo.</span>
        </div>
      </div>

      <!-- CẤU HÌNH WEB TAB -->
      <div v-else-if="activeTab === 'app_config'" class="p-6 max-w-2xl mx-auto">
        <h2 class="text-lg text-[var(--admin-text)] tracking-widest mb-8">⚙️ CẤU HÌNH WEB REALTIME</h2>
        <div class="space-y-6">
          <!-- App Version -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">APP VERSION (trigger reload cho user)</label>
            <div class="flex items-center gap-4">
              <div class="text-5xl text-[var(--admin-text)] font-black">{{ appConfig.appVersion }}</div>
              <button @click="bumpAppVersion" class="bg-[var(--admin-primary)] hover:bg-blue-700 text-white text-xs px-5 py-2.5 rounded-xl font-black tracking-widest transition-all active:scale-95">
                +1 TĂNG VERSION
              </button>
            </div>
            <p class="text-slate-400 text-[10px] font-sans normal-case not-italic mt-3">Tắt: user thấy popup tự bấm tải lại. Bật: trang tự reload sau 3 giây.</p>
          </div>

          <!-- Force Refresh -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">FORCE REFRESH KHI VERSION TĂNG</label>
            <div class="flex items-center gap-4">
              <button
                @click="appConfig.forceRefreshEnabled = !appConfig.forceRefreshEnabled"
                :class="['w-14 h-7 rounded-full transition-all relative', appConfig.forceRefreshEnabled ? 'bg-emerald-500' : 'bg-slate-300']"
              >
                <div :class="['absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all', appConfig.forceRefreshEnabled ? 'left-7' : 'left-0.5']"></div>
              </button>
              <span :class="['text-sm font-black', appConfig.forceRefreshEnabled ? 'text-[var(--admin-success)]' : 'text-[var(--admin-muted)]']">
                {{ appConfig.forceRefreshEnabled ? 'BẬT — tự reload sau 3 giây' : 'TẮT — hiện popup cho user tự bấm tải lại' }}
              </span>
            </div>
          </div>

          <!-- Refresh Message -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">NỘI DUNG THÔNG BÁO KHI RELOAD</label>
            <textarea
              v-model="appConfig.refreshMessage"
              class="w-full bg-white text-[var(--admin-text)] text-sm py-3 px-4 rounded-xl border border-[var(--admin-border)] outline-none focus:border-[var(--admin-primary)] font-sans normal-case not-italic resize-none"
              rows="3"
              placeholder="Vd: Hệ thống vừa cập nhật phiên bản mới. Trang sẽ tải lại để áp dụng thay đổi."
            ></textarea>
          </div>

          <!-- Save Button -->
          <button
            @click="saveAppConfig"
            :disabled="isSavingConfig"
            class="w-full bg-[var(--admin-primary)] hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" v-if="isSavingConfig"></div>
            <span>{{ isSavingConfig ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH' }}</span>
          </button>
        </div>
      </div>

      <!-- SUPPORT CONFIG TAB -->
      <div v-else-if="activeTab === 'support_config'" class="p-6 max-w-2xl mx-auto">
        <h2 class="text-lg text-[var(--admin-text)] tracking-widest mb-8">💬 HỖ TRỢ / THÔNG BÁO REALTIME</h2>
        <div class="space-y-6">

          <!-- Bật/tắt thông báo hỗ trợ -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">BẬT / TẮT THÔNG BÁO HỖ TRỢ</label>
            <div class="flex items-center gap-4">
              <button
                @click="supportConfigAdmin.enabled = !supportConfigAdmin.enabled"
                :class="['w-14 h-7 rounded-full transition-all relative', supportConfigAdmin.enabled ? 'bg-emerald-500' : 'bg-slate-300']"
              >
                <div :class="['absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all', supportConfigAdmin.enabled ? 'left-7' : 'left-0.5']"></div>
              </button>
              <span :class="['text-sm font-black', supportConfigAdmin.enabled ? 'text-[var(--admin-success)]' : 'text-[var(--admin-muted)]']">
                {{ supportConfigAdmin.enabled ? 'BẬT — user thấy nút Hỗ trợ hoạt động' : 'TẮT — ẩn thông báo' }}
              </span>
            </div>
          </div>

          <!-- Auto popup -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">TỰ BẬT POPUP CHO USER</label>
            <div class="flex items-center gap-4">
              <button
                @click="supportConfigAdmin.autoPopupEnabled = !supportConfigAdmin.autoPopupEnabled"
                :class="['w-14 h-7 rounded-full transition-all relative', supportConfigAdmin.autoPopupEnabled ? 'bg-rose-500' : 'bg-slate-300']"
              >
                <div :class="['absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all', supportConfigAdmin.autoPopupEnabled ? 'left-7' : 'left-0.5']"></div>
              </button>
              <span :class="['text-sm font-black', supportConfigAdmin.autoPopupEnabled ? 'text-rose-600' : 'text-[var(--admin-muted)]']">
                {{ supportConfigAdmin.autoPopupEnabled ? 'BẬT — bảng hỗ trợ tự nổi lên khi version tăng' : 'TẮT — user phải tự bấm nút Hỗ trợ' }}
              </span>
            </div>
            <p class="text-slate-400 text-[10px] font-sans normal-case not-italic mt-3">Kết hợp với tăng Announcement Version để đẩy thông báo mới tới tất cả user.</p>
          </div>

          <!-- Announcement Version -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">ANNOUNCEMENT VERSION (trigger popup cho user)</label>
            <div class="flex items-center gap-4">
              <div class="text-5xl text-[var(--admin-text)] font-black">{{ supportConfigAdmin.announcementVersion }}</div>
              <button @click="bumpAnnouncementVersion" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-5 py-2.5 rounded-xl font-black tracking-widest transition-all active:scale-95">
                +1 VERSION
              </button>
            </div>
            <p class="text-slate-400 text-[10px] font-sans normal-case not-italic mt-3">Tăng version + bật Auto Popup + Lưu → tất cả user đang mở web sẽ thấy bảng hỗ trợ tự nổi lên.</p>
          </div>

          <!-- Tiêu đề -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">TIÊU ĐỀ BẢNG HỖ TRỢ</label>
            <input
              v-model="supportConfigAdmin.title"
              type="text"
              class="w-full bg-white text-[var(--admin-text)] text-sm py-3 px-4 rounded-xl border border-[var(--admin-border)] outline-none focus:border-rose-500 font-sans normal-case not-italic"
              placeholder="Vd: Hỗ trợ"
            />
          </div>

          <!-- Nội dung thông báo -->
          <div class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-5">
            <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-3">NỘI DUNG THÔNG BÁO</label>
            <textarea
              v-model="supportConfigAdmin.message"
              class="w-full bg-white text-[var(--admin-text)] text-sm py-3 px-4 rounded-xl border border-[var(--admin-border)] outline-none focus:border-rose-500 font-sans normal-case not-italic resize-none"
              rows="4"
              placeholder="Vd: App này đang tạm dừng, vui lòng không làm tiếp. Nhắn tin Fanpage để được hỗ trợ."
            ></textarea>
          </div>

          <!-- Save Button -->
          <button
            @click="saveSupportConfig"
            :disabled="isSavingSupportConfig"
            class="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" v-if="isSavingSupportConfig"></div>
            <span>{{ isSavingSupportConfig ? 'ĐANG LƯU...' : '💾 LƯU THÔNG BÁO' }}</span>
          </button>
          <p class="text-slate-400 text-[10px] font-sans normal-case not-italic text-center">Nút Nhắn tin Fanpage được cố định trong hệ thống.</p>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.admin-theme {
  --admin-bg: #F6F7FB;
  --admin-card: #FFFFFF;
  --admin-card-soft: #F1F5F9;
  --admin-border: #E2E8F0;
  --admin-text: #0F172A;
  --admin-muted: #64748B;
  --admin-primary: #2563EB;
  --admin-success: #059669;
  --admin-warning: #D97706;
  --admin-danger: #DC2626;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
