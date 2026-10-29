<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { auth, db, storage } from '@/firebase'
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { compressImage, MAX_UPLOAD_BYTES, perfMark, perfLog } from '@/utils/imageCompress'
import { getReportImages } from '@/utils/reportImages'
import { jobsData } from '@/data/jobs'
import { POSTER_DESIGN_JOB_ID } from '@/utils/posterDesign'

// Popup job "THIẾT KẾ POSTER / BANNER": chọn 1 trong 3 nghệ sĩ, làm theo hướng dẫn Canva rồi gửi 1 ảnh thiết kế.
// Gửi đơn như SubmitReportView (nén compressImage, Storage proofs/{uid}/{reportId}/, report 'pending', 1 lần/tài khoản)
// và KHÔNG cộng xu ở đây — Admin duyệt và cộng xu ở tab JOB KHÁC như các job cơ bản khác.
const props = defineProps<{ show: boolean; job?: any; myReports?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()

// job: bản đã merge cấu hình Admin (mergedJobs ở App.vue); thiếu thì dùng cấu hình tĩnh trong jobs.ts
const staticJob = jobsData[POSTER_DESIGN_JOB_ID]
const jobConfig = computed(() => props.job || staticJob)
const rewardAmount = computed(() => Number(String(jobConfig.value?.reward ?? '').replace(/\D/g, '')) || 0)
const rewardText = computed(() => `${rewardAmount.value.toLocaleString('vi-VN')} xu`)

type Artist = { id: string; icon: string; name: string }
const artists = computed<Artist[]>(() => jobConfig.value?.posterArtists || staticJob.posterArtists || [])
const steps = computed<any[]>(() => jobConfig.value?.steps || staticJob.steps || [])
const approvalRules = computed<string[]>(() => jobConfig.value?.approvalRules || staticJob.approvalRules || [])

const selectedArtistId = ref<string | null>(null)
const selectedArtist = computed(() => artists.value.find(a => a.id === selectedArtistId.value) || null)
// Card chủ đề hẹp trên mobile: dùng gạch nối không ngắt dòng để không bị tách "M-" / "TP"
const noBreakHyphen = (s: string) => s.replace(/-/g, '‑')

// --- 1 ảnh thiết kế, nén giống SubmitReportView (compressImage + chặn MAX_UPLOAD_BYTES của Storage Rules) ---
const fileInput = ref<HTMLInputElement | null>(null)
const imagePreview = ref('')
const imageBlob = ref<Blob | null>(null)
const imageError = ref('')
const processingImage = ref(false)
const zoomImage = ref<string | null>(null)

const submitting = ref(false)
const submitStage = ref<'idle' | 'uploading' | 'saving'>('idle')
const showSuccess = ref(false)
const submittedArtistName = ref('')

const pickImage = () => { if (!processingImage.value && !submitting.value) fileInput.value?.click() }

const handleFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  imageError.value = ''
  if (/\.(heic|heif)$/i.test(file.name)) {
    imageError.value = 'Ảnh HEIC của iPhone không đọc được. Vui lòng chụp màn hình lại ảnh thiết kế rồi tải lên.'
    return
  }
  if (!file.type.startsWith('image/')) {
    imageError.value = 'Vui lòng chọn file ảnh JPG hoặc PNG.'
    return
  }
  processingImage.value = true
  try {
    const compressed = await compressImage(file)
    if (compressed.blob.size > MAX_UPLOAD_BYTES) {
      imageError.value = 'Ảnh quá lớn, vui lòng chọn ảnh khác.'
      return
    }
    imagePreview.value = compressed.dataUrl
    imageBlob.value = compressed.blob
  } catch (err: any) {
    imageError.value = 'Lỗi xử lý ảnh: ' + (err?.message || 'vui lòng thử ảnh khác.')
  } finally {
    processingImage.value = false
  }
}

const removeImage = () => {
  imagePreview.value = ''
  imageBlob.value = null
  imageError.value = ''
}

const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : new Date(ts || 0).getTime()
const myPosterReports = computed(() =>
  (props.myReports || [])
    .filter(r => r.jobId === POSTER_DESIGN_JOB_ID)
    .slice()
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
)
// Đơn đang chờ / đã duyệt → không cho gửi lại (1 lần/tài khoản như job cơ bản khác); đơn bị từ chối thì được làm lại
const activeReport = computed(() => myPosterReports.value.find(r => ['pending', 'approved', 'collected'].includes(r.status)))
const activeReportImage = computed(() => activeReport.value ? getReportImages(activeReport.value)[0]?.url || '' : '')
const lastRejected = computed(() => myPosterReports.value.find(r => r.status === 'rejected'))

const canSubmit = computed(() => !activeReport.value && !!selectedArtist.value && !!imageBlob.value && !processingImage.value && !submitting.value)
const submitHint = computed(() => {
  if (submitting.value) return ''
  if (!selectedArtist.value && !imageBlob.value) return 'Chọn 1 chủ đề và tải 1 ảnh thiết kế để gửi.'
  if (!selectedArtist.value) return 'Chọn 1 trong 3 chủ đề nghệ sĩ ở phía trên.'
  if (!imageBlob.value) return 'Tải lên 1 ảnh thiết kế để gửi.'
  return ''
})

const close = () => {
  if (submitting.value) return
  zoomImage.value = null
  emit('close')
}

// Popup con "Gửi bằng chứng": chỉ mở khi bấm nút GỬI BẰNG CHỨNG ở chân popup hướng dẫn — user không phải cuộn
// xuống cuối trang hướng dẫn mới thấy chỗ tải ảnh. Chủ đề + ảnh dùng chung state với popup hướng dẫn.
const showProof = ref(false)
const openProof = () => { if (!activeReport.value) showProof.value = true }
const closeProof = () => {
  if (submitting.value) return
  zoomImage.value = null
  showProof.value = false
}
// Đóng popup job bằng bất kỳ cách nào (nút X, gửi xong, chưa đăng nhập) thì lần mở sau luôn bắt đầu từ trang hướng dẫn
watch(() => props.show, (open) => { if (!open) showProof.value = false })

const submitProof = async () => {
  const artist = selectedArtist.value
  const blob = imageBlob.value
  if (!canSubmit.value || !artist || !blob) return
  const user = auth.currentUser
  if (!user) {
    emit('close')
    router.push('/login')
    return
  }

  submitting.value = true
  const tSubmitStart = perfMark()
  try {
    // 1 lần/tài khoản: kiểm tra lại trên Firestore giống SubmitReportView (myReports chỉ có 50 đơn gần nhất)
    const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('jobId', '==', POSTER_DESIGN_JOB_ID)))
    const statuses = snap.docs.map(d => d.data().status)
    if (statuses.some(s => s === 'approved' || s === 'collected')) {
      Swal.fire({ icon: 'error', title: 'ĐÃ NHẬN THƯỞNG!', text: 'Mỗi tài khoản chỉ được làm công việc này 1 lần duy nhất.', confirmButtonColor: '#dc2626' })
      return
    }
    if (statuses.includes('pending')) {
      Swal.fire({ icon: 'warning', title: 'ĐANG CHỜ DUYỆT!', text: 'Bạn đã gửi bằng chứng cho công việc này rồi, vui lòng chờ Admin duyệt.', confirmButtonColor: '#f59e0b' })
      return
    }

    // Tạo trước reportId để dùng làm path Storage (giống SubmitReportView)
    const reportRef = doc(collection(db, 'reports'))
    submitStage.value = 'uploading'
    const imgRef = storageRef(storage, `proofs/${user.uid}/${reportRef.id}/image_0.jpg`)
    let url = ''
    try {
      const tUpload = perfMark()
      await uploadBytes(imgRef, blob, { contentType: 'image/jpeg' })
      url = await getDownloadURL(imgRef)
      perfLog('Upload ảnh poster (uploadBytes+getDownloadURL)', tUpload)
    } catch (uploadError: any) {
      alert('❌ LỖI TẢI ẢNH LÊN: ' + (uploadError?.message || 'Vui lòng thử lại.'))
      return
    }

    submitStage.value = 'saving'
    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}

    await setDoc(reportRef, {
      uid: user.uid,
      username: userDoc.username || '',
      fullName: userDoc.fullName || '',
      phoneRef: userDoc.phoneRef || userDoc.phone || '',
      jobId: POSTER_DESIGN_JOB_ID,
      jobName: jobConfig.value?.title || staticJob.title,
      reward: rewardAmount.value,
      // Chủ đề nghệ sĩ đã chọn — Admin đối chiếu với ảnh ở cột BẰNG CHỨNG
      posterArtist: artist.id,
      posterArtistName: artist.name,
      proofImages: [{ url, path: imgRef.fullPath }],
      imageCount: 1,
      storageCleaned: false,
      status: 'pending',
      createdAt: serverTimestamp(),
      site: 'rapjob'
    })

    submittedArtistName.value = artist.name
    showSuccess.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + (error?.message || 'Vui lòng thử lại!'))
  } finally {
    perfLog('TỔNG THỜI GIAN GỬI POSTER (từ lúc bấm gửi)', tSubmitStart)
    submitting.value = false
    submitStage.value = 'idle'
  }
}

