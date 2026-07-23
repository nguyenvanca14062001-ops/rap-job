<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, onSnapshot, collection, query, where, orderBy, limit, updateDoc, increment, arrayUnion } from "firebase/firestore"
import { useVipJobs } from '@/composables/useVipJobs'
import { startAppConfigListener } from '@/composables/useAppConfig'
import { startSupportListener, supportConfig, supportBadge, shouldAutoPopup, markSupportSeen, setUserContext } from '@/composables/useSupportConfig'
import SupportPanel from '@/components/SupportPanel.vue'

// --- IMPORT COMPONENT ---
import AppBrowserBlocker from '@/components/AppBrowserBlocker.vue'
import Sidebar from '@/components/home/Sidebar.vue'
import JobSection from '@/components/home/JobSection.vue'
import HistorySection from '@/components/home/HistorySection.vue'
import InfoSection from '@/components/home/InfoSection.vue'
import TreasureChest from '@/components/TreasureChest.vue'
import ProfileCard from '@/components/home/ProfileCard.vue'
import Logo from '@/components/Logo.vue'
import { jobsData } from '@/data/jobs'

// --- JOB BROWSER (dùng trong CÔNG VIỆC bottom sheet) ---
const jobIconMap: Record<string, string> = {
  'follow-cgv': '🎬', 'review-cinema': '⭐', 'checkin-cinema': '📸',
  'survey-cinema': '📋', 'post-threads': '🧵', 'join-zalo': '💬',
  'app-chung-khoan': '📈', 'app-chung-khoan-2': '📈', 'app-chung-khoan-3': '📈',
  'app-chung-khoan-4': '📈', 'msb-bank': '🏦', 'vpbank': '🏦', 'liobank': '🏦', 'abbank': '🏦', 'lpbank-plus': '🏦',
  'referral-hub': '👥', 'daily_threads': '🧵', 'zalo_kokomi': '💬',
}
const VIP_IDS = ['referral-hub', 'liobank', 'app-chung-khoan-3', 'app-chung-khoan-4', 'msb-bank', 'vpbank', 'app-chung-khoan-2', 'app-chung-khoan', 'abbank', 'lpbank-plus']

// VIP JOBS + APP CONFIG + SUPPORT CONFIG — realtime từ Firestore
const { vipJobs, ready: vipJobsReady } = useVipJobs()
startAppConfigListener()
startSupportListener()

const showSupportPanel = ref(false)

watch(shouldAutoPopup, (val) => { if (val) showSupportPanel.value = true })

const handleSupportClose = () => { markSupportSeen() }

// Merge vip_jobs Firestore lên static jobs.ts
// - Trước snapshot đầu tiên: {} → không flash job list
// - Sau snapshot: vip_jobs rỗng → dùng nguyên jobsData
// - Nếu có: override field-level, lọc hidden, gắn cờ paused/soldout
const mergedJobs = computed((): Record<string, any> => {
  if (!vipJobsReady.value) return {}
  if (vipJobs.value.length === 0) return { ...jobsData }
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
  return result
})

