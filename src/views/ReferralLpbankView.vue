<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db, storage } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import Swal from 'sweetalert2'
import { compressImage, MAX_UPLOAD_BYTES } from '@/utils/imageCompress'
import { normalizePhone } from '@/utils/phone'
import { LPBANK_REFERRAL_JOB_ID, LPBANK_REFERRAL_CODE } from '@/utils/referralLpbank'

const props = defineProps<{
  myReports?: any[]
  isDataLoading?: boolean
}>()

const router = useRouter()
const baseUrl = import.meta.env.BASE_URL
const FANPAGE_URL = 'https://www.facebook.com/rapjobfreelance/'
const REQUIRED_IMAGES = 2

const isLoggedIn = ref(false)
const userUid = ref('')
const isAuthChecking = ref(true)

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    isAuthChecking.value = false
    if (user) {
      isLoggedIn.value = true
      userUid.value = user.uid
    } else {
      router.push('/login')
    }
  })
})

// --- Ảnh mẫu / zoom ---
const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }
const sampleImages = ['images/anh-lpbank1.jpg', 'images/anh-lpbank4.jpg']

// --- Copy helper (toast) ---
const copyText = (text: string, toastTitle: string) => {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    Swal.fire({ title: toastTitle, icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' })
  }).catch(() => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      Swal.fire({ title: toastTitle, icon: 'success', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' })
    } catch {
      alert('Lỗi sao chép, hãy copy thủ công nhé!')
    }
    document.body.removeChild(textArea)
  })
}
const copyReferralCode = () => copyText(LPBANK_REFERRAL_CODE, 'Đã sao chép mã giới thiệu')

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

// --- Lịch sử đơn LPBANK (lấy từ myReports đã đồng bộ sẵn) ---
const showHistoryModal = ref(false)
const lpbankHistory = computed(() => (props.myReports || []).filter(r => r.jobId === LPBANK_REFERRAL_JOB_ID))

// --- Popup gửi bằng chứng ---
const showSubmitModal = ref(false)
const friendName = ref('')
const friendPhone = ref('')
const images = ref<string[]>([])
const imageBlobs = ref<Blob[]>([])
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const isSubmitting = ref(false)
const submitStage = ref<'idle' | 'uploading' | 'saving'>('idle')

const openSubmitModal = () => {
  friendName.value = ''
  friendPhone.value = ''
  images.value = []
  imageBlobs.value = []
  imageError.value = ''
  showSubmitModal.value = true
}
const closeSubmitModal = () => { if (!isSubmitting.value) showSubmitModal.value = false }
const triggerFileInput = () => { if (images.value.length < REQUIRED_IMAGES) fileInput.value?.click() }

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  const files = Array.from(target.files)

  if (images.value.length + files.length > REQUIRED_IMAGES) {
    imageError.value = `Chỉ được chọn đúng ${REQUIRED_IMAGES} ảnh bằng chứng.`
    target.value = ''
    return
  }
  imageError.value = ''

  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      alert(`⚠️ LỖI ĐỊNH DẠNG: Bức ảnh "${file.name}" là ảnh HEIC của iPhone nên hệ thống không nhận diện được. Vui lòng CHỤP MÀN HÌNH lại bức ảnh đó rồi tải lên!`)
      continue
    }
    if (!file.type.startsWith('image/')) continue
    try {
      const compressed = await compressImage(file)
      if (compressed.blob.size > MAX_UPLOAD_BYTES) {
        alert('⚠️ Ảnh quá lớn, vui lòng chọn ảnh khác hoặc chụp lại rõ hơn.')
        continue
      }
      images.value.push(compressed.dataUrl)
      imageBlobs.value.push(compressed.blob)
    } catch (err: any) {
      alert('⚠️ LỖI XỬ LÝ ẢNH: ' + (err?.message || 'Vui lòng thử ảnh khác.'))
    }
  }
  target.value = ''
}

const removeImage = (index: number) => {
  images.value.splice(index, 1)
  imageBlobs.value.splice(index, 1)
  imageError.value = ''
}

