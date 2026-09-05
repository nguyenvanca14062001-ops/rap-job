<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, onSnapshot, collection, query, where, orderBy, limit, updateDoc } from "firebase/firestore"
import { useVipJobs } from '@/composables/useVipJobs'
import { usePostThreadsConfig } from '@/composables/usePostThreadsConfig'
import { POST_THREADS_JOB_ID } from '@/utils/postThreadsConfig'
import { startAppConfigListener } from '@/composables/useAppConfig'
import { startSupportListener, supportConfig, supportBadge, shouldAutoPopup, markSupportSeen, setUserContext } from '@/composables/useSupportConfig'
import SupportPanel from '@/components/SupportPanel.vue'
import Swal from 'sweetalert2'

// --- IMPORT COMPONENT ---
import AppBrowserBlocker from '@/components/AppBrowserBlocker.vue'
import Sidebar from '@/components/home/Sidebar.vue'
import JobSection from '@/components/home/JobSection.vue'
import HistorySection from '@/components/home/HistorySection.vue'
import InfoSection from '@/components/home/InfoSection.vue'
import ProfileCard from '@/components/home/ProfileCard.vue'
import Logo from '@/components/Logo.vue'
import MomoReferralHubModal from '@/components/MomoReferralHubModal.vue'
import LpbankPlusReferralHubModal from '@/components/LpbankPlusReferralHubModal.vue'
import ShopeePayReferralHubModal from '@/components/ShopeePayReferralHubModal.vue'
import FriendReferralSelectModal from '@/components/FriendReferralSelectModal.vue'
import { jobsData } from '@/data/jobs'

// --- JOB BROWSER (dùng trong CÔNG VIỆC bottom sheet) ---
const jobIconMap: Record<string, string> = {
  'follow-cgv': '🎬', 'review-cinema': '⭐', 'checkin-cinema': '📸',
  'survey-cinema': '📋', 'post-threads': '🧵', 'join-zalo': '💬',
  'app-chung-khoan': '📈', 'app-chung-khoan-2': '📈', 'app-chung-khoan-3': '📈',
  'app-chung-khoan-4': '📈', 'msb-bank': '🏦', 'vpbank': '🏦', 'liobank': '🏦', 'abbank': '🏦', 'lpbank-plus': '🏦', 'vietcombank': '🏦', 'shopee-pay': '🛍️',
  'referral-hub': '👥', 'daily_threads': '🧵', 'momo': '💰', 'referral_momo': '👥', 'referral-friends': '👥',
}
const VIP_IDS = ['referral-friends', 'referral-hub', 'liobank', 'app-chung-khoan-3', 'app-chung-khoan-4', 'msb-bank', 'vpbank', 'app-chung-khoan-2', 'app-chung-khoan', 'abbank', 'lpbank-plus', 'vietcombank', 'shopee-pay', 'momo', 'referral_momo']
// 2 job "giới thiệu bạn bè" cũ đã gộp vào card parent 'referral-friends' — vẫn giữ nguyên trong VIP_IDS/jobsData
// (report/logic không đổi), chỉ ẩn khỏi lưới card VIP để tránh hiện trùng với card parent.
const CONSOLIDATED_INTO_FRIEND_REFERRAL_HUB = ['referral-hub', 'referral_momo', 'referral_abbank', 'referral_shopee_pay', 'referral_lpbank_plus']

// VIP JOBS + APP CONFIG + SUPPORT CONFIG — realtime từ Firestore
const { vipJobs, ready: vipJobsReady } = useVipJobs()
// Cấu hình riêng bật/tắt/tạm dừng/ẩn job "ĐĂNG BÀI THREADS" (post-threads) — KHÔNG liên quan daily_threads
const { config: postThreadsConfig } = usePostThreadsConfig()
startAppConfigListener()
startSupportListener()

const showSupportPanel = ref(false)

watch(shouldAutoPopup, (val) => { if (val) showSupportPanel.value = true })

const handleSupportClose = () => { markSupportSeen() }

// Áp dụng cấu hình riêng bật/tắt/tạm dừng/ẩn job "ĐĂNG BÀI THREADS" (post-threads) lên kết quả merge.
// Không đụng tới job nào khác — chỉ đọc/gắn cờ đúng key POST_THREADS_JOB_ID.
// Doc config chưa tồn tại → mặc định open/visible (usePostThreadsConfig đã tự fallback) để không làm mất job.
function applyPostThreadsConfig(result: Record<string, any>): Record<string, any> {
  if (!(POST_THREADS_JOB_ID in result)) return result
  const cfg = postThreadsConfig.value
  if (cfg.status === 'hidden' || !cfg.visible) {
    delete result[POST_THREADS_JOB_ID]
  } else if (cfg.status === 'paused') {
    result[POST_THREADS_JOB_ID] = { ...result[POST_THREADS_JOB_ID], paused: true }
  }
  return result
}

// Merge vip_jobs Firestore lên static jobs.ts
// - Trước snapshot đầu tiên: {} → không flash job list
// - Sau snapshot: vip_jobs rỗng → dùng nguyên jobsData
// - Nếu có: override field-level, lọc hidden, gắn cờ paused/soldout
const mergedJobs = computed((): Record<string, any> => {
  if (!vipJobsReady.value) return {}
  if (vipJobs.value.length === 0) return applyPostThreadsConfig({ ...jobsData })
  const result: Record<string, any> = {}
  for (const [id, staticJob] of Object.entries(jobsData)) {
    const override = vipJobs.value.find(v => v.id === id)
    if (!override) { result[id] = staticJob; continue }
    if (override.status === 'hidden') continue
    result[id] = {
      ...staticJob,
      title:   override.title   ?? staticJob.title,
      reward:  override.reward  ?? staticJob.reward,
      badge:   override.badge   ?? staticJob.badge,
      color:   override.color   ?? staticJob.color,
      warning: override.warning ?? staticJob.warning,
      order:   override.order   ?? staticJob.order,
      ageRequirement: override.ageRequirement ?? staticJob.ageRequirement,
      paused:  override.status === 'paused',
      soldout: override.status === 'soldout',
      status:  override.status,
    }
  }
  // Card parent 'referral-friends' tự ẩn nếu cả 4 job con (referral_momo/referral_abbank/referral_shopee_pay/referral_lpbank_plus) đều hidden
  if ('referral-friends' in result) {
    const childIds = ['referral_momo', 'referral_abbank', 'referral_shopee_pay', 'referral_lpbank_plus']
    const allChildrenHidden = childIds.every(cid => vipJobs.value.find(v => v.id === cid)?.status === 'hidden')
    if (allChildrenHidden) delete result['referral-friends']
  }
  applyPostThreadsConfig(result)
  return result
})

// Thứ tự VIP jobs theo Firestore order; lọc hidden + job đã gộp vào card parent; fallback về vị trí gốc trong VIP_IDS
const sortedVipJobIds = computed(() =>
  VIP_IDS
    .filter(id => id in mergedJobs.value && !CONSOLIDATED_INTO_FRIEND_REFERRAL_HUB.includes(id) && id !== 'referral-friends')
    .sort((a, b) => {
      const oA = Number(mergedJobs.value[a]?.order ?? VIP_IDS.indexOf(a))
      const oB = Number(mergedJobs.value[b]?.order ?? VIP_IDS.indexOf(b))
      return oA - oB
    })
)

// --- Age confirmation modal (mobile bottom sheet) ---
const showAgeConfirmModal = ref(false)
const ageConfirmJobId = ref('')
const ageConfirmJobTitle = ref('')
const ageConfirmAge = ref(18)

// --- Badge text color cho danh sách CÔNG VIỆC (list đơn giản, 1 màu nền, chỉ đổi màu chữ) ---
function getBadgeTextClass(badge: string): string {
  const b = (badge || '').toUpperCase()
  if (b.includes('HOT')) return 'text-red-400'
  if (b.includes('HẰNG NGÀY')) return 'text-teal-400'
  if (b.includes('SURVEY')) return 'text-violet-400'
  if (b.includes('VIP')) return 'text-amber-400'
  return 'text-slate-400'
}

// --- KHỞI TẠO BIẾN TRẠNG THÁI HỆ THỐNG ---
const router = useRouter()
const route = useRoute()

// Haptic feedback helper — safe to call anywhere including templates
const vibrate = (ms = 20) => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms) }

// Trạng thái ẩn/hiện số dư (Mặc định là hiện)
const isBalanceVisible = ref(localStorage.getItem('mmo_balance_hide') !== 'true');

const toggleBalance = () => {
  isBalanceVisible.value = !isBalanceVisible.value;
  localStorage.setItem('mmo_balance_hide', String(!isBalanceVisible.value));
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
};

