<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { normalizePhone } from '@/utils/phone'
import {
  DAILY_THREAD_JOB_ID, DAILY_THREAD_JOB_NAME, DAILY_THREAD_COLLECTION, DAILY_THREAD_MAX_PENDING_PER_DAY,
  DAILY_THREAD_REWARD_TABLE, getDateKey, normalizeThreadNick, normalizePostUrl, isValidThreadsUrl,
  dailyThreadStatusLabel, getDailyThreadSuggestedReward,
  DAILY_THREAD_GUIDE_COLLECTION, DAILY_THREAD_GUIDE_DOC_ID, DAILY_THREAD_GUIDE_DEFAULT,
  normalizeDailyThreadGuideConfig, type DailyThreadGuideConfig
} from '@/utils/dailyThreads'
import DailyThreadsGuideModal from '@/components/DailyThreadsGuideModal.vue'
import DailyThreadsResultModal from '@/components/DailyThreadsResultModal.vue'

const props = defineProps<{
  username?: string
  userFullName?: string
  userPhone?: string
}>()

const rewardTiers = DAILY_THREAD_REWARD_TABLE

const router = useRouter()
const isLoggedIn = ref(false)
const userUid = ref('')
const isAuthChecking = ref(true)

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    isAuthChecking.value = false
    if (user) {
      isLoggedIn.value = true
      userUid.value = user.uid
      startHistoryListener()
      startGuideConfigListener()
    } else {
      router.push('/login')
    }
  })
})

onUnmounted(() => {
  if (unsubHistory) unsubHistory()
  if (unsubGuideConfig) unsubGuideConfig()
})

// --- Popup hướng dẫn đăng bài (copy content / lưu ảnh / ghim QR) — config realtime từ Firestore ---
const showGuideModal = ref(false)
const guideConfig = ref<DailyThreadGuideConfig>({ ...DAILY_THREAD_GUIDE_DEFAULT })
let unsubGuideConfig: any = null

const startGuideConfigListener = () => {
  if (unsubGuideConfig) return
  unsubGuideConfig = onSnapshot(
    doc(db, DAILY_THREAD_GUIDE_COLLECTION, DAILY_THREAD_GUIDE_DOC_ID),
    (snap) => { guideConfig.value = normalizeDailyThreadGuideConfig(snap.exists() ? snap.data() : null) },
    () => { guideConfig.value = { ...DAILY_THREAD_GUIDE_DEFAULT } }
  )
}

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

// --- Lịch sử đơn Thread hằng ngày — collection riêng, listener riêng ---
let unsubHistory: any = null
const historyList = ref<any[]>([])
const showHistoryModal = ref(false)

const startHistoryListener = () => {
  if (unsubHistory) unsubHistory()
  unsubHistory = onSnapshot(
    query(collection(db, DAILY_THREAD_COLLECTION), where('uid', '==', userUid.value)),
    (snap) => {
      const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
      historyList.value = data
    }
  )
}

// --- Popup riêng: thông báo cộng xu / từ chối cho đơn Thread hằng ngày — độc lập, không dùng chung với popup của App.vue ---
const dismissedThreadPaid = ref<string[]>(JSON.parse(localStorage.getItem('mmo_dismissed_daily_thread_paid') || '[]'))
const dismissedThreadRejected = ref<string[]>(JSON.parse(localStorage.getItem('mmo_dismissed_daily_thread_rejected') || '[]'))

// Lần đầu bật tính năng này: âm thầm đánh dấu đã đọc các đơn cũ đã xử lý từ trước, tránh popup dồn ập lên user cũ.
let isFirstResultLoad = localStorage.getItem('mmo_dismissed_daily_thread_paid') === null && localStorage.getItem('mmo_dismissed_daily_thread_rejected') === null
let hasSeededResultDismiss = false

