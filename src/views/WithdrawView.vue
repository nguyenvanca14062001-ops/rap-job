<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db, storage } from '@/firebase'
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import Swal from 'sweetalert2'
import { compressImage, MAX_UPLOAD_BYTES } from '@/utils/imageCompress'

const router = useRouter()

const props = defineProps<{
  userBalance: number
  myReports: any[]
  myWithdrawals: any[]
  username?: string
  userFullName?: string
  userPhone?: string
}>()

const amount = ref<number | null>(null)
const isLoading = ref(false)

const qrPreview = ref<string | null>(null)
const qrBlob = ref<Blob | null>(null)
const qrError = ref('')
const qrFileInput = ref<HTMLInputElement | null>(null)

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const historySectionRef = ref<HTMLElement | null>(null)

const hasPendingWithdraw = computed(() => props.myWithdrawals.some(w => w.status === 'pending'))
const approvedJobsCount = computed(() =>
  props.myReports.filter(r => r.status === 'approved' || r.status === 'collected').length
)
const showConfirmModal = ref(false)
const confirmStep = ref(1) // 1: xem thông tin quy đổi, 2: xác nhận cuối cùng

const withdrawOptions = [250000, 500000, 650000, 800000, 1000000, 2000000]

const requiredJobs = computed(() => 9)
const tasksUnlocked = computed(() => approvedJobsCount.value >= requiredJobs.value)
const taskError = ref('')

const formatNumber = (num: number) => {
  return Math.floor(num).toLocaleString('vi-VN')
}

const selectAmount = (val: number) => {
  if (!tasksUnlocked.value) {
    taskError.value = 'Bạn cần hoàn thành đủ 9 nhiệm vụ trước khi rút tiền.'
    return
  }
  taskError.value = ''
  amount.value = val
}

onMounted(() => {
  if (!auth.currentUser) { router.push('/login'); return }
})

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const statusLabel = (status: string) => {
  if (status === 'approved' || status === 'paid') return 'Đã thanh toán'
  if (status === 'rejected') return 'Bị từ chối'
  return 'Đang chờ xử lý'
}

const statusBadgeClass = (status: string) => {
  if (status === 'approved' || status === 'paid') return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
  if (status === 'rejected') return 'bg-red-500/10 text-red-500 border border-red-500/20'
  return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
}

const scrollToHistory = () => {
  nextTick(() => historySectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

const triggerQrFileInput = () => { qrFileInput.value?.click() }

const handleQrFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    qrError.value = 'Vui lòng chọn ảnh QR ngân hàng hợp lệ.'
    target.value = ''
    return
  }

  try {
    const compressed = await compressImage(file)
    console.log("Image compressed:", {
      originalSizeKB: Math.round(file.size / 1024),
      compressedSizeKB: Math.round(compressed.blob.size / 1024),
      type: compressed.blob.type
    })
    if (compressed.blob.size >= MAX_UPLOAD_BYTES) {
      qrError.value = 'Ảnh QR quá lớn, vui lòng chọn ảnh khác.'
      target.value = ''
      return
    }
    qrPreview.value = compressed.dataUrl
    qrBlob.value = compressed.blob
    qrError.value = ''
  } catch (err: any) {
    qrError.value = err?.message || 'Vui lòng chọn ảnh QR ngân hàng hợp lệ.'
  }
  target.value = ''
}

const removeQr = () => {
  qrPreview.value = null
  qrBlob.value = null
  qrError.value = ''
  if (qrFileInput.value) qrFileInput.value.value = ''
}

const triggerWithdraw = () => {
  if (!tasksUnlocked.value) {
    taskError.value = 'Bạn cần hoàn thành đủ 9 nhiệm vụ trước khi rút tiền.'
    return
  }
  taskError.value = ''

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
      text: 'Vui lòng chọn số xu muốn rút.',
      icon: 'warning',
      confirmButtonColor: '#eab308',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  if (!qrBlob.value) {
    qrError.value = 'Vui lòng tải ảnh QR ngân hàng.'
    return
  }
  qrError.value = ''

  if (amount.value > props.userBalance) {
    Swal.fire({
      title: 'SỐ DƯ KHÔNG ĐỦ!',
      text: 'Số dư của bạn không đủ để rút mốc này.',
      icon: 'error',
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'rounded-[30px]' }
    })
    return
  }

  confirmStep.value = 1
  showConfirmModal.value = true
}