const isLoggedIn = ref(false)
const isAuthChecking = ref(true) 
const isMenuOpen = ref(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
const isDataLoading = ref(true)
const windowWidth = ref(0)
const showBankModal = ref(false)
const showMomoReferralHub = ref(false)
const showLpbankPlusReferralHub = ref(false)
const showShopeePayReferralHub = ref(false)
const showFriendReferralSelect = ref(false)
const activePopup = ref<'nop-bai' | 'cong-viec' | 'lich-su' | ''>('')
const mobileRejectNote = ref<string | null>(null)
const jobCategory = ref<'basic' | 'vip' | ''>('')

const isAdminRoute = computed(() => route.path.includes('admin'))
const isAuthRoute = computed(() => route.path.includes('/login') || route.path.includes('/register'))

// Ẩn ticker/nổ hũ ảo "vừa rút thành công" khi user đang thao tác công việc/hướng dẫn/nộp bằng chứng —
// tránh che giao diện lúc cần tập trung. Không đổi logic ticker/withdrawal thật, chỉ đổi điều kiện hiển thị UI.
// - isJobRoute: /job/:id (job detail cơ bản + VIP), /jobs/* (referral-abbank, daily-threads, momo), /submit-report, /survey-cinema
// - hasWorkModalOpen: các bottom sheet/modal "chọn công việc" mở ngay trên trang chủ (chưa đổi route)
const shouldHideWithdrawTicker = computed(() => {
  const path = route.path || ''
  const isJobRoute = path.startsWith('/job') || path === '/submit-report' || path === '/survey-cinema'

  const hasWorkModalOpen =
    activePopup.value === 'cong-viec' ||
    activePopup.value === 'nop-bai' ||
    showAgeConfirmModal.value ||
    showFriendReferralSelect.value ||
    showMomoReferralHub.value ||
    showLpbankPlusReferralHub.value ||
    showShopeePayReferralHub.value ||
    showBankModal.value

  return isJobRoute || hasWorkModalOpen
})

const username = ref(localStorage.getItem('mmo_username') || 'Member')
const userBalance = ref(Number(localStorage.getItem('mmo_balance')) || 0)
const userFullName = ref('')
const userPhone = ref('')
const userBirthYear = ref('')
// Nguồn sự thật cho điều kiện mở khóa rút tiền (>= 3 nhiệm vụ VIP) — đồng bộ với Firestore Rules
// mới trên withdrawals, KHÔNG tự đếm từ myReports ở client nữa (dễ lệch với field thật trên server).
const vipCompletedCount = ref(0)

const myReports = ref<any[]>([])
const myWithdrawals = ref<any[]>([])

// Hủy listener cũ khi chuyển trạng thái để tránh rác bộ nhớ
let unsubscribeUser: (() => void) | null = null
let unsubscribeReports: (() => void) | null = null
let unsubscribeWithdrawals: (() => void) | null = null

// ============================================================================
// LOGIC POPUP: KHÁCH ĐỌC THÔNG BÁO TỪ ADMIN (TỪ CHỐI, TIN NHẮN, DUYỆT ĐƠN)
// ============================================================================
const dismissedRejections = ref<string[]>(JSON.parse(localStorage.getItem('mmo_dismissed_rejections') || '[]'))
const unreadRejectedReport = computed(() => {
  return myReports.value.find(rp => rp.status === 'rejected' && !dismissedRejections.value.includes(rp.id))
})
const dismissRejection = (id: string) => {
  dismissedRejections.value.push(id)
  localStorage.setItem('mmo_dismissed_rejections', JSON.stringify(dismissedRejections.value))
}

const dismissedMessages = ref<string[]>(JSON.parse(localStorage.getItem('mmo_dismissed_messages') || '[]'))
const unreadMessageReport = computed(() => {
  return myReports.value.find(rp => rp.status === 'pending' && rp.note && !dismissedMessages.value.includes(rp.id))
})
const dismissMessage = (id: string) => {
  dismissedMessages.value.push(id)
  localStorage.setItem('mmo_dismissed_messages', JSON.stringify(dismissedMessages.value))
}

const dismissedApprovals = ref<string[]>(JSON.parse(localStorage.getItem('mmo_dismissed_approvals') || '[]'))
const unreadApprovedReport = computed(() => {
  return myReports.value.find(rp => rp.status === 'approved' && !dismissedApprovals.value.includes(rp.id))
})
const dismissApproval = (id: string) => {
  dismissedApprovals.value.push(id)
  localStorage.setItem('mmo_dismissed_approvals', JSON.stringify(dismissedApprovals.value))
}

// Đóng popup nhận thưởng — CHỈ ẩn UI phía client (đánh dấu đã xem, lưu localStorage).
// Không ghi Firestore, không đụng balance, không đổi status report.
// Tiền đã được cộng 1 lần duy nhất ở AdminView.approveReport() ngay lúc Admin bấm Duyệt.
const closeApprovalPopup = (report: any) => {
  if (!report) return;
  dismissApproval(report.id);
}

const handleRutXuNgay = (report: any) => {
  closeApprovalPopup(report);
  router.push('/withdraw');
}
// ============================================================================

// ============================================================================
// LOGIC THÔNG BÁO "NỔ HŨ" (ĐÃ CẬP NHẬT CÔNG VIỆC MỚI)
// ============================================================================
const randomNotice = ref<any>(null)
const names = ['TRUNG NGUYỄN', 'HOÀNG ANH', 'MINH TUẤN', 'THANH HẰNG', 'VĂN NAM', 'BÍCH PHƯỢNG', 'QUỐC BẢO', 'KHÁNH LINH', 'TRẦN TÂM', 'SƠN TÙNG', 'ANH VŨ', 'QUANG LÊ', 'MINH ĐỨC', 'HỮU PHÚC', 'TIẾN ĐẠT']
const banks = ['MB BANK', 'VPBANK', 'TPBANK', 'VIETCOMBANK', 'TECHCOMBANK', 'MOMO', 'MSB BANK']

const jobList = [
  { name: 'Follow Fanpage CGV', reward: '20.000' },
  { name: 'Đánh Giá 5 Sao Rạp Phim', reward: '25.000' },
  { name: 'Check-in Tại Rạp', reward: '20.000' },
  { name: 'Khảo Sát Phim', reward: '20.000' },
  { name: 'Đánh Giá Google Map', reward: '25.000' },
  { name: 'Tham Gia Nhóm Zalo', reward: '10.000' },
  { name: 'App Chứng Khoán Kafi', reward: '85.000' },
  { name: 'Ngân Hàng MSB', reward: '100.000' },
  { name: 'Ngân Hàng VPBank', reward: '100.000' },
]


const fmtXu = (n: number) => n.toLocaleString('vi-VN')

// Pool rút tiền THẬT (status === 'approved') lấy từ Firestore — không dùng dữ liệu giả.
const approvedWithdrawalsFeed = ref<{ uid: string; name: string; amount: number }[]>([])
let unsubscribeApprovedWithdrawals: (() => void) | null = null

const startApprovedWithdrawalsFeed = () => {
  unsubscribeApprovedWithdrawals = onSnapshot(
    query(
      collection(db, "withdrawals"),
      where("site", "==", "rapjob"),
      where("status", "==", "approved"),
      limit(200)
    ),
    (snapshot) => {
      approvedWithdrawalsFeed.value = snapshot.docs
        .map(d => {
          const data: any = d.data()
          const name = String(data.fullName || data.username || '').trim()
          const amount = Number(data.amount) || 0
          return { uid: d.id, name, amount }
        })
        .filter(w => w.name && w.amount > 0)
    },
    (error) => {
      if (import.meta.env.DEV) console.error('[Firestore] Lỗi tải feed withdrawal approved (ticker):', error)
    }
  )
}

// Ưu tiên hiển thị các mốc rút phổ biến, mốc lớn (1.000.000+) chỉ thỉnh thoảng xuất hiện —
// nhưng luôn chọn trong danh sách withdrawal approved thật, không tự tạo mốc giả.
const PRIORITY_WITHDRAW_AMOUNTS = [250000, 500000, 650000]
const pickWeightedWithdrawal = () => {
  const pool = approvedWithdrawalsFeed.value
  if (!pool.length) return null
  const priorityPool = pool.filter(w => PRIORITY_WITHDRAW_AMOUNTS.includes(w.amount))
  const otherPool = pool.filter(w => !PRIORITY_WITHDRAW_AMOUNTS.includes(w.amount))
  const useOther = otherPool.length > 0 && (priorityPool.length === 0 || Math.random() < 0.2)
  const src = useOther ? otherPool : (priorityPool.length ? priorityPool : otherPool)
  return src[Math.floor(Math.random() * src.length)] ?? null
}

// Dữ liệu mô phỏng cục bộ — CHỈ dùng khi chưa có withdrawal approved thật nào, không ghi Firestore,
// không đại diện cho giao dịch có thật. Luôn gắn cờ isSimulated + dòng chú thích "Dữ liệu mô phỏng"
// để không bị hiểu nhầm là giao dịch thật.
const pickSimulatedAmount = () => {
  if (Math.random() < 0.05) return 1000000
  return PRIORITY_WITHDRAW_AMOUNTS[Math.floor(Math.random() * PRIORITY_WITHDRAW_AMOUNTS.length)] ?? 250000
}

let lastNoticeUid: string | null = null
const triggerNotice = () => {
  // Ưu tiên tuyệt đối withdrawal approved thật nếu đã có
  if (approvedWithdrawalsFeed.value.length) {
    let pick = pickWeightedWithdrawal()
    if (!pick) return
    if (approvedWithdrawalsFeed.value.length > 1 && pick.uid === lastNoticeUid) {
      pick = pickWeightedWithdrawal() ?? pick
    }
    lastNoticeUid = pick.uid
    randomNotice.value = {
      type: 'withdraw', name: pick.name.toUpperCase(), title: 'Vừa rút thành công',
      amount: fmtXu(pick.amount), isSimulated: false
    }
  } else {
    // Chưa có withdrawal approved thật → hiện dữ liệu mô phỏng, đánh dấu rõ ràng là dữ liệu mẫu
    const name = names[Math.floor(Math.random() * names.length)]
    randomNotice.value = {
      type: 'withdraw', name, title: 'Vừa rút thành công',
      amount: fmtXu(pickSimulatedAmount()), isSimulated: true, sub: 'Dữ liệu mô phỏng'
    }
  }
  setTimeout(() => { randomNotice.value = null }, 2500)
}

const startToasting = () => {
  startApprovedWithdrawalsFeed()
  const withdrawLoop = () => {
    const next = Math.floor(Math.random() * (6000 - 3500 + 1) + 3500)
    setTimeout(() => { if (!randomNotice.value) triggerNotice(); withdrawLoop() }, next)
  }
  withdrawLoop()
}

// ============================================================
// SOUND EFFECTS (Web Audio API — không cần file ngoài)
// ============================================================
function playRewardSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    // Fanfare tăng dần: C5 → E5 → G5 → C6
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.13
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.28, t + 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t); osc.stop(t + 0.4)
    })
  } catch (_) {}
}

// Phát âm thanh khi popup nhận thưởng hiện
watch(unreadApprovedReport, (val) => {
  if (val) playRewardSound()
})

const combinedHistory = computed(() => {
  const combined = [
    ...myReports.value.map(item => ({ ...item, type: 'task' })), 
    ...myWithdrawals.value.map(item => ({ ...item, type: 'withdraw' }))
  ]
  return combined.map(item => {
    let displayTime = 'VỪA XONG'; 
    let sortTime = Date.now()
    if (item.createdAt) {
      if (typeof item.createdAt === 'string') {
        displayTime = item.createdAt.split('T')[0]; sortTime = new Date(item.createdAt).getTime()
      } else if (item.createdAt.toDate) {
        const d = item.createdAt.toDate(); displayTime = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; sortTime = d.getTime()
      }
    }
    return { ...item, displayTime, sortTime }
  }).sort((a, b) => b.sortTime - a.sortTime)
})

// === LOGIC ĐỒNG BỘ THỜI GIAN THỰC CHỐNG LỖI ===
const initFirebaseSync = (user: any) => {
  if (unsubscribeUser) { if (import.meta.env.DEV) console.log('[Firestore] STOP user/reports/withdrawals listeners'); unsubscribeUser() }
  if (unsubscribeReports) unsubscribeReports()
  if (unsubscribeWithdrawals) unsubscribeWithdrawals()

  if (!user || isAdminRoute.value) return

  if (import.meta.env.DEV) console.log('[Firestore] START listeners uid:', user.uid)
  isLoggedIn.value = true
  setUserContext(user.uid)

  unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data()
      username.value = data.username || data.fullName || 'Member'
      userFullName.value = data.fullName || ''
      userPhone.value = data.phone || ''
      userBirthYear.value = data.dob || ''
      const realBalance = data.balance ? Number(data.balance) : 0;
      userBalance.value = realBalance;
      vipCompletedCount.value = Number(data.vipCompletedCount) || 0

      localStorage.setItem('mmo_username', username.value)
      localStorage.setItem('mmo_balance', String(realBalance))
    }
  })
  
  if (import.meta.env.DEV) console.log('[Firestore] START reports listener — collection: reports, uid filter, orderBy createdAt desc, limit 50')
  unsubscribeReports = onSnapshot(query(collection(db, "reports"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(50)), (snapshot) => {
    myReports.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    isDataLoading.value = false
  })

  if (import.meta.env.DEV) console.log('[Firestore] START withdrawals listener — collection: withdrawals, uid filter, sorted client-side (tránh phụ thuộc composite index)')
  unsubscribeWithdrawals = onSnapshot(
    query(collection(db, "withdrawals"), where("uid", "==", user.uid)),
    (snapshot) => {
      myWithdrawals.value = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        .slice(0, 20)
    },
    (error) => {
      console.error('[Firestore] Lỗi tải lịch sử rút tiền (withdrawals listener):', error)
    }
  )
}

// Tự động bật "lite-effects" (tắt animation nền/glow liên tục, giữ nguyên bố cục & màu sắc)
// trên màn hình nhỏ (<=768px), khi hệ điều hành bật prefers-reduced-motion, hoặc thiết bị yếu
// (ít lõi CPU). Chỉ thêm/xoá class trên <body> — không đụng tới logic nghiệp vụ nào khác.
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false
const isLowPowerDevice = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
  ? navigator.hardwareConcurrency <= 4
  : false
const updateLiteEffects = () => {
  const shouldUseLite = window.innerWidth <= 768 || prefersReducedMotion || isLowPowerDevice
  document.body.classList.toggle('lite-effects', shouldUseLite)
}

onMounted(() => {
  windowWidth.value = window.innerWidth
  updateLiteEffects()
  window.addEventListener('resize', () => { windowWidth.value = window.innerWidth; updateLiteEffects() })
  startToasting()

  onAuthStateChanged(auth, (user) => {
    isAuthChecking.value = false 
    if (user) {
      initFirebaseSync(user)
    } else {
      isLoggedIn.value = false; isDataLoading.value = false; username.value = 'Member'; userBalance.value = 0;
      userFullName.value = ''; userPhone.value = ''; userBirthYear.value = ''; vipCompletedCount.value = 0
      setUserContext(null)
      myReports.value = []; myWithdrawals.value = []; localStorage.clear()
    }
  })
})

// Chỉ tạo lại listeners khi rời khỏi trang admin, không recreate mỗi lần navigate
watch(isAdminRoute, (isAdmin, wasAdmin) => {
  if (!isAdmin && wasAdmin && auth.currentUser) {
    initFirebaseSync(auth.currentUser)
  }
})

const handleNav = (path: string) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
  const targetPath = path === '/submit' ? '/submit-report' : path;
  const protectedRoutes = ['/submit', '/submit-report', '/withdraw', '/history'];

  if (!isLoggedIn.value && (protectedRoutes.includes(targetPath) || targetPath.startsWith('/job/'))) {
    alert('⚠️ ĐĂNG NHẬP ĐỂ TIẾP TỤC!'); router.push('/login'); return;
  }

  if (route.path === targetPath) {
    const mainScroll = document.querySelector('main');
    if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    router.push(targetPath);
  }
  if (windowWidth.value < 1024) isMenuOpen.value = false;
}

const handleReceiveJob = (jobId: string) => {
  if (!isLoggedIn.value) { router.push('/login'); return; }
  if (jobId === POST_THREADS_JOB_ID && mergedJobs.value[jobId]?.paused) {
    alert('Công việc này đang tạm dừng, vui lòng quay lại sau.')
    return
  }
  if (mergedJobs.value[jobId]?.paused || mergedJobs.value[jobId]?.soldout) {
    Swal.fire({
      title: mergedJobs.value[jobId]?.soldout ? 'Công việc đã hết slot, vui lòng quay lại sau.' : 'Công việc này đang tạm dừng, vui lòng quay lại sau.',
      icon: 'info',
      toast: true,
      position: 'top',
      timer: 2200,
      showConfirmButton: false,
    })
    return
  }
  if (jobId === 'survey-cinema') {
    router.push('/survey-cinema')
  } else if (jobId === 'APP NGÂN HÀNG' || jobId === 'app-ngan-hang') {
    showBankModal.value = true
  } else if (jobId === 'referral-friends') {
    activePopup.value = ''
    showFriendReferralSelect.value = true
  } else if (jobId === 'referral-hub') {
    activePopup.value = ''
    router.push('/jobs/referral-abbank')
  } else if (jobId === 'daily_threads') {
    activePopup.value = ''
    router.push('/jobs/daily-threads')
  } else if (jobId === 'referral_momo') {
    activePopup.value = ''
    showMomoReferralHub.value = true
  } else if (VIP_IDS.includes(jobId)) {
    activePopup.value = ''
    ageConfirmJobId.value = jobId
    ageConfirmJobTitle.value = mergedJobs.value[jobId]?.title || jobId
    ageConfirmAge.value = mergedJobs.value[jobId]?.ageRequirement ?? 18
    showAgeConfirmModal.value = true
  } else {
    activePopup.value = ''
    router.push(`/job/${jobId}`)
  }
}

const confirmAgeAndNavigate = () => {
  showAgeConfirmModal.value = false
  const id = ageConfirmJobId.value
  router.push(id === 'momo' ? '/jobs/momo' : `/job/${id}`)
}

const cancelAgeConfirm = () => {
  showAgeConfirmModal.value = false
  ageConfirmJobId.value = ''
  ageConfirmJobTitle.value = ''
}