// Thứ tự VIP jobs theo Firestore order; lọc hidden; fallback về vị trí gốc trong VIP_IDS
const sortedVipJobIds = computed(() =>
  VIP_IDS
    .filter(id => id in mergedJobs.value)
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

// --- Color maps cho 2-column card grid (CÔNG VIỆC sheet) ---
const jobCardClass: Record<string, string> = {
  'follow-cgv':     'bg-gradient-to-br from-[#4A1212] to-[#220606] border-red-600/70 shadow-[0_0_20px_rgba(220,38,38,0.25)]',
  'review-cinema':  'bg-gradient-to-br from-[#4A3500] to-[#221800] border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
  'checkin-cinema': 'bg-gradient-to-br from-[#4A1428] to-[#220610] border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.25)]',
  'survey-cinema':  'bg-gradient-to-br from-[#281555] to-[#100820] border-violet-600/70 shadow-[0_0_20px_rgba(124,58,237,0.25)]',
  'post-threads':   'bg-gradient-to-br from-[#4A1E3D] to-[#240A1A] border-fuchsia-500/70 shadow-[0_0_20px_rgba(217,70,239,0.25)]',
  'join-zalo':      'bg-gradient-to-br from-[#1E2850] to-[#0C1226] border-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.25)]',
  'daily_threads':  'bg-gradient-to-br from-[#042a2e] to-[#021617] border-teal-500/70 shadow-[0_0_20px_rgba(20,184,166,0.25)]',
  'zalo_kokomi':    'bg-gradient-to-br from-[#0a2540] to-[#051224] border-sky-500/70 shadow-[0_0_20px_rgba(14,165,233,0.25)]',
}
const jobBadgeClass: Record<string, string> = {
  'follow-cgv': 'bg-red-700', 'review-cinema': 'bg-amber-600',
  'checkin-cinema': 'bg-rose-600', 'survey-cinema': 'bg-violet-700',
  'post-threads': 'bg-fuchsia-600', 'join-zalo': 'bg-indigo-600',
  'daily_threads': 'bg-teal-600', 'zalo_kokomi': 'bg-sky-600',
}
const jobIconBgClass: Record<string, string> = {
  'follow-cgv': 'bg-red-600/20', 'review-cinema': 'bg-amber-500/20',
  'checkin-cinema': 'bg-rose-500/20', 'survey-cinema': 'bg-violet-500/20',
  'post-threads': 'bg-fuchsia-500/20', 'join-zalo': 'bg-indigo-500/20',
  'daily_threads': 'bg-teal-500/20', 'zalo_kokomi': 'bg-sky-500/20',
}
const jobRewardClass: Record<string, string> = {
  'follow-cgv': 'text-red-400', 'review-cinema': 'text-amber-400',
  'checkin-cinema': 'text-rose-400', 'survey-cinema': 'text-violet-400',
  'post-threads': 'text-fuchsia-400', 'join-zalo': 'text-indigo-400',
  'daily_threads': 'text-teal-400', 'zalo_kokomi': 'text-sky-400',
}
function getAgeBadgeClass(age: number): string {
  if (age <= 15) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (age <= 18) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
  if (age <= 20) return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  return 'bg-red-500/20 text-red-300 border-red-500/30'
}
const jobBtnClass: Record<string, string> = {
  'follow-cgv': 'bg-red-700', 'review-cinema': 'bg-amber-600',
  'checkin-cinema': 'bg-rose-600', 'survey-cinema': 'bg-violet-700',
  'post-threads': 'bg-fuchsia-600', 'join-zalo': 'bg-indigo-600',
  'daily_threads': 'bg-teal-600', 'zalo_kokomi': 'bg-sky-600',
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
const showWelcomePopup = ref(false)
const showBankModal = ref(false)
const activePopup = ref<'nop-bai' | 'cong-viec' | 'lich-su' | ''>('')
const mobileRejectNote = ref<string | null>(null)
const jobCategory = ref<'basic' | 'vip' | ''>('')

const isAdminRoute = computed(() => route.path.includes('admin'))
const isAuthRoute = computed(() => route.path.includes('/login') || route.path.includes('/register'))

const username = ref(localStorage.getItem('mmo_username') || 'Member')
const userBalance = ref(Number(localStorage.getItem('mmo_balance')) || 0)
const userFullName = ref('')
const userPhone = ref('')
const userBirthYear = ref('')

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

const handleThuTienVeVi = async (report: any) => {
  if (!auth.currentUser) return;
  try {
    // 🛑 ĐÃ XÓA LỆNH CỘNG TIỀN Ở ĐÂY ĐỂ CHỐNG HACK VÀ CHỐNG CỘNG ĐÚP 🛑
    // Tiền CHỈ ĐƯỢC CỘNG 1 LẦN DUY NHẤT ở trang Admin khi sếp bấm Duyệt.
    
    // Đổi trạng thái sang collected để đóng popup vĩnh viễn cho đơn này
    await updateDoc(doc(db, "reports", report.id), { status: 'collected' });
    dismissApproval(report.id); 
  } catch (e) { 
    console.error("LỖI ĐÓNG POPUP:", e); 
    alert("Lỗi xử lý! Sếp nhấn F12 xem tab Console báo đỏ chữ gì nhé."); 
  }
}

const handleRutXuNgay = async (report: any) => {
  await handleThuTienVeVi(report);
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
  { name: 'Follow Fanpage CGV', reward: '30.000' },
  { name: 'Đánh Giá 5 Sao Rạp Phim', reward: '25.000' },
  { name: 'Check-in Tại Rạp', reward: '30.000' },
  { name: 'Khảo Sát Phim', reward: '30.000' },
  { name: 'Đánh Giá Google Map', reward: '25.000' },
  { name: 'Tham Gia Nhóm Zalo', reward: '10.000' },
  { name: 'App Chứng Khoán Kafi', reward: '85.000' },
  { name: 'Ngân Hàng MSB', reward: '100.000' },
  { name: 'Ngân Hàng VPBank', reward: '100.000' },
]

// Pool các loại hoạt động (không có tên — tên lấy ngẫu nhiên từ names[])
const activityPool = [
  { icon: '🎬', job: 'FOLLOW FANPAGE CGV',       reward: '30.000',    type: 'job'      },
  { icon: '⭐', job: 'ĐÁNH GIÁ 5 SAO RẠP PHIM', reward: '25.000',    type: 'job'      },
  { icon: '📸', job: 'CHECK-IN TẠI RẠP',         reward: '30.000',    type: 'job'      },
  { icon: '📋', job: 'KHẢO SÁT PHIM',            reward: '30.000',    type: 'job'      },
  { icon: '📍', job: 'ĐÁNH GIÁ GOOGLE MAP',      reward: '25.000',    type: 'job'      },
  { icon: '💬', job: 'THAM GIA NHÓM ZALO',       reward: '10.000',    type: 'job'      },
  { icon: '📈', job: 'APP CHỨNG KHOÁN KAFI',     reward: '85.000',    type: 'job'      },
  { icon: '💎', job: 'NGÂN HÀNG MSB',            reward: '100.000',   type: 'job'      },
  { icon: '💎', job: 'NGÂN HÀNG VPBANK',         reward: '100.000',   type: 'job'      },
  { icon: '💸', job: 'RÚT VỀ MB BANK',           reward: '350.000',   type: 'withdraw' },
  { icon: '💸', job: 'RÚT VỀ VPBANK',            reward: '650.000',   type: 'withdraw' },
  { icon: '💸', job: 'RÚT VỀ TECHCOMBANK',       reward: '500.000',   type: 'withdraw' },
  { icon: '💸', job: 'RÚT VỀ MOMO',              reward: '1.000.000', type: 'withdraw' },
  { icon: '💸', job: 'RÚT VỀ VIETCOMBANK',       reward: '800.000',   type: 'withdraw' },
  { icon: '💸', job: 'RÚT VỀ TPBANK',            reward: '300.000',   type: 'withdraw' },
]
let _feedUid = 0
const liveActivityFeed = ref<any[]>([])

const startLiveFeed = () => {
  // Khởi tạo 8 entries ngẫu nhiên
  const usedNames = [...names].sort(() => Math.random() - 0.5)
  const initTimes = ['1 phút', '2 phút', '4 phút', '6 phút', '9 phút', '13 phút', '18 phút', '24 phút']
  liveActivityFeed.value = initTimes.map((t, i) => {
    const entry = activityPool[Math.floor(Math.random() * activityPool.length)]
    return { ...entry, name: usedNames[i % usedNames.length], time: t + ' trước', uid: ++_feedUid }
  })
  // Thêm entry mới lên đầu mỗi 2.5–4.5 giây
  const rotate = () => {
    const delay = Math.floor(Math.random() * (4500 - 2500 + 1) + 2500)
    setTimeout(() => {
      const entry = activityPool[Math.floor(Math.random() * activityPool.length)]
      const name = names[Math.floor(Math.random() * names.length)]
      liveActivityFeed.value = [
        { ...entry, name, time: 'vừa xong', uid: ++_feedUid },
        ...liveActivityFeed.value.slice(0, 7)
      ]
      rotate()
    }, delay)
  }
  rotate()
}

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const fmtXu = (n: number) => n.toLocaleString('vi-VN')

const triggerNotice = (type: 'withdraw' | 'chest') => {
  const name = names[Math.floor(Math.random() * names.length)]
  if (type === 'withdraw') {
    const bank = banks[Math.floor(Math.random() * banks.length)]
    const withdrawAmounts = ['250.000', '500.000', '650.000', '800.000', '1.000.000', ]
    randomNotice.value = {
      type: 'withdraw', name, title: 'Vừa rút thành công',
      amount: withdrawAmounts[Math.floor(Math.random() * withdrawAmounts.length)], sub: `Về Ngân hàng ${bank}`
    }
  } else {
    const chestList = [
      { name: 'Hòm Bạc',       min: 20000,  max: 100000  },
      { name: 'Hòm Vàng',      min: 50000,  max: 300000  },
      { name: 'Hòm Kim Cương', min: 200000, max: 1000000 },
    ]
    const c = chestList[Math.floor(Math.random() * chestList.length)]
    const xu = randInt(c.min, c.max)
    randomNotice.value = {
      type: 'chest', name, title: `Vừa nhận ${fmtXu(xu)} XU`,
      amount: '', sub: `Từ ${c.name}`
    }
  }
  setTimeout(() => { randomNotice.value = null }, 2500)
}

const startToasting = () => {
  const withdrawLoop = () => {
    const next = Math.floor(Math.random() * (6000 - 3500 + 1) + 3500)
    setTimeout(() => { if (!randomNotice.value) triggerNotice('withdraw'); withdrawLoop() }, next)
  }
  const chestLoop = () => {
    const next = Math.floor(Math.random() * (7000 - 4000 + 1) + 4000)
    setTimeout(() => { if (!randomNotice.value) triggerNotice('chest'); chestLoop() }, next)
  }
  withdrawLoop(); chestLoop()
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

function playChestSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    // Shimmer ma thuật: G4 → B4 → D5 → F#5 → B5
    const notes = [392, 494, 587, 740, 988]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.09
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
      osc.start(t); osc.stop(t + 0.32)
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

// === VIP PROGRESS (dùng myReports đã có, không cần backend mới) ===
const vipTiers = [
  { min: 0,  max: 9,   key: '',         rewardXu: 0,      btnBg: '',            bar: '',             name: 'THƯỜNG',        icon: '🎖️', chest: null,               chestDesc: null,                               color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/40' },
  { min: 10, max: 11,  key: 'bac',      rewardXu: 10000,  btnBg: 'bg-slate-600',bar: 'bg-slate-400', name: 'VIP BẠC',       icon: '🥈', chest: '🎁 Hòm Bạc',      chestDesc: '20.000 – 100.000 XU',  color: 'text-slate-300', bg: 'bg-slate-400/20', border: 'border-slate-400/60' },
  { min: 12, max: 15,  key: 'vang',     rewardXu: 50000,  btnBg: 'bg-amber-600',bar: 'bg-amber-500', name: 'VIP VÀNG',      icon: '🥇', chest: '🎁 Hòm Vàng',     chestDesc: '50.000 – 300.000 XU',  color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/60' },
  { min: 16, max: 999, key: 'kimcuong', rewardXu: 200000, btnBg: 'bg-cyan-600', bar: 'bg-cyan-500',  name: 'VIP KIM CƯƠNG', icon: '💎', chest: '🎁 Hòm Kim Cương', chestDesc: '200.000 – 1.000.000 XU',color: 'text-cyan-400',  bg: 'bg-cyan-500/20',  border: 'border-cyan-500/60'  },
]

const expandedChest = ref<number | null>(null)
const selectedChestTier = computed(() =>
  expandedChest.value !== null ? vipTiers[expandedChest.value + 1] : null
)

const vipProgress = computed(() => {
  const count = myReports.value.filter((r: any) => r.status === 'approved' || r.status === 'collected').length
  let tierIdx = 0
  for (let i = vipTiers.length - 1; i >= 0; i--) {
    if (count >= vipTiers[i].min) { tierIdx = i; break }
  }
  const tier = vipTiers[tierIdx]
  const nextTier = tierIdx < vipTiers.length - 1 ? vipTiers[tierIdx + 1] : null
  const rangeSize = nextTier ? nextTier.min - tier.min : 1
  const progress = nextTier ? Math.min(100, ((count - tier.min) / rangeSize) * 100) : 100
  return { count, tier, nextTier, progress, tierIdx }
})

// Track hòm đã nhận (đọc từ Firestore)
const claimedChests = ref<string[]>([])
const claimingChest = ref(false)

const claimChest = async (key: string, rewardXu: number) => {
  if (claimingChest.value || claimedChests.value.includes(key)) return
  const user = auth.currentUser
  if (!user) return
  claimingChest.value = true
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      balance: increment(rewardXu),
      claimedChests: arrayUnion(key)
    })
  } catch (e) { console.error('Lỗi nhận thưởng:', e) }
  finally { claimingChest.value = false }
}

// Claim popup
const showClaimPopup = ref(false)
const claimPopupOpening = ref(false)
const claimPopupParticles = ref<{ id: number; x: number; delay: number }[]>([])

function openClaimPopup() {
  if (!selectedChestTier.value) return
  playChestSound()
  showClaimPopup.value = true
  claimPopupOpening.value = false
  claimPopupParticles.value = []
  setTimeout(() => {
    claimPopupOpening.value = true
    claimPopupParticles.value = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 140,
      delay: i * 65,
    }))
  }, 280)
}

