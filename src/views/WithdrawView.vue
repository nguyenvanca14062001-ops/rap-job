<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import Swal from 'sweetalert2'

const router = useRouter()
const amount = ref<number | null>(null)
const bankInfo = ref('')
const isLoading = ref(false)
const userBalance = ref(0)
const currentUser = ref<any>(null)
const hasPendingWithdraw = ref(false)
const approvedJobsCount = ref(0)
const previous200kWithdrawalsCount = ref(0)

const showConfirmModal = ref(false)
const confirmStep = ref(1) // 1: xem thông tin quy đổi, 2: xác nhận cuối cùng

const withdrawOptions = [200000, 500000, 650000, 800000, 1000000, 2000000]

const requiredJobs = computed(() => {
  if (amount.value === 200000 && previous200kWithdrawalsCount.value > 0) {
    return 10
  }
  return 9
})

const formatNumber = (num: number) => {
  return Math.floor(num).toLocaleString('vi-VN')
}

const selectAmount = (val: number) => {
  amount.value = val
}

const fakeWithdrawals = ref<any[]>([])
let intervalId: any = null

const hoHo = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi']
const tenTen = ['Thành', 'Hoa', 'Linh', 'Tùng', 'Hùng', 'Oanh', 'Trang', 'Nam', 'Việt', 'Đức']

const generateFakeWithdraw = () => {
  const ho = hoHo[Math.floor(Math.random() * hoHo.length)]
  const ten = tenTen[Math.floor(Math.random() * tenTen.length)]
  const name = `${ho} *** ${ten}`
  const mocs = [200000, 500000, 650000, 800000, 1000000]
  const randomAmount = mocs[Math.floor(Math.random() * mocs.length)]
  const times = ['Vừa xong', '1 phút trước', '3 phút trước', '5 phút trước', '10 phút trước']
  const randomTime = times[Math.floor(Math.random() * times.length)]
  return { id: Date.now() + Math.random(), name, amount: randomAmount, time: randomTime }
}

const initFakeList = () => {
  for (let i = 0; i < 4; i++) {
    fakeWithdrawals.value.push(generateFakeWithdraw())
  }
}

const startFakeLoop = () => {
  intervalId = setInterval(() => {
    fakeWithdrawals.value.unshift(generateFakeWithdraw())
    if (fakeWithdrawals.value.length > 4) {
      fakeWithdrawals.value.pop()
    }
  }, 4000)
}

onMounted(() => {
  initFakeList()
  startFakeLoop()

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser.value = user
      onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
          userBalance.value = docSnap.data().balance || 0
          hasPendingWithdraw.value = docSnap.data().hasPendingWithdraw || false
        }
      })

      try {
        const qJobs = query(
          collection(db, "reports"),
          where("uid", "==", user.uid),
          where("status", "in", ["approved", "collected"])
        );
        const snapJobs = await getDocs(qJobs);
        approvedJobsCount.value = snapJobs.size;
      } catch (err) {
        console.error("Lỗi khi đếm số job:", err);
      }

      try {
        const qWithdrawals = query(collection(db, "withdrawals"), where("uid", "==", user.uid), where("status", "==", "approved"));
        const snapWithdrawals = await getDocs(qWithdrawals);
        previous200kWithdrawalsCount.value = snapWithdrawals.docs.filter(d => {
          const data = d.data();
          return (data.amount === 200000 || data.amountXu === 200000);
        }).length;
      } catch (err) {
        console.error("Lỗi khi check lịch sử rút tiền:", err);
      }

    } else {
      router.push('/login')
    }
  })
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})