const handleScrollToHistory = () => {
  if (route.path !== '/') {
    router.push('/')
    setTimeout(() => { document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' }) }, 500)
  } else {
    document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' })
  }
  if (windowWidth.value < 1024) isMenuOpen.value = false
}

const handleScrollToVip = () => {
  if (route.path !== '/') {
    router.push('/')
    setTimeout(() => { document.getElementById('vip-section')?.scrollIntoView({ behavior: 'smooth' }) }, 500)
  } else {
    document.getElementById('vip-section')?.scrollIntoView({ behavior: 'smooth' })
  }
  activePopup.value = ''
  if (windowWidth.value < 1024) isMenuOpen.value = false
}

const logout = async () => { 
  if(confirm('Xác nhận đăng xuất?')) { await signOut(auth); localStorage.clear(); router.push('/login') } 
}

const contactSupport = (t: string) => {
  window.open(t === 'facebook' ? 'https://www.facebook.com/rapjobfreelance/' : 'https://zalo.me/g/fambpb151', '_blank')
}

watch(activePopup, (val) => {
  if (val !== 'cong-viec') jobCategory.value = ''
})
</script>

<template>
  <div v-if="isAuthChecking" class="min-h-screen bg-[#0e0a09] flex items-center justify-center text-white">
    <div class="text-center space-y-4">
      <div class="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs uppercase tracking-widest text-slate-500 font-black italic">Đang tải cấu hình hệ thống...</p>
    </div>
  </div>

  <div v-else-if="isAdminRoute" class="min-h-screen bg-[#0e0a09] text-slate-300 font-sans w-full">
    <router-view />
  </div>

  <div v-else-if="isAuthRoute && !isLoggedIn" class="min-h-screen bg-slate-50 font-sans w-full">
    <router-view />
  </div>

  <div v-else class="min-h-screen text-slate-300 font-sans flex overflow-x-hidden text-left relative cinema-bg film-grain">

    <!-- Aurora background layer -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div class="aurora-blob-1"></div>
      <div class="aurora-blob-2"></div>
      <div class="aurora-blob-3"></div>
      <div class="dot-grid"></div>
    </div>

    <svg width="0" height="0" class="absolute">
      <defs>
        <linearGradient id="finalGoldCoin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fde047" />
          <stop offset="50%" style="stop-color:#eab308" />
          <stop offset="100%" style="stop-color:#854d0e" />
        </linearGradient>
      </defs>
    </svg>

    <Transition name="fade">
      <div v-if="unreadRejectedReport" class="fixed inset-0 z-[99999] flex items-center justify-center px-6">
        <div class="absolute inset-0 bg-black/95 backdrop-blur-md"></div>
        <div class="relative bg-[#150f0d] border-2 border-red-500/50 w-full max-w-md p-8 rounded-[30px] shadow-[0_0_80px_rgba(239,68,68,0.4)] text-center">
          <div class="relative z-10 space-y-5">
            <div class="w-20 h-20 bg-gradient-to-tr from-red-500 to-rose-600 rounded-full mx-auto flex items-center justify-center text-4xl animate-bounce shadow-[0_0_30px_rgba(239,68,68,0.6)]">⚠️</div>
            <h2 class="text-2xl text-white font-black italic uppercase tracking-tighter leading-none">THÔNG BÁO TỪ <span class="text-red-500">ADMIN</span></h2>
            <div class="bg-[#120b0a] rounded-xl p-5 border border-slate-800 text-left">
              <p class="text-slate-500 text-[10px] uppercase tracking-widest font-black mb-1">CÔNG VIỆC BỊ TỪ CHỐI:</p>
              <p class="text-white text-sm font-black italic mb-4">{{ unreadRejectedReport.jobName || 'Nhiệm vụ MMO' }}</p>
              <p class="text-red-400 text-[10px] uppercase tracking-widest font-black mb-1">LÝ DO BỊ TỪ CHỐI:</p>
              <p class="text-white text-sm font-bold italic normal-case bg-red-500/10 border border-red-500/20 p-3 rounded-lg">{{ unreadRejectedReport.note || 'Thông tin cung cấp không hợp lệ. Vui lòng làm lại!' }}</p>
            </div>
            <button @click="dismissRejection(unreadRejectedReport.id)" class="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black italic uppercase shadow-lg active:scale-95 transition-all">TÔI ĐÃ HIỂU VÀ SẼ LÀM LẠI</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="unreadMessageReport && !unreadRejectedReport" class="fixed inset-0 z-[99998] flex items-center justify-center px-6">
        <div class="absolute inset-0 bg-black/95 backdrop-blur-md"></div>
        <div class="relative bg-[#150f0d] border-2 border-red-600/50 w-full max-w-md p-8 rounded-[30px] shadow-[0_0_80px_rgba(185,28,28,0.35)] text-center">
          <div class="relative z-10 space-y-5">
            <div class="w-20 h-20 bg-gradient-to-tr from-red-600 to-amber-500 rounded-full mx-auto flex items-center justify-center text-4xl animate-bounce shadow-[0_0_30px_rgba(185,28,28,0.5)]">📩</div>
            <h2 class="text-2xl text-white font-black italic uppercase tracking-tighter leading-none">TIN NHẮN TỪ <span class="text-red-500">ADMIN</span></h2>
            <div class="bg-[#120b0a] rounded-xl p-5 border border-slate-800 text-left">
              <p class="text-slate-500 text-[10px] uppercase tracking-widest font-black mb-1">ĐỐI VỚI CÔNG VIỆC ĐANG CHỜ:</p>
              <p class="text-white text-sm font-black italic mb-4">{{ unreadMessageReport.jobName || 'Nhiệm vụ MMO' }}</p>
              <p class="text-amber-400 text-[10px] uppercase tracking-widest font-black mb-1">LỜI NHẮN:</p>
              <p class="text-white text-sm font-bold italic normal-case bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">{{ unreadMessageReport.note }}</p>
            </div>
            <button @click="dismissMessage(unreadMessageReport.id)" class="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-xl font-black italic uppercase shadow-lg active:scale-95 transition-all">ĐÃ ĐỌC LỜI NHẮN VÀ TẮT</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="unreadApprovedReport" class="fixed inset-0 z-[99997] flex items-center justify-center px-4 sm:px-6 overflow-hidden">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-sm"></div>
        
        <div class="absolute inset-0 pointer-events-none z-[99998]">
        <div class="absolute inset-0 confetti-layer-1"></div>
        <div class="absolute inset-0 confetti-layer-2"></div>
        <div class="absolute inset-0 confetti-layer-3"></div>
      </div>

        <div class="relative bg-gradient-to-b from-[#261208] to-[#120b0a] border-[3px] border-emerald-500 reward-popup-card w-full max-w-[420px] p-6 sm:p-8 rounded-[40px] text-center animate-in zoom-in-95 duration-500 z-[99999] overflow-hidden">

          <button @click="closeApprovalPopup(unreadApprovedReport)" aria-label="Đóng" class="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-all active:scale-95 text-xl leading-none font-black">
            ×
          </button>

          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-emerald-500/20 blur-[80px] rounded-full"></div>

          <div class="relative z-10 space-y-6 sm:space-y-8">
            
            <div class="space-y-4">
              <div class="w-24 h-24 bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 rounded-full mx-auto flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(234,179,8,0.6)] animate-bounce-custom border-4 border-white/10">
                🎉
              </div>
              <h2 class="text-[28px] sm:text-[32px] text-white font-black italic tracking-tighter leading-none drop-shadow-md">
                NHIỆM VỤ ĐƯỢC <br> <span class="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">PHÊ DUYỆT!</span>
              </h2>
            </div>
            
            <div class="bg-black/40 rounded-2xl p-5 border border-white/5 text-left relative overflow-hidden group">
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              
              <p class="text-slate-400 text-[11px] uppercase tracking-[2px] font-black mb-1 opacity-80">TÊN CÔNG VIỆC:</p>
              <p class="text-white text-base font-black italic mb-5 leading-tight">{{ unreadApprovedReport.jobName || 'Nhiệm vụ MMO' }}</p>
              
              <div class="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 flex flex-col items-center">
                <p class="text-emerald-400 text-[11px] uppercase tracking-[2px] font-black mb-2">TIỀN THƯỞNG:</p>
                <div class="flex items-center justify-center gap-2">
                  <p class="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 text-3xl sm:text-[40px] font-black italic reward-amount-glow">
                    +{{ unreadApprovedReport.reward || '0' }}
                  </p>
                  <div class="flex flex-col items-center -translate-y-1">
                    <svg class="w-7 h-7 sm:w-9 sm:h-9 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="url(#finalGoldCoin)" />
                      <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    <span class="text-[9px] text-yellow-500 font-black not-italic tracking-tighter leading-none">XU</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              <button @click="closeApprovalPopup(unreadApprovedReport)" class="w-full py-4 bg-[#1a0f0d] text-slate-300 rounded-2xl font-black italic uppercase text-xs hover:bg-slate-700 hover:text-white transition-all active:scale-95 border border-slate-600 hover:border-slate-400 shadow-md">
                ĐÓNG
              </button>
              
              <button @click="handleRutXuNgay(unreadApprovedReport)" class="relative w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-black italic uppercase text-[14px] hover:from-orange-400 hover:to-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] active:scale-95 transition-all overflow-hidden btn-glow-effect">
                <span class="relative z-10 flex items-center justify-center gap-2">
                  RÚT XU NGAY
                  <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </span>
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              </button>
            </div>

          </div>
        </div>
      </div>
    </Transition>

    <div :class="['fixed lg:sticky top-0 left-0 h-screen z-[1500] transition-all duration-500 bg-[#150f0d] border-r border-slate-900 overflow-hidden flex-shrink-0', isMenuOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full']">
      <Sidebar 
        v-if="isMenuOpen" 
        :isLoggedIn="isLoggedIn" 
        :isMenuOpen="isMenuOpen" 
        :username="username" 
        :userBalance="userBalance" 
        @toggleMenu="isMenuOpen = !isMenuOpen" 
        @logout="logout" 
        @routerPush="handleNav" 
        @requireAuth="handleNav" 
        @scrollToHistory="handleScrollToHistory" 
        @contactSupport="contactSupport" 
      />
    </div>

    <div class="flex-1 flex flex-col transition-all duration-500 min-w-0 bg-transparent w-full relative">
      
      <header class="h-16 md:h-20 flex items-center justify-between px-4 md:px-10 sticky top-0 bg-[#130c0a]/95 backdrop-blur-xl z-[1100] border-b border-red-900/25 shadow-sm">
        <div class="flex items-center gap-3">
          <button @click.stop="isMenuOpen = !isMenuOpen" class="p-2 md:p-3 bg-[#150f0d] border border-slate-800 rounded-xl md:rounded-2xl transition-all active:scale-95 hidden lg:block">
            <svg v-if="!isMenuOpen" class="w-5 h-5 md:w-6 md:h-6 text-red-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            <svg v-else class="w-5 h-5 md:w-6 md:h-6 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <Logo />
        </div>
        
        <div class="flex items-center gap-2 md:gap-4 bg-[#150f0d] border border-slate-900 pl-3 md:pl-5 pr-1 py-1 md:py-1.5 rounded-full shadow-inner ml-auto">
          <div class="flex items-center gap-1 md:gap-2">
            <span class="text-slate-500 text-[8px] md:text-[9px] uppercase hidden sm:inline-block italic font-black">Ví:</span>
            <span class="text-white text-sm md:text-xl font-black italic tracking-tighter min-w-[60px] md:min-w-[90px] text-right">
              {{ isLoggedIn ? (isBalanceVisible ? userBalance.toLocaleString() : '******') : '0' }} 
            </span>
            <div class="flex flex-col items-center translate-y-[-1px]">
               <svg class="w-4 h-4 md:w-5 md:h-5 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="url(#finalGoldCoin)" />
                  <circle cx="12" cy="12" r="7" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 1" opacity="0.3" />
                  <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
               </svg>
               <span class="text-[7px] text-yellow-500 font-black not-italic leading-none">XU</span>
            </div>
            <button @click="toggleBalance" class="text-slate-500 hover:text-red-400 px-1 active:scale-90">
              <svg v-if="isBalanceVisible" class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              <svg v-else class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L14.5 5.252M12 5c4.478 0 8.268 2.943 9.542 7a10.025 10.05 0 01-4.132 5.411m0 0L21 21M3 3l18 18" /></svg>
            </button>
          </div>
          <button @click="handleNav('/withdraw')" class="w-6 h-6 md:w-8 md:h-8 bg-red-700 text-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(185,28,28,0.4)] active:scale-90 transition-transform"><svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 md:p-10 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10 space-y-10 custom-scrollbar relative text-left">
        <template v-if="route.path === '/'">
           <!-- Mobile Profile Card -->
           <div class="lg:hidden mb-2">
             <ProfileCard
               :username="username"
               :myReports="myReports"
               :isLoggedIn="isLoggedIn"
               :isDataLoading="isDataLoading"
               :userBalance="userBalance"
             />
           </div>

           <JobSection
             :username="username"
             :isLoggedIn="isLoggedIn"
             :jobs="mergedJobs"
             @receiveJob="handleReceiveJob"
             @routerPush="handleNav"
             @contactSupport="contactSupport"
           />
           <!-- Desktop: hiển thị history thật -->
           <HistorySection class="hidden lg:block" id="history-section" :isLoggedIn="isLoggedIn" :isDataLoading="isDataLoading" :myReports="combinedHistory" />



           <!-- Mobile: Demo mức hoa hồng theo loại công việc -->
           <div class="lg:hidden space-y-4">
             <div class="flex items-center gap-3">
               <div class="w-1.5 h-8 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(56,189,248,0.5)]"></div>
               <h2 class="text-2xl text-white font-black italic uppercase tracking-tighter">
                 MỨC <span class="text-sky-400">HOA HỒNG</span>
               </h2>
             </div>

             <div class="space-y-2.5">
               <div class="bg-[#1e1309]/70 border border-slate-700/40 rounded-[20px] px-4 py-3.5 flex items-center gap-3">
                 <div class="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">👥</div>
                 <div class="flex-1 min-w-0">
                   <p class="text-white text-[12.5px] font-black italic uppercase tracking-tight truncate">Giới thiệu bạn bè</p>
                   <p class="text-emerald-400 text-[13px] font-black italic tracking-tighter">65.000 – 90.000 xu / lượt</p>
                 </div>
                 <button @click="handleReceiveJob('referral-friends')" class="shrink-0 bg-emerald-500 active:bg-emerald-400 text-[#090e17] px-4 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-wide">Tham gia</button>
               </div>

               <div class="bg-[#1e1309]/70 border border-slate-700/40 rounded-[20px] px-4 py-3.5 flex items-center gap-3">
                 <div class="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center text-xl shrink-0">⚡</div>
                 <div class="flex-1 min-w-0">
                   <p class="text-white text-[12.5px] font-black italic uppercase tracking-tight truncate">Công việc cơ bản</p>
                   <p class="text-yellow-400 text-[13px] font-black italic tracking-tighter">10.000 – 30.000 xu / job</p>
                 </div>
                 <button @click="activePopup = 'cong-viec'; jobCategory = 'basic'" class="shrink-0 bg-red-600 active:bg-red-500 text-white px-4 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-wide">Đăng ký</button>
               </div>

               <div class="bg-[#1e1309]/70 border border-amber-500/25 rounded-[20px] px-4 py-3.5 flex items-center gap-3">
                 <div class="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-xl shrink-0">👑</div>
                 <div class="flex-1 min-w-0">
                   <p class="text-white text-[12.5px] font-black italic uppercase tracking-tight truncate">Công việc VIP</p>
                   <p class="text-amber-400 text-[13px] font-black italic tracking-tighter">85.000 – 100.000 xu / job</p>
                 </div>
                 <button @click="activePopup = 'cong-viec'; jobCategory = 'vip'" class="shrink-0 bg-amber-500 active:bg-amber-400 text-[#090e17] px-4 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-wide">Đăng ký</button>
               </div>
             </div>
           </div>
           <InfoSection :isLoggedIn="isLoggedIn" @contactSupport="contactSupport" />
           
           <footer class="mt-20 bg-gradient-to-b from-[#0f0907] to-[#120b0a] pt-16 pb-28 md:pb-8 relative z-[100] italic uppercase font-black rounded-t-3xl overflow-hidden">
             <!-- Gradient top line -->
             <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-700/60 to-transparent"></div>
             <!-- Ambient top glow -->
             <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-28 bg-red-800/[0.08] rounded-full blur-[60px] pointer-events-none"></div>
             <div class="max-w-7xl mx-auto px-6 text-left">
               <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
                 <div class="space-y-4">
                   <Logo />
                   <p class="text-slate-500 text-[11px] normal-case font-bold max-w-xs italic leading-relaxed">
                     Hệ thống kiếm tiền online uy tín số 1 Việt Nam. <br>
                     Thanh toán minh bạch, bảo mật tuyệt đối 24/7.
                   </p>
                 </div>
                 
                 <div class="space-y-6">
                   <h3 class="text-white text-sm tracking-[2px] border-l-4 border-red-700 pl-4 uppercase font-black italic">Đối tác thanh toán</h3>
                   <div class="grid grid-cols-4 gap-3 items-center">
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="/images/logo-mb.png" class="bank-logo" alt="MB Bank"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png" class="bank-logo" alt="MoMo"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR.png" class="bank-logo" alt="VNPay"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="/images/logo-techcombank.png" class="bank-logo" alt="Techcombank"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-Vietcombank.png" class="bank-logo" alt="Vietcombank"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="/images/logo-tpbank.png" class="bank-logo" alt="TP Bank"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-ACB.png" class="bank-logo" alt="ACB"></div>
                     <div class="bg-white/90 rounded-xl p-3 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"><img src="https://cdn.haitrieu.com/wp-content/uploads/2022/01/Logo-VPBank.png" class="bank-logo" alt="VP Bank"></div>
                   </div>
                 </div>
                 
                 <div class="space-y-6">
                   <h3 class="text-white text-sm tracking-[2px] border-l-4 border-red-700 pl-4 uppercase font-black italic">Hỗ trợ cộng đồng</h3>
                   <div class="flex flex-col gap-3 font-black italic uppercase">
                     <button @click="contactSupport('facebook')" class="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-[11px] shadow-[0_0_20px_rgba(59,130,246,0.35)] font-black italic uppercase transition-all active:scale-95 flex items-center justify-center gap-2.5 border-t border-white/20">
                       <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                       Fanpage Messenger
                     </button>
                     <button @click="contactSupport('zalo')" class="w-full py-3.5 bg-[#0a1628] border border-slate-700/50 hover:border-[#0068FF]/40 hover:bg-[#0d1f3a] text-white rounded-xl text-[11px] font-black italic uppercase transition-all active:scale-95 flex items-center justify-center gap-2.5">
                       <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-4 h-4" />
                       Nhóm Zalo Cộng Đồng
                     </button>
                   </div>
                 </div>
               </div>
               <div class="pt-8 relative">
                 <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent"></div>
                 <div class="flex flex-col md:flex-row items-center justify-between gap-2 text-[9px] font-black text-slate-600 tracking-[1px] uppercase italic">
                   <p>COPYRIGHT © 2026 RẠP JOB CINEMA. ALL RIGHTS RESERVED.</p>
                   <p class="text-slate-700">VER 2.0 · POWERED BY FIREBASE</p>
                 </div>
               </div>
             </div>
           </footer>
        </template>
        <Transition v-else name="page-fade" mode="out-in">
          <router-view
            :key="route.path"
            :userBalance="userBalance"
            :username="username"
            :myReports="myReports"
            :myWithdrawals="myWithdrawals"
            :userFullName="userFullName"
            :userPhone="userPhone"
            :userBirthYear="userBirthYear"
            :isDataLoading="isDataLoading"
            :vipJobs="vipJobs"
            :vipCompletedCount="vipCompletedCount"
          />
        </Transition>
      </main>
    </div>

    <div v-if="showBankModal" class="fixed inset-0 z-[5000] flex items-end lg:items-center justify-center">
      <div @click="showBankModal = false" class="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"></div>
      
      <div class="relative w-full lg:max-w-md bg-[#150f0d] border-t lg:border border-slate-800 rounded-t-[40px] lg:rounded-[35px] p-8 md:p-10 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300 lg:zoom-in lg:slide-in-from-bottom-0">
        <div class="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6 lg:hidden"></div>
        <h3 class="text-xl text-white border-l-4 border-red-700 pl-4 mb-8 font-black uppercase italic tracking-tighter">Chọn Ngân Hàng</h3>
        
        <div class="space-y-4 font-bold uppercase italic font-black pb-10 lg:pb-0">
          <div v-for="bank in [{ id: 'msb-bank', name: 'MSB - CÁ NHÂN' }, { id: 'vpbank', name: 'VPBank NEO' }]"
               :key="bank.id" 
               @click="() => { showBankModal = false; router.push(`/job/${bank.id}`) }"
               class="flex items-center justify-between p-6 bg-[#120b0a] border border-slate-800 rounded-2xl cursor-pointer hover:border-red-600 transition-all active:scale-95 shadow-lg">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-red-500 text-xs border border-slate-800">🏦</div>
              <span class="text-white text-sm tracking-tighter">{{ bank.name }}</span>
            </div>
            <span class="text-red-500 font-black font-sans italic">➜</span>
          </div>
          <button @click="showBankModal = false" class="w-full py-4 mt-4 bg-slate-900 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest lg:hidden">ĐÓNG LẠI</button>
        </div>
      </div>
    </div>

    <MomoReferralHubModal :show="showMomoReferralHub" :myReports="myReports" :vipJobs="vipJobs" @close="showMomoReferralHub = false" />
    <LpbankPlusReferralHubModal :show="showLpbankPlusReferralHub" :myReports="myReports" @close="showLpbankPlusReferralHub = false" />
    <ShopeePayReferralHubModal :show="showShopeePayReferralHub" :myReports="myReports" @close="showShopeePayReferralHub = false" />
    <FriendReferralSelectModal
      :show="showFriendReferralSelect"
      :vipJobs="vipJobs"
      @close="showFriendReferralSelect = false"
      @selectMomo="showFriendReferralSelect = false; showMomoReferralHub = true"
      @selectAbbank="showFriendReferralSelect = false; router.push('/jobs/referral-abbank')"
      @selectShopeePay="showFriendReferralSelect = false; showShopeePayReferralHub = true"
      @selectLpbankPlus="showFriendReferralSelect = false; showLpbankPlusReferralHub = true"
    />

    <!-- BOTTOM SHEET BACKDROP -->
    <Transition name="fade-backdrop">
      <div v-if="activePopup"
           @click="activePopup = ''"
           class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[3900] lg:hidden">
      </div>
    </Transition>

    <!-- BOTTOM SHEET PANEL -->
    <Transition name="sheet-up">
      <div v-if="activePopup"
           class="fixed bottom-[90px] left-3 right-3 z-[3950] lg:hidden rounded-[28px] overflow-hidden max-h-[78vh] flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.5)] bg-[#17110f] border border-white/10 select-none">

        <!-- Handle bar -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 bg-white/20 rounded-full"></div>
        </div>

        <!-- NỘP BÀI popup -->
        <div v-if="activePopup === 'nop-bai'" class="p-4 space-y-3">
          <p class="text-[9px] text-slate-500 font-black uppercase tracking-[3px] text-center mb-2">CHỌN TÍNH NĂNG</p>

          <button @click="handleNav('/submit-report'); activePopup = ''"
            class="w-full flex items-center gap-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-[20px] px-5 py-4 transition-all active:scale-[0.98] group">
            <div class="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0 group-active:scale-90 transition-transform">
              <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div class="text-left flex-1">
              <p class="text-white font-black uppercase italic text-sm tracking-tight">Gửi Bằng Chứng</p>
              <p class="text-slate-400 text-[10px] font-bold normal-case not-italic mt-0.5">Upload ảnh chứng minh hoàn thành job</p>
            </div>
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>

        </div>

        <!-- CÔNG VIỆC popup — 2-step category flow (đã đơn giản hoá: list 1 cột, ít màu/glow) -->
        <div v-if="activePopup === 'cong-viec'" class="flex flex-col flex-1 min-h-0">
          <!-- Sticky header — dynamic based on step -->
          <div class="sticky top-0 bg-[#171010] px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
            <div class="flex items-center gap-2.5">
              <!-- Back button (screen 2 only) -->
              <button v-if="jobCategory !== ''" @click="jobCategory = ''" class="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <h3 class="text-white text-sm font-bold tracking-tight">
                <template v-if="jobCategory === ''">Chọn loại công việc</template>
                <template v-else-if="jobCategory === 'basic'">Công việc cơ bản</template>
                <template v-else>Công việc VIP</template>
              </h3>
            </div>
            <button @click="activePopup = ''" class="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- SCREEN 1: Chọn loại công việc — list đơn giản, không card/glow -->
          <div v-if="jobCategory === ''" class="flex-1 overflow-y-auto p-2">

            <button @click="handleReceiveJob('referral-friends')"
              class="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-white/5 transition-colors text-left border-b border-white/5">
              <div class="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">👥</div>
              <div class="flex-1 min-w-0">
                <p class="text-white text-[13px] font-semibold leading-tight">Giới thiệu bạn bè</p>
                <p class="text-emerald-400 text-[11px] font-semibold mt-0.5">65K – 90K xu / lượt</p>
              </div>
              <svg class="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>

            <button @click="jobCategory = 'basic'"
              class="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-white/5 transition-colors text-left border-b border-white/5">
              <div class="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl shrink-0">⚡</div>
              <div class="flex-1 min-w-0">
                <p class="text-white text-[13px] font-semibold leading-tight">Công việc cơ bản</p>
                <p class="text-red-400 text-[11px] font-semibold mt-0.5">10K – 30K xu / job</p>
              </div>
              <svg class="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>

            <button @click="jobCategory = 'vip'"
              class="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-white/5 transition-colors text-left">
              <div class="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl shrink-0">👑</div>
              <div class="flex-1 min-w-0">
                <p class="text-white text-[13px] font-semibold leading-tight">Công việc VIP</p>
                <p class="text-amber-400 text-[11px] font-semibold mt-0.5">85K – 100K xu / job</p>
              </div>
              <svg class="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <!-- SCREEN 2a: Basic jobs — list 1 cột, gọn -->
          <div v-else-if="jobCategory === 'basic'" class="overflow-y-auto overscroll-y-contain flex-1 px-2 py-2 flex flex-col gap-1.5">
            <template v-for="(j, id) in mergedJobs" :key="id">
              <button v-if="!VIP_IDS.includes(id as string) || id === 'shopee-pay'"
                @click="handleReceiveJob(id as string)"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-white/5 bg-white/[0.03] active:bg-white/[0.07] transition-colors text-left"
                :class="[j.paused ? 'opacity-50' : '', id === 'shopee-pay' ? 'order-first' : '']">

                <!-- Icon -->
                <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">
                  {{ jobIconMap[id as string] || '🎯' }}
                </div>

                <!-- Title + reward -->
                <div class="flex-1 min-w-0">
                  <p class="text-white text-[12.5px] font-semibold leading-snug line-clamp-2">{{ j.title }}</p>
                  <p class="text-[12px] font-bold mt-0.5 truncate" :class="j.paused ? 'text-slate-500' : 'text-yellow-400'">
                    <template v-if="j.rewardText">{{ j.rewardText }}</template>
                    <template v-else>{{ String(j.reward).replace(/\D/g,'') }} xu</template>
                  </p>
                </div>

                <!-- Badge + CTA -->
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <span class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/10" :class="j.paused ? 'text-slate-400' : getBadgeTextClass(j.badge || 'CƠ BẢN')">
                    {{ j.paused ? 'TẠM DỪNG' : (j.badge || 'CƠ BẢN') }}
                  </span>
                  <span class="flex items-center gap-0.5 text-[10.5px] font-bold" :class="j.paused ? 'text-slate-500' : 'text-white'">
                    {{ j.paused ? 'Tạm dừng' : 'Làm ngay' }}
                    <svg v-if="!j.paused" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </span>
                </div>
              </button>
            </template>
            <div class="h-1"></div>
          </div>

          <!-- SCREEN 2b: VIP jobs — list 1 cột, tông amber nhẹ -->
          <div v-else-if="jobCategory === 'vip'" class="overflow-y-auto overscroll-y-contain flex-1 px-2 py-2 space-y-1.5">
            <template v-for="id in sortedVipJobIds" :key="id">
              <button
                @click="handleReceiveJob(id as string)"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] active:bg-amber-500/[0.08] transition-colors text-left"
                :class="(mergedJobs[id as string]?.paused || mergedJobs[id as string]?.soldout) ? 'opacity-50' : ''">

                <!-- Icon -->
                <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-base shrink-0">
                  {{ jobIconMap[id as string] || '💎' }}
                </div>

                <!-- Title + reward (+ độ tuổi nếu có) -->
                <div class="flex-1 min-w-0">
                  <p class="text-amber-100 text-[12.5px] font-semibold leading-snug line-clamp-2">{{ mergedJobs[id as string]?.title }}</p>
                  <p class="text-[12px] font-bold mt-0.5 truncate"
                     :class="(mergedJobs[id as string]?.paused || mergedJobs[id as string]?.soldout) ? 'text-slate-500' : 'text-amber-400'">
                    <template v-if="mergedJobs[id as string]?.rewardText">{{ mergedJobs[id as string]?.rewardText }}</template>
                    <template v-else>{{ String(mergedJobs[id as string]?.reward || '0').replace(/\D/g,'') }} xu</template>
                    <span v-if="mergedJobs[id as string]?.ageRequirement" class="text-slate-500 font-medium"> · từ {{ mergedJobs[id as string]?.ageRequirement }} tuổi</span>
                  </p>
                </div>

                <!-- Badge + CTA -->
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <span class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/10"
                        :class="(mergedJobs[id as string]?.paused || mergedJobs[id as string]?.soldout) ? 'text-slate-400' : 'text-amber-400'">
                    {{ mergedJobs[id as string]?.soldout ? 'HẾT SLOT' : mergedJobs[id as string]?.paused ? 'TẠM DỪNG' : (mergedJobs[id as string]?.badge || 'VIP') }}
                  </span>
                  <span class="flex items-center gap-0.5 text-[10.5px] font-bold"
                        :class="(mergedJobs[id as string]?.paused || mergedJobs[id as string]?.soldout) ? 'text-slate-500' : 'text-amber-300'">
                    {{ mergedJobs[id as string]?.soldout ? 'Hết slot' : mergedJobs[id as string]?.paused ? 'Tạm dừng' : 'Đăng ký' }}
                    <svg v-if="!(mergedJobs[id as string]?.paused || mergedJobs[id as string]?.soldout)" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </span>
                </div>
              </button>
            </template>
            <div class="h-1"></div>
          </div>
        </div>

        <!-- LỊCH SỬ popup -->
        <div v-if="activePopup === 'lich-su'" class="flex flex-col flex-1 min-h-0">
          <!-- Sticky header -->
          <div class="sticky top-0 bg-[#1e1309] px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-1 h-5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.6)]"></div>
              <h3 class="text-white text-sm font-black italic uppercase tracking-tight">LỊCH SỬ HOẠT ĐỘNG</h3>
            </div>
            <button @click="activePopup = ''" class="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="overflow-y-auto overscroll-y-contain flex-1 px-3 py-3 space-y-2">

            <div v-if="!isLoggedIn" class="text-center py-12">
              <p class="text-slate-500 font-black italic uppercase tracking-widest text-[10px]">Vui lòng đăng nhập để xem lịch sử</p>
            </div>

            <div v-else-if="isDataLoading" class="text-center py-10">
              <div class="w-7 h-7 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-slate-500 text-[10px] font-black italic uppercase">Đang tải dữ liệu...</p>
            </div>

            <div v-else-if="combinedHistory.length === 0" class="text-center py-12">
              <div class="text-4xl mb-3">🎬</div>
              <p class="text-slate-600 font-black italic uppercase text-[10px] tracking-[3px]">Chưa có hoạt động nào</p>
            </div>

            <template v-else>
              <svg width="0" height="0" class="absolute">
                <defs>
                  <linearGradient id="sheetGoldCoin" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#fde047" />
                    <stop offset="50%" style="stop-color:#eab308" />
                    <stop offset="100%" style="stop-color:#854d0e" />
                  </linearGradient>
                </defs>
              </svg>

              <div v-for="item in combinedHistory" :key="item.id"
                   :class="[
                     'relative bg-[#1e1309]/70 border border-slate-700/40 p-4 rounded-[20px] flex justify-between',
                     item.status === 'rejected' ? 'border-rose-500/30 !bg-rose-950/10 items-start' : 'items-center'
                   ]">
                <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-[20px]"
                     :class="item.status === 'approved' || item.status === 'collected' ? 'bg-emerald-500/60'
                           : item.status === 'pending' ? 'bg-yellow-500/60' : 'bg-rose-500/70'"></div>

                <div class="pl-2 flex flex-col gap-0.5 flex-1 min-w-0">
                  <span class="text-red-500 text-[8px] font-black tracking-[2px] opacity-80">{{ item.displayTime }}</span>
                  <h4 class="text-white text-[11px] font-black italic uppercase tracking-tight truncate">
                    {{ item.type === 'withdraw' ? '🏦 RÚT TIỀN VỀ VÍ' : item.jobName }}
                  </h4>
                  <template v-if="item.status === 'rejected' && item.type !== 'withdraw'">
                    <p v-if="(item.note || '').length <= 60"
                       class="text-rose-400/80 text-[8px] font-bold normal-case leading-tight">
                      Lý do: {{ item.note || 'Không đạt điều kiện duyệt.' }}
                    </p>
                    <button v-else
                            @click.stop="mobileRejectNote = item.note"
                            class="text-rose-400 text-[8px] font-black underline underline-offset-1">
                      Xem lý do
                    </button>
                  </template>
                </div>

                <div class="flex items-center gap-3 shrink-0">
                  <div class="flex items-center gap-1.5">
                    <span :class="[
                      'text-lg font-black italic tracking-tighter',
                      item.status === 'rejected' ? 'text-rose-400/60' : (item.type === 'withdraw' ? 'text-rose-500' : 'text-emerald-400')
                    ]">
                      {{ item.type === 'withdraw' ? '-' : '+' }}{{ (item.reward || item.amount || 0).toLocaleString('vi-VN') }}
                    </span>
                    <div class="flex flex-col items-center translate-y-[-1px]">
                      <svg class="w-4 h-4 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="url(#sheetGoldCoin)" />
                        <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
                      </svg>
                      <span class="text-[7px] text-yellow-500 font-black not-italic leading-none mt-0.5">XU</span>
                    </div>
                  </div>
                  <span v-if="item.status === 'approved' || item.status === 'collected'"
                        class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[7px] font-black rounded-lg uppercase italic">✓</span>
                  <span v-else-if="item.status === 'pending'"
                        class="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[7px] font-black rounded-lg uppercase italic">⏳</span>
                  <span v-else
                        class="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[7px] font-black rounded-lg uppercase italic">✗</span>
                </div>
              </div>
            </template>

          </div>

          <Teleport to="body">
            <div v-if="mobileRejectNote !== null"
                 @click.self="mobileRejectNote = null"
                 class="fixed inset-0 z-[99999] flex items-end justify-center bg-black/70 backdrop-blur-sm pb-6 px-4">
              <div class="bg-[#1a0b08] border border-rose-500/40 rounded-2xl p-5 w-full max-w-sm shadow-xl">
                <p class="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-2">LÝ DO TỪ CHỐI</p>
                <p class="text-white text-sm font-bold italic normal-case leading-relaxed">{{ mobileRejectNote }}</p>
                <button @click="mobileRejectNote = null"
                        class="mt-4 w-full py-2.5 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-black uppercase rounded-xl tracking-widest">
                  ĐÓNG
                </button>
              </div>
            </div>
          </Teleport>
        </div>

        <div class="h-2"></div>
      </div>
    </Transition>

    <nav v-if="!isAuthRoute || isLoggedIn"
         class="cosmic-nav fixed bottom-0 left-0 w-full lg:hidden z-[4000] flex items-stretch justify-between px-1 pt-2 pb-3 bg-[#0a0714]/85 backdrop-blur-md border-t border-violet-400/15 select-none">

      <!-- ① CÔNG VIỆC — vị trí 1 (HOT 🔥) — active: cyan -->
      <button @click="vibrate(); activePopup === 'cong-viec' ? activePopup = '' : activePopup = 'cong-viec'" class="relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1">
        <span class="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full transition duration-200" :class="activePopup === 'cong-viec' ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)] opacity-100' : 'opacity-0'"></span>
        <span class="relative flex items-center justify-center w-9 h-9 rounded-xl transition duration-200" :class="activePopup === 'cong-viec' ? 'bg-cyan-500/15 shadow-[0_0_10px_rgba(34,211,238,0.35)]' : ''">
          <span class="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-0.5 bg-red-600 text-white text-[6px] font-black px-1 py-0.5 rounded-full uppercase leading-none">🔥</span>
          <svg style="width:24px;height:24px" class="transition duration-200" :class="activePopup === 'cong-viec' ? 'text-cyan-400' : 'text-[#9CA3AF]'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </span>
        <span class="text-[10px] font-bold tracking-wide uppercase transition duration-200" :class="activePopup === 'cong-viec' ? 'text-cyan-400' : 'text-[#8B93A7]'">CÔNG VIỆC</span>
      </button>

      <!-- ② LỊCH SỬ — vị trí 2 — active: blue -->
      <button @click="vibrate(); activePopup === 'lich-su' ? activePopup = '' : activePopup = 'lich-su'" class="relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1">
        <span class="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full transition duration-200" :class="activePopup === 'lich-su' ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.7)] opacity-100' : 'opacity-0'"></span>
        <span class="flex items-center justify-center w-9 h-9 rounded-xl transition duration-200" :class="activePopup === 'lich-su' ? 'bg-blue-500/15 shadow-[0_0_10px_rgba(96,165,250,0.35)]' : ''">
          <svg style="width:24px;height:24px" class="transition duration-200" :class="activePopup === 'lich-su' ? 'text-blue-400' : 'text-[#9CA3AF]'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        <span class="text-[10px] font-bold tracking-wide uppercase transition duration-200" :class="activePopup === 'lich-su' ? 'text-blue-400' : 'text-[#8B93A7]'">LỊCH SỬ</span>
      </button>

      <!-- ③ RÚT TIỀN — nút giữa nổi bật, nhô lên ~10px, gradient đỏ→hồng -->
      <button @click="handleNav('/withdraw')" class="relative flex-1 min-h-[48px] flex flex-col items-center justify-end pb-1.5">
        <span class="absolute -top-[10px] left-1/2 -translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/10 bg-gradient-to-br from-red-600 to-pink-500 transition duration-200"
              :class="route.path === '/withdraw' ? 'shadow-[0_0_24px_rgba(239,68,68,0.75),0_4px_14px_rgba(0,0,0,0.5)]' : 'shadow-[0_0_10px_rgba(239,68,68,0.35),0_4px_10px_rgba(0,0,0,0.4)]'">
          <svg style="width:24px;height:24px" class="text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>
        </span>
        <span class="text-[10px] font-bold tracking-wide uppercase transition duration-200" :class="route.path === '/withdraw' ? 'text-red-400' : 'text-[#8B93A7]'">RÚT TIỀN</span>
      </button>

      <!-- ④ GỬI BC — vị trí 4 — active: green -->
      <button @click="vibrate(); activePopup === 'nop-bai' ? activePopup = '' : activePopup = 'nop-bai'" class="relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1">
        <span class="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full transition duration-200" :class="activePopup === 'nop-bai' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] opacity-100' : 'opacity-0'"></span>
        <span class="flex items-center justify-center w-9 h-9 rounded-xl transition duration-200" :class="activePopup === 'nop-bai' ? 'bg-emerald-500/15 shadow-[0_0_10px_rgba(52,211,153,0.35)]' : ''">
          <svg style="width:24px;height:24px" class="transition duration-200" :class="activePopup === 'nop-bai' ? 'text-emerald-400' : 'text-[#9CA3AF]'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </span>
        <span class="text-[10px] font-bold tracking-wide uppercase transition duration-200" :class="activePopup === 'nop-bai' ? 'text-emerald-400' : 'text-[#8B93A7]'">GỬI BC</span>
      </button>

      <!-- ⑤ HỖ TRỢ — vị trí 5 — active: fuchsia (tím/hồng) -->
      <button @click="showSupportPanel = true" class="relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1">
        <span class="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full transition duration-200" :class="showSupportPanel ? 'bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.7)] opacity-100' : 'opacity-0'"></span>
        <span class="relative flex items-center justify-center w-9 h-9 rounded-xl transition duration-200" :class="showSupportPanel ? 'bg-fuchsia-500/15 shadow-[0_0_10px_rgba(232,121,249,0.35)]' : ''">
          <svg style="width:24px;height:24px" class="transition duration-200" :class="showSupportPanel ? 'text-fuchsia-400' : 'text-[#9CA3AF]'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
          <span v-if="supportBadge" class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0507] animate-pulse pointer-events-none"></span>
        </span>
        <span class="text-[10px] font-bold tracking-wide uppercase transition duration-200" :class="showSupportPanel ? 'text-fuchsia-400' : 'text-[#8B93A7]'">HỖ TRỢ</span>
      </button>

    </nav>

    <Transition name="slide-up">
      <div v-if="randomNotice && (!isAuthRoute || isLoggedIn) && !shouldHideWithdrawTicker"
           :style="windowWidth >= 1024 ? { left: isMenuOpen ? '320px' : '20px' } : {}"
           class="fixed top-[72px] left-3 right-3 lg:top-auto lg:bottom-10 lg:left-auto lg:right-auto z-[5000] flex items-center gap-3 bg-[#150f0d]/95 backdrop-blur-xl border border-red-700/50 px-4 py-3 rounded-2xl shadow-[0_8px_40px_rgba(220,38,38,0.35),0_4px_20px_rgba(0,0,0,0.6)] lg:min-w-[320px] transition-all duration-300">
        <div :class="[
          'w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-md shrink-0',
          randomNotice.type === 'withdraw'
            ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/40'
            : 'bg-gradient-to-tr from-orange-600 to-red-500 shadow-red-500/40'
        ]">
           <svg v-if="randomNotice.type === 'withdraw'" class="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24" fill="none">
             <circle cx="12" cy="12" r="10" fill="url(#finalGoldCoin)" />
             <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
           </svg>
           <span v-else class="text-lg">🔥</span>
        </div>
        <div class="flex flex-col text-left leading-tight min-w-0">
          <span class="text-white text-[12px] font-black italic tracking-tighter uppercase truncate">{{ randomNotice.name }}</span>
          <span :class="['text-[13px] font-black italic truncate', randomNotice.type === 'withdraw' ? 'text-emerald-400' : 'text-orange-400']">
            {{ randomNotice.title }}{{ randomNotice.amount ? ' ' + randomNotice.amount : '' }}
          </span>
          <span v-if="randomNotice.sub" class="text-slate-500 text-[9px] font-bold uppercase tracking-widest italic opacity-70 truncate">{{ randomNotice.sub }}</span>
        </div>
      </div>
    </Transition>

    <div class="fixed bottom-4 right-2 md:bottom-8 md:right-8 z-[999] hidden lg:flex flex-col gap-4 items-end scale-75 md:scale-100 origin-bottom-right">
      <div class="flex items-center group cursor-pointer relative" @click="showSupportPanel = true">
        <div class="mr-4 text-right overflow-hidden italic uppercase hidden md:block whitespace-nowrap">
          <p class="text-[9px] text-red-400 font-black tracking-[2px] mb-1 opacity-80 animate-jump-delay">GIẢI ĐÁP THẮC MẮC</p>
          <p class="text-white text-sm font-black italic uppercase tracking-tighter">LIÊN HỆ FANPAGE</p>
        </div>
        <div class="relative w-16 h-16 bg-[#1877F2] rounded-full shadow-lg flex items-center justify-center text-white flex-shrink-0">
          <svg class="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          <span v-if="supportBadge" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0e0a09] animate-pulse"></span>
        </div>
      </div>
      <div class="flex items-center group cursor-pointer" @click="showSupportPanel = true">
        <div class="mr-4 text-right overflow-hidden italic uppercase hidden md:block whitespace-nowrap">
          <p class="text-[9px] text-red-500 font-black tracking-[2px] mb-1 opacity-80 animate-jump-delay">CỘNG ĐỒNG RẠP JOB</p>
          <p class="text-white text-sm font-black italic uppercase tracking-tighter">THAM GIA NHÓM</p>
        </div>
        <div class="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center flex-shrink-0">
          <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-10 h-10 object-contain" />
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="isMenuOpen && windowWidth < 1024" @click="isMenuOpen = false" class="fixed inset-0 bg-black/80 z-[1200] lg:hidden backdrop-blur-sm"></div>
    </Transition>
    <Transition name="fade">
      <button v-if="isMenuOpen && windowWidth < 1024" @click.stop="isMenuOpen = false" class="fixed top-4 left-4 z-[5000] p-3 bg-[#150f0d] border border-slate-800 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-transform active:scale-95 flex items-center justify-center">
        <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </Transition>
    
    <AppBrowserBlocker />

  </div>

  <!-- AGE CONFIRMATION MODAL (mobile + desktop) -->
  <Teleport to="body">
    <Transition name="age-modal-app">
      <div v-if="showAgeConfirmModal"
           class="fixed inset-0 flex items-center justify-center p-4"
           style="background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);z-index:99999;"
           @click.self="cancelAgeConfirm">
        <div class="relative w-full max-w-[380px] rounded-[28px] overflow-hidden age-confirm-box"
             style="background:linear-gradient(145deg,#0f0a02,#1a1000,#0c0800);border:1.5px solid rgba(245,158,11,0.55);box-shadow:0 0 60px rgba(245,158,11,0.25),0 0 120px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,255,255,0.05);">

          <div style="height:3px;background:linear-gradient(90deg,transparent,#f59e0b,#fbbf24,#f59e0b,transparent);"></div>

          <div class="absolute top-0 left-0 w-16 h-16 pointer-events-none" style="background:radial-gradient(circle at 0% 0%,rgba(245,158,11,0.12),transparent 70%);"></div>
          <div class="absolute top-0 right-0 w-16 h-16 pointer-events-none" style="background:radial-gradient(circle at 100% 0%,rgba(245,158,11,0.12),transparent 70%);"></div>

          <div class="px-6 pt-6 pb-7 text-center space-y-4">
            <div class="flex justify-center">
              <div class="w-16 h-16 rounded-full flex items-center justify-center age-shield-app"
                   style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1.5px solid rgba(245,158,11,0.4);box-shadow:0 0 24px rgba(245,158,11,0.3);">
                <svg viewBox="0 0 24 24" fill="none" class="w-8 h-8">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
                  <text x="12" y="16" text-anchor="middle" fill="#fbbf24" font-size="9" font-weight="900" font-family="Arial" style="font-style:italic">18+</text>
                </svg>
              </div>
            </div>

            <div class="space-y-1">
              <p class="text-[11px] font-black uppercase tracking-[3px]"
                 style="color:#f59e0b;text-shadow:0 0 12px rgba(245,158,11,0.6);">XÁC NHẬN ĐỘ TUỔI</p>
              <h3 class="text-[15px] font-black uppercase leading-snug tracking-tight"
                  style="color:#fde68a;text-shadow:0 0 20px rgba(251,191,36,0.4);">
                {{ ageConfirmJobTitle }}
              </h3>
            </div>

            <div class="rounded-2xl px-5 py-4"
                 style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);">
              <p class="text-[13px] font-semibold leading-relaxed" style="color:#e2d4a0;">
                Công việc này yêu cầu
                <span class="font-black" style="color:#fbbf24;">đủ {{ ageConfirmAge }} tuổi trở lên.</span><br/>
                Bạn đã đủ {{ ageConfirmAge }} tuổi chưa?
              </p>
            </div>

            <div class="flex gap-3 pt-1">
              <button @click="cancelAgeConfirm"
                      class="flex-1 py-3.5 rounded-2xl font-black text-[12px] uppercase tracking-wide transition-all active:scale-95 hover:brightness-110"
                      style="background:linear-gradient(135deg,#7f1d1d,#991b1b);color:#fecaca;border:1.5px solid rgba(239,68,68,0.5);box-shadow:0 0 20px rgba(239,68,68,0.35),inset 0 1px 0 rgba(255,255,255,0.05);text-shadow:0 0 8px rgba(239,68,68,0.5);">
                ✕ HUỶ
              </button>
              <button @click="confirmAgeAndNavigate"
                      class="flex-1 py-3.5 rounded-2xl font-black text-[12px] uppercase tracking-wide transition-all active:scale-95 age-btn-confirm-app"
                      style="background:linear-gradient(135deg,#d97706,#f59e0b,#fbbf24);color:#1c0d00;border:1.5px solid rgba(251,191,36,0.6);text-shadow:0 1px 0 rgba(255,255,255,0.2);">
                ✓ ĐÃ ĐỦ {{ ageConfirmAge }}
              </button>
            </div>

            <p class="text-[9px] tracking-wider uppercase" style="color:rgba(120,100,60,0.7);">
              Click ra ngoài để đóng
            </p>
          </div>

          <div style="height:2px;background:linear-gradient(90deg,transparent,rgba(245,158,11,0.4),transparent);"></div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <SupportPanel v-model="showSupportPanel" :config="supportConfig" @close="handleSupportClose" />