const finishSuccess = () => {
  showSuccess.value = false
  selectedArtistId.value = null
  removeImage()
  emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="close"></div>

      <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
        <button @click="close" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
          <!-- Tiêu đề + mô tả -->
          <h2 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] leading-tight uppercase">
            🎨 {{ jobConfig?.title }} — <span class="text-yellow-400">{{ rewardText.toUpperCase() }}</span>
          </h2>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span class="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11.5px] font-bold">Chỉ làm 1 lần</span>
            <span class="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11.5px] font-bold">1 ảnh bằng chứng</span>
          </div>
          <p class="mt-2.5 text-slate-300 text-[13px] font-medium leading-relaxed">
            {{ jobConfig?.shortDesc }} Hoàn thành và gửi ảnh để nhận thưởng {{ rewardText }} sau khi được duyệt.
          </p>

          <!-- Đã gửi bằng chứng (đang chờ / đã duyệt) -->
          <div v-if="activeReport" class="mt-4 rounded-2xl border p-4"
               :class="activeReport.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-emerald-500/30 bg-emerald-500/10'">
            <p class="text-[14.5px] font-black leading-snug" :class="activeReport.status === 'pending' ? 'text-yellow-300' : 'text-emerald-300'">
              {{ activeReport.status === 'pending' ? '⏳ Bằng chứng của bạn đang chờ Admin duyệt' : '✅ Bạn đã hoàn thành công việc này' }}
            </p>
            <div class="mt-2.5 flex items-center gap-3">
              <img v-if="activeReportImage" :src="activeReportImage" alt="Ảnh thiết kế đã gửi" class="w-14 h-16 shrink-0 rounded-lg object-cover border border-white/10 bg-white" />
              <div class="min-w-0">
                <p v-if="activeReport.posterArtistName" class="text-slate-300 text-[13px] font-medium">
                  Chủ đề: <span class="text-white font-black">{{ activeReport.posterArtistName }}</span>
                </p>
                <p class="mt-0.5 text-slate-400 text-[12px] font-medium">Mỗi tài khoản chỉ được làm công việc này 1 lần.</p>
              </div>
            </div>
          </div>

          <template v-else>
            <p v-if="lastRejected" class="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-rose-300 text-[12.5px] font-semibold leading-snug">
              Đơn trước bị từ chối<template v-if="lastRejected.note">: {{ lastRejected.note }}</template>. Bạn có thể thiết kế lại và gửi bằng chứng mới.
            </p>

            <!-- Chọn 1 trong 3 chủ đề -->
            <section class="mt-4">
              <p class="text-white text-[13px] font-black uppercase tracking-wide">Chọn 1 trong 3 chủ đề</p>
              <div class="mt-2 grid grid-cols-3 gap-2">
                <button v-for="a in artists" :key="a.id" @click="selectedArtistId = a.id" :aria-pressed="selectedArtistId === a.id"
                        class="relative min-h-[84px] rounded-2xl border-2 px-1.5 py-2.5 flex flex-col items-center justify-center gap-1 text-center transition-all active:scale-[0.97]"
                        :class="selectedArtistId === a.id
                          ? 'bg-red-600 border-yellow-400 text-white shadow-[0_0_18px_rgba(220,38,38,0.45)]'
                          : 'bg-white/[0.04] border-white/15 text-slate-200'">
                  <span v-if="selectedArtistId === a.id" class="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-yellow-400 text-[#3a0a00] text-[10px] font-black flex items-center justify-center">✓</span>
                  <span class="text-[22px] leading-none">{{ a.icon }}</span>
                  <span class="text-[12px] font-black leading-tight">{{ noBreakHyphen(a.name) }}</span>
                </button>
              </div>
            </section>

            <!-- Hướng dẫn ngắn -->
            <section class="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3.5">
              <p class="text-white text-[13px] font-black uppercase tracking-wide">📖 Hướng dẫn thực hiện</p>
              <ol class="mt-2.5 space-y-2">
                <li v-for="s in steps" :key="s.id" class="flex items-start gap-2.5">
                  <span class="mt-px w-5 h-5 shrink-0 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 text-[10.5px] font-black flex items-center justify-center">{{ s.id }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-slate-200 text-[12.5px] font-medium leading-snug break-words">{{ s.title }}</p>
                    <a v-if="s.downloadLink" :href="s.downloadLink" target="_blank" rel="noopener"
                       class="mt-1.5 inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 active:bg-red-500 text-white text-[11px] font-black uppercase">
                      {{ s.buttonText || 'Mở link' }}
                    </a>
                  </div>
                </li>
              </ol>
              <p v-if="jobConfig?.guideNote" class="mt-3 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-yellow-200 text-[12px] font-medium leading-snug">
                💡 {{ jobConfig.guideNote }}
              </p>
            </section>

            <!-- Điều kiện duyệt đơn -->
            <section class="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3.5">
              <p class="text-white text-[13px] font-black uppercase tracking-wide">✅ Ảnh được duyệt khi</p>
              <ul class="mt-2 space-y-1.5">
                <li v-for="(rule, idx) in approvalRules" :key="idx" class="flex items-start gap-2 text-slate-300 text-[12.5px] font-medium leading-snug">
                  <span class="text-yellow-400 font-black shrink-0">✓</span>{{ rule }}
                </li>
              </ul>
            </section>

          </template>
        </div>

        <!-- Nút mở popup gửi bằng chứng — luôn nằm dưới cùng popup, user không phải cuộn xuống cuối trang hướng dẫn -->
        <div v-if="!activeReport" class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-3.5">
          <p class="mb-2 text-center text-[11.5px] font-medium" :class="selectedArtist ? 'text-slate-300' : 'text-slate-400'">
            <template v-if="selectedArtist">Chủ đề đã chọn: <span class="text-white font-black">{{ selectedArtist.icon }} {{ selectedArtist.name }}</span></template>
            <template v-else>Thiết kế xong, bấm nút bên dưới để tải ảnh lên.</template>
          </p>
          <button @click="openProof"
                  class="w-full h-12 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] text-[14px] font-black uppercase tracking-wide shadow-[0_4px_16px_rgba(251,191,36,0.35)] active:scale-[0.98] transition-transform">
            GỬI BẰNG CHỨNG
          </button>
        </div>
      </div>

      <!-- Popup GỬI BẰNG CHỨNG — chỉ hiện khi bấm nút ở chân popup hướng dẫn: chọn/đổi chủ đề + 1 ảnh + gửi -->
      <div v-if="showProof" class="fixed inset-0 z-[5400] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75" @click="closeProof"></div>
        <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
          <button @click="closeProof" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
            <h3 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] leading-tight uppercase">📤 Gửi bằng chứng</h3>
            <p class="mt-1 pr-10 text-slate-400 text-[12.5px] font-medium">{{ jobConfig?.title }} · thưởng <span class="text-yellow-400 font-bold">{{ rewardText }}</span></p>

            <!-- Chủ đề: chọn sẵn từ trang hướng dẫn, đổi được ngay tại đây -->
            <p class="mt-4 text-white text-[13px] font-black uppercase tracking-wide">Chủ đề đã chọn</p>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button v-for="a in artists" :key="a.id" @click="selectedArtistId = a.id" :aria-pressed="selectedArtistId === a.id"
                      class="min-h-[60px] rounded-xl border-2 px-1 py-2 flex flex-col items-center justify-center gap-1 text-center transition-all active:scale-[0.97]"
                      :class="selectedArtistId === a.id
                        ? 'bg-red-600 border-yellow-400 text-white shadow-[0_0_14px_rgba(220,38,38,0.4)]'
                        : 'bg-white/[0.04] border-white/15 text-slate-300'">
                <span class="text-[18px] leading-none">{{ a.icon }}</span>
                <span class="text-[11px] font-black leading-tight">{{ noBreakHyphen(a.name) }}</span>
              </button>
            </div>

            <!-- 1 ảnh thiết kế -->
            <p class="mt-4 text-white text-[13px] font-black uppercase tracking-wide">Ảnh thiết kế</p>
            <div v-if="processingImage" class="mt-2 h-[92px] rounded-xl border-2 border-dashed border-white/15 bg-black/30 flex items-center justify-center gap-2 text-slate-300 text-[12.5px] font-medium">
              <span class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
              Đang xử lý ảnh...
            </div>
            <button v-else-if="!imagePreview" @click="pickImage"
                    class="mt-2 w-full h-[92px] rounded-xl border-2 border-dashed border-red-500/35 bg-red-500/[0.05] active:bg-red-500/10 flex flex-col items-center justify-center gap-1 transition-colors">
              <span class="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-300">
                <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
              </span>
              <span class="text-slate-200 text-[13px] font-semibold">Chạm để tải ảnh thiết kế</span>
              <span class="text-slate-500 text-[11px] font-medium">1 ảnh · JPG, PNG</span>
            </button>
            <div v-else class="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2.5">
              <button @click="zoomImage = imagePreview" aria-label="Xem ảnh lớn" class="w-16 h-20 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-white cursor-zoom-in">
                <img :src="imagePreview" alt="Ảnh thiết kế đã chọn" class="w-full h-full object-cover" />
              </button>
              <div class="flex-1 min-w-0">
                <p class="text-white text-[13px] font-bold">✓ Đã chọn ảnh thiết kế</p>
                <p class="text-slate-500 text-[11px] font-medium">Chạm ảnh để xem lớn</p>
                <div class="mt-2 flex gap-2">
                  <button @click="pickImage" class="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[11.5px] font-bold active:scale-95 transition-transform">Đổi ảnh</button>
                  <button @click="removeImage" class="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-[11.5px] font-bold active:scale-95 transition-transform">Xoá</button>
                </div>
              </div>
            </div>
            <input ref="fileInput" type="file" accept="image/jpeg, image/png, image/jpg" class="hidden" @change="handleFile" />

            <p v-if="imageError" class="mt-2 text-rose-400 text-[12px] font-bold leading-snug">⚠️ {{ imageError }}</p>
            <p class="mt-1.5 text-slate-500 text-[11.5px] font-medium">Chỉ cần 1 ảnh thiết kế, không cần ảnh chụp màn hình Canva.</p>
          </div>

          <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-3.5">
            <p v-if="submitHint" class="mb-2 text-center text-slate-400 text-[11.5px] font-medium">{{ submitHint }}</p>
            <button @click="submitProof" :disabled="!canSubmit"
                    class="w-full h-12 rounded-xl text-[14px] font-black uppercase tracking-wide transition-transform"
                    :class="canSubmit
                      ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] shadow-[0_4px_16px_rgba(251,191,36,0.35)] active:scale-[0.98]'
                      : 'bg-slate-700/70 text-slate-400 cursor-not-allowed'">
              {{ submitStage === 'uploading' ? 'ĐANG TẢI ẢNH LÊN...' : submitStage === 'saving' ? 'ĐANG GỬI...' : 'GỬI BẰNG CHỨNG' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Xem ảnh lớn -->
      <div v-if="zoomImage" class="fixed inset-0 z-[5800] flex items-center justify-center p-4 bg-black/90 cursor-zoom-out" @click="zoomImage = null">
        <img :src="zoomImage" alt="Ảnh thiết kế" class="max-w-full max-h-full rounded-2xl object-contain bg-white" />
      </div>

      <!-- Gửi thành công — đơn chờ Admin duyệt -->
      <div v-if="showSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="finishSuccess"></div>
        <div class="relative w-full max-w-sm rounded-[28px] border border-emerald-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] p-6 text-center shadow-2xl">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">✅</div>
          <h3 class="mt-4 text-white text-[18px] leading-tight uppercase">Gửi bằng chứng thành công</h3>
          <p class="mt-2 text-slate-400 text-[13px] font-medium leading-relaxed">
            Chủ đề <span class="text-white font-black">{{ submittedArtistName }}</span>. Đơn đang
            <span class="text-yellow-400 font-bold">chờ Admin duyệt</span>, xu sẽ được cộng vào ví khi ảnh được duyệt hợp lệ.
          </p>
          <div class="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 py-2.5 text-yellow-400 text-[15px] font-black">
            +{{ rewardText }} · CHỜ DUYỆT
          </div>
          <button @click="finishSuccess" class="mt-5 w-full h-12 rounded-xl bg-red-600 active:bg-red-500 text-white text-[14px] font-black uppercase tracking-wide transition-colors">
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