watch(historyList, (list) => {
  if (!isFirstResultLoad || hasSeededResultDismiss) return
  hasSeededResultDismiss = true
  const paidIds = list.filter(r => r.status === 'paid').map(r => r.id)
  const rejectedIds = list.filter(r => r.status === 'rejected').map(r => r.id)
  if (paidIds.length) {
    dismissedThreadPaid.value = [...dismissedThreadPaid.value, ...paidIds]
    localStorage.setItem('mmo_dismissed_daily_thread_paid', JSON.stringify(dismissedThreadPaid.value))
  }
  if (rejectedIds.length) {
    dismissedThreadRejected.value = [...dismissedThreadRejected.value, ...rejectedIds]
    localStorage.setItem('mmo_dismissed_daily_thread_rejected', JSON.stringify(dismissedThreadRejected.value))
  }
})

const unreadPaidThread = computed(() => historyList.value.find(r => r.status === 'paid' && !dismissedThreadPaid.value.includes(r.id)))
const unreadRejectedThread = computed(() => historyList.value.find(r => r.status === 'rejected' && !dismissedThreadRejected.value.includes(r.id)))

// Ưu tiên hiện từ chối trước nếu cả 2 cùng có đơn chưa đọc
const activeResultReport = computed(() => unreadRejectedThread.value || unreadPaidThread.value || null)
const activeResultType = computed<'paid' | 'rejected'>(() => unreadRejectedThread.value ? 'rejected' : 'paid')

const dismissActiveResult = () => {
  const rp = activeResultReport.value
  if (!rp) return
  if (activeResultType.value === 'rejected') {
    dismissedThreadRejected.value.push(rp.id)
    localStorage.setItem('mmo_dismissed_daily_thread_rejected', JSON.stringify(dismissedThreadRejected.value))
  } else {
    dismissedThreadPaid.value.push(rp.id)
    localStorage.setItem('mmo_dismissed_daily_thread_paid', JSON.stringify(dismissedThreadPaid.value))
  }
}

const pendingTodayCount = computed(() => {
  const today = getDateKey()
  return historyList.value.filter(r => r.status === 'pending' && r.dateKey === today).length
})

// --- Popup gửi bằng chứng ---
const showSubmitModal = ref(false)
const threadNick = ref('')
const postUrl = ref('')
const qrViews = ref('')
const note = ref('')
const isSubmitting = ref(false)

const openSubmitModal = () => {
  threadNick.value = ''
  postUrl.value = ''
  qrViews.value = ''
  note.value = ''
  showSubmitModal.value = true
}
const closeSubmitModal = () => { if (!isSubmitting.value) showSubmitModal.value = false }

// Dự kiến nhận xu — cập nhật realtime theo số view mã QR đang nhập, chưa submit
const suggestedRewardPreview = computed(() => getDailyThreadSuggestedReward(qrViews.value))

// --- Popup thành công ---
const showSuccessModal = ref(false)
const lastSubmitted = ref<{ threadNick: string; qrViews: number; createdAt: Date } | null>(null)

