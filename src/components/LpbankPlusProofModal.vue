<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { auth, db, storage } from '@/firebase'
import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { compressImage, MAX_UPLOAD_BYTES } from '@/utils/imageCompress'
import { normalizePhone } from '@/utils/phone'
import { VIP_JOB_IDS } from '@/utils/vipJobs'
import { jobsData } from '@/data/jobs'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'submitted'): void }>()

const baseUrl = import.meta.env.BASE_URL
const job = jobsData['lpbank-plus']
const SAMPLE_IMAGES = job.proofSampleImages as string[]
const REQUIRED_IMAGES = 3

const JOB_ID = 'lpbank-plus'

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const username = ref('')
const fullName = ref('')
const phoneRef = ref('')
const images = ref<string[]>([])
const imageBlobs = ref<Blob[]>([])
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const isSubmitting = ref(false)
const submitStage = ref<'idle' | 'uploading' | 'saving'>('idle')

const loadProfile = async () => {
  const uid = auth.currentUser?.uid
  if (!uid) return
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (!userSnap.exists()) return
  const userDoc: any = userSnap.data()
  username.value = userDoc.username || ''
  if (!fullName.value) fullName.value = userDoc.fullName || ''
  if (!phoneRef.value) phoneRef.value = userDoc.phoneRef || userDoc.phone || ''
}

onMounted(loadProfile)
watch(() => props.show, (v) => { if (v) loadProfile() })

const resetForm = () => {
  fullName.value = ''
  phoneRef.value = ''
  images.value = []
  imageBlobs.value = []
  imageError.value = ''
}

const handleClose = () => { if (!isSubmitting.value) { resetForm(); emit('close') } }
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

const submitProof = async () => {
  const uid = auth.currentUser?.uid
  if (!uid || isSubmitting.value) return
  const name = fullName.value.trim()
  const phone = phoneRef.value.trim()

  if (!name) { alert('⚠️ VUI LÒNG NHẬP HỌ VÀ TÊN XÁC THỰC!'); return }
  if (!phone || normalizePhone(phone).length < 9) { alert('⚠️ VUI LÒNG NHẬP ĐÚNG SỐ ĐIỆN THOẠI ĐỐI SOÁT!'); return }
  if (imageBlobs.value.length !== REQUIRED_IMAGES) {
    imageError.value = `Vui lòng gửi đúng ${REQUIRED_IMAGES} ảnh bằng chứng theo mẫu bên dưới. Thiếu ảnh hoặc gửi sai ảnh có thể bị từ chối.`
    return
  }

  isSubmitting.value = true
  try {
    const pendingSnap = await getDocs(query(collection(db, 'reports'), where('uid', '==', uid), where('status', '==', 'pending')))
    const pendingVipCount = pendingSnap.docs.filter(d => VIP_JOB_IDS.includes(d.data().jobId)).length
    if (pendingVipCount >= 3) {
      alert('⚠️ Bạn đang có 3 đơn VIP chờ duyệt. Vui lòng chờ admin xử lý trước khi gửi thêm đơn mới.')
      isSubmitting.value = false
      return
    }

    const reportRef = doc(collection(db, 'reports'))
    const reportId = reportRef.id

    submitStage.value = 'uploading'
    let proofImages: { url: string; path: string }[] = []
    try {
      proofImages = await Promise.all(imageBlobs.value.map(async (blob, index) => {
        const path = `proofs/${uid}/${reportId}/image_${index}.jpg`
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

    submitStage.value = 'saving'

    const reportData = {
      uid,
      username: username.value,
      fullName: name,
      phoneRef: phone,
      phoneNormalized: normalizePhone(phone),

      jobId: JOB_ID,
      jobName: 'APP LPBANK PLUS',
      title: 'APP LPBANK PLUS',

      category: 'vip',
      jobCategory: 'vip',
      jobType: 'vip',
      isVip: true,
      bankType: 'lpbank',

      reward: 85000,
      actualReward: 0,

      proofImages,
      imageCount: proofImages.length,

      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await setDoc(reportRef, reportData)

    resetForm()
    emit('submitted')
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + error.message)
  } finally {
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
          <h2 class="text-lg md:text-xl text-white tracking-tight">📥 GỬI BẰNG CHỨNG LPBANK PLUS</h2>
          <button @click="handleClose" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="space-y-5">
          <div class="space-y-2" v-if="username">
            <label class="text-slate-500 text-[11px] tracking-widest ml-1">TÀI KHOẢN</label>
            <div class="w-full bg-[#0d121f]/60 border border-slate-800 rounded-2xl py-3.5 px-5 text-slate-400 font-sans not-italic font-semibold text-[14px]">{{ username }}</div>
          </div>

          <div class="space-y-2">
            <label class="text-amber-400 text-[11px] tracking-widest ml-1">HỌ VÀ TÊN XÁC THỰC *</label>
            <input v-model="fullName" type="text" placeholder="Nguyễn Văn A"
                   class="w-full bg-[#0d121f] border border-slate-800 focus:border-amber-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
          </div>
          <div class="space-y-2">
            <label class="text-amber-400 text-[11px] tracking-widest ml-1">SỐ ĐIỆN THOẠI ĐỐI SOÁT *</label>
            <input v-model="phoneRef" type="text" placeholder="VD: 0987654321"
                   class="w-full bg-[#0d121f] border border-slate-800 focus:border-amber-500 rounded-2xl py-3.5 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[14px] transition-colors" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between ml-1">
              <label class="text-amber-400 text-[11px] tracking-widest">ẢNH BẰNG CHỨNG * (ĐÚNG {{ REQUIRED_IMAGES }} ẢNH)</label>
              <span :class="['text-[10px] font-sans not-italic font-bold', images.length === REQUIRED_IMAGES ? 'text-emerald-400' : 'text-slate-500']">
                ĐÃ CHỌN {{ images.length }}/{{ REQUIRED_IMAGES }} ẢNH
              </span>
            </div>
            <div @click="triggerFileInput"
                 class="w-full border-2 border-dashed border-slate-700/60 hover:border-amber-500/50 bg-[#0d121f]/30 rounded-[28px] py-10 px-6 flex flex-col items-center justify-center transition-all"
                 :class="images.length < REQUIRED_IMAGES ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'">
              <div class="text-3xl mb-2">📸</div>
              <p class="text-[10px] md:text-[11px] text-rose-400 tracking-widest uppercase text-center leading-relaxed">
                VUI LÒNG GỬI ĐÚNG {{ REQUIRED_IMAGES }} ẢNH BẰNG CHỨNG THEO MẪU BÊN DƯỚI
              </p>
              <p class="text-[9px] md:text-[10px] text-slate-500 tracking-widest uppercase text-center leading-relaxed mt-1 normal-case">
                Thiếu ảnh hoặc gửi sai ảnh có thể bị từ chối.
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
                  <div class="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">ẢNH {{ idx + 1 }}</div>
                </div>
              </div>
            </div>

            <div v-if="images.length > 0" class="grid grid-cols-3 gap-3 mt-3">
              <div v-for="(img, index) in images" :key="index" class="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0d121f] aspect-square">
                <img class="w-full h-full object-cover bg-white" :src="img" />
                <button class="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] font-sans not-italic z-10 shadow-lg" @click.stop="removeImage(index)">✕</button>
              </div>
            </div>
          </div>

          <button @click="submitProof" :disabled="isSubmitting"
                  class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl text-[13px] md:text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50">
            {{ submitStage === 'uploading' ? 'ĐANG TẢI ẢNH LÊN...' : submitStage === 'saving' ? 'ĐANG GỬI BẰNG CHỨNG...' : isSubmitting ? 'ĐANG XỬ LÝ...' : 'GỬI BẰNG CHỨNG 📥' }}
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