// --- Popup thành công (riêng cho LPBANK referral) ---
const showSuccessModal = ref(false)
const lastSubmittedOrder = ref<{ friendName: string; friendPhone: string; orderCode: string; createdAt: Date } | null>(null)

const submitReferral = async () => {
  if (!userUid.value || isSubmitting.value) return
  const name = friendName.value.trim()
  const phone = friendPhone.value.trim()

  if (!name) { alert('⚠️ VUI LÒNG NHẬP TÊN NGƯỜI BẠN ĐÃ GIỚI THIỆU!'); return }
  if (!phone || normalizePhone(phone).length < 9) { alert('⚠️ VUI LÒNG NHẬP ĐÚNG SỐ ĐIỆN THOẠI NGƯỜI BẠN ĐÃ GIỚI THIỆU!'); return }
  if (imageBlobs.value.length !== REQUIRED_IMAGES) {
    imageError.value = `Vui lòng tải lên đúng ${REQUIRED_IMAGES} ảnh bằng chứng theo mẫu hướng dẫn.`
    return
  }

  isSubmitting.value = true
  try {
    const userSnap = await getDoc(doc(db, 'users', userUid.value))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}

    const reportRef = doc(collection(db, 'reports'))
    const reportId = reportRef.id

    submitStage.value = 'uploading'
    let proofImages: { url: string; path: string }[] = []
    try {
      proofImages = await Promise.all(imageBlobs.value.map(async (blob, index) => {
        const path = `proofs/${userUid.value}/${reportId}/image_${index}.jpg`
        const imgRef = storageRef(storage, path)
        await uploadBytes(imgRef, blob, { contentType: 'image/jpeg' })
        const url = await getDownloadURL(imgRef)
        return { url, path: imgRef.fullPath }
      }))
    } catch (uploadError: any) {
      alert('❌ LỖI TẢI ẢNH LÊN: ' + (uploadError?.message || 'Vui lòng thử lại.'))
      isSubmitting.value = false
      submitStage.value = 'idle'
      return
    }

    if (proofImages.length !== REQUIRED_IMAGES) {
      throw new Error(`Vui lòng tải lên đúng ${REQUIRED_IMAGES} ảnh bằng chứng.`)
    }

    submitStage.value = 'saving'

    const orderCode = `${name} - ${phone}`

    const reportData = {
      uid: userUid.value,
      username: userDoc.username || userDoc.fullName || '',
      fullName: userDoc.fullName || '',
      phoneRef: userDoc.phoneRef || userDoc.phone || '',
      phoneNormalized: normalizePhone(userDoc.phoneRef || userDoc.phone || ''),
      birthYear: userDoc.birthYear || userDoc.yearOfBirth || userDoc.dateOfBirth || userDoc.dob || '',

      jobId: LPBANK_REFERRAL_JOB_ID,
      jobName: 'Giới thiệu bạn bè đăng ký APP LPBANK',
      category: 'vip',
      type: 'friend_referral',
      bankType: 'lpbank',

      friendName: name,
      friendPhone: phone,
      friendPhoneNormalized: normalizePhone(phone),

      referralOrderCode: orderCode,

      reward: 0,
      estimatedReward: null,

      proofImages,
      imageCount: proofImages.length,

      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      storageCleaned: false
    }

    await setDoc(reportRef, reportData)

    lastSubmittedOrder.value = { friendName: name, friendPhone: phone, orderCode, createdAt: new Date() }
    showSubmitModal.value = false
    showSuccessModal.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + error.message)
  } finally {
    isSubmitting.value = false
    submitStage.value = 'idle'
  }
}

const copyOrderCode = () => { if (lastSubmittedOrder.value) copyText(lastSubmittedOrder.value.orderCode, 'Đã sao chép mã đơn') }
const openFanpage = () => window.open(FANPAGE_URL, '_blank')
const closeSuccessAndShowHistory = () => { showSuccessModal.value = false; showHistoryModal.value = true }
</script>

<template>
  <div class="min-h-screen bg-transparent text-slate-300 p-4 md:p-8 font-black italic uppercase text-left relative">

    <!-- ZOOM ẢNH -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" v-if="selectedImage" @click="closeImage">
        <button class="absolute top-6 right-6 w-12 h-12 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[7010]" @click.stop="closeImage">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain z-[7005] cursor-default" :src="selectedImage" @click.stop />
      </div>
    </Transition>

    <!-- Đang tải -->
    <div v-if="isAuthChecking || props.isDataLoading" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs text-slate-500 tracking-widest uppercase">Đang tải dữ liệu...</p>
    </div>

    <!-- Nội dung chính -->
    <div v-else class="max-w-3xl mx-auto space-y-6">

      <div class="flex justify-between items-center border-b border-slate-800 pb-4">
        <button class="text-[10px] tracking-[3px] text-slate-500 hover:text-white flex items-center gap-1 px-3 py-2.5 -mx-3 -my-2 active:scale-95 transition-transform" @click="router.push('/')">
          <span class="text-base font-light not-italic font-sans">✕</span> QUAY LẠI
        </button>
        <span class="text-[10px] tracking-[4px] text-slate-600">GIỚI THIỆU BẠN BÈ</span>
      </div>

      <!-- HERO -->
      <div class="bg-gradient-to-br from-[#2A1C00] to-[#160E00] border border-amber-500/40 rounded-[36px] p-6 md:p-10 text-center shadow-2xl relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-3xl relative z-10">👥</div>
        <h1 class="text-2xl md:text-4xl text-white tracking-tighter leading-tight mb-3 relative z-10">
          GIỚI THIỆU BẠN BÈ<br/>ĐĂNG KÝ <span class="text-amber-400">APP LPBANK PLUS</span>
        </h1>
        <div class="bg-[#052e1f] border border-[#005c3c] rounded-full px-6 py-2.5 w-max mx-auto flex items-center gap-2 shadow-inner relative z-10">
          <span class="text-[#f59e0b] text-xl">⚡</span>
          <span class="text-[#00df89] text-sm md:text-base tracking-tighter">THƯỞNG: 100.000 - 150.000 XU</span>
        </div>
        <p class="text-slate-400 text-[11px] md:text-xs font-medium normal-case leading-relaxed mt-4 max-w-md mx-auto relative z-10">
          Mời bạn bè đăng ký APP LPBANK PLUS theo hướng dẫn để nhận thưởng.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 mt-6 relative z-10">
          <button @click="openSubmitModal" class="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[13px] md:text-sm">
            GỬI BẰNG CHỨNG LPBANK PLUS 📥
          </button>
          <button @click="showHistoryModal = true" class="flex-1 py-4 bg-[#0d121f] border border-slate-700 hover:border-amber-500/60 text-white rounded-2xl active:scale-95 transition-all text-[13px] md:text-sm">
            LỊCH SỬ ĐƠN LPBANK PLUS 📜
          </button>
        </div>
      </div>

      <!-- THƯỞNG TĂNG DẦN -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 shadow-xl">
        <h3 class="text-amber-400 text-sm md:text-base tracking-tight mb-4 flex items-center gap-2">🎁 THƯỞNG TĂNG DẦN</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center">
            <p class="text-slate-500 text-[9px] tracking-widest mb-1">LẦN 1</p>
            <p class="text-emerald-400 text-base md:text-lg">100.000</p>
          </div>
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center">
            <p class="text-slate-500 text-[9px] tracking-widest mb-1">LẦN 2</p>
            <p class="text-emerald-400 text-base md:text-lg">110.000</p>
          </div>
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center">
            <p class="text-slate-500 text-[9px] tracking-widest mb-1">LẦN 3</p>
            <p class="text-emerald-400 text-base md:text-lg">120.000</p>
          </div>
          <div class="bg-[#0d121f] border border-amber-500/40 rounded-2xl p-4 text-center">
            <p class="text-amber-500 text-[9px] tracking-widest mb-1">TỪ LẦN 4</p>
            <p class="text-amber-400 text-base md:text-lg">150.000</p>
          </div>
        </div>
        <p class="text-slate-500 text-[10px] font-medium normal-case mt-4 leading-relaxed">
          Chỉ tính những đơn đã được admin duyệt thành công. Đơn chờ duyệt hoặc bị từ chối không được tính.
        </p>
      </div>

      <!-- MÃ GIỚI THIỆU -->
      <div class="bg-[#111726] border border-emerald-500/30 rounded-[30px] p-6 shadow-xl">
        <p class="text-emerald-400 text-[10px] tracking-[2px] mb-2">MÃ GIỚI THIỆU</p>
        <div class="flex items-center justify-between gap-4">
          <p class="text-white text-2xl md:text-3xl tracking-wider select-all font-sans not-italic">{{ LPBANK_REFERRAL_CODE }}</p>
          <button @click="copyReferralCode" class="bg-emerald-500 hover:bg-emerald-400 text-[#090e17] px-4 py-3 rounded-xl text-[11px] shrink-0 active:scale-95 transition-all">
            📋 SAO CHÉP
          </button>
        </div>
      </div>

      <!-- CẢNH BÁO -->
      <div class="bg-gradient-to-r from-orange-950/70 to-red-950/50 border border-orange-600/40 rounded-2xl p-4 space-y-2 shadow-inner">
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>⚠️</span><span>1 điện thoại chỉ đăng ký được 1 tài khoản LPBANK PLUS.</span>
        </p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>⚠️</span><span>Không được đăng ký 2 tài khoản LPBANK PLUS trên cùng 1 điện thoại.</span>
        </p>
      </div>

      <!-- HƯỚNG DẪN 2 BƯỚC -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 md:p-8 shadow-xl space-y-6">
        <h3 class="text-blue-400 text-sm md:text-base tracking-tight">📖 HƯỚNG DẪN THỰC HIỆN</h3>
        <div class="relative pl-10">
          <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-emerald-500 text-[#090e17] flex items-center justify-center text-sm shadow-lg">1</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">
            Hướng dẫn bạn bè tải APP LPBANK PLUS, đăng ký tài khoản và nhập mã giới thiệu <span class="text-emerald-400 select-all">{{ LPBANK_REFERRAL_CODE }}</span>.
          </p>
        </div>
        <div class="relative pl-10">
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-emerald-500 text-[#090e17] flex items-center justify-center text-sm shadow-lg">2</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">
            Làm theo 2 ảnh mẫu bên dưới, sau đó chụp lại và gửi bằng chứng.
          </p>
        </div>
      </div>

      <!-- ẢNH MẪU -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 shadow-xl">
        <h3 class="text-slate-400 text-sm tracking-tight mb-4">ẢNH MẪU HƯỚNG DẪN</h3>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="(img, idx) in sampleImages" :key="idx" @click="openImage(baseUrl + img)"
               class="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 aspect-[3/4] cursor-zoom-in group">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" :src="baseUrl + img" />
            <div class="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded">MẪU {{ idx + 1 }}</div>
          </div>
        </div>
      </div>

    </div>

    <!-- POPUP GỬI BẰNG CHỨNG -->
    <Transition name="fade">
      <div v-if="showSubmitModal" class="fixed inset-0 z-[5000] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="closeSubmitModal"></div>
        <div class="relative bg-[#111726] border border-amber-500/30 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg md:text-xl text-white tracking-tight">📥 GỬI BẰNG CHỨNG LPBANK PLUS</h2>
            <button @click="closeSubmitModal" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="space-y-5 text-left">
            <div class="space-y-2">
              <label class="text-amber-400 text-[11px] tracking-widest ml-1">TÊN NGƯỜI BẠN ĐÃ GIỚI THIỆU *</label>
              <input v-model="friendName" type="text" placeholder="Tên bạn bè"
                     class="w-full bg-[#0d121f] border border-slate-800 focus:border-amber-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
            </div>
            <div class="space-y-2">
              <label class="text-amber-400 text-[11px] tracking-widest ml-1">SỐ ĐIỆN THOẠI NGƯỜI BẠN ĐÃ GIỚI THIỆU *</label>
              <input v-model="friendPhone" type="text" placeholder="VD: 0987654321"
                     class="w-full bg-[#0d121f] border border-slate-800 focus:border-amber-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between ml-1">
                <label class="text-amber-400 text-[11px] tracking-widest">ẢNH BẰNG CHỨNG * (ĐÚNG {{ REQUIRED_IMAGES }} ẢNH)</label>
                <span :class="['text-[10px] font-sans not-italic font-bold', images.length === REQUIRED_IMAGES ? 'text-emerald-400' : 'text-slate-500']">
                  {{ images.length }}/{{ REQUIRED_IMAGES }}
                </span>
              </div>
              <div @click="triggerFileInput"
                   class="w-full border-2 border-dashed border-slate-700/60 hover:border-amber-500/50 bg-[#0d121f]/30 rounded-[28px] py-10 px-6 flex flex-col items-center justify-center transition-all"
                   :class="images.length < REQUIRED_IMAGES ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'">
                <div class="text-3xl mb-2">📸</div>
                <p class="text-[10px] md:text-[11px] text-slate-400 tracking-widest uppercase text-center leading-relaxed">
                  Tải đúng {{ REQUIRED_IMAGES }} ảnh theo mẫu hướng dẫn
                </p>
              </div>
              <input type="file" ref="fileInput" @change="handleFileUpload" multiple accept="image/jpeg, image/png, image/jpg" class="hidden" />
              <p v-if="imageError" class="text-rose-400 text-[11px] font-sans not-italic font-bold normal-case leading-relaxed">⚠️ {{ imageError }}</p>

              <div class="mt-1 p-4 bg-[#0d121f] border border-slate-800/80 rounded-2xl shadow-inner">
                <p class="text-[10px] md:text-[11px] text-yellow-400 font-black tracking-widest mb-3 uppercase italic leading-relaxed">
                  ⚠️ Bạn phải gửi đủ {{ sampleImages.length }} ảnh mẫu LPBANK PLUS này (chạm để zoom to):
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <div v-for="(img, idx) in sampleImages" :key="idx" @click="openImage(baseUrl + img)"
                       class="relative rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 aspect-[3/4] cursor-zoom-in group hover:border-amber-500 transition-colors">
                    <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" :src="baseUrl + img" />
                    <div class="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">MẪU {{ idx + 1 }}</div>
                  </div>
                </div>
              </div>

              <div v-if="images.length > 0" class="grid grid-cols-2 gap-3 mt-3">
                <div v-for="(img, index) in images" :key="index" class="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0d121f] aspect-square">
                  <img class="w-full h-full object-cover bg-white" :src="img" />
                  <button class="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] font-sans not-italic z-10 shadow-lg" @click.stop="removeImage(index)">✕</button>
                </div>
              </div>
            </div>

            <button @click="submitReferral" :disabled="isSubmitting"
                    class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl text-[13px] md:text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {{ submitStage === 'uploading' ? 'ĐANG TẢI ẢNH LÊN...' : submitStage === 'saving' ? 'ĐANG GỬI BẰNG CHỨNG...' : isSubmitting ? 'ĐANG XỬ LÝ...' : 'GỬI BẰNG CHỨNG LPBANK PLUS 📥' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP THÀNH CÔNG (riêng cho LPBANK referral) -->
    <Transition name="fade">
      <div v-if="showSuccessModal && lastSubmittedOrder" class="fixed inset-0 z-[6000] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md"></div>
        <div class="relative bg-[#111726] border border-emerald-500/30 w-full max-w-sm rounded-[36px] p-7 text-center shadow-2xl animate-in zoom-in duration-300">
          <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <span class="text-3xl">✅</span>
          </div>
          <h2 class="text-xl text-white tracking-tight mb-2">NỘP ĐƠN THÀNH CÔNG</h2>
          <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-4">
            Đơn giới thiệu bạn bè LPBANK PLUS đã được gửi.<br/>Vui lòng chờ phê duyệt.<br/>
            Để được duyệt nhanh hơn, hãy gửi ảnh bằng chứng + mã đơn này qua Fanpage.
          </p>

          <div class="bg-[#0d121f] border border-emerald-500/40 rounded-2xl p-4 mb-4 text-left space-y-2">
            <p class="text-emerald-400 text-[9px] tracking-widest">MÃ ĐƠN CỦA BẠN</p>
            <div class="flex items-center justify-between gap-2">
              <p class="text-white text-sm font-sans not-italic font-bold normal-case select-all break-all">{{ lastSubmittedOrder.orderCode }}</p>
              <button @click="copyOrderCode" class="bg-emerald-500 hover:bg-emerald-400 text-[#090e17] px-3 py-2 rounded-lg text-[10px] shrink-0">📋</button>
            </div>
            <div class="border-t border-slate-800 pt-2 space-y-1 font-sans not-italic normal-case text-[10px] text-slate-400">
              <p>Bạn bè: <span class="text-white font-bold">{{ lastSubmittedOrder.friendName }}</span></p>
              <p>SĐT bạn bè: <span class="text-white font-bold">{{ lastSubmittedOrder.friendPhone }}</span></p>
              <p>Thời gian gửi: <span class="text-white font-bold">{{ formatDate(lastSubmittedOrder.createdAt) }}</span></p>
            </div>
          </div>

          <div class="space-y-2.5">
            <button @click="openFanpage" class="w-full bg-[#1877F2] hover:bg-blue-600 text-white py-3.5 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
              NHẮN FANPAGE
            </button>
            <button @click="closeSuccessAndShowHistory" class="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
              XEM LỊCH SỬ
            </button>
            <button @click="showSuccessModal = false" class="w-full text-slate-500 py-2 text-[10px] tracking-widest hover:text-white transition-colors">
              ĐÓNG
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- POPUP LỊCH SỬ ĐƠN LPBANK -->
    <Transition name="fade">
      <div v-if="showHistoryModal" class="fixed inset-0 z-[5500] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="showHistoryModal = false"></div>
        <div class="relative bg-[#111726] border border-slate-800 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg text-white tracking-tight">📜 LỊCH SỬ ĐƠN LPBANK PLUS</h2>
            <button @click="showHistoryModal = false" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div v-if="!lpbankHistory.length" class="text-center py-12">
            <div class="text-4xl mb-3">📭</div>
            <p class="text-slate-600 text-[10px] tracking-[3px]">CHƯA CÓ ĐƠN NÀO</p>
          </div>

          <div v-else class="space-y-3 text-left">
            <div v-for="rp in lpbankHistory" :key="rp.id" class="bg-[#0d121f] border rounded-2xl p-4"
                 :class="rp.status === 'rejected' ? 'border-rose-500/30' : rp.status === 'pending' ? 'border-yellow-500/20' : 'border-emerald-500/20'">
              <div class="flex justify-between items-start gap-3 mb-2">
                <div class="font-sans not-italic normal-case min-w-0">
                  <p class="text-white text-[12px] font-bold truncate">{{ rp.friendName }}</p>
                  <p class="text-slate-500 text-[10px]">SĐT: {{ rp.friendPhone }}</p>
                  <p class="text-slate-600 text-[9px] mt-1 truncate">Mã đơn: {{ rp.referralOrderCode }}</p>
                  <p class="text-slate-600 text-[9px]">{{ formatDate(rp.createdAt) }}</p>
                  <p v-if="rp.referralSuccessNumber" class="text-amber-400 text-[9px] font-bold mt-1">Lần giới thiệu #{{ rp.referralSuccessNumber }}</p>
                </div>
                <span class="shrink-0 text-[9px] px-2 py-1 rounded-full font-sans not-italic normal-case"
                      :class="rp.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : rp.status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'">
                  {{ rp.status === 'pending' ? 'CHỜ PHÊ DUYỆT' : rp.status === 'rejected' ? 'BỊ TỪ CHỐI' : `ĐÃ CỘNG ${(rp.actualReward || rp.reward || 0).toLocaleString()} XU` }}
                </span>
              </div>
              <p v-if="rp.status === 'rejected' && rp.note" class="text-rose-400 text-[10px] font-sans not-italic normal-case mt-1 leading-relaxed">Lý do: {{ rp.note }}</p>
              <div v-if="rp.proofImages?.length" class="flex gap-2 mt-2">
                <div v-for="(img, idx) in rp.proofImages" :key="idx" @click="openImage(img.url)" class="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 cursor-zoom-in shrink-0">
                  <img class="w-full h-full object-cover" :src="img.url" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

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