async function confirmClaim() {
  if (!selectedChestTier.value) return
  await claimChest(selectedChestTier.value.key, selectedChestTier.value.rewardXu)
  showClaimPopup.value = false
  claimPopupOpening.value = false
  claimPopupParticles.value = []
}

// === LOGIC ĐỒNG BỘ THỜI GIAN THỰC CHỐNG LỖI ===
const initFirebaseSync = (user: any) => {
  if (unsubscribeUser) { if (import.meta.env.DEV) console.log('[Firestore] STOP user/reports/withdrawals listeners'); unsubscribeUser() }
  if (unsubscribeReports) unsubscribeReports()
  if (unsubscribeWithdrawals) unsubscribeWithdrawals()

  if (!user || isAdminRoute.value) return

  if (import.meta.env.DEV) console.log('[Firestore] START listeners uid:', user.uid)
  isLoggedIn.value = true
  setUserContext(user.uid)

  unsubscribeUser = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data()
      claimedChests.value = Array.isArray(data.claimedChests) ? data.claimedChests : []
      username.value = data.username || data.fullName || 'Member'
      userFullName.value = data.fullName || ''
      userPhone.value = data.phone || ''
      userBirthYear.value = data.dob || ''
      const realBalance = data.balance ? Number(data.balance) : 0;
      userBalance.value = realBalance;
      
      if (data.receivedWelcomeGift !== true) {
         if (realBalance === 0) {
           try {
             await updateDoc(doc(db, "users", user.uid), { 
               balance: increment(10000),
               receivedWelcomeGift: true 
             })
             showWelcomePopup.value = true
           } catch (e) { console.error("Lỗi cộng tiền:", e) }
         } else if (realBalance > 0) {
           updateDoc(doc(db, "users", user.uid), { receivedWelcomeGift: true }).catch(e => {})
         }
      }

      localStorage.setItem('mmo_username', username.value)
      localStorage.setItem('mmo_balance', String(realBalance))
    }
  })
  
  if (import.meta.env.DEV) console.log('[Firestore] START reports listener — collection: reports, uid filter, orderBy createdAt desc, limit 50')
  unsubscribeReports = onSnapshot(query(collection(db, "reports"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(50)), (snapshot) => {
    myReports.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    isDataLoading.value = false
  })

  if (import.meta.env.DEV) console.log('[Firestore] START withdrawals listener — collection: withdrawals, uid filter, orderBy createdAt desc, limit 20')
  unsubscribeWithdrawals = onSnapshot(
    query(collection(db, "withdrawals"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(20)),
    (snapshot) => {
      myWithdrawals.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    },
    (error) => {
      console.error('[Firestore] Lỗi tải lịch sử rút tiền (withdrawals listener):', error)
    }
  )
}

onMounted(() => {
  windowWidth.value = window.innerWidth
  window.addEventListener('resize', () => { windowWidth.value = window.innerWidth })
  startToasting()
  startLiveFeed()
  
  onAuthStateChanged(auth, (user) => {
    isAuthChecking.value = false 
    if (user) {
      initFirebaseSync(user)
    } else {
      isLoggedIn.value = false; isDataLoading.value = false; username.value = 'Member'; userBalance.value = 0;
      userFullName.value = ''; userPhone.value = ''; userBirthYear.value = ''
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
  if (mergedJobs.value[jobId]?.paused || mergedJobs.value[jobId]?.soldout) {
    alert('⏸️ CÔNG VIỆC TẠM DỪNG\nChương trình đang được cập nhật. Vui lòng quay lại sau!')
    return
  }
  if (jobId === 'survey-cinema') {
    router.push('/survey-cinema')
  } else if (jobId === 'APP NGÂN HÀNG' || jobId === 'app-ngan-hang') {
    showBankModal.value = true
  } else if (jobId === 'referral-hub') {
    activePopup.value = ''
    router.push('/jobs/referral-lpbank')
  } else if (jobId === 'daily_threads') {
    activePopup.value = ''
    router.push('/jobs/daily-threads')
  } else if (jobId === 'zalo_kokomi') {
    activePopup.value = ''
    router.push('/jobs/zalo-kokomi')
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
  router.push(`/job/${ageConfirmJobId.value}`)
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
      <div v-if="showWelcomePopup" class="fixed inset-0 z-[4000] flex items-center justify-center px-6">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showWelcomePopup = false"></div>
        <div class="relative bg-[#150f0d] border border-red-700/30 w-full max-w-md p-8 rounded-[40px] shadow-[0_0_50px_rgba(185,28,28,0.2)] text-center">
          <div class="relative z-10 space-y-6">
            <div class="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-3xl mx-auto flex items-center justify-center text-4xl animate-bounce">🎁</div>
            <h2 class="text-3xl text-white font-black italic uppercase tracking-tighter leading-none">Chào mừng <br/><span class="text-red-500">Tân Thủ!</span></h2>
            <p class="text-slate-400 text-sm font-bold italic leading-relaxed uppercase">Hệ thống đã cộng 10,000 XU vào ví.</p>
            <button @click="showWelcomePopup = false" class="w-full py-5 bg-red-700 text-white rounded-2xl font-black italic uppercase shadow-lg shadow-red-600/30 active:scale-95">Bắt đầu ngay</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ===== CLAIM CHEST POPUP ===== -->
    <Transition name="fade">
      <div v-if="showClaimPopup && selectedChestTier" class="fixed inset-0 z-[5000] flex items-center justify-center px-6">
        <div class="absolute inset-0 bg-black/92 backdrop-blur-md" @click="showClaimPopup = false"></div>
        <div class="relative w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl border"
             :class="[selectedChestTier.bg, selectedChestTier.border]"
             :style="{ boxShadow: `0 0 60px ${selectedChestTier.key === 'kimcuong' ? 'rgba(6,182,212,0.35)' : selectedChestTier.key === 'vang' ? 'rgba(245,158,11,0.35)' : 'rgba(148,163,184,0.25)'}` }">

          <!-- Inner glow top -->
          <div class="absolute top-0 left-0 right-0 h-32 pointer-events-none"
               :style="{ background: `radial-gradient(ellipse at 50% -20%, ${selectedChestTier.key === 'kimcuong' ? 'rgba(6,182,212,0.25)' : selectedChestTier.key === 'vang' ? 'rgba(245,158,11,0.25)' : 'rgba(148,163,184,0.2)'} 0%, transparent 70%)` }"></div>

          <div class="relative z-10 p-7 space-y-5 text-center">

            <!-- Animated chest + particles -->
            <div class="relative flex justify-center items-center h-28">

              <!-- XU Particles bay lên -->
              <div v-for="p in claimPopupParticles" :key="p.id"
                   class="popup-xu-particle absolute font-black text-[11px] text-amber-400 pointer-events-none"
                   :style="{ '--ppx': p.x + 'px', animationDelay: p.delay + 'ms' }">
                +XU
              </div>

              <!-- Light burst -->
              <div v-if="claimPopupOpening"
                   class="absolute inset-0 rounded-full pointer-events-none popup-light-burst"
                   :style="{ background: `radial-gradient(circle, ${selectedChestTier.key === 'kimcuong' ? 'rgba(6,182,212,0.6)' : selectedChestTier.key === 'vang' ? 'rgba(251,191,36,0.6)' : 'rgba(148,163,184,0.5)'} 0%, transparent 65%)` }"></div>

              <!-- Big chest emoji -->
              <span class="text-[72px] leading-none relative z-10 select-none"
                    :class="claimPopupOpening ? 'popup-chest-open' : 'popup-chest-idle'">
                🎁
              </span>
            </div>

            <!-- Tier + reward info -->
            <div class="space-y-1.5">
              <p class="font-black italic uppercase text-base tracking-wide" :class="selectedChestTier.color">
                {{ selectedChestTier.chest }} 🎉
              </p>
              <p class="text-white font-black text-sm">{{ selectedChestTier.chestDesc }}</p>
              <p class="text-emerald-400 text-[10px] font-bold">Bạn đã đủ điều kiện nhận thưởng!</p>
            </div>

            <!-- Reward highlight -->
            <div class="rounded-2xl border py-3 px-4"
                 :class="[selectedChestTier.bg, selectedChestTier.border]">
              <p class="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">PHẦN THƯỞNG</p>
              <p class="font-black text-2xl italic" :class="selectedChestTier.color">
                +{{ selectedChestTier.rewardXu.toLocaleString('vi-VN') }}
                <span class="text-amber-400">XU</span>
              </p>
            </div>

            <!-- Buttons -->
            <div class="space-y-2.5">
              <button
                @click="confirmClaim"
                :disabled="claimingChest"
                class="w-full py-4 rounded-2xl font-black italic uppercase text-sm text-white transition-all active:scale-95 disabled:opacity-60 shadow-xl"
                :class="selectedChestTier.btnBg">
                <span v-if="claimingChest">⏳ Đang xử lý...</span>
                <span v-else>🎁 NHẬN NGAY +{{ selectedChestTier.rewardXu.toLocaleString('vi-VN') }} XU</span>
              </button>
              <button @click="showClaimPopup = false"
                      class="w-full py-2 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-400 transition-colors">
                Để sau
              </button>
            </div>

          </div>
        </div>
      </div>
    </Transition>
    <!-- ===== END CLAIM CHEST POPUP ===== -->

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
              <button @click="handleThuTienVeVi(unreadApprovedReport)" class="w-full py-4 bg-[#1a0f0d] text-slate-300 rounded-2xl font-black italic uppercase text-xs hover:bg-slate-700 hover:text-white transition-all active:scale-95 border border-slate-600 hover:border-slate-400 shadow-md">
                THU TIỀN VỀ VÍ
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
               :vipProgress="vipProgress"
               :vipTiers="vipTiers"
               :claimedChests="claimedChests"
               :isLoggedIn="isLoggedIn"
               :isDataLoading="isDataLoading"
               :userBalance="userBalance"
             />
           </div>

           <!-- Mobile: 3 Hòm Rương -->
           <div v-if="isLoggedIn" class="lg:hidden space-y-3">
             <!-- Grid hòm -->
             <div class="grid grid-cols-3 gap-2.5">
               <TreasureChest
                 v-for="(t, i) in vipTiers.slice(1)" :key="t.key"
                 :tier="t"
                 :unlocked="vipProgress.count >= t.min"
                 :claimed="claimedChests.includes(t.key)"
                 :count="vipProgress.count"
                 @toggle="expandedChest = expandedChest === i ? null : i"
               />
             </div>

             <!-- Detail panel khi click hòm -->
             <div v-if="selectedChestTier" class="relative rounded-2xl border p-4 space-y-2"
                  :class="[selectedChestTier.bg, selectedChestTier.border]">

               <!-- ĐÃ MỞ -->
               <template v-if="vipProgress.count >= selectedChestTier.min">
                 <p class="text-center font-black italic uppercase text-sm" :class="selectedChestTier.color">
                   {{ selectedChestTier.chest }} 🎉
                 </p>
                 <p class="text-center text-white text-[11px] font-black">{{ selectedChestTier.chestDesc }}</p>
                 <p class="text-center text-emerald-400 text-[9px] font-bold">Chúc mừng! Bạn đã đủ điều kiện nhận thưởng.</p>

                 <!-- ĐÃ NHẬN -->
                 <div v-if="claimedChests.includes(selectedChestTier.key)"
                      class="w-full py-2 text-center text-emerald-400 text-[10px] font-black uppercase tracking-wide border border-emerald-500/20 rounded-xl bg-emerald-500/5">
                   ✅ ĐÃ NHẬN THƯỞNG
                 </div>
                 <!-- CHƯA NHẬN -->
                 <button v-else
                         @click="openClaimPopup()"
                         :disabled="claimingChest"
                         class="w-full py-3 rounded-xl font-black italic uppercase text-sm text-white transition-all active:scale-95 disabled:opacity-60 shadow-lg"
                         :class="selectedChestTier.btnBg">
                   <span v-if="claimingChest">⏳ Đang xử lý...</span>
                   <span v-else>🎁 NHẬN THƯỞNG +{{ selectedChestTier.rewardXu.toLocaleString('vi-VN') }} XU</span>
                 </button>
               </template>

               <!-- CÒN KHÓA -->
               <template v-else>
                 <p class="text-center font-black italic uppercase text-sm" :class="selectedChestTier.color">
                   {{ selectedChestTier.chest }}
                 </p>
                 <p class="text-center text-slate-400 text-[10px] font-bold">
                   Cần hoàn thành {{ selectedChestTier.min }} công việc
                 </p>
                 <div class="space-y-1">
                   <div class="flex justify-between">
                     <span class="text-slate-600 text-[8px] font-black uppercase">TIẾN ĐỘ</span>
                     <span class="text-[9px] font-black" :class="selectedChestTier.color">
                       {{ vipProgress.count }}/{{ selectedChestTier.min }}
                     </span>
                   </div>
                   <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div class="h-full rounded-full transition-all duration-700"
                          :class="selectedChestTier.bar"
                          :style="{ width: Math.min(100, (vipProgress.count / selectedChestTier.min) * 100) + '%' }"></div>
                   </div>
                 </div>
                 <p class="text-center text-[9px] font-black italic" :class="selectedChestTier.color">
                   Phần thưởng: {{ selectedChestTier.chestDesc }}
                 </p>
               </template>
             </div>
           </div><!-- /3 hòm rương -->

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



           <!-- Mobile: Live activity feed -->
           <div class="lg:hidden space-y-4">
             <div class="flex items-center gap-3">
               <div class="w-1.5 h-8 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(56,189,248,0.5)]"></div>
               <div class="flex items-center gap-2 flex-wrap">
                 <h2 class="text-2xl text-white font-black italic uppercase tracking-tighter">
                   HOẠT ĐỘNG <span class="text-sky-400">GẦN ĐÂY</span>
                 </h2>
                 <span class="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded-full">
                   <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                   LIVE
                 </span>
               </div>
             </div>

             <div class="relative overflow-hidden">
               <TransitionGroup name="live-feed" tag="div" class="space-y-2">
                 <div v-for="entry in liveActivityFeed" :key="entry.uid"
                      class="bg-[#1e1309]/70 border border-slate-700/40 rounded-[20px] px-4 py-3 flex items-center gap-3">
                   <div :class="[
                     'w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border border-white/10',
                     entry.type === 'withdraw' ? 'bg-emerald-500/15' : 'bg-red-600/15'
                   ]">{{ entry.icon }}</div>
                   <div class="flex-1 min-w-0">
                     <p class="text-white text-[11px] font-black italic uppercase tracking-tight truncate">{{ entry.name }}</p>
                     <p class="text-slate-400 text-[9px] font-bold normal-case truncate">{{ entry.job }}</p>
                   </div>
                   <div class="text-right shrink-0">
                     <p :class="['text-sm font-black italic tracking-tighter', entry.type === 'withdraw' ? 'text-emerald-400' : 'text-yellow-400']">
                       +{{ entry.reward }}
                     </p>
                     <p :class="['text-[8px] font-bold', entry.time === 'vừa xong' ? 'text-sky-400' : 'text-slate-600']">{{ entry.time }}</p>
                   </div>
                 </div>
               </TransitionGroup>
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
           class="fixed bottom-[90px] left-3 right-3 z-[3950] lg:hidden rounded-[28px] overflow-hidden max-h-[78vh] flex flex-col shadow-[0_-8px_60px_rgba(0,0,0,0.7)] bg-gradient-to-b from-[#221510] to-[#160d0b] border border-white/10 select-none">

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

        <!-- CÔNG VIỆC popup — 2-step category flow -->
        <div v-if="activePopup === 'cong-viec'" class="flex flex-col flex-1 min-h-0">
          <!-- Sticky header — dynamic based on step -->
          <div class="sticky top-0 bg-[#1e1309] px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
            <div class="flex items-center gap-2">
              <!-- Back button (screen 2 only) -->
              <button v-if="jobCategory !== ''" @click="jobCategory = ''" class="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform mr-0.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div class="w-1 h-5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                   :class="jobCategory === 'vip' ? 'bg-amber-400' : 'bg-red-500'"></div>
              <h3 class="text-white text-sm font-black italic uppercase tracking-tight">
                <template v-if="jobCategory === ''">CHỌN LOẠI CÔNG VIỆC</template>
                <template v-else-if="jobCategory === 'basic'">⚡ CƠ BẢN</template>
                <template v-else>👑 VIP</template>
              </h3>
            </div>
            <button @click="activePopup = ''" class="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- SCREEN 1: Chọn loại công việc -->
          <div v-if="jobCategory === ''" class="flex-1 flex flex-col gap-4 p-4 justify-center">

            <!-- Card CƠ BẢN -->
            <button @click="jobCategory = 'basic'"
              class="relative flex items-center gap-4 p-5 rounded-[22px] bg-gradient-to-r from-[#2a0c0c] to-[#1a0808] border-2 border-red-600/50 active:border-red-500/80 active:scale-[0.97] transition-all overflow-hidden group">
              <div class="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent pointer-events-none"></div>
              <div class="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-2xl shrink-0">⚡</div>
              <div class="text-left flex-1 relative z-10">
                <p class="text-white text-base font-black italic uppercase leading-tight">CÔNG VIỆC CƠ BẢN</p>
                <p class="text-red-400 text-[11px] font-black uppercase tracking-wider mt-0.5">NHANH &amp; DỄ • 10K–30K XU</p>
                <p class="text-slate-500 text-[10px] mt-1">Follow, check-in, đánh giá, khảo sát...</p>
              </div>
              <svg class="w-5 h-5 text-red-400 shrink-0 group-active:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>

            <!-- Card VIP -->
            <button @click="jobCategory = 'vip'"
              class="relative flex items-center gap-4 p-5 rounded-[22px] bg-gradient-to-r from-[#2A1C00] to-[#1a1000] border-2 border-amber-500/50 active:border-amber-400/80 active:scale-[0.97] transition-all overflow-hidden group">
              <div class="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent pointer-events-none"></div>
              <div class="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-2xl shrink-0">👑</div>
              <div class="text-left flex-1 relative z-10">
                <p class="text-amber-300 text-base font-black italic uppercase leading-tight">CÔNG VIỆC VIP</p>
                <p class="text-amber-400 text-[11px] font-black uppercase tracking-wider mt-0.5">THU NHẬP CAO • 85K–100K XU</p>
                <p class="text-slate-500 text-[10px] mt-1">App chứng khoán, ngân hàng...</p>
              </div>
              <svg class="w-5 h-5 text-amber-400 shrink-0 group-active:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <!-- SCREEN 2a: Basic jobs — 2-column card grid -->
          <div v-else-if="jobCategory === 'basic'" class="overflow-y-auto overscroll-y-contain flex-1 px-3 py-3">
            <div class="grid grid-cols-2 gap-2.5">
              <template v-for="(j, id) in mergedJobs" :key="id">
                <button v-if="!VIP_IDS.includes(id as string)"
                  @click="handleReceiveJob(id as string)"
                  class="relative flex flex-col p-4 rounded-[20px] border-[1.5px] transition-all duration-200 active:scale-[0.96] overflow-hidden text-left"
                  :class="jobCardClass[id as string] || 'bg-[#150f0d] border-slate-700'">

                  <!-- Highlight layer -->
                  <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white/5 pointer-events-none rounded-[18px]"></div>

                  <!-- Badge top-right -->
                  <div class="absolute top-0 right-0 text-[8px] px-2 py-1 rounded-bl-xl rounded-tr-[18px] font-black italic uppercase border-b border-l border-white/15 text-white z-10"
                       :class="jobBadgeClass[id as string] || 'bg-slate-700'">
                    {{ j.badge || 'CƠ BẢN' }}
                  </div>

                  <!-- Icon -->
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 border border-white/10 relative z-10"
                       :class="jobIconBgClass[id as string] || 'bg-white/5'">
                    {{ jobIconMap[id as string] || '🎯' }}
                  </div>

                  <!-- Title -->
                  <p class="text-white text-[11px] font-black italic uppercase tracking-tight leading-tight mb-2 flex-1 relative z-10">
                    {{ j.title }}
                  </p>

                  <!-- Reward -->
                  <div class="flex items-baseline gap-1 mb-3 relative z-10">
                    <template v-if="j.rewardText">
                      <span class="text-[13px] font-black italic tracking-tighter" :class="jobRewardClass[id as string] || 'text-yellow-400'">
                        {{ j.rewardText }}
                      </span>
                    </template>
                    <template v-else>
                      <span class="text-lg font-black italic tracking-tighter"
                            :class="jobRewardClass[id as string] || 'text-yellow-400'">
                        +{{ String(j.reward).replace(/\D/g,'') }}
                      </span>
                      <span class="text-[9px] font-black text-slate-400">XU</span>
                    </template>
                  </div>

                  <!-- CTA button -->
                  <div class="w-full py-2 rounded-xl text-white text-[10px] font-black italic uppercase text-center relative z-10"
                       :class="jobBtnClass[id as string] || 'bg-slate-700'">
                    BẮT ĐẦU ⚡
                  </div>
                </button>
              </template>
            </div>
            <div class="h-2"></div>
          </div>

          <!-- SCREEN 2b: VIP jobs — 2-column card grid (amber theme) -->
          <div v-else-if="jobCategory === 'vip'" class="overflow-y-auto overscroll-y-contain flex-1 px-3 py-3">
            <div class="grid grid-cols-2 gap-2.5">
              <template v-for="id in sortedVipJobIds" :key="id">
                <button
                  @click="handleReceiveJob(id as string)"
                  class="relative flex flex-col p-4 rounded-[20px] border-[1.5px] transition-all duration-200 active:scale-[0.96] overflow-hidden text-left bg-gradient-to-br from-[#2A1C00] to-[#1a1000] border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  :class="(mergedJobs[id as string]?.paused || mergedJobs[id as string]?.soldout) ? 'opacity-50 grayscale' : ''">

                  <!-- Highlight layer -->
                  <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white/5 pointer-events-none rounded-[18px]"></div>

                  <!-- Paused / Soldout overlay -->
                  <div v-if="mergedJobs[id as string]?.soldout" class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <span class="bg-black/70 text-red-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">HẾT SLOT</span>
                  </div>
                  <div v-else-if="mergedJobs[id as string]?.paused" class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <span class="bg-black/70 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">⏸ TẠM DỪNG</span>
                  </div>

                  <!-- Badge top-right -->
                  <div class="absolute top-0 right-0 text-[8px] px-2 py-1 rounded-bl-xl rounded-tr-[18px] font-black italic uppercase border-b border-l border-amber-400/20 text-amber-200 z-10 bg-amber-700">
                    {{ mergedJobs[id as string]?.badge || 'VIP' }}
                  </div>

                  <!-- Icon -->
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 border border-amber-400/20 bg-amber-500/15 relative z-10">
                    {{ jobIconMap[id as string] || '💎' }}
                  </div>

                  <!-- Title -->
                  <p class="text-amber-200 text-[11px] font-black italic uppercase tracking-tight leading-tight mb-1 relative z-10">
                    {{ mergedJobs[id as string]?.title }}
                  </p>

                  <!-- Age badge -->
                  <div
                    v-if="mergedJobs[id as string]?.ageRequirement"
                    class="w-full px-2 py-1 rounded-lg text-[11px] font-black uppercase text-center mb-2 relative z-10 border"
                    :class="getAgeBadgeClass(mergedJobs[id as string]?.ageRequirement)"
                  >🪪 YÊU CẦU: TỪ {{ mergedJobs[id as string]?.ageRequirement }} TUỔI</div>

                  <!-- Reward -->
                  <div v-if="mergedJobs[id as string]?.rewardText" class="flex items-baseline gap-1 mb-3 relative z-10">
                    <span class="text-sm font-black italic tracking-tighter text-amber-400">
                      {{ mergedJobs[id as string]?.rewardText }}
                    </span>
                  </div>
                  <div v-else class="flex items-baseline gap-1 mb-3 relative z-10">
                    <span class="text-lg font-black italic tracking-tighter text-amber-400">
                      +{{ String(mergedJobs[id as string]?.reward || '0').replace(/\D/g,'') }}
                    </span>
                    <span class="text-[9px] font-black text-slate-400">XU</span>
                  </div>

                  <!-- CTA button -->
                  <div class="w-full py-2 rounded-xl text-white text-[10px] font-black italic uppercase text-center relative z-10 bg-amber-600">
                    ĐĂNG KÝ 👑
                  </div>
                </button>
              </template>
            </div>
            <div class="h-2"></div>
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
         class="cosmic-nav fixed bottom-0 left-0 w-full lg:hidden z-[4000] flex justify-between items-end px-2 pb-5 pt-2 bg-[#06000f]/97 backdrop-blur-xl border-t border-violet-500/15 overflow-hidden select-none">

      <!-- Laser border — 2 beams continuous sweep -->
      <div class="laser-border" aria-hidden="true"></div>

      <!-- ① CÔNG VIỆC — vị trí 1 (HOT 🔥) -->
      <button @click="vibrate(); activePopup === 'cong-viec' ? activePopup = '' : activePopup = 'cong-viec'" class="flex flex-col items-center gap-1 w-[20%] group relative z-10">
        <div class="absolute -top-2 w-5 h-[3px] bg-red-500 rounded-full shadow-[0_0_8px_#dc2626]" v-if="activePopup === 'cong-viec'"></div>
        <div class="relative">
          <!-- HOT badge -->
          <div class="absolute -top-2 -right-2 z-10 flex items-center gap-0.5 bg-red-600 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.7)] uppercase leading-none">🔥 HOT</div>
          <!-- Orbit ring -->
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring" style="border:1.5px solid transparent; border-top-color:#dc2626; border-right-color:rgba(220,38,38,0.25);"></div>
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring-reverse" style="border:1px solid transparent; border-bottom-color:rgba(220,38,38,0.35);"></div>
          <!-- Icon circle -->
          <div class="w-[52px] h-[52px] rounded-full bg-[#140808] border border-red-900/50 flex items-center justify-center nav-glow-red group-hover:-translate-y-[5px] transition-transform duration-300" :class="activePopup === 'cong-viec' ? 'border-red-500/70 bg-red-900/20' : ''">
            <svg class="w-5 h-5 transition-colors duration-300" :class="activePopup === 'cong-viec' ? 'text-red-400' : 'text-slate-400 group-hover:text-red-400'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
        </div>
        <span class="text-[8px] font-black tracking-widest uppercase transition-colors duration-300" :class="activePopup === 'cong-viec' ? 'text-red-400' : 'text-slate-500 group-hover:text-red-400'">CÔNG VIỆC</span>
      </button>

      <!-- ② LỊCH SỬ — vị trí 2 -->
      <button @click="vibrate(); activePopup === 'lich-su' ? activePopup = '' : activePopup = 'lich-su'" class="flex flex-col items-center gap-1 w-[20%] group relative z-10">
        <div class="absolute -top-2 w-5 h-[3px] bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)]" v-if="activePopup === 'lich-su'"></div>
        <div class="relative">
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring" style="border:1.5px solid transparent; border-top-color:#38bdf8; border-right-color:rgba(56,189,248,0.2);"></div>
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring-reverse" style="border:1px solid transparent; border-bottom-color:rgba(56,189,248,0.35);"></div>
          <div class="w-[52px] h-[52px] rounded-full bg-[#080e14] border border-sky-900/50 flex items-center justify-center nav-glow-sky group-hover:-translate-y-[5px] transition-transform duration-300" :class="activePopup === 'lich-su' ? 'border-sky-500/70 bg-sky-900/20' : ''">
            <svg class="w-5 h-5 transition-colors duration-300" :class="activePopup === 'lich-su' ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-400'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <span class="text-[8px] font-black tracking-widest uppercase transition-colors duration-300" :class="activePopup === 'lich-su' ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400'">LỊCH SỬ</span>
      </button>

      <!-- ③ RÚT TIỀN — Center button (flat, no float) -->
      <button @click="handleNav('/withdraw')" class="flex flex-col items-center gap-1 w-[20%] group relative z-10">
        <div class="relative">
          <!-- Orbit ring FAB -->
          <div class="absolute inset-[-7px] rounded-full pointer-events-none orbit-ring-fast" style="border:2px solid transparent; border-top-color:#dc2626; border-right-color:rgba(251,191,36,0.4); border-bottom-color:rgba(220,38,38,0.15);"></div>
          <!-- Pulse ring -->
          <div class="absolute inset-[-7px] rounded-full border border-red-500/25 fab-pulse pointer-events-none"></div>
          <!-- Main button -->
          <div class="w-[54px] h-[54px] rounded-full bg-gradient-to-br from-red-600 via-rose-500 to-orange-500 flex items-center justify-center shadow-[0_0_24px_rgba(220,38,38,0.7),0_4px_14px_rgba(0,0,0,0.5)] group-active:scale-95 transition-all duration-300 border-2 border-red-400/30 relative overflow-hidden group-hover:-translate-y-[5px]">
            <div class="absolute top-1 left-2 right-2 h-3 bg-white/20 rounded-full blur-[3px] pointer-events-none"></div>
            <svg class="w-6 h-6 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>
          </div>
        </div>
        <span class="text-[9px] font-black text-red-400 tracking-widest uppercase drop-shadow-[0_0_6px_rgba(220,38,38,0.5)]">Rút Tiền</span>
      </button>

      <!-- ④ NỘP BÀI — vị trí 4 -->
      <button @click="vibrate(); activePopup === 'nop-bai' ? activePopup = '' : activePopup = 'nop-bai'" class="flex flex-col items-center gap-1 w-[20%] group relative z-10">
        <div class="absolute -top-2 w-5 h-[3px] bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.9)]" v-if="activePopup === 'nop-bai'"></div>
        <div class="relative">
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring" style="border:1.5px solid transparent; border-top-color:#10b981; border-right-color:rgba(16,185,129,0.2);"></div>
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring-reverse" style="border:1px solid transparent; border-bottom-color:rgba(16,185,129,0.35);"></div>
          <div class="w-[52px] h-[52px] rounded-full bg-[#081410] border border-emerald-900/50 flex items-center justify-center nav-glow-emerald group-hover:-translate-y-[5px] transition-transform duration-300" :class="activePopup === 'nop-bai' ? 'border-emerald-500/70 bg-emerald-900/20' : ''">
            <svg class="w-5 h-5 transition-colors duration-300" :class="activePopup === 'nop-bai' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
        </div>
        <span class="text-[8px] font-black tracking-widest uppercase transition-colors duration-300" :class="activePopup === 'nop-bai' ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'">GỬI BC</span>
      </button>

      <!-- ⑤ HỖ TRỢ — vị trí 5 -->
      <button @click="showSupportPanel = true" class="flex flex-col items-center gap-1 w-[20%] group relative z-10">
        <div class="relative">
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring" style="border:1.5px solid transparent; border-top-color:#f43f5e; border-right-color:rgba(244,63,94,0.2);"></div>
          <div class="absolute inset-[-5px] rounded-full pointer-events-none orbit-ring-reverse" style="border:1px solid transparent; border-bottom-color:rgba(244,63,94,0.35);"></div>
          <div class="w-[52px] h-[52px] rounded-full bg-[#140810] border border-rose-900/50 flex items-center justify-center nav-glow-rose group-hover:-translate-y-[5px] transition-transform duration-300">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-rose-400 transition-colors duration-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
          </div>
          <span v-if="supportBadge" class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0507] animate-pulse pointer-events-none"></span>
        </div>
        <span class="text-[8px] font-black tracking-widest uppercase transition-colors" :class="supportBadge ? 'text-rose-400' : 'text-slate-500 group-hover:text-rose-400'">HỖ TRỢ</span>
      </button>

    </nav>

    <Transition name="slide-up">
      <div v-if="randomNotice && (!isAuthRoute || isLoggedIn)"
           :style="windowWidth >= 1024 ? { left: isMenuOpen ? '320px' : '20px' } : {}"
           class="fixed top-[72px] left-3 right-3 lg:top-auto lg:bottom-10 lg:left-auto lg:right-auto z-[5000] flex items-center gap-3 bg-[#150f0d]/95 backdrop-blur-xl border border-red-700/50 px-4 py-3 rounded-2xl shadow-[0_8px_40px_rgba(220,38,38,0.35),0_4px_20px_rgba(0,0,0,0.6)] lg:min-w-[320px] transition-all duration-300">
        <div :class="[
          'w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-md shrink-0',
          randomNotice.type === 'withdraw'
            ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/40'
            : randomNotice.type === 'chest'
            ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-amber-400/50'
            : 'bg-gradient-to-tr from-orange-600 to-red-500 shadow-red-500/40'
        ]">
           <svg v-if="randomNotice.type === 'withdraw'" class="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24" fill="none">
             <circle cx="12" cy="12" r="10" fill="url(#finalGoldCoin)" />
             <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
           </svg>
           <span v-else-if="randomNotice.type === 'chest'" class="text-lg">🎁</span>
           <span v-else class="text-lg">🔥</span>
        </div>
        <div class="flex flex-col text-left leading-tight min-w-0">
          <span class="text-white text-[12px] font-black italic tracking-tighter uppercase truncate">{{ randomNotice.name }}</span>
          <span :class="['text-[13px] font-black italic truncate', randomNotice.type === 'withdraw' ? 'text-emerald-400' : randomNotice.type === 'chest' ? 'text-amber-300' : 'text-orange-400']">
            {{ randomNotice.title }}{{ randomNotice.amount ? ' ' + randomNotice.amount : '' }}{{ randomNotice.type === 'job' ? ' XU' : '' }}
          </span>
          <span class="text-slate-500 text-[9px] font-bold uppercase tracking-widest italic opacity-70 truncate">{{ randomNotice.sub }}</span>
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
/* ===== COSMIC NAV ===== */
.cosmic-nav {
  box-shadow:
    0 -30px 80px rgba(0,0,0,0.99),
    0 -1px 0 rgba(139,92,246,0.3),
    0 -8px 40px rgba(88,28,220,0.12);
  background: linear-gradient(180deg, rgba(14,0,28,0.97) 0%, rgba(6,0,15,0.98) 100%);
  /* iPhone X+ home indicator safe area */
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
}
.cosmic-nav::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 8% 40%, rgba(167,139,250,0.7) 0%, transparent 100%),
    radial-gradient(1px 1px at 18% 70%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(2px 2px at 32% 25%, rgba(56,189,248,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 45% 80%, rgba(255,255,255,0.25) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 58% 35%, rgba(251,191,36,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 72% 65%, rgba(255,255,255,0.3) 0%, transparent 100%),
    radial-gradient(2px 2px at 83% 20%, rgba(244,63,94,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 92% 75%, rgba(167,139,250,0.4) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 25% 50%, rgba(16,185,129,0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 65% 15%, rgba(255,255,255,0.2) 0%, transparent 100%);
  animation: starTwinkle 3s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes starTwinkle {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}

/* ⚡ Dual laser beams — chạy liên tục không nghỉ */
.laser-border {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}
.laser-border::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 160px; height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(139,92,246,0.4) 20%,
    rgba(255,255,255,1) 50%,
    rgba(251,191,36,1) 65%,
    rgba(56,189,248,0.6) 85%,
    transparent 100%
  );
  box-shadow: 0 0 8px rgba(255,255,255,0.9), 0 0 20px rgba(139,92,246,0.7), 0 0 35px rgba(251,191,36,0.4);
  filter: blur(0.3px);
  animation: laserSweep1 2.4s linear infinite;
}
.laser-border::after {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 90px; height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(244,63,94,0.4) 30%,
    rgba(255,255,255,0.9) 55%,
    rgba(56,189,248,0.8) 80%,
    transparent 100%
  );
  box-shadow: 0 0 6px rgba(56,189,248,0.8), 0 0 18px rgba(244,63,94,0.6);
  filter: blur(0.4px);
  animation: laserSweep2 3.7s linear infinite;
  animation-delay: -1.6s;
}
@keyframes laserSweep1 {
  0%   { transform: translateX(-160px); }
  100% { transform: translateX(calc(100vw + 60px)); }
}
@keyframes laserSweep2 {
  0%   { transform: translateX(-90px); }
  100% { transform: translateX(calc(100vw + 40px)); }
}

/* Orbit ring — regular buttons */
.orbit-ring {
  animation: orbitSpin 3s linear infinite;
  transform-origin: center;
}
/* Orbit ring — center FAB (faster) */
.orbit-ring-fast {
  animation: orbitSpin 2s linear infinite;
  transform-origin: center;
}
/* Orbit ring — counter-clockwise (dual ring effect) */
.orbit-ring-reverse {
  animation: orbitSpinReverse 5s linear infinite;
  transform-origin: center;
}
@keyframes orbitSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes orbitSpinReverse {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}

/* Per-button colored glow pulses */
.nav-glow-red {
  animation: pulseRed 2.5s ease-in-out infinite;
}
@keyframes pulseRed {
  0%,100% { box-shadow: 0 0 8px rgba(220,38,38,0.2), inset 0 0 8px rgba(220,38,38,0.05); }
  50%     { box-shadow: 0 0 24px rgba(220,38,38,0.65), 0 0 48px rgba(220,38,38,0.2), inset 0 0 14px rgba(220,38,38,0.12); }
}
.nav-glow-sky {
  animation: pulseSky 2.8s ease-in-out infinite;
}
@keyframes pulseSky {
  0%,100% { box-shadow: 0 0 8px rgba(56,189,248,0.2), inset 0 0 8px rgba(56,189,248,0.05); }
  50%     { box-shadow: 0 0 24px rgba(56,189,248,0.65), 0 0 48px rgba(56,189,248,0.2), inset 0 0 14px rgba(56,189,248,0.12); }
}
.nav-glow-emerald {
  animation: pulseEmerald 3s ease-in-out infinite;
}
@keyframes pulseEmerald {
  0%,100% { box-shadow: 0 0 8px rgba(16,185,129,0.2), inset 0 0 8px rgba(16,185,129,0.05); }
  50%     { box-shadow: 0 0 24px rgba(16,185,129,0.65), 0 0 48px rgba(16,185,129,0.2), inset 0 0 14px rgba(16,185,129,0.12); }
}
.nav-glow-rose {
  animation: pulseRose 2.6s ease-in-out infinite;
}
@keyframes pulseRose {
  0%,100% { box-shadow: 0 0 8px rgba(244,63,94,0.2), inset 0 0 8px rgba(244,63,94,0.05); }
  50%     { box-shadow: 0 0 24px rgba(244,63,94,0.65), 0 0 48px rgba(244,63,94,0.2), inset 0 0 14px rgba(244,63,94,0.12); }
}

/* FAB pulse ring */
.fab-pulse {
  animation: fabPulse 2.5s ease-in-out infinite;
}
@keyframes fabPulse {
  0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.35; }
  50%       { transform: translateX(-50%) scale(1.12); opacity: 0.08; }
}
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.slide-up-enter-from { opacity: 0; transform: translateY(80px) scale(0.6); }
.slide-up-leave-to { opacity: 0; transform: translateX(-80px) scale(0.9); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ===== CLAIM CHEST POPUP ANIMATIONS ===== */
/* Chest idle float */
@keyframes chestIdle {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-6px) scale(1.02); }
}
/* Chest opening burst */
@keyframes chestOpenAnim {
  0%   { transform: scale(0.85) rotate(-8deg); }
  25%  { transform: scale(1.25) rotate(5deg); }
  50%  { transform: scale(1.1) rotate(-3deg); }
  75%  { transform: scale(1.18) rotate(2deg); }
  100% { transform: scale(1.12) rotate(0deg); }
}
.popup-chest-idle { animation: chestIdle 2.4s ease-in-out infinite; }
.popup-chest-open { animation: chestOpenAnim 0.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

/* Light burst */
@keyframes popupLightBurst {
  0%   { opacity: 0; transform: scale(0.4); }
  30%  { opacity: 0.9; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(2.2); }
}
.popup-light-burst { animation: popupLightBurst 1.4s ease-out forwards; }

/* XU particles */
@keyframes popupXuFloat {
  0%   { opacity: 1; transform: translateX(var(--ppx)) translateY(0) scale(1.1); }
  100% { opacity: 0; transform: translateX(var(--ppx)) translateY(-70px) scale(0.7); }
}
.popup-xu-particle {
  top: 35%;
  left: 50%;
  transform: translateX(-50%);
  animation: popupXuFloat 1.4s ease-out forwards;
}
/* ===== END CLAIM CHEST POPUP ===== */

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
}
.aurora-blob-2 {
  position: absolute;
  bottom: -200px; right: -200px;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(80px);
  animation: aurora-drift 28s ease-in-out infinite alternate-reverse;
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

/* ── LIVE FEED TRANSITION ───────────────────────────── */
.live-feed-enter-active { transition: all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.live-feed-leave-active  { transition: all 0.3s ease; position: absolute; width: 100%; }
.live-feed-enter-from   { opacity: 0; transform: translateY(-24px) scale(0.96); }
.live-feed-leave-to     { opacity: 0; transform: translateX(30px); }
.live-feed-move         { transition: transform 0.4s ease; }

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