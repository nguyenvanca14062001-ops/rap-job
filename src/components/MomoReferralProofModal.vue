<script setup lang="ts">
import { ref, computed } from 'vue'
import { auth, db, storage } from '@/firebase'
import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { compressImage, MAX_UPLOAD_BYTES, perfMark, perfLog } from '@/utils/imageCompress'
import { normalizePhone } from '@/utils/phone'
import { VIP_JOB_IDS } from '@/utils/vipJobs'
import { MOMO_REFERRAL_JOB_ID, MOMO_REFERRAL_REWARD } from '@/utils/referralMomo'

const props = defineProps<{ show: boolean; vipJobs?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'submitted', payload: { friendName: string; friendPhone: string; orderCode: string; createdAt: Date }): void }>()

const baseUrl = import.meta.env.BASE_URL

// Đọc reward thật từ Firestore vip_jobs (doc referral_momo) — khớp với số Admin cấu hình, không
// còn hard-code MOMO_REFERRAL_REWARD cố định khi lưu report.
const momoRewardAmount = computed(() => {
  const cfg = (props.vipJobs || []).find((v: any) => (v.jobId || v.id) === MOMO_REFERRAL_JOB_ID)
  const digits = String(cfg?.reward || '').replace(/\D/g, '')
  return digits ? Number(digits) : MOMO_REFERRAL_REWARD
})

// Ảnh mẫu lấy nguyên từ job VÍ MOMO gốc (SubmitReportView.vue -> jobSamples['momo']) — cùng bộ ảnh, không tạo mẫu mới
const SAMPLE_IMAGES = ['images/anh-momo-2.jpg', 'images/anh-momo-6.jpg', 'images/anh-momo-7.jpg']
const MIN_IMAGES = 3
const MAX_IMAGES = 5

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const friendName = ref('')
const friendPhone = ref('')
const images = ref<string[]>([])
const imageBlobs = ref<Blob[]>([])
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const isSubmitting = ref(false)
const submitStage = ref<'idle' | 'uploading' | 'saving'>('idle')
const uploadedCount = ref(0)

const resetForm = () => {
  friendName.value = ''
  friendPhone.value = ''
  images.value = []
  imageBlobs.value = []
  imageError.value = ''
}

const handleClose = () => { if (!isSubmitting.value) { resetForm(); emit('close') } }
const triggerFileInput = () => { if (images.value.length < MAX_IMAGES) fileInput.value?.click() }

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  const files = Array.from(target.files)

  if (images.value.length + files.length > MAX_IMAGES) {
    imageError.value = `Chỉ được chọn tối đa ${MAX_IMAGES} ảnh bằng chứng.`
    target.value = ''
    return
  }
  imageError.value = ''

  const tBatchStart = perfMark()
  // Nén song song (Promise.all) thay vì tuần tự — các ảnh độc lập nhau nên xử lý đồng thời.
  const results = await Promise.all(files.map(async (file) => {
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      alert(`⚠️ LỖI ĐỊNH DẠNG: Bức ảnh "${file.name}" là ảnh HEIC của iPhone nên hệ thống không nhận diện được. Vui lòng CHỤP MÀN HÌNH lại bức ảnh đó rồi tải lên!`)
      return null
    }
    if (!file.type.startsWith('image/')) return null
    try {
      const compressed = await compressImage(file)
      if (compressed.blob.size > MAX_UPLOAD_BYTES) {
        alert('⚠️ Ảnh quá lớn, vui lòng chọn ảnh khác hoặc chụp lại rõ hơn.')
        return null
      }
      return compressed
    } catch (err: any) {
      alert('⚠️ LỖI XỬ LÝ ẢNH: ' + (err?.message || 'Vui lòng thử ảnh khác.'))
      return null
    }
  }))
  perfLog(`Tổng nén ${files.length} ảnh vừa chọn (D)`, tBatchStart)

  for (const compressed of results) {
    if (!compressed) continue
    images.value.push(compressed.dataUrl)
    imageBlobs.value.push(compressed.blob)
  }
  target.value = ''
}

const removeImage = (index: number) => {
  images.value.splice(index, 1)
  imageBlobs.value.splice(index, 1)
  imageError.value = ''
}

const submitReferral = async () => {
  const uid = auth.currentUser?.uid
  if (!uid || isSubmitting.value) return
  const name = friendName.value.trim()
  const phone = friendPhone.value.trim()

  if (!name) { alert('⚠️ VUI LÒNG NHẬP TÊN NGƯỜI BẠN ĐÃ GIỚI THIỆU!'); return }
  if (!phone || normalizePhone(phone).length < 9) { alert('⚠️ VUI LÒNG NHẬP ĐÚNG SỐ ĐIỆN THOẠI NGƯỜI BẠN ĐÃ GIỚI THIỆU!'); return }
  if (imageBlobs.value.length < MIN_IMAGES) {
    imageError.value = `Chiến dịch này bắt buộc phải tải lên ít nhất ${MIN_IMAGES} ảnh mẫu để đối soát!`
    return
  }

  isSubmitting.value = true
  const tSubmitStart = perfMark()
  try {
    // Giới hạn tối đa 3 đơn VIP đang chờ duyệt cùng lúc — áp dụng chung cho mọi job VIP/referral
    const pendingSnap = await getDocs(query(collection(db, 'reports'), where('uid', '==', uid), where('status', '==', 'pending')))
    const pendingVipCount = pendingSnap.docs.filter(d => VIP_JOB_IDS.includes(d.data().jobId)).length
    if (pendingVipCount >= 3) {
      alert('⚠️ Bạn đang có 3 đơn VIP chờ duyệt. Vui lòng chờ admin xử lý trước khi gửi thêm đơn mới.')
      isSubmitting.value = false
      return
    }

    const userSnap = await getDoc(doc(db, 'users', uid))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}

    const reportRef = doc(collection(db, 'reports'))
    const reportId = reportRef.id

    submitStage.value = 'uploading'
    uploadedCount.value = 0
    let proofImages: { url: string; path: string }[] = []
    const tUploadStart = perfMark()
    try {
      // Upload + getDownloadURL của tất cả ảnh chạy song song, không chờ tuần tự từng ảnh.
      proofImages = await Promise.all(imageBlobs.value.map(async (blob, index) => {
        const path = `proofs/${uid}/${reportId}/image_${index}.jpg`
        const imgRef = storageRef(storage, path)
        const tImg = perfMark()
        await uploadBytes(imgRef, blob, { contentType: 'image/jpeg' })
        const url = await getDownloadURL(imgRef)
        perfLog(`Upload ảnh ${index + 1}/${imageBlobs.value.length} (uploadBytes+getDownloadURL)`, tImg)
        uploadedCount.value++
        return { url, path: imgRef.fullPath }
      }))
    } catch (uploadError: any) {
      alert('❌ LỖI TẢI ẢNH LÊN: ' + (uploadError?.message || 'Vui lòng thử lại.'))
      isSubmitting.value = false
      submitStage.value = 'idle'
      return
    }
    perfLog(`Tổng upload ${imageBlobs.value.length} ảnh (E+F+G)`, tUploadStart)

    submitStage.value = 'saving'

    const orderCode = `${name} - ${phone}`
    const phoneRef = userDoc.phoneRef || userDoc.phone || ''

    const reportData = {
      uid,
      username: userDoc.username || userDoc.fullName || '',
      fullName: userDoc.fullName || '',
      phoneRef,
      phoneNormalized: normalizePhone(phoneRef),

      jobId: MOMO_REFERRAL_JOB_ID,
      jobName: 'Giới thiệu bạn bè đăng ký APP VÍ MOMO',
      title: 'GIỚI THIỆU BẠN BÈ',
      type: 'friend_referral',

      category: 'vip',
      jobCategory: 'vip',
      jobType: 'vip',
      isVip: true,

      bankType: 'momo',
      referralProgram: 'momo',

      friendName: name,
      friendPhone: phone,
      friendPhoneNormalized: normalizePhone(phone),
      referralOrderCode: orderCode,

      reward: momoRewardAmount.value,
      actualReward: 0,

      proofImages,
      imageCount: proofImages.length,

      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    const tSave = perfMark()
    await setDoc(reportRef, reportData)
    perfLog('Tạo report Firestore (H)', tSave)

    const createdAt = new Date()
    resetForm()
    emit('submitted', { friendName: name, friendPhone: phone, orderCode, createdAt })
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + error.message)
  } finally {
    perfLog('TỔNG THỜI GIAN TỪ LÚC BẤM GỬI (I)', tSubmitStart)
    isSubmitting.value = false
    submitStage.value = 'idle'
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5400] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="handleClose"></div>
      <div class="relative bg-[#111726] border border-amber-500/30 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto font-black italic uppercase text-left">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg md:text-xl text-white tracking-tight">📥 GỬI BẰNG CHỨNG GIỚI THIỆU MOMO</h2>
          <button @click="handleClose" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="space-y-5">
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
              <label class="text-amber-400 text-[11px] tracking-widest">ẢNH BẰNG CHỨNG * (TỐI ĐA {{ MAX_IMAGES }} ẢNH)</label>
              <span :class="['text-[10px] font-sans not-italic font-bold', images.length >= MIN_IMAGES ? 'text-emerald-400' : 'text-slate-500']">
                ĐÃ CHỌN {{ images.length }}/{{ MAX_IMAGES }} ẢNH
              </span>
            </div>
            <div @click="triggerFileInput"
                 class="w-full border-2 border-dashed border-slate-700/60 hover:border-amber-500/50 bg-[#0d121f]/30 rounded-[28px] py-10 px-6 flex flex-col items-center justify-center transition-all"
                 :class="images.length < MAX_IMAGES ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'">
              <div class="text-3xl mb-2">📸</div>
              <p class="text-[10px] md:text-[11px] text-rose-400 tracking-widest uppercase text-center leading-relaxed">
                YÊU CẦU BẮT BUỘC NỘP TỪ {{ MIN_IMAGES }} ẢNH TRỞ LÊN (XEM MẪU BÊN DƯỚI)
              </p>
            </div>
            <input type="file" ref="fileInput" @change="handleFileUpload" multiple accept="image/jpeg, image/png, image/jpg" class="hidden" />
            <p v-if="imageError" class="text-rose-400 text-[11px] font-sans not-italic font-bold normal-case leading-relaxed">⚠️ {{ imageError }}</p>

            <div class="mt-1 p-4 bg-[#0d121f] border border-slate-800/80 rounded-2xl shadow-inner">
              <p class="text-[10px] md:text-[11px] text-yellow-400 font-black tracking-widest mb-3 uppercase italic leading-relaxed">
                ⚠️ Bạn phải gửi đủ {{ SAMPLE_IMAGES.length }} ảnh mẫu này (chạm để zoom to):
              </p>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="(img, idx) in SAMPLE_IMAGES" :key="idx" @click="openImage(baseUrl + img)"
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
            {{ submitStage === 'uploading' ? `ĐANG TẢI ẢNH ${uploadedCount}/${imageBlobs.length}...` : submitStage === 'saving' ? 'ĐANG GỬI BẰNG CHỨNG...' : isSubmitting ? 'ĐANG XỬ LÝ...' : 'GỬI BẰNG CHỨNG 📥' }}
          </button>
        </div>
      </div>

      <div v-if="selectedImage" class="fixed inset-0 z-[5700] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="closeImage">
        <button class="absolute top-6 right-6 w-11 h-11 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[5710]" @click.stop="closeImage">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain cursor-default" :src="selectedImage" @click.stop />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