const submitDailyThread = async () => {
  if (!userUid.value || isSubmitting.value) return

  const nick = threadNick.value.trim()
  const url = postUrl.value.trim()
  const viewsNum = Number(qrViews.value)

  if (!nick) { alert('⚠️ VUI LÒNG NHẬP TÊN NICK THREADS!'); return }
  if (!url) { alert('⚠️ VUI LÒNG NHẬP LINK BÀI VIẾT THREADS!'); return }
  if (!isValidThreadsUrl(url)) { alert('⚠️ LINK BÀI VIẾT PHẢI LÀ LINK THREADS HỢP LỆ (threads.net)!'); return }
  if (qrViews.value === '' || !Number.isFinite(viewsNum) || viewsNum < 0) { alert('⚠️ SỐ VIEW MÃ QR PHẢI LÀ SỐ HỢP LỆ (>= 0)!'); return }

  isSubmitting.value = true
  try {
    const today = getDateKey()
    const pendingSnap = await getDocs(query(
      collection(db, DAILY_THREAD_COLLECTION),
      where('uid', '==', userUid.value),
      where('status', '==', 'pending'),
      where('dateKey', '==', today)
    ))
    if (pendingSnap.docs.length >= DAILY_THREAD_MAX_PENDING_PER_DAY) {
      Swal.fire({
        icon: 'warning',
        title: 'ĐÃ ĐỦ 5 ĐƠN CHỜ DUYỆT',
        text: 'Bạn đã gửi đủ 5 đơn đang chờ duyệt hôm nay. Vui lòng chờ admin duyệt hoặc từ chối trước khi gửi tiếp.',
        confirmButtonColor: '#f59e0b'
      })
      isSubmitting.value = false
      return
    }

    const userSnap = await getDoc(doc(db, 'users', userUid.value))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}
    const name = (userDoc.fullName || props.userFullName || '').toString().trim()
    const phone = (userDoc.phoneRef || userDoc.phone || props.userPhone || '').toString().trim()
    const suggestedReward = getDailyThreadSuggestedReward(viewsNum)

    const reportRef = doc(collection(db, DAILY_THREAD_COLLECTION))
    const reportData = {
      uid: userUid.value,
      username: userDoc.username || userDoc.fullName || '',
      fullName: name,
      phoneRef: phone,
      phoneNormalized: normalizePhone(phone),
      birthYear: userDoc.birthYear || userDoc.yearOfBirth || userDoc.dateOfBirth || userDoc.dob || '',

      jobId: DAILY_THREAD_JOB_ID,
      jobName: DAILY_THREAD_JOB_NAME,

      threadNick: nick,
      threadNickLower: normalizeThreadNick(nick),
      postUrl: url,
      postUrlNormalized: normalizePostUrl(url),
      qrViews: viewsNum,

      note: note.value.trim(),

      suggestedReward,
      reward: suggestedReward,
      actualReward: 0,

      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dateKey: today,

      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: '',
      rejectNote: ''
    }

    await setDoc(reportRef, reportData)

    lastSubmitted.value = { threadNick: nick, qrViews: viewsNum, createdAt: new Date() }
    showSubmitModal.value = false
    showSuccessModal.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + error.message)
  } finally {
    isSubmitting.value = false
  }
}

const closeSuccessAndShowHistory = () => { showSuccessModal.value = false; showHistoryModal.value = true }

const statusBadgeClass = (status: string) => {
  if (status === 'paid' || status === 'approved') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  if (status === 'rejected') return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
}
</script>

<template>
  <div class="min-h-screen bg-transparent text-slate-300 p-4 md:p-8 font-black italic uppercase text-left relative">

    <!-- Đang tải -->
    <div v-if="isAuthChecking" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs text-slate-500 tracking-widest uppercase">Đang tải dữ liệu...</p>
    </div>

    <!-- Nội dung chính -->
    <div v-else class="max-w-3xl mx-auto space-y-6">

      <div class="flex justify-between items-center border-b border-slate-800 pb-4">
        <button class="text-[10px] tracking-[3px] text-slate-500 hover:text-white flex items-center gap-1 px-3 py-2.5 -mx-3 -my-2 active:scale-95 transition-transform" @click="router.push('/')">
          <span class="text-base font-light not-italic font-sans">✕</span> QUAY LẠI
        </button>
        <span class="text-[10px] tracking-[4px] text-slate-600">THREAD HẰNG NGÀY</span>
      </div>

      <!-- HERO -->
      <div class="bg-gradient-to-br from-[#042a2e] to-[#021617] border border-teal-500/40 rounded-[36px] p-6 md:p-10 text-center shadow-2xl relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-40 h-40 bg-teal-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-3xl relative z-10">🧵</div>
        <h1 class="text-2xl md:text-4xl text-white tracking-tighter leading-tight mb-3 relative z-10">
          ĐĂNG BÀI THREAD<br/>HẰNG NGÀY
        </h1>
        <div class="bg-[#052e1f] border border-[#005c3c] rounded-full px-6 py-2.5 w-max mx-auto flex items-center gap-2 shadow-inner relative z-10">
          <span class="text-[#f59e0b] text-xl">⚡</span>
          <span class="text-[#00df89] text-sm md:text-base tracking-tighter">THƯỞNG: 20.000 - 100.000 XU</span>
        </div>
        <p class="text-slate-400 text-[11px] md:text-xs font-medium normal-case leading-relaxed mt-4 max-w-md mx-auto relative z-10">
          Đăng bài mỗi ngày, nhập link nhận xu.
        </p>
        <p v-if="pendingTodayCount > 0" class="text-teal-400 text-[10px] md:text-[11px] font-bold normal-case mt-2 relative z-10">
          Đang chờ duyệt hôm nay: {{ pendingTodayCount }}/{{ DAILY_THREAD_MAX_PENDING_PER_DAY }}
        </p>
        <div class="flex flex-col sm:flex-row gap-3 mt-6 relative z-10">
          <button @click="openSubmitModal" class="flex-1 py-4 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[13px] md:text-sm">
            GỬI BẰNG CHỨNG 🧵
          </button>
          <button @click="showGuideModal = true" class="flex-1 py-4 bg-[#0d121f] border border-slate-700 hover:border-teal-500/60 text-white rounded-2xl active:scale-95 transition-all text-[13px] md:text-sm">
            XEM HƯỚNG DẪN 📖
          </button>
          <button @click="showHistoryModal = true" class="flex-1 py-4 bg-[#0d121f] border border-slate-700 hover:border-teal-500/60 text-white rounded-2xl active:scale-95 transition-all text-[13px] md:text-sm">
            LỊCH SỬ ĐƠN 📜
          </button>
        </div>
      </div>

      <!-- BẢNG MỨC THƯỞNG -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 shadow-xl">
        <h3 class="text-violet-400 text-sm md:text-base tracking-tight mb-4">📊 BẢNG MỨC THƯỞNG</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-center border-separate border-spacing-y-2 font-sans not-italic normal-case min-w-[420px]">
            <thead>
              <tr class="text-slate-500 text-[9px] md:text-[10px] tracking-widest">
                <th class="pb-2 font-bold">VIEW BÀI THREADS</th>
                <th class="pb-2 font-bold text-amber-400">LƯỢT XEM MÃ QR<br/>GHIM TẠI BÌNH LUẬN</th>
                <th class="pb-2 font-bold">THƯỞNG</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(tier, idx) in rewardTiers" :key="tier.qrViews" class="bg-[#0d121f]">
                <td class="py-3 rounded-l-2xl text-white text-[12px] font-bold">{{ tier.postViews }} view</td>
                <td class="py-3 text-violet-400 text-[12px] font-bold">{{ tier.qrViews.toLocaleString() }} view</td>
                <td class="py-3 rounded-r-2xl text-[13px] font-black" :class="idx === rewardTiers.length - 1 ? 'text-amber-400' : 'text-emerald-400'">{{ tier.reward.toLocaleString() }} XU</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- HƯỚNG DẪN -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 md:p-8 shadow-xl space-y-6">
        <h3 class="text-teal-400 text-sm md:text-base tracking-tight">📖 HƯỚNG DẪN THỰC HIỆN</h3>
        <div class="relative pl-10">
          <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">1</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed mb-3">Bấm nút "XEM HƯỚNG DẪN" để lấy nội dung bài đăng, ảnh và mã QR.</p>
          <button @click="showGuideModal = true" class="flex items-center justify-center gap-2 py-3 px-5 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[11px] md:text-xs not-italic normal-case font-sans font-bold">
            📖 XEM HƯỚNG DẪN
          </button>
        </div>
        <div class="relative pl-10">
          <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">2</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">Dùng tài khoản Threads để đăng bài theo nội dung được giao.</p>
        </div>
        <div class="relative pl-10">
          <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">3</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">Ghim mã QR trong bài viết và chụp/kiểm tra số view.</p>
        </div>
        <div class="relative pl-10">
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">4</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">Bấm "Gửi bằng chứng" và điền đầy đủ thông tin để nhận xu.</p>
        </div>
      </div>

      <!-- LƯU Ý -->
      <div class="bg-gradient-to-r from-orange-950/70 to-red-950/50 border border-orange-600/40 rounded-2xl p-4 space-y-2 shadow-inner">
        <p class="text-orange-400 text-[11px] tracking-widest mb-1">⚠️ LƯU Ý</p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>1.</span><span>Bài đăng + mã QR ghim phải đạt đủ view/lượt xem mới được gửi bằng chứng.</span>
        </p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>2.</span><span>22h - 23h hằng ngày bên mình mới duyệt đơn và cộng xu.</span>
        </p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>3.</span><span>Có thể tạo nhiều nick Threads để đăng.</span>
        </p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>4.</span><span>Có thể xoá bài đăng lại, hoặc đăng nhiều lần để đạt đủ số view/lượt xem.</span>
        </p>
      </div>

    </div>

    <!-- POPUP GỬI BẰNG CHỨNG -->
    <Transition name="fade">
      <div v-if="showSubmitModal" class="fixed inset-0 z-[5000] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="closeSubmitModal"></div>
        <div class="relative bg-[#111726] border border-violet-500/30 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg md:text-xl text-white tracking-tight">📥 GỬI BẰNG CHỨNG</h2>
            <button @click="closeSubmitModal" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- LƯU Ý TRƯỚC KHI GỬI -->
          <div class="bg-[#0d0a1f] border border-violet-500/20 rounded-2xl p-4 mb-6 text-left font-sans not-italic normal-case">
            <p class="text-violet-400 text-[11px] tracking-widest font-bold flex items-center gap-1.5 mb-2">💡 LƯU Ý TRƯỚC KHI GỬI</p>
            <ul class="space-y-1.5">
              <li class="text-slate-400 text-[11px] leading-relaxed flex gap-2"><span class="text-violet-500 mt-0.5">•</span><span>Bài đăng + mã QR ghim phải đạt đủ view/lượt xem mới được gửi bằng chứng.</span></li>
              <li class="text-slate-400 text-[11px] leading-relaxed flex gap-2"><span class="text-violet-500 mt-0.5">•</span><span>Từ <span class="text-white font-bold">22h – 23h</span> hằng ngày, bên mình mới duyệt đơn và cộng xu.</span></li>
              <li class="text-slate-400 text-[11px] leading-relaxed flex gap-2"><span class="text-violet-500 mt-0.5">•</span><span>Có thể tạo nhiều nick Threads để đăng bài.</span></li>
              <li class="text-slate-400 text-[11px] leading-relaxed flex gap-2"><span class="text-violet-500 mt-0.5">•</span><span>Có thể xoá bài đăng lại, hoặc đăng nhiều lần để đạt đủ số view/lượt xem.</span></li>
            </ul>
          </div>

          <p class="text-violet-400 text-[11px] tracking-widest ml-1 mb-3">NỘP BẰNG CHỨNG</p>
          <div class="bg-[#0d121f] border border-slate-800 rounded-[28px] p-5 space-y-5 text-left">
            <div v-if="props.username" class="flex items-center justify-between border-b border-slate-800 pb-4">
              <span class="text-slate-500 text-[10px] tracking-widest">TÀI KHOẢN</span>
              <span class="text-white text-sm font-black font-sans not-italic normal-case">{{ props.username.toUpperCase() }}</span>
            </div>

            <div class="space-y-2">
              <label class="text-slate-500 text-[10px] tracking-widest ml-1">TÊN NICK THREADS *</label>
              <input v-model="threadNick" type="text" placeholder="VD: @tennick hoặc tennick"
                     class="w-full bg-[#111726] border border-slate-800 focus:border-violet-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
            </div>
            <div class="space-y-2">
              <label class="text-slate-500 text-[10px] tracking-widest ml-1">LINK BÀI VIẾT THREADS *</label>
              <input v-model="postUrl" type="text" placeholder="https://www.threads.net/..."
                     class="w-full bg-[#111726] border border-slate-800 focus:border-violet-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
            </div>
            <div class="space-y-2">
              <label class="text-slate-500 text-[10px] tracking-widest ml-1">SỐ VIEW MÃ QR ĐƯỢC GHIM *</label>
              <input v-model="qrViews" type="number" min="0" placeholder="VD: 350"
                     class="w-full bg-[#111726] border border-slate-800 focus:border-violet-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
              <div v-if="qrViews !== '' && suggestedRewardPreview > 0"
                   class="bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 rounded-2xl px-4 py-3 font-sans not-italic normal-case flex items-center gap-2">
                <span class="text-lg">💰</span>
                <span class="text-emerald-400 text-[13px] font-bold">Dự kiến nhận: {{ suggestedRewardPreview.toLocaleString() }} xu</span>
              </div>
              <div v-else-if="qrViews !== ''"
                   class="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3 font-sans not-italic normal-case flex items-center gap-2">
                <span class="text-lg">⚠️</span>
                <span class="text-orange-400 text-[11px] font-bold leading-snug">Chưa đủ mốc nhận xu. Tối thiểu 50 view để nhận 20.000 xu.</span>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-slate-500 text-[10px] tracking-widest ml-1">GHI CHÚ THÊM (TÙY CHỌN)</label>
              <textarea v-model="note" rows="2" placeholder="Ghi chú nếu cần..."
                        class="w-full bg-[#111726] border border-slate-800 focus:border-violet-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[13px] transition-colors resize-none"></textarea>
            </div>
          </div>

          <button @click="submitDailyThread" :disabled="isSubmitting"
                  class="w-full mt-5 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400 text-white rounded-2xl text-[13px] md:text-sm shadow-lg shadow-violet-900/40 active:scale-95 transition-all disabled:opacity-50">
            {{ isSubmitting ? 'ĐANG GỬI BẰNG CHỨNG...' : 'GỬI BẰNG CHỨNG 🧵' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- POPUP THÀNH CÔNG -->
    <Transition name="fade">
      <div v-if="showSuccessModal && lastSubmitted" class="fixed inset-0 z-[6000] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md"></div>
        <div class="relative bg-[#111726] border border-emerald-500/30 w-full max-w-sm rounded-[36px] p-7 text-center shadow-2xl animate-in zoom-in duration-300">
          <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <span class="text-3xl">✅</span>
          </div>
          <h2 class="text-xl text-white tracking-tight mb-2">ĐÃ GỬI BẰNG CHỨNG</h2>
          <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-4">
            Bằng chứng đăng bài Threads hằng ngày đã được gửi.<br/>
            Vui lòng chờ admin kiểm tra và cộng xu trong khung giờ 22h - 23h.
          </p>

          <div class="bg-[#0d121f] border border-emerald-500/40 rounded-2xl p-4 mb-4 text-left space-y-1 font-sans not-italic normal-case text-[10px] text-slate-400">
            <p class="text-emerald-400 text-[9px] tracking-widest mb-1">THÔNG TIN ĐƠN</p>
            <p>Nick Threads: <span class="text-white font-bold">{{ lastSubmitted.threadNick }}</span></p>
            <p>View QR: <span class="text-white font-bold">{{ lastSubmitted.qrViews }}</span></p>
            <p>Thời gian gửi: <span class="text-white font-bold">{{ formatDate(lastSubmitted.createdAt) }}</span></p>
          </div>

          <div class="space-y-2.5">
            <button @click="closeSuccessAndShowHistory" class="w-full bg-teal-500/20 border border-teal-500/30 text-teal-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
              XEM LỊCH SỬ
            </button>
            <button @click="showSuccessModal = false" class="w-full text-slate-500 py-2 text-[10px] tracking-widest hover:text-white transition-colors">
              ĐÓNG
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP LỊCH SỬ ĐƠN -->
    <Transition name="fade">
      <div v-if="showHistoryModal" class="fixed inset-0 z-[5500] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="showHistoryModal = false"></div>
        <div class="relative bg-[#111726] border border-slate-800 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg text-white tracking-tight">📜 LỊCH SỬ ĐƠN THREAD</h2>
            <button @click="showHistoryModal = false" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div v-if="!historyList.length" class="text-center py-12">
            <div class="text-4xl mb-3">📭</div>
            <p class="text-slate-600 text-[10px] tracking-[3px]">CHƯA CÓ ĐƠN NÀO</p>
          </div>

          <div v-else class="space-y-3 text-left">
            <div v-for="rp in historyList" :key="rp.id" class="bg-[#0d121f] border rounded-2xl p-4"
                 :class="rp.status === 'rejected' ? 'border-rose-500/30' : rp.status === 'pending' ? 'border-yellow-500/20' : 'border-emerald-500/20'">
              <div class="flex justify-between items-start gap-3 mb-2">
                <div class="font-sans not-italic normal-case min-w-0">
                  <p class="text-white text-[12px] font-bold truncate">🧵 {{ rp.threadNick }}</p>
                  <a :href="rp.postUrl" target="_blank" rel="noopener" class="text-teal-400 text-[10px] truncate block hover:underline">{{ rp.postUrl }}</a>
                  <p class="text-slate-500 text-[10px] mt-1">View QR: <span class="text-white font-bold">{{ rp.qrViews }}</span></p>
                  <p class="text-slate-600 text-[9px]">{{ formatDate(rp.createdAt) }}</p>
                </div>
                <span class="shrink-0 text-[9px] px-2 py-1 rounded-full font-sans not-italic normal-case border" :class="statusBadgeClass(rp.status)">
                  {{ rp.status === 'paid' || rp.status === 'approved' ? `ĐÃ CỘNG ${(rp.actualReward || 0).toLocaleString()} XU` : dailyThreadStatusLabel(rp.status).toUpperCase() }}
                </span>
              </div>
              <p v-if="rp.status === 'rejected'" class="text-rose-400 text-[10px] font-sans not-italic normal-case mt-1 leading-relaxed">
                Lý do: {{ rp.rejectReason || 'Không đạt yêu cầu' }}<span v-if="rp.rejectNote"> — {{ rp.rejectNote }}</span>
              </p>
              <p v-else-if="rp.status === 'pending'" class="text-yellow-500 text-[10px] font-sans not-italic normal-case mt-1 leading-relaxed">
                Chờ admin kiểm tra
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP HƯỚNG DẪN ĐĂNG BÀI -->
    <DailyThreadsGuideModal
      :show="showGuideModal"
      :contents="guideConfig.contents"
      :post-images="guideConfig.postImages"
      :qr-image="guideConfig.qrImage"
      @close="showGuideModal = false"
    />

    <!-- POPUP RIÊNG: KẾT QUẢ CỘNG XU / TỪ CHỐI ĐƠN THREAD HẰNG NGÀY -->
    <DailyThreadsResultModal
      :show="!!activeResultReport"
      :type="activeResultType"
      :thread-nick="activeResultReport?.threadNick"
      :actual-reward="activeResultReport?.actualReward"
      :reject-reason="activeResultReport?.rejectReason"
      :reject-note="activeResultReport?.rejectNote"
      @close="dismissActiveResult"
    />

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