const triggerWithdraw = () => {
  if (hasPendingWithdraw.value) {
    Swal.fire({
      title: 'LỆNH ĐANG CHỜ XỬ LÝ!',
      text: 'Bạn đang có lệnh rút tiền chờ xử lý. Vui lòng đợi Admin duyệt trước khi tạo lệnh mới!',
      icon: 'warning',
      confirmButtonColor: '#eab308',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  if (!amount.value) {
    Swal.fire({
      title: 'CHƯA CHỌN SỐ TIỀN!',
      text: 'Vui lòng chọn số XU muốn rút!',
      icon: 'warning',
      confirmButtonColor: '#eab308',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  if (amount.value > userBalance.value) {
    Swal.fire({
      title: 'SỐ DƯ KHÔNG ĐỦ!',
      text: 'Số dư ví XU của bạn không đủ để thực hiện giao dịch này!',
      icon: 'error',
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  if (!bankInfo.value.trim() || bankInfo.value.length < 10) {
    Swal.fire({
      title: 'THIẾU THÔNG TIN NHẬN TIỀN!',
      text: 'Vui lòng nhập chính xác thông tin nhận tiền (Tên Ngân hàng - STK - Tên Chủ Thẻ)!',
      icon: 'warning',
      confirmButtonColor: '#eab308',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  confirmStep.value = 1
  showConfirmModal.value = true
}

const handleConfirmWithdraw = async () => {
  if (isLoading.value || !currentUser.value || !amount.value) return

  if (approvedJobsCount.value < requiredJobs.value) {
    Swal.fire({
      title: 'CHƯA ĐỦ ĐIỀU KIỆN!',
      text: `Bạn cần hoàn thành ít nhất ${requiredJobs.value} nhiệm vụ để rút mốc này!`,
      icon: 'error',
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  isLoading.value = true

  try {
    const withdrawalRef = collection(db, "withdrawals")
    const realMoneyVND = Math.floor(amount.value / 12)

    await addDoc(withdrawalRef, {
      uid: currentUser.value.uid,
      amount: amount.value,
      realMoney: realMoneyVND,
      bankInfo: bankInfo.value,
      status: 'pending',
      createdAt: new Date()
    })

    const userRef = doc(db, "users", currentUser.value.uid)
    await updateDoc(userRef, {
      balance: userBalance.value - amount.value,
      hasPendingWithdraw: true
    })

    Swal.fire({
      title: 'GỬI ĐƠN THÀNH CÔNG!',
      text: 'Lệnh rút tiền của bạn đã được gửi. Vui lòng chờ hệ thống kiểm tra và giải ngân.',
      icon: 'success',
      confirmButtonColor: '#2563eb',
      customClass: { popup: 'rounded-[30px]' }
    }).then(() => {
      router.push('/')
    })
  } catch (error) {
    console.error("Lỗi khi rút tiền: ", error)
    Swal.fire({
      title: 'LỖI HỆ THỐNG!',
      text: 'Không thể kết nối tới máy chủ, vui lòng thử lại sau ít phút.',
      icon: 'error',
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'rounded-[30px]' }
    })
  } finally {
    isLoading.value = false
    showConfirmModal.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-transparent text-slate-300 font-sans p-4 md:p-10 font-black uppercase italic tracking-tighter pb-36">

    <button @click="router.back()" class="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-6 md:mb-10 group">
      <svg class="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
      <span class="tracking-widest text-[10px]">QUAY LẠI</span>
    </button>

    <div class="max-w-xl mx-auto space-y-6">

      <div class="bg-[#111726] border border-slate-800 rounded-[30px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <!-- Top accent bar -->
        <div class="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-t-[30px] opacity-90"></div>
        <!-- Radial glow bg -->
        <div class="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/[0.06] rounded-full blur-[80px] pointer-events-none"></div>

        <div class="text-center mb-8 relative z-10">
          <div class="w-16 h-16 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(234,179,8,0.45)]">
            <svg viewBox="0 0 24 24" class="w-9 h-9 drop-shadow-[0_0_10px_rgba(234,179,8,0.7)]">
              <defs>
                <linearGradient id="goldWithdrawCoin" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#fde047"/>
                  <stop offset="50%" style="stop-color:#eab308"/>
                  <stop offset="100%" style="stop-color:#854d0e"/>
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="10" fill="url(#goldWithdrawCoin)"/>
              <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="text-3xl text-white">RÚT TIỀN</h1>
          <p class="text-yellow-500 mt-2 text-xs tracking-widest">SỐ DƯ KHẢ DỤNG: {{ formatNumber(userBalance) }} XU</p>
        </div>

        <div class="space-y-6 relative z-10">
          <div>
            <label class="block text-blue-500 text-[10px] tracking-widest mb-3">CHỌN SỐ XU MUỐN RÚT</label>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="opt in withdrawOptions" :key="opt" class="relative">
                <div v-if="opt === 500000" class="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 text-[7px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-black uppercase tracking-wider whitespace-nowrap shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                  PHỔ BIẾN
                </div>
                <button
                  @click="selectAmount(opt)"
                  :class="[
                    'w-full py-3 rounded-[14px] border-2 transition-all text-xs md:text-sm active:scale-95',
                    amount === opt
                      ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500 text-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.35)] ring-1 ring-yellow-500/30'
                      : 'bg-[#0d121f] border-slate-800 text-slate-500 hover:border-slate-600'
                  ]"
                >
                  {{ formatNumber(opt) }} XU
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-blue-500 text-[10px] tracking-widest mb-3">THÔNG TIN NHẬN TIỀN (VNĐ)</label>
            <textarea
              v-model="bankInfo"
              rows="3"
              placeholder="VD: MB BANK - 123456789 - NGUYEN VAN A"
              class="w-full bg-[#0d121f] border border-slate-800 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-all resize-none normal-case font-medium not-italic text-sm"
            ></textarea>
          </div>

          <button
            @click="triggerWithdraw"
            :disabled="isLoading || hasPendingWithdraw"
            :class="[
              'w-full py-4 rounded-2xl text-[13px] tracking-widest transition-all mt-2',
              hasPendingWithdraw
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-yellow-500 hover:bg-yellow-400 text-[#090e17] active:scale-95 confirm-glow'
            ]"
          >
            {{ isLoading ? 'ĐANG XỬ LÝ...' : (hasPendingWithdraw ? 'ĐANG CÓ LỆNH CHỜ DUYỆT' : 'XÁC NHẬN RÚT TIỀN') }}
          </button>
        </div>
      </div>

      <div class="bg-[#111726] border border-slate-800 rounded-[30px] p-6 shadow-xl">
        <div class="flex items-center gap-2 mb-6">
          <div class="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          <h2 class="text-white text-lg tracking-tighter">LỊCH SỬ RÚT TIỀN</h2>
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1"></div>
        </div>

        <div class="space-y-3 relative overflow-hidden h-[300px]">
          <TransitionGroup name="list" tag="div" class="space-y-3">
            <div v-for="(item, index) in fakeWithdrawals" :key="item.id" class="flex items-center justify-between p-4 bg-[#0d121f] border border-slate-800/80 rounded-2xl">
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center text-xs font-black',
                  ['bg-blue-900/70 text-blue-400', 'bg-emerald-900/70 text-emerald-400', 'bg-purple-900/70 text-purple-400', 'bg-rose-900/70 text-rose-400'][index % 4]
                ]">
                  {{ item.name.charAt(0) }}
                </div>
                <div>
                  <p class="text-white text-xs">{{ item.name }}</p>
                  <p class="text-slate-500 text-[9px] mt-0.5">{{ item.time }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-emerald-400 font-black text-sm tracking-tighter">+{{ formatNumber(item.amount) }}</p>
                <p class="text-emerald-500 text-[8px] mt-0.5 tracking-widest">• THÀNH CÔNG</p>
              </div>
            </div>
          </TransitionGroup>
          <div class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#111726] to-transparent pointer-events-none"></div>
        </div>
      </div>

    </div>

    <Transition name="fade">
      <div v-if="showConfirmModal" class="fixed inset-0 z-[6000] flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showConfirmModal = false"></div>

        <div class="relative w-full max-w-md bg-gradient-to-b from-[#1a2333] to-[#111726] border border-slate-700 rounded-[30px] p-8 md:p-10 text-center shadow-2xl">

          <template v-if="amount === 200000 && approvedJobsCount < requiredJobs">
            <!-- Amber top accent line -->
            <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-t-[30px]"></div>
            <!-- Ambient glow -->
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none"></div>

            <!-- Lock icon -->
            <div class="absolute -top-10 left-1/2 -translate-x-1/2">
              <div class="w-20 h-20 bg-[#090e17] rounded-full p-2 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(234,179,8,0.35)]">
                <div class="w-full h-full bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                  <svg class="w-8 h-8 text-[#1c1100]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1C8.676 1 6 3.676 6 7v1H4v15h16V8h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 110 4 2 2 0 010-4z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Content -->
            <div class="mt-12 relative z-10">
              <div class="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black tracking-[2px] px-3 py-1 rounded-full mb-3 uppercase">
                🔒 Mở Khóa Rút Tiền
              </div>
              <h3 class="text-xl md:text-2xl text-white font-black tracking-tighter mb-2 uppercase italic">CẦN THÊM NHIỆM VỤ</h3>
              <p class="text-slate-400 text-[11px] normal-case font-medium not-italic mb-5 px-2 leading-relaxed">
                Hoàn thành đủ <span class="text-amber-400 font-bold">{{ requiredJobs }} nhiệm vụ</span> được duyệt để mở khóa rút tiền mốc <span class="text-amber-400 font-bold">200.000 XU</span>
              </p>

              <!-- Progress card -->
              <div class="bg-[#090e17] rounded-2xl py-5 px-5 border border-amber-500/10 mb-5 shadow-inner relative overflow-hidden">
                <div class="absolute inset-0 bg-amber-500/[0.025]"></div>
                <p class="text-slate-500 text-[9px] tracking-[3px] mb-3 font-black uppercase">Tiến Độ Nhiệm Vụ</p>

                <!-- Big numbers -->
                <p class="font-black text-3xl md:text-4xl flex items-baseline justify-center gap-1 mb-3">
                  <span class="text-amber-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">{{ approvedJobsCount }}</span>
                  <span class="text-slate-600 text-xl">/</span>
                  <span class="text-slate-400 text-xl">{{ requiredJobs }}</span>
                </p>

                <!-- Progress bar -->
                <div class="w-full h-3 bg-slate-800/80 rounded-full overflow-hidden mb-2 border border-slate-700/30">
                  <div class="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-1000 relative overflow-hidden"
                       :style="{ width: `${Math.min((approvedJobsCount / requiredJobs) * 100, 100)}%` }">
                    <div class="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>

                <p class="text-rose-400 text-[10px] font-black tracking-wide italic">
                  ⚡ Còn thiếu {{ requiredJobs - approvedJobsCount }} nhiệm vụ nữa
                </p>
              </div>

              <!-- Buttons -->
              <button @click="() => { showConfirmModal = false; router.push('/') }"
                      class="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-[#1c1100] rounded-xl active:scale-95 transition-all text-[11px] md:text-xs tracking-widest font-black italic uppercase shadow-[0_0_20px_rgba(234,179,8,0.4)] mb-2 border-t border-white/20">
                ĐI LÀM NGAY 🚀
              </button>
              <button @click="showConfirmModal = false"
                      class="w-full py-2.5 bg-transparent text-slate-600 hover:text-slate-400 rounded-xl active:scale-95 transition-all text-[10px] tracking-widest font-black uppercase">
                ĐÓNG
              </button>
            </div>
          </template>

          <!-- STEP 1: Thông tin quy đổi -->
          <template v-else-if="confirmStep === 1">
            <div class="absolute -top-10 left-1/2 -translate-x-1/2">
              <div class="w-20 h-20 bg-[#090e17] rounded-full p-2 border-2 border-slate-800">
                <div class="w-full h-full bg-gradient-to-tr from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                  🔄
                </div>
              </div>
            </div>

            <h3 class="text-2xl text-white mt-8 mb-2">QUY ĐỔI TIỀN THẬT</h3>
            <p class="text-slate-400 text-[10px] normal-case font-medium not-italic mb-6 px-4">Hệ thống áp dụng tỉ giá tự động quy đổi: XU ÷ 12</p>

            <div class="bg-[#090e17] rounded-2xl py-6 px-4 border border-slate-800 mb-8 relative overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>

              <p class="text-yellow-500 text-2xl mb-1 drop-shadow-md">{{ formatNumber(amount || 0) }} XU</p>
              <p class="text-slate-500 text-[10px] mb-3">=</p>
              <p class="text-emerald-400 text-3xl font-black drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{{ formatNumber((amount || 0) / 12) }} VNĐ</p>
            </div>

            <p class="text-white text-xs leading-relaxed mb-8 font-medium normal-case not-italic">
              Xác nhận quy đổi XU để chuyển thẳng vào tài khoản ngân hàng của bạn?
            </p>

            <div class="flex gap-3">
              <button @click="showConfirmModal = false" class="flex-1 py-3.5 bg-[#0d121f] border border-slate-700 text-slate-400 rounded-xl hover:bg-slate-800 active:scale-95 transition-all text-xs tracking-widest">
                HỦY
              </button>
              <button @click="confirmStep = 2" class="flex-1 py-3.5 bg-yellow-500 text-[#090e17] rounded-xl hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] active:scale-95 transition-all text-xs tracking-widest">
                XÁC NHẬN
              </button>
            </div>
          </template>

          <!-- STEP 2: Xác nhận lần cuối -->
          <template v-else>
            <!-- Icon cảnh báo -->
            <div class="absolute -top-10 left-1/2 -translate-x-1/2">
              <div class="w-20 h-20 bg-[#090e17] rounded-full p-2 border-2 border-rose-600/50 shadow-[0_0_25px_rgba(239,68,68,0.3)]">
                <div class="w-full h-full bg-gradient-to-tr from-rose-600 to-red-500 rounded-full flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  ⚠️
                </div>
              </div>
            </div>

            <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded-t-[30px]"></div>

            <h3 class="text-xl text-white mt-8 mb-1 uppercase italic font-black tracking-tighter">BẠN CÓ CHẮC KHÔNG?</h3>
            <p class="text-slate-400 text-[10px] normal-case font-medium not-italic mb-5 px-2 leading-relaxed">
              Hành động này không thể hoàn tác. Hệ thống sẽ trừ XU và gửi tiền về ngân hàng của bạn.
            </p>

            <!-- Tóm tắt giao dịch -->
            <div class="bg-[#090e17] rounded-2xl py-4 px-5 border border-rose-900/40 mb-6 text-left space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-slate-500 text-[10px] uppercase tracking-widest font-black">Trừ ví</span>
                <span class="text-rose-400 font-black text-sm">-{{ formatNumber(amount || 0) }} XU</span>
              </div>
              <div class="border-t border-slate-800"></div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 text-[10px] uppercase tracking-widest font-black">Nhận về</span>
                <span class="text-emerald-400 font-black text-sm">+{{ formatNumber((amount || 0) / 12) }} VNĐ</span>
              </div>
              <div class="border-t border-slate-800"></div>
              <div class="flex items-start justify-between gap-2">
                <span class="text-slate-500 text-[10px] uppercase tracking-widest font-black flex-shrink-0">Ngân hàng</span>
                <span class="text-white text-[10px] font-bold normal-case not-italic text-right leading-tight">{{ bankInfo }}</span>
              </div>
            </div>

            <div class="flex gap-3">
              <button @click="confirmStep = 1"
                      class="flex-1 py-3.5 bg-[#0d121f] border border-slate-700 text-slate-400 rounded-xl hover:bg-slate-800 active:scale-95 transition-all text-xs tracking-widest">
                QUAY LẠI
              </button>
              <button @click="handleConfirmWithdraw" :disabled="isLoading"
                      class="flex-1 py-3.5 bg-gradient-to-r from-rose-600 to-red-500 text-white rounded-xl hover:from-rose-500 hover:to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-all text-xs tracking-widest disabled:opacity-60">
                {{ isLoading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN RÚT TIỀN 🔐' }}
              </button>
            </div>
          </template>

        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-30px);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}

@keyframes confirm-pulse {
  0%, 100% { box-shadow: 0 10px 20px rgba(234,179,8,0.3); }
  50%       { box-shadow: 0 10px 40px rgba(234,179,8,0.6), 0 0 80px rgba(234,179,8,0.15); }
}
.confirm-glow {
  animation: confirm-pulse 2s ease-in-out infinite;
}
</style>