</template>

<style>
/* ===== COSMIC NAV — bottom nav mobile (5 nút cố định) ===== */
.cosmic-nav {
  min-height: 72px;
  box-shadow: 0 -6px 24px rgba(0,0,0,0.35), 0 -1px 0 rgba(139,92,246,0.15);
  /* iPhone X+ home indicator safe area — cộng thêm dưới padding-bottom sẵn có, không đè mất nội dung */
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.slide-up-enter-from { opacity: 0; transform: translateY(80px) scale(0.6); }
.slide-up-leave-to { opacity: 0; transform: translateX(-80px) scale(0.9); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes jump-cycle {
  0%, 40%, 100% { transform: translateY(0); opacity: 1; } 
  5%, 15%, 25% { transform: translateY(-10px); } 
  10%, 20%, 30% { transform: translateY(0); } 
  45% { opacity: 0; transform: scale(0.5); } 
  55% { opacity: 1; transform: scale(1.1); } 
}

.animate-jump-cycle { animation: jump-cycle 4s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.animate-jump-delay { animation: jump-cycle 4s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); animation-delay: 0.1s; }

.bank-logo {
  height: 28px;
  width: auto;
  object-fit: contain;
  opacity: 0.88;
  transition: all 0.3s ease;
  cursor: pointer;
}
.bank-logo:hover {
  opacity: 1;
  transform: scale(1.05);
}

/* --- HIỆU ỨNG POPUP NỔ HŨ (GIAO DIỆN VIP) --- */
.animate-bounce-custom {
  animation: bounce-custom 2s infinite cubic-bezier(0.280, 0.840, 0.420, 1);
}
@keyframes bounce-custom {
  0%   { transform: scale(1,1)      translateY(0); }
  10%  { transform: scale(1.1,.9)   translateY(0); }
  30%  { transform: scale(.9,1.1)   translateY(-15px); }
  50%  { transform: scale(1.05,.95) translateY(0); }
  57%  { transform: scale(1,1)      translateY(-5px); }
  64%  { transform: scale(1,1)      translateY(0); }
  100% { transform: scale(1,1)      translateY(0); }
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}

.btn-glow-effect {
  border-top: 1px solid rgba(255,255,255,0.4);
  border-bottom: 2px solid rgba(0,0,0,0.4);
}
.btn-glow-effect:hover {
  box-shadow: 0 0 40px rgba(239,68,68,0.8), inset 0 0 20px rgba(255,255,255,0.2);
}

/* Pháo hoa — 3 layers tốc độ/màu khác nhau */
.confetti-layer-1 {
  background-image:
    radial-gradient(circle, #fbbf24 2px, transparent 3px),
    radial-gradient(circle, #f87171 2px, transparent 3px),
    radial-gradient(circle, #34d399 2px, transparent 3px),
    radial-gradient(circle, #60a5fa 2px, transparent 3px);
  background-size: 73px 79px, 97px 103px, 131px 127px, 167px 173px;
  background-position: 0 0, 23px 37px, 61px 19px, 89px 71px;
  animation: confetti-fall 6s linear infinite;
  opacity: 0.55;
}
.confetti-layer-2 {
  background-image:
    radial-gradient(circle, #a78bfa 3px, transparent 4px),
    radial-gradient(circle, #fb923c 3px, transparent 4px),
    radial-gradient(circle, #38bdf8 3px, transparent 4px),
    radial-gradient(circle, #f472b6 3px, transparent 4px);
  background-size: 107px 113px, 157px 151px, 191px 197px, 239px 233px;
  background-position: 15px 25px, 55px 85px, 105px 45px, 175px 125px;
  animation: confetti-fall-diagonal 9s linear infinite;
  opacity: 0.45;
}
.confetti-layer-3 {
  background-image:
    radial-gradient(circle, #fde68a 4px, transparent 6px),
    radial-gradient(circle, #bbf7d0 4px, transparent 6px),
    radial-gradient(circle, #ddd6fe 4px, transparent 6px);
  background-size: 211px 223px, 277px 283px, 337px 331px;
  background-position: 40px 60px, 130px 110px, 220px 180px;
  animation: confetti-fall 12s linear infinite, confetti-twinkle 3s ease-in-out infinite alternate;
  opacity: 0.35;
}
@keyframes confetti-fall {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes confetti-fall-diagonal {
  0% { transform: translateY(-100%) translateX(0); }
  100% { transform: translateY(100vh) translateX(40px); }
}
@keyframes confetti-twinkle {
  from { opacity: 0.2; }
  to { opacity: 0.5; }
}

/* Rainbow border animation cho popup */
@keyframes rainbow-border {
  0%,100% { border-color: #10b981; box-shadow: 0 0 60px rgba(16,185,129,0.5), 0 0 120px rgba(16,185,129,0.2); }
  20%  { border-color: #dc2626; box-shadow: 0 0 60px rgba(220,38,38,0.5), 0 0 120px rgba(220,38,38,0.2); }
  40%  { border-color: #a78bfa; box-shadow: 0 0 60px rgba(167,139,250,0.5), 0 0 120px rgba(167,139,250,0.2); }
  60%  { border-color: #ec4899; box-shadow: 0 0 60px rgba(236,72,153,0.5), 0 0 120px rgba(236,72,153,0.2); }
  80%  { border-color: #f59e0b; box-shadow: 0 0 60px rgba(245,158,11,0.5), 0 0 120px rgba(245,158,11,0.2); }
}
.reward-popup-card { animation: rainbow-border 4s ease-in-out infinite; }

/* Reward amount glow pulse */
@keyframes reward-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(234,179,8,0.4)); }
  50% { filter: drop-shadow(0 0 22px rgba(234,179,8,0.85)); }
}
.reward-amount-glow { animation: reward-glow-pulse 1.5s ease-in-out infinite; }

/* Aurora background */
.aurora-blob-1 {
  position: absolute;
  top: -200px; left: -200px;
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(185,28,28,0.12) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(80px);
  animation: aurora-drift 22s ease-in-out infinite alternate;
  will-change: transform;
}
.aurora-blob-2 {
  position: absolute;
  bottom: -200px; right: -200px;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(80px);
  animation: aurora-drift 28s ease-in-out infinite alternate-reverse;
  will-change: transform;
}
.aurora-blob-3 {
  position: absolute;
  top: 45%; right: -100px;
  width: 450px; height: 450px;
  background: radial-gradient(circle, rgba(180,130,20,0.08) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(80px);
  animation: aurora-drift 18s ease-in-out infinite alternate;
  animation-delay: -8s;
  will-change: transform;
}
.dot-grid {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px);
  background-size: 28px 28px;
}
@keyframes aurora-drift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(60px, 45px) scale(1.1); }
}

/* ── BOTTOM SHEET TRANSITIONS ──────────────────────── */
.fade-backdrop-enter-active, .fade-backdrop-leave-active { transition: opacity 0.2s ease; }
.fade-backdrop-enter-from, .fade-backdrop-leave-to { opacity: 0; }

.sheet-up-enter-active { transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease; }
.sheet-up-leave-active  { transition: transform 0.22s ease, opacity 0.18s ease; }
.sheet-up-enter-from { transform: translateY(72px); opacity: 0; }
.sheet-up-leave-to   { transform: translateY(40px); opacity: 0; }

/* ── CINEMA ATMOSPHERE ─────────────────────────────── */
.cinema-bg {
  background:
    radial-gradient(ellipse 100% 35% at 50% 0%, rgba(185,28,28,0.09) 0%, transparent 55%),
    radial-gradient(ellipse 60% 25% at 0% 100%, rgba(180,120,0,0.05) 0%, transparent 50%),
    #0e0a09;
}

/* Film grain overlay — inline SVG noise, opacity cực nhẹ */
.film-grain::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-size: 200px 200px;
  opacity: 0.022;
  pointer-events: none;
  z-index: 9998;
  mix-blend-mode: overlay;
}

/* === AGE CONFIRM MODAL (App.vue) === */
.age-modal-app-enter-active { transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
.age-modal-app-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.age-modal-app-enter-from  { opacity: 0; }
.age-modal-app-leave-to    { opacity: 0; }
.age-modal-app-enter-from .age-confirm-box { transform: scale(0.85) translateY(20px); }
.age-modal-app-enter-to   .age-confirm-box { transform: scale(1) translateY(0); }
.age-modal-app-leave-to   .age-confirm-box { transform: scale(0.9); }

@keyframes shield-pulse-app {
  0%, 100% { box-shadow: 0 0 24px rgba(245,158,11,0.3); }
  50%       { box-shadow: 0 0 40px rgba(245,158,11,0.6), 0 0 70px rgba(245,158,11,0.15); }
}
.age-shield-app { animation: shield-pulse-app 2s ease-in-out infinite; }

@keyframes confirm-glow-app {
  0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.4); }
  50%       { box-shadow: 0 0 35px rgba(245,158,11,0.8), 0 0 60px rgba(245,158,11,0.2); }
}
.age-btn-confirm-app { animation: confirm-glow-app 1.6s ease-in-out infinite; }

/* ── ROUTE PAGE TRANSITION (mobile app feel) ───────── */
.page-fade-enter-active, .page-fade-leave-active { transition: opacity 0.18s ease; }
.page-fade-enter-from, .page-fade-leave-to { opacity: 0; }
</style>