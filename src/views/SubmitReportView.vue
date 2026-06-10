<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from "firebase/auth"
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import Swal from 'sweetalert2'
import exifr from 'exifr'

const router = useRouter()
const route = useRoute()
const isLoggedIn = ref(false)
const userUid = ref('')
const isLoading = ref(false)
const showSuccessModal = ref(false)
const baseUrl = import.meta.env.BASE_URL

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const jobOptions = [
  { id: 'follow-cgv',     name: 'FOLLOW FANPAGE RẠP PHIM (20.000 XU)',             reward: '20.000 xu' },
  { id: 'review-cinema',  name: 'ĐÁNH GIÁ 5 SAO RẠP PHIM (25.000 XU)',             reward: '25.000 xu' },
  { id: 'checkin-cinema', name: 'CHECK-IN TẠI RẠP + ĐĂNG MXH (30.000 XU)',         reward: '30.000 xu' },
  { id: 'survey-cinema',  name: 'KHẢO SÁT THÓI QUEN XEM PHIM (20.000 XU)',         reward: '20.000 xu' },
  { id: 'post-threads',   name: 'ĐĂNG BÀI THREADS (25.000 XU)',                    reward: '25.000 xu' },
  { id: 'join-zalo',      name: 'THAM GIA NHÓM ZALO (10.000 XU)',                  reward: '10.000 xu' },
  { id: 'app-chung-khoan',   name: 'APP CHỨNG KHOÁN SỐ 1 (85.000 XU)',            reward: '85.000 xu' },
  { id: 'app-chung-khoan-2', name: 'APP CHỨNG KHOÁN SỐ 2 (85.000 XU)',            reward: '85.000 xu' },
  { id: 'app-chung-khoan-3', name: 'APP CHỨNG KHOÁN SỐ 3 (85.000 XU)',            reward: '85.000 xu' },
  { id: 'app-chung-khoan-4', name: 'APP CHỨNG KHOÁN SỐ 4 (85.000 XU)',            reward: '85.000 xu' },
  { id: 'msb-bank',       name: 'ĐĂNG KÝ NGÂN HÀNG MSB (100.000 XU)',             reward: '100.000 xu' },
  { id: 'vpbank',         name: 'ĐĂNG KÝ NGÂN HÀNG VPBANK (100.000 XU)',          reward: '100.000 xu' },
  { id: 'liobank',       name: 'ĐĂNG KÝ NGÂN HÀNG LIOBANK (50.000 XU)',          reward: '50.000 xu' }
]

const jobSamples: Record<string, string[]> = {
  'app-chung-khoan-4': ['images/anh-maybank2.jpg', 'images/anh-maybank3.jpg', 'images/anh-maybank4.jpg'],
  'vpbank': ['images/anh-vpbank2.jpg', 'images/anh-vpbank3.jpg', 'images/anh-vpbank6.jpg'],
  'msb-bank': ['images/anh-msb2.jpg', 'images/anh-msb3.jpg', 'images/anh-msb10.jpg'],
  'app-chung-khoan': ['images/anh-kafi2.jpg', 'images/anh-kafi3.jpg', 'images/anh-kafi10.jpg'],
  'app-chung-khoan-2': ['images/anh-dnse2.jpg', 'images/anh-dnse3.jpg', 'images/anh-dnse10.jpg'],
  'app-chung-khoan-3': ['images/anh-kis1.jpg', 'images/anh-kis2.jpg', 'images/anh-kis10.jpg'],
  'liobank': ['images/anh-liobank3a.jpg', 'images/anh-liobank3b.jpg', 'images/anh-liobank4.jpg']
}

const selectedJob = ref(jobOptions[0])
const fullName = ref('')
const phoneNumber = ref('')
const birthYear = ref('')
const birthMonth = ref('')
const exifData = ref<any>({ hasExif: false, suspicious: false })
const images = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  const jobIdFromQuery = route.query.job as string
  if (jobIdFromQuery) {
    const foundJob = jobOptions.find(j => j.id === jobIdFromQuery)
    if (foundJob) selectedJob.value = foundJob
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      isLoggedIn.value = true
      userUid.value = user.uid
    } else {
      router.push('/login')
    }
  })
})

watch(() => route.query.job, (newJobId) => {
  if (newJobId) {
    const foundJob = jobOptions.find(j => j.id === newJobId as string)
    if (foundJob) selectedJob.value = foundJob
  }
})

const isFanpageTask = computed(() =>
  ['vpbank', 'msb-bank', 'app-chung-khoan', 'app-chung-khoan-2', 'app-chung-khoan-3', 'app-chung-khoan-4', 'liobank'].includes(selectedJob.value.id)
)

const fourImageJobs: string[] = []
const threeImageJobs = ['vpbank', 'msb-bank', 'app-chung-khoan', 'app-chung-khoan-2', 'app-chung-khoan-3', 'app-chung-khoan-4', 'liobank']

const imageRequirementText = computed(() => {
  const jobId = selectedJob.value.id
  if (fourImageJobs.includes(jobId)) return "YÊU CẦU BẮT BUỘC NỘP TỪ 4 ẢNH TRỞ LÊN (XEM MẪU BÊN DƯỚI)"
  if (threeImageJobs.includes(jobId)) return "YÊU CẦU BẮT BUỘC NỘP TỪ 3 ẢNH TRỞ LÊN (XEM MẪU BÊN DƯỚI)"
  return "TẢI LÊN ẢNH CHỤP MÀN HÌNH BẰNG CHỨNG XÁC THỰC"
})

const triggerFileInput = () => { fileInput.value?.click() }

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        let width = img.width
        let height = img.height
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width)
          width = MAX_WIDTH
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.6))
        } else {
          resolve(e.target?.result as string)
        }
      }
      img.onerror = () => { resolve(e.target?.result as string) }
    }
  })
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  const files = Array.from(target.files)

  if (images.value.length + files.length > 5) {
    alert('⚠️ CHỈ ĐƯỢC UPLOAD TỐI ĐA 5 ẢNH!')
    return
  }

  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      alert(`⚠️ LỖI ĐỊNH DẠNG: Bức ảnh "${file.name}" là ảnh HEIC của iPhone nên hệ thống không nhận diện được. Vui lòng CHỤP MÀN HÌNH lại bức ảnh đó rồi tải lên!`)
      continue
    }
    if (!file.type.startsWith('image/')) continue
    const compressedImage = await compressImage(file)
    if (images.value.length === 0) await readExif(file)
    images.value.push(compressedImage)
  }
  target.value = ''
}

const removeImage = (index: number) => { images.value.splice(index, 1) }

const readExif = async (file: File) => {
  try {
    const out = await exifr.parse(file, { pick: ['Make','Model','DateTimeOriginal','Software'] })
    if (!out) return
    const sw = out.Software || null
    exifData.value = {
      hasExif: true,
      device: [out.Make, out.Model].filter(Boolean).join(' ') || null,
      dateTaken: out.DateTimeOriginal ? String(out.DateTimeOriginal) : null,
      software: sw,
      suspicious: sw ? ['photoshop','gimp','lightroom','snapseed','picsart','ai','editor'].some(k => sw.toLowerCase().includes(k)) : false
    }
  } catch { exifData.value = { hasExif: false, suspicious: false } }
}

const submitReport = async () => {
  if (!fullName.value || !phoneNumber.value || !birthYear.value || !birthMonth.value || images.value.length === 0) {
    alert('⚠️ VUI LÒNG NHẬP ĐỦ THÔNG TIN VÀ TẢI ẢNH XÁC THỰC!')
    return
  }

  if (birthYear.value.toString().length !== 4) {
    alert('⚠️ VUI LÒNG NHẬP ĐÚNG NĂM SINH 4 SỐ (VD: 2000)!')
    return
  }

  if (fourImageJobs.includes(selectedJob.value.id) && images.value.length < 4) {
    alert('⚠️ CHIẾN DỊCH NGÂN HÀNG TPBANK BẮT BUỘC PHẢI TẢI LÊN ÍT NHẤT 4 ẢNH MẪU!')
    return
  }

  if (threeImageJobs.includes(selectedJob.value.id) && images.value.length < 3) {
    alert('⚠️ CHIẾN DỊCH NÀY BẮT BUỘC PHẢI TẢI LÊN ÍT NHẤT 3 ẢNH MẪU ĐỂ ĐỐI SOÁT!')
    return
  }

  isLoading.value = true
  try {
    // Chặn spam: tối đa 3 đơn pending cùng lúc
    const qSpam = query(
      collection(db, "reports"),
      where("uid", "==", userUid.value),
      where("status", "==", "pending")
    )
    const snapshotSpam = await getDocs(qSpam)
    if (snapshotSpam.docs.length >= 3) {
      alert("⚠️ HỆ THỐNG TẠM KHÓA: Bạn đang có 3 đơn chờ duyệt. Vui lòng chờ Admin xử lý trước khi gửi thêm!")
      isLoading.value = false
      return
    }

    // Chặn làm lại: các job tương tác chỉ được làm 1 lần duy nhất
    const oneTimeJobs = ['follow-cgv', 'review-cinema', 'checkin-cinema', 'survey-cinema', 'post-threads', 'join-zalo']

    if (oneTimeJobs.includes(selectedJob.value.id)) {
      // Query theo jobId (report mới) VÀ jobName (report cũ có thể không có jobId)
      const [snapById, snapByName] = await Promise.all([
        getDocs(query(collection(db, "reports"), where("uid", "==", userUid.value), where("jobId", "==", selectedJob.value.id))),
        getDocs(query(collection(db, "reports"), where("uid", "==", userUid.value), where("jobName", "==", selectedJob.value.name)))
      ])

      // Gộp 2 kết quả, loại trùng theo doc.id
      const seenIds = new Set<string>()
      const allDocs = [...snapById.docs, ...snapByName.docs].filter(doc => {
        if (seenIds.has(doc.id)) return false
        seenIds.add(doc.id)
        return true
      })

      const isPending  = allDocs.some(doc => doc.data().status === 'pending')
      const isDone     = allDocs.some(doc => ['approved', 'collected'].includes(doc.data().status))

      if (isDone) {
        Swal.fire({
          icon: 'error',
          title: 'ĐÃ NHẬN THƯỞNG!',
          text: 'Mỗi tài khoản chỉ được phép làm công việc này 1 lần duy nhất! Đơn của bạn đã hoàn thành trước đó.',
          confirmButtonColor: '#3b82f6'
        })
        isLoading.value = false
        return
      }

      if (isPending) {
        Swal.fire({
          icon: 'warning',
          title: 'ĐANG CHỜ DUYỆT!',
          text: `Bạn đang có 1 đơn "${selectedJob.value.name.split(' (')[0]}" chờ duyệt rồi. Không thể nộp thêm!`,
          confirmButtonColor: '#f59e0b'
        })
        isLoading.value = false
        return
      }
    }

    await addDoc(collection(db, "reports"), {
      uid: userUid.value,
      jobId: selectedJob.value.id,
      jobName: selectedJob.value.name,
      reward: selectedJob.value.reward,
      fullName: fullName.value.toUpperCase(),
      phoneRef: phoneNumber.value,
      birthYear: birthYear.value,
      birthMonth: birthMonth.value,
      exif: exifData.value,
      images: images.value,
      status: 'pending',
      createdAt: serverTimestamp()
    })

    showSuccessModal.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + error.message)
  } finally {
    isLoading.value = false
  }
}

const closeAndGoHome = () => {
  showSuccessModal.value = false
  router.push('/')
}

const openFanpage = () => {
  window.open('https://www.facebook.com/vieclamrapjob', '_blank')
  closeAndGoHome()
}
</script>

<template>
  <div class="min-h-screen bg-transparent py-10 px-4 md:px-0 flex flex-col items-center font-black italic uppercase relative text-left">

    <!-- ZOOM ẢNH -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" v-if="selectedImage" @click="closeImage">
        <button class="absolute top-6 right-6 md:top-10 md:right-10 w-12 h-12 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors z-[6010] shadow-2xl" @click.stop="closeImage">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-[6005] cursor-default" :src="selectedImage" @click.stop />
      </div>
    </Transition>

    <div class="w-full max-w-xl relative animate-in fade-in slide-in-from-bottom-4 duration-700">
      <button @click="router.back()" class="text-slate-500 hover:text-white flex items-center gap-2 text-[10px] md:text-xs tracking-[3px] transition-colors mb-8">
        <span class="font-sans not-italic">✕</span> TRỞ LẠI
      </button>

      <h1 class="text-4xl md:text-6xl text-white tracking-tighter leading-none mb-10 drop-shadow-xl">
        NỘP <span class="text-blue-500">BẰNG CHỨNG</span>
      </h1>

      <div class="space-y-6 bg-[#111726]/50 p-6 md:p-10 rounded-[30px] border border-slate-800/50 shadow-2xl">

        <div class="space-y-2 text-left relative z-10">
          <label class="text-blue-400 text-[11px] tracking-widest ml-1 font-black">CÔNG VIỆC HOÀN THÀNH</label>
          <div class="relative">
            <select
              v-model="selectedJob"
              :disabled="!!route.query.job"
              :class="['w-full bg-[#0d121f] border rounded-[20px] py-4 px-5 text-white outline-none appearance-none font-sans font-bold text-[14px] md:text-[15px] not-italic transition-all', !!route.query.job ? 'border-slate-700/80 text-emerald-400 bg-[#0d121f]/80 cursor-not-allowed shadow-inner' : 'border-slate-800 focus:border-blue-500 cursor-pointer']"
            >
              <option v-for="job in jobOptions" :key="job.id" :value="job">{{ job.name }}</option>
            </select>
            <span v-if="!route.query.job" class="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs font-sans not-italic">⌄</span>
            <span v-else class="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 text-lg font-sans not-italic font-black">✓</span>
          </div>
        </div>

        <div class="space-y-2 text-left mt-4">
          <label class="text-blue-400 text-[11px] tracking-widest ml-1 font-black">HỌ VÀ TÊN XÁC THỰC</label>
          <input
            v-model="fullName"
            type="text"
            placeholder="Nhập họ tên chính xác của bạn..."
            class="w-full bg-[#0d121f] border border-slate-800 focus:border-blue-500 rounded-[20px] py-4 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[15px] shadow-inner transition-colors"
          />
        </div>

        <div class="space-y-2 text-left">
          <label class="text-blue-400 text-[11px] tracking-widest ml-1 font-black">{{ selectedJob.id === 'app-chung-khoan-4' ? 'SĐT CỦA NGƯỜI ĐĂNG KÝ APP' : 'SĐT ĐỐI SOÁT' }}</label>
          <input
            v-model="phoneNumber"
            type="text"
            placeholder="Số điện thoại đăng ký / làm việc..."
            class="w-full bg-[#0d121f] border border-slate-800 focus:border-blue-500 rounded-[20px] py-4 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[15px] shadow-inner transition-colors"
          />
        </div>

        <div class="space-y-2 text-left">
          <label class="text-blue-400 text-[11px] tracking-widest ml-1 font-black">NĂM SINH NGƯỜI ĐĂNG KÝ</label>
          <input
            v-model="birthYear"
            type="number"
            placeholder="Năm (VD: 2000)"
            class="w-full bg-[#0d121f] border border-slate-800 focus:border-blue-500 rounded-[20px] py-4 px-5 text-white outline-none placeholder:text-slate-500 placeholder:normal-case font-sans not-italic font-semibold text-[15px] shadow-inner transition-colors"
            @input="birthYear = birthYear ? String(birthYear).slice(0,4) : ''"
          />
        </div>

        <div class="space-y-2 text-left">
          <label class="text-blue-400 text-[11px] tracking-widest ml-1 font-black">THÁNG SINH</label>
          <select
            v-model="birthMonth"
            class="w-1/2 bg-[#0d121f] border border-slate-800 focus:border-blue-500 rounded-[20px] py-3 px-5 text-white outline-none font-sans not-italic font-semibold text-[13px] shadow-inner transition-colors appearance-none"
          >
            <option value="" disabled>Tháng...</option>
            <option v-for="m in 12" :key="m" :value="String(m)">Tháng {{ m }}</option>
          </select>
        </div>

        <div class="space-y-2 text-left mt-2">
          <label class="text-blue-400 text-[11px] tracking-widest ml-1 font-black">HÌNH ẢNH XÁC THỰC VÀ ĐỐI CHIẾU MẪU</label>
          <div
            @click="triggerFileInput"
            class="w-full border-2 border-dashed border-slate-700/60 hover:border-blue-500/50 bg-[#0d121f]/30 rounded-[30px] py-12 px-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
          >
            <div class="text-4xl group-hover:scale-110 transition-transform mb-3">📸</div>
            <p :class="[
                 'text-[11px] md:text-[12px] tracking-widest transition-colors uppercase text-center leading-relaxed font-black',
                 fourImageJobs.includes(selectedJob.id) || threeImageJobs.includes(selectedJob.id)
                   ? 'text-rose-400'
                   : 'text-slate-400 group-hover:text-white'
               ]">
              {{ imageRequirementText }}
            </p>
          </div>
          <input type="file" ref="fileInput" @change="handleFileUpload" multiple accept="image/jpeg, image/png, image/jpg" class="hidden" />

          <div v-if="jobSamples[selectedJob.id]" class="mt-4 p-4 bg-[#0d121f] border border-slate-800/80 rounded-2xl shadow-inner">
            <p class="text-[10px] md:text-[11px] text-yellow-400 font-black tracking-widest mb-3 uppercase italic leading-relaxed">
              ⚠️ Bạn phải gửi đủ {{ jobSamples[selectedJob.id].length }} ảnh mẫu này (Chạm để zoom to):
            </p>
            <div :class="['grid gap-2', jobSamples[selectedJob.id].length >= 4 ? 'grid-cols-4' : 'grid-cols-3']">
              <div v-for="(img, idx) in jobSamples[selectedJob.id]" :key="idx"
                   @click="openImage(baseUrl + img)"
                   class="relative rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 aspect-[3/4] cursor-zoom-in group hover:border-blue-500 transition-colors">
                <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" :src="baseUrl + img" />
                <div class="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">MẪU {{ idx + 1 }}</div>
              </div>
            </div>
          </div>

          <div v-if="images.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div v-for="(img, index) in images" :key="index"
                 @click="openImage(img)"
                 class="relative group rounded-[18px] overflow-hidden border border-slate-800 bg-[#0d121f] aspect-square cursor-zoom-in">
              <img class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity bg-white" :src="img" />
              <button class="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] font-sans not-italic z-10 shadow-lg" @click.stop="removeImage(index)">✕</button>
            </div>
          </div>
        </div>

        <button
          @click="submitReport"
          :disabled="isLoading"
          class="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[20px] text-xl font-black italic shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all active:scale-95 disabled:opacity-50"
        >
          {{ isLoading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN GỬI ĐƠN' }}
        </button>

      </div>
    </div>

    <!-- POPUP THÀNH CÔNG -->
    <Transition name="fade">
      <div class="fixed inset-0 z-[1000] flex items-center justify-center p-4 backdrop-blur-md" v-if="showSuccessModal">
        <div class="absolute inset-0 bg-black/80"></div>
        <div class="relative bg-[#111726] border border-blue-500/30 w-full max-w-sm rounded-[40px] p-8 text-center shadow-[0_0_50px_rgba(37,99,235,0.2)] animate-in zoom-in duration-300">
          <div class="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <span class="text-4xl">✅</span>
          </div>
          <h2 class="text-2xl text-white font-black italic tracking-tighter mb-2 uppercase">Gửi đơn thành công!</h2>

          <div v-if="isFanpageTask">
            <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-6 italic uppercase">
              Bằng chứng đã được ghi nhận.<br/>
              Vui lòng <span class="text-[#1877F2] font-black">Nhắn tin Fanpage</span> để Admin duyệt đơn ngay nhé!
            </p>
            <button class="w-full bg-[#1877F2] flex items-center justify-center gap-2 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-[2px] hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-900/40 mb-3" @click="openFanpage">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              NHẮN TIN FANPAGE
            </button>
            <button class="w-full bg-transparent text-slate-500 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[2px] hover:text-white transition-all" @click="closeAndGoHome">
              ĐỂ SAU
            </button>
          </div>

          <div v-else>
            <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-8 italic uppercase">
              Hệ thống đã nhận được bằng chứng.<br/>
              Đợi khoảng <span class="text-blue-500 font-black">1 giờ</span> để Admin xét duyệt và cộng tiền nhé!
            </p>
            <button class="w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-[2px] hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/40" @click="closeAndGoHome">
              ĐÃ HIỂU
            </button>
          </div>

        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

select {
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 1.5rem center;
  background-size: 0.8rem;
}
select:disabled { background-image: none; }

input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