const handleConfirmWithdraw = async () => {
  const user = auth.currentUser
  if (isLoading.value || !user || !amount.value) return

  if (!qrBlob.value) {
    qrError.value = 'Vui lòng tải ảnh QR ngân hàng.'
    showConfirmModal.value = false
    return
  }

  // Chặn cứng lần cuối trước khi tạo withdrawal, phòng trường hợp state bị lệch với UI
  if (approvedJobsCount.value < requiredJobs.value) {
    taskError.value = 'Bạn cần hoàn thành đủ 9 nhiệm vụ trước khi rút tiền.'
    showConfirmModal.value = false
    return
  }

  isLoading.value = true

  // Tạo trước withdrawalId để dùng làm path Storage
  const withdrawalRef = doc(collection(db, "withdrawals"))
  const withdrawalId = withdrawalRef.id
  const withdrawAmount = amount.value

  let qrImage: { url: string; path: string }
  try {
    const path = `withdrawal_qr/${user.uid}/${withdrawalId}/qr.jpg`
    console.log("Withdrawal QR upload debug:", {
      authUid: auth.currentUser?.uid,
      path,
      fileSize: qrBlob.value.size,
      fileType: qrBlob.value.type
    })
    const imgRef = storageRef(storage, path)
    await uploadBytes(imgRef, qrBlob.value, { contentType: 'image/jpeg' })
    const url = await getDownloadURL(imgRef)
    qrImage = { url, path: imgRef.fullPath }
  } catch (uploadError) {
    console.error("Lỗi upload QR: ", uploadError)
    Swal.fire({
      title: 'LỖI TẢI ẢNH QR!',
      text: 'Không thể tải ảnh QR lên, vui lòng thử lại.',
      icon: 'error',
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'rounded-[30px]' }
    })
    isLoading.value = false
    return
  }
  console.log("Uploaded withdrawal QR:", qrImage)

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", user.uid)
      const userSnap = await transaction.get(userRef)
      const currentBalance = Number(userSnap.data()?.balance || 0)

      if (currentBalance < withdrawAmount) {
        throw new Error('INSUFFICIENT_BALANCE')
      }

      transaction.update(userRef, {
        balance: currentBalance - withdrawAmount,
        hasPendingWithdraw: true
      })

      transaction.set(withdrawalRef, {
        uid: user.uid,
        username: props.username || '',
        fullName: props.userFullName || '',
        phoneRef: props.userPhone || '',
        amount: withdrawAmount,
        realMoney: Math.floor(withdrawAmount / 12),
        bankInfo: '',
        status: 'pending',
        qrImage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        note: '',
        rejectReason: '',
        paidAt: null,
        paidBy: null
      })
    })
  } catch (txError: any) {
    if (txError?.message === 'INSUFFICIENT_BALANCE') {
      Swal.fire({
        title: 'SỐ DƯ KHÔNG ĐỦ!',
        text: 'Số dư của bạn không đủ để rút mốc này.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-[30px]' }
      })
    } else {
      console.error("Lỗi khi rút tiền: ", txError)
      Swal.fire({
        title: 'LỖI HỆ THỐNG!',
        text: 'Không thể kết nối tới máy chủ, vui lòng thử lại sau ít phút.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-[30px]' }
      })
    }
    isLoading.value = false
    showConfirmModal.value = false
    return
  }

  amount.value = null
  qrPreview.value = null
  qrBlob.value = null
  isLoading.value = false
  showConfirmModal.value = false

  Swal.fire({
    title: '✅ Đã gửi yêu cầu rút tiền',
    html: `Yêu cầu rút <b>${formatNumber(withdrawAmount)} XU</b> của bạn đã được gửi.<br/>Vui lòng chờ admin kiểm tra và chuyển khoản.`,
    icon: 'success',
    showCancelButton: true,
    confirmButtonText: 'XEM LỊCH SỬ RÚT TIỀN',
    cancelButtonText: 'ĐÓNG',
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#334155',
    customClass: { popup: 'rounded-[30px]' }
  }).then((result) => {
    if (result.isConfirmed) scrollToHistory()
  })
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

        <div v-if="!tasksUnlocked" class="mb-6 relative z-10 bg-[#090e17] border border-amber-500/20 rounded-2xl p-5">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">🔒</span>
            <p class="text-amber-400 text-[11px] tracking-wide normal-case leading-relaxed font-bold">
              Bạn cần hoàn thành tối thiểu {{ requiredJobs }} nhiệm vụ để mở khóa chức năng rút tiền.
            </p>
          </div>
          <div class="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden mb-2 border border-slate-700/30">
            <div class="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-500"
                 :style="{ width: `${Math.min((approvedJobsCount / requiredJobs) * 100, 100)}%` }"></div>
          </div>
          <p class="text-slate-400 text-[10px] normal-case font-sans not-italic font-bold">
            Đã hoàn thành: {{ approvedJobsCount }}/{{ requiredJobs }} nhiệm vụ. Hãy hoàn thành thêm {{ Math.max(requiredJobs - approvedJobsCount, 0) }} nhiệm vụ nữa để rút tiền.
          </p>
        </div>

        <div class="space-y-6 relative z-10">
          <div>
            <label class="block text-blue-500 text-[10px] tracking-widest mb-3">CHỌN SỐ XU MUỐN RÚT</label>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="opt in withdrawOptions" :key="opt" class="relative">
                <div v-if="opt === 500000" class="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 text-[7px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-black uppercase tracking-wider whitespace-nowrap shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                  PHỔ BIẾN
                </div>
                <span v-if="!tasksUnlocked" class="absolute top-1.5 right-2 z-10 text-xs">🔒</span>
                <button
                  @click="selectAmount(opt)"
                  :class="[
                    'w-full py-3 rounded-[14px] border-2 transition-all text-xs md:text-sm active:scale-95',
                    !tasksUnlocked
                      ? 'bg-[#0d121f]/50 border-slate-800/60 text-slate-600 opacity-50 grayscale cursor-not-allowed active:scale-100'
                      : amount === opt
                        ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500 text-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.35)] ring-1 ring-yellow-500/30'
                        : 'bg-[#0d121f] border-slate-800 text-slate-500 hover:border-slate-600'
                  ]"
                >
                  {{ formatNumber(opt) }} XU
                </button>
              </div>
            </div>
            <p v-if="taskError" class="text-rose-400 text-[11px] font-sans not-italic font-bold normal-case leading-relaxed mt-2">
              ⚠️ {{ taskError }}
            </p>
          </div>

          <div>
            <label class="block text-blue-500 text-[10px] tracking-widest mb-2">TẢI ẢNH QR NGÂN HÀNG</label>
            <p class="text-slate-500 text-[10px] normal-case font-medium not-italic leading-relaxed mb-3">
              Vui lòng tải ảnh mã QR ngân hàng chính chủ để nhận tiền. Ảnh QR cần rõ số tài khoản, ngân hàng và tên người nhận.
            </p>

            <div
              v-if="!qrPreview"
              @click="triggerQrFileInput"
              class="w-full border-2 border-dashed border-slate-700/60 hover:border-yellow-500/50 bg-[#0d121f]/30 rounded-[20px] py-10 px-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
            >
              <div class="text-3xl group-hover:scale-110 transition-transform mb-2">🔳</div>
              <p class="text-[11px] tracking-widest uppercase text-slate-400 group-hover:text-white font-black">CHỌN ẢNH QR</p>
            </div>

            <div v-else class="relative w-40 mx-auto">
              <div @click="openImage(qrPreview)" class="rounded-2xl overflow-hidden border-2 border-yellow-500/50 aspect-square bg-white cursor-zoom-in">
                <img :src="qrPreview" class="w-full h-full object-contain" />
              </div>
              <button @click.stop="removeQr" class="absolute -top-2 -right-2 w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[11px] font-sans not-italic shadow-lg">✕</button>
            </div>

            <input type="file" ref="qrFileInput" @change="handleQrFileChange" accept="image/jpeg, image/png, image/jpg, image/webp" class="hidden" />

            <p v-if="qrError" class="text-rose-400 text-[11px] font-sans not-italic font-bold normal-case leading-relaxed mt-2">
              ⚠️ {{ qrError }}
            </p>
          </div>

          <button
            @click="triggerWithdraw"
            :disabled="isLoading || hasPendingWithdraw || !tasksUnlocked"
            :class="[
              'w-full py-4 rounded-2xl text-[13px] tracking-widest transition-all mt-2',
              hasPendingWithdraw || !tasksUnlocked
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-yellow-500 hover:bg-yellow-400 text-[#090e17] active:scale-95 confirm-glow'
            ]"
          >
            {{ isLoading ? 'ĐANG GỬI YÊU CẦU...' : (hasPendingWithdraw ? 'ĐANG CÓ LỆNH CHỜ DUYỆT' : (!tasksUnlocked ? 'CHƯA ĐỦ ĐIỀU KIỆN RÚT TIỀN' : 'XÁC NHẬN RÚT TIỀN')) }}
          </button>
        </div>
      </div>

      <div ref="historySectionRef" class="bg-[#111726] border border-slate-800 rounded-[30px] p-6 shadow-xl">
        <div class="flex items-center gap-2 mb-6">
          <div class="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          <h2 class="text-white text-lg tracking-tighter">LỊCH SỬ RÚT TIỀN CỦA BẠN</h2>
        </div>

        <div v-if="!myWithdrawals.length" class="py-10 text-center text-slate-600 text-[11px] normal-case font-medium not-italic">
          Bạn chưa có yêu cầu rút tiền nào.
        </div>

        <div v-else class="space-y-3">
          <div v-for="w in myWithdrawals" :key="w.id" class="p-4 bg-[#0d121f] border border-slate-800/80 rounded-2xl">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div v-if="w.qrImage?.url" @click="openImage(w.qrImage.url)" class="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-white cursor-zoom-in flex-shrink-0">
                  <img :src="w.qrImage.url" class="w-full h-full object-contain" />
                </div>
                <div v-else class="w-12 h-12 rounded-lg border border-slate-800 flex items-center justify-center text-slate-700 text-[7px] text-center leading-tight normal-case flex-shrink-0 p-1">
                  Chưa có QR
                </div>
                <div>
                  <p class="text-white text-sm tracking-tighter">{{ formatNumber(w.amount || 0) }} XU</p>
                  <p class="text-slate-500 text-[9px] mt-0.5 font-sans not-italic normal-case">{{ formatDate(w.createdAt) }}</p>
                </div>
              </div>
              <span :class="['text-[9px] px-2.5 py-1 rounded-full whitespace-nowrap font-sans not-italic normal-case', statusBadgeClass(w.status)]">{{ statusLabel(w.status) }}</span>
            </div>
            <p v-if="w.status === 'rejected' && (w.adminNote || w.rejectReason)" class="mt-3 text-rose-400 text-[10px] normal-case font-sans not-italic font-bold leading-relaxed">
              Lý do từ chối: {{ w.adminNote || w.rejectReason }}
            </p>
            <p v-if="(w.status === 'approved' || w.status === 'paid') && w.paidAt" class="mt-3 text-emerald-400 text-[10px] normal-case font-sans not-italic font-bold">
              Đã thanh toán lúc: {{ formatDate(w.paidAt) }}
            </p>
          </div>
        </div>
      </div>

    </div>

    <Transition name="fade">
      <div v-if="selectedImage" class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="closeImage">
        <button class="absolute top-6 right-6 w-12 h-12 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[6010]" @click.stop="closeImage">✕</button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain z-[6005] cursor-default bg-white" :src="selectedImage" @click.stop />
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showConfirmModal" class="fixed inset-0 z-[6000] flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showConfirmModal = false"></div>

        <div class="relative w-full max-w-md bg-gradient-to-b from-[#1a2333] to-[#111726] border border-slate-700 rounded-[30px] p-8 md:p-10 text-center shadow-2xl">

          <!-- STEP 1: Thông tin quy đổi -->
          <template v-if="confirmStep === 1">
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
              <div class="border-t border-slate-800" v-if="qrPreview"></div>
              <div class="flex items-center justify-between gap-2" v-if="qrPreview">
                <span class="text-slate-500 text-[10px] uppercase tracking-widest font-black flex-shrink-0">Mã QR</span>
                <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-white">
                  <img :src="qrPreview" class="w-full h-full object-contain" />
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <button @click="confirmStep = 1"
                      class="flex-1 py-3.5 bg-[#0d121f] border border-slate-700 text-slate-400 rounded-xl hover:bg-slate-800 active:scale-95 transition-all text-xs tracking-widest">
                QUAY LẠI
              </button>
              <button @click="handleConfirmWithdraw" :disabled="isLoading"
                      class="flex-1 py-3.5 bg-gradient-to-r from-rose-600 to-red-500 text-white rounded-xl hover:from-rose-500 hover:to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-all text-xs tracking-widest disabled:opacity-60">
                {{ isLoading ? 'ĐANG GỬI YÊU CẦU...' : 'XÁC NHẬN RÚT TIỀN 🔐' }}
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
