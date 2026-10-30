<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { auth, db, storage } from '@/firebase'
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { compressImage, MAX_UPLOAD_BYTES, perfMark, perfLog } from '@/utils/imageCompress'
import { jobsData } from '@/data/jobs'
import { THREADS_COMMENT_JOB_ID, hashImageFile } from '@/utils/threadsComment'
import { parseThreadsPostUrl } from '@/utils/threadsSeeding'
import { openFanpageMessenger } from '@/utils/fanpage'

// Popup job "BÌNH LUẬN DẠO – THREADS": khung thưởng, 1 ví dụ quy đổi, ảnh minh họa, nội dung mẫu (nút sao chép), 2 lưu ý
// và các đơn đã gửi. Chân popup có nút HƯỚNG DẪN (popup con: các bước rút gọn) cạnh nút GỬI BẰNG CHỨNG (popup con: số bình
// luận khai báo + link bài viết đã bình luận + 1–5 ảnh, nén compressImage, Storage proofs/{uid}/{reportId}/ giống SubmitReportView).
// Làm nhiều lần và KHÔNG cộng xu ở đây — Admin nhập số bình luận hợp lệ khi duyệt (AdminView.approveReport),
// xu = số hợp lệ × mức thưởng/bình luận.
const props = defineProps<{ show: boolean; job?: any; myReports?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()

// job: bản đã merge cấu hình Admin (mergedJobs ở App.vue); thiếu thì dùng cấu hình tĩnh trong jobs.ts
const staticJob = jobsData[THREADS_COMMENT_JOB_ID]
const jobConfig = computed(() => props.job || staticJob)
// Xu cho 1 bình luận hợp lệ — cùng nguồn Admin dùng khi duyệt (getTrustedReward: vip_jobs nếu có, không thì jobs.ts)
const ratePerComment = computed(() => Number(String(jobConfig.value?.reward ?? '').replace(/\D/g, '')) || 0)
const fmtXu = (n: number) => n.toLocaleString('vi-VN')

const exampleCount = computed(() => Number(jobConfig.value?.exampleCommentCount ?? staticJob.exampleCommentCount) || 0)
const steps = computed<any[]>(() => jobConfig.value?.steps ?? staticJob.steps ?? [])
// Popup HƯỚNG DẪN riêng (các bước rút gọn) — mở bằng nút cạnh GỬI BẰNG CHỨNG
const showGuide = ref(false)
const notes = computed<{ text: string; highlight?: string }[]>(() => jobConfig.value?.notes ?? staticJob.notes ?? [])

// Tách đoạn cần tô đậm (highlight) ra khỏi câu để in đậm trong template
const splitHighlight = (text: string, highlight?: string) => {
  const idx = highlight ? text.indexOf(highlight) : -1
  if (!highlight || idx < 0) return [{ text, hl: false }]
  return [
    { text: text.slice(0, idx), hl: false },
    { text: highlight, hl: true },
    { text: text.slice(idx + highlight.length), hl: false }
  ].filter(part => part.text)
}

// --- Ảnh minh họa: chỉ hiện khi tải được thật. File chưa có (Vite / Cloudflare Pages trả về trang HTML thay vì 404,
// trình duyệt báo lỗi ảnh) → hiện "Ảnh hướng dẫn đang được cập nhật", không hiện biểu tượng ảnh lỗi ---
const guideImageSrc = computed(() => {
  const path = String(jobConfig.value?.guideImage || '').trim()
  if (!path) return ''
  return /^https?:\/\//i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\/+/, '')
})
const guideImageState = ref<'loading' | 'loaded' | 'missing'>('loading')
watch([() => props.show, guideImageSrc], () => { guideImageState.value = guideImageSrc.value ? 'loading' : 'missing' }, { immediate: true })
const zoomImage = ref<string | null>(null)

// --- Nội dung cần bình luận (biến commentContent trong jobs.ts) — khung ở popup chính + bước showCommentContent của popup HƯỚNG DẪN ---
const commentContent = computed(() => String(jobConfig.value?.commentContent ?? '').trim())
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
const copyContent = async () => {
  const text = commentContent.value
  if (!text) return
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    // Không dùng được Clipboard API (WebView cũ / không phải HTTPS) → cách cũ execCommand
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    textArea.setSelectionRange(0, text.length)
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(textArea)
  }
  if (!ok) {
    alert('Lỗi sao chép, hãy copy thủ công nhé!')
    return
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  Swal.fire({ title: 'Đã sao chép', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' })
}

// --- Đơn đã gửi của job này (myReports: 50 đơn gần nhất của user, realtime từ App.vue) ---
// createdAt chưa có = serverTimestamp đang ghi → coi là vừa gửi
const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : ts ? new Date(ts).getTime() : Date.now()
const formatTime = (ts: any) => {
  const d = new Date(getTime(ts))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${d.getDate()}/${d.getMonth() + 1}`
}
const myCommentReports = computed(() =>
  (props.myReports || [])
    .filter(r => r.jobId === THREADS_COMMENT_JOB_ID)
    .slice()
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
)
const recentReports = computed(() => myCommentReports.value.slice(0, 5))
const lastReport = computed(() => myCommentReports.value[0])
const pendingCount = computed(() => myCommentReports.value.filter(r => r.status === 'pending').length)
const approvedCount = computed(() => myCommentReports.value.filter(r => r.status === 'approved' || r.status === 'collected').length)
const creditedXu = (r: any) => Number(r.actualReward ?? String(r.reward ?? '').replace(/\D/g, '')) || 0

// --- Form gửi bằng chứng ---
const MAX_PROOF_IMAGES = 5
// Chỉ chặn gõ nhầm số quá lớn — không phải giới hạn số bình luận (làm nhiều hơn thì gửi thêm đơn)
const MAX_COMMENT_DIGITS = 4

const showProof = ref(false)
const commentCountInput = ref('')
const postUrlInput = ref('')
type ProofImage = { id: number; preview: string; blob: Blob; hash: string }
let proofImageSeq = 0
const proofImages = ref<ProofImage[]>([])
const processingImages = ref(false)
const imageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const submitting = ref(false)
const submitStage = ref<'idle' | 'uploading' | 'saving'>('idle')
const uploadedCount = ref(0)
const showSuccess = ref(false)
const submittedCount = ref(0)

const onCommentCountInput = (event: Event) => {
  const el = event.target as HTMLInputElement
  const clean = el.value.replace(/\D/g, '').slice(0, MAX_COMMENT_DIGITS)
  el.value = clean
  commentCountInput.value = clean
}
const commentCount = computed(() => Number(commentCountInput.value) || 0)
// Link bài viết đã bình luận dạo — cùng hàm kiểm tra với ĐĂNG BÀI THREADS – SEEDING (utils/threadsSeeding.ts): mã bài viết
// giống nhau dù link threads.com / threads.net, có @nick hay dạng ngắn /t/, kèm ?xmt=… → Admin gom được đơn cùng 1 bài. Link
// /share/ (Sao chép liên kết trên iPhone) vẫn nhận nhưng chưa biết mã bài → Admin kiểm tra thủ công
const parsedPost = computed(() => parseThreadsPostUrl(postUrlInput.value))
const postUrlError = computed(() =>
  postUrlInput.value.trim() && !parsedPost.value
    ? 'Link chưa đúng. Mở bài viết trên Threads → bấm biểu tượng chia sẻ → Sao chép liên kết rồi dán vào đây.'
    : ''
)
// Rời ô nhập: bỏ tham số theo dõi (?xmt=...) → hiện đúng link sẽ gửi
const normalizePostUrlInput = () => {
  if (parsedPost.value) postUrlInput.value = parsedPost.value.url
}
const estimatedXu = computed(() => commentCount.value * ratePerComment.value)

const canSubmit = computed(() =>
  commentCount.value >= 1 && !!parsedPost.value && proofImages.value.length > 0 &&
  !processingImages.value && !submitting.value
)
const submitHint = computed(() => {
  if (submitting.value || processingImages.value) return ''
  const missing: string[] = []
  if (commentCount.value < 1) missing.push('số bình luận')
  if (!parsedPost.value) missing.push('link bài viết')
  if (!proofImages.value.length) missing.push('ảnh bằng chứng')
  return missing.length ? `Còn thiếu: ${missing.join(', ')}.` : ''
})

const pickImages = () => {
  if (processingImages.value || submitting.value || proofImages.value.length >= MAX_PROOF_IMAGES) return
  fileInput.value?.click()
}

const handleFiles = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''
  if (!files.length) return
  imageError.value = ''
  if (proofImages.value.length + files.length > MAX_PROOF_IMAGES) {
    imageError.value = `Mỗi đơn gửi tối đa ${MAX_PROOF_IMAGES} ảnh — bạn chỉ còn chọn được ${MAX_PROOF_IMAGES - proofImages.value.length} ảnh.`
    return
  }
  processingImages.value = true
  const errors = new Set<string>()
  try {
    // Nén (giống SubmitReportView, chặn MAX_UPLOAD_BYTES của Storage Rules) + băm file gốc, song song từng ảnh
    const results = await Promise.all(files.map(async (file): Promise<ProofImage | null> => {
      if (/\.(heic|heif)$/i.test(file.name)) {
        errors.add('Ảnh HEIC của iPhone không đọc được — vui lòng chụp màn hình lại rồi tải lên.')
        return null
      }
      if (!file.type.startsWith('image/')) {
        errors.add('Vui lòng chọn file ảnh JPG hoặc PNG.')
        return null
      }
      try {
        const [compressed, hash] = await Promise.all([compressImage(file), hashImageFile(file)])
        if (compressed.blob.size > MAX_UPLOAD_BYTES) {
          errors.add('Có ảnh quá lớn, vui lòng chọn ảnh khác.')
          return null
        }
        return { id: ++proofImageSeq, preview: compressed.dataUrl, blob: compressed.blob, hash }
      } catch (err: any) {
        errors.add('Lỗi xử lý ảnh: ' + (err?.message || 'vui lòng thử ảnh khác.'))
        return null
      }
    }))
    for (const img of results) {
      if (!img) continue
      if (img.hash && proofImages.value.some(p => p.hash === img.hash)) {
        errors.add('Có ảnh bị chọn trùng — đã bỏ qua ảnh trùng.')
        continue
      }
      proofImages.value.push(img)
    }
  } finally {
    processingImages.value = false
    imageError.value = Array.from(errors).join(' ')
  }
}

const removeImage = (index: number) => {
  proofImages.value.splice(index, 1)
  imageError.value = ''
}

const close = () => {
  if (submitting.value) return
  zoomImage.value = null
  emit('close')
}

const openProof = () => {
  showProof.value = true
}
const closeProof = () => {
  if (submitting.value) return
  zoomImage.value = null
  showProof.value = false
}
// Đóng popup job bằng bất kỳ cách nào thì lần mở sau luôn bắt đầu từ trang hướng dẫn
watch(() => props.show, (open) => { if (!open) { showGuide.value = false; showProof.value = false; showSuccess.value = false } })

const submitProof = async () => {
  if (!canSubmit.value) return
  const user = auth.currentUser
  if (!user) {
    emit('close')
    router.push('/login')
    return
  }

  const post = parsedPost.value
  if (!post) return
  const count = commentCount.value
  const images = proofImages.value.slice()
  const hashes = images.map(img => img.hash).filter(Boolean)

  submitting.value = true
  const tSubmitStart = perfMark()
  try {
    // Không nhận lại ảnh của đơn trước (đang chờ / đã duyệt) — so SHA-256 file gốc. Đọc lại Firestore vì myReports chỉ có
    // 50 đơn gần nhất. Đơn bị từ chối không tính để user sửa lại và gửi lại được.
    if (hashes.length) {
      const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('jobId', '==', THREADS_COMMENT_JOB_ID)))
      const usedHashes = new Set<string>()
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.status !== 'rejected' && Array.isArray(data.proofImageHashes)) data.proofImageHashes.forEach((h: string) => usedHashes.add(h))
      })
      const duplicateCount = hashes.filter(h => usedHashes.has(h)).length
      if (duplicateCount) {
        Swal.fire({
          icon: 'warning',
          title: 'ẢNH ĐÃ GỬI Ở ĐƠN TRƯỚC!',
          text: `Có ${duplicateCount} ảnh trùng với đơn bình luận bạn đã gửi. Mỗi bình luận chỉ được nhận thưởng 1 lần — hãy bỏ ảnh đó và chỉ gửi ảnh các bình luận mới.`,
          confirmButtonColor: '#f59e0b'
        })
        return
      }
    }

    // Tạo trước reportId để dùng làm path Storage (giống SubmitReportView)
    const reportRef = doc(collection(db, 'reports'))
    submitStage.value = 'uploading'
    uploadedCount.value = 0
    let uploaded: { url: string; path: string }[] = []
    try {
      const tUpload = perfMark()
      uploaded = await Promise.all(images.map(async (img, index) => {
        const imgRef = storageRef(storage, `proofs/${user.uid}/${reportRef.id}/image_${index}.jpg`)
        await uploadBytes(imgRef, img.blob, { contentType: 'image/jpeg' })
        const url = await getDownloadURL(imgRef)
        uploadedCount.value++
        return { url, path: imgRef.fullPath }
      }))
      perfLog(`Upload ${images.length} ảnh bình luận dạo (uploadBytes+getDownloadURL)`, tUpload)
    } catch (uploadError: any) {
      alert('❌ LỖI TẢI ẢNH LÊN: ' + (uploadError?.message || 'Vui lòng thử lại.'))
      return
    }

    submitStage.value = 'saving'
    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}
    const rate = ratePerComment.value

    await setDoc(reportRef, {
      uid: user.uid,
      username: userDoc.username || '',
      fullName: userDoc.fullName || '',
      phoneRef: userDoc.phoneRef || userDoc.phone || '',
      jobId: THREADS_COMMENT_JOB_ID,
      jobName: jobConfig.value?.title || staticJob.title,
      // Số xu DỰ KIẾN nếu mọi bình luận khai báo đều hợp lệ — chỉ để hiện trong lịch sử lúc chờ duyệt. Admin không dùng số
      // này: khi duyệt, approveReport() ghi đè reward/actualReward = số bình luận hợp lệ × mức thưởng lấy từ cấu hình job.
      reward: count * rate,
      rewardPerComment: rate,
      commentCount: count,
      // Cùng tên field với ĐĂNG BÀI THREADS – SEEDING → tab Admin cảnh báo được các đơn cùng 1 bài viết. Link /share/: mã bài ''
      // (mã chia sẻ không phải mã bài viết), tab Admin đánh dấu đơn cần kiểm tra thủ công
      threadsPostUrl: post.url,
      threadsPostCode: post.code,
      proofImages: uploaded,
      proofImageHashes: hashes,
      imageCount: uploaded.length,
      storageCleaned: false,
      status: 'pending',
      createdAt: serverTimestamp(),
      site: 'rapjob'
    })

    submittedCount.value = count
    commentCountInput.value = ''
    postUrlInput.value = ''
    proofImages.value = []
    imageError.value = ''
    showSuccess.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + (error?.message || 'Vui lòng thử lại!'))
  } finally {
    perfLog('TỔNG THỜI GIAN GỬI BÌNH LUẬN DẠO (từ lúc bấm gửi)', tSubmitStart)
    submitting.value = false
    submitStage.value = 'idle'
  }
}

// Gửi xong quay về trang hướng dẫn (job làm nhiều lần) — đơn mới hiện ngay ở mục "Đơn đã gửi"
const finishSuccess = () => {
  showSuccess.value = false
  showProof.value = false
}
// Nút NHẮN TIN FANPAGE ở popup nộp thành công: mở Messenger Fanpage Rạp Job để user báo Admin duyệt đơn (utils/fanpage.ts)
const messageFanpage = () => {
  openFanpageMessenger()
  finishSuccess()
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
          <!-- Tiêu đề -->
          <h2 class="pr-10 text-white text-[18px] min-[375px]:text-[19px] font-black leading-tight uppercase">
            {{ jobConfig?.icon }} {{ jobConfig?.title }}<template v-if="jobConfig?.platform"> – <span class="text-red-400">{{ jobConfig.platform }}</span></template>
          </h2>

          <!-- Khung thưởng nổi bật -->
          <div class="mt-3 rounded-2xl border border-yellow-400/40 bg-gradient-to-br from-yellow-400/15 via-amber-500/10 to-red-600/15 px-3 py-3.5 text-center shadow-[0_0_24px_rgba(250,204,21,0.12)]">
            <p class="text-yellow-300 font-black uppercase leading-tight">
              <span class="text-[26px] min-[375px]:text-[28px] tracking-tight">{{ fmtXu(ratePerComment) }} XU</span>
              <span class="block text-[13px] tracking-wide">/ bình luận hợp lệ</span>
            </p>
            <p class="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 min-[375px]:px-3 py-1 text-emerald-300 text-[10px] min-[375px]:text-[11px] font-black uppercase tracking-normal min-[375px]:tracking-wide whitespace-nowrap">
              ♾ Không giới hạn số lần tham gia
            </p>
          </div>

          <!-- Ví dụ quy đổi (1 ví dụ) -->
          <div v-if="exampleCount" class="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-center">
            <p class="text-slate-400 text-[11px] font-black uppercase tracking-wider">💰 Ví dụ quy đổi</p>
            <p class="mt-0.5 text-white text-[15px] font-black">{{ exampleCount }} bình luận = <span class="text-yellow-400">{{ fmtXu(exampleCount * ratePerComment) }} xu</span></p>
          </div>

          <!-- Lưu ý bắt buộc — ngay dưới ví dụ quy đổi -->
          <div class="mt-3 rounded-2xl border-2 border-amber-400/60 bg-amber-500/15 px-3.5 py-2.5">
            <p class="text-yellow-300 text-[13px] font-black uppercase tracking-wide leading-snug text-balance">⚠️ Bắt buộc sao chép nội dung cần bình luận</p>
            <p class="mt-1 text-amber-50 text-[12.5px] font-medium leading-snug">
              Bấm nút <strong class="text-white font-black whitespace-nowrap">📖 HƯỚNG DẪN</strong> và xem <strong class="text-white font-black whitespace-nowrap">📸 HÌNH ẢNH MINH HỌA</strong> để biết chi tiết.
            </p>
          </div>

          <!-- Hình ảnh minh họa — ngay dưới lưu ý bắt buộc -->
          <section class="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3.5">
            <p class="text-white text-[13px] font-black uppercase tracking-wide">📸 Hình ảnh minh họa</p>
            <div class="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <button v-if="guideImageSrc && guideImageState !== 'missing'" v-show="guideImageState === 'loaded'" type="button"
                      @click="zoomImage = guideImageSrc" aria-label="Phóng to ảnh minh họa" class="relative block w-full cursor-zoom-in">
                <img :src="guideImageSrc" alt="Ảnh minh họa cách trả lời bình luận trên Threads"
                     class="block w-full aspect-[8/5] object-cover object-top"
                     @load="guideImageState = 'loaded'" @error="guideImageState = 'missing'" />
                <span class="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2 py-1 text-white text-[10.5px] font-bold">🔍 Chạm để phóng to</span>
              </button>
              <div v-if="guideImageState !== 'loaded'" class="min-h-[132px] flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                <span v-if="guideImageState === 'loading'" class="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                <template v-else>
                  <span class="text-[26px] leading-none">🖼️</span>
                  <p class="text-slate-300 text-[13px] font-bold">Ảnh hướng dẫn đang được cập nhật</p>
                </template>
              </div>
            </div>
            <p class="mt-2 text-slate-400 text-[11.5px] font-medium leading-snug">
              Ảnh mẫu: bài đăng Threads, khu vực bình luận, vị trí nút Trả lời và một ví dụ trả lời bình luận phù hợp.
            </p>
          </section>

          <!-- Nội dung cần bình luận — ngay dưới ảnh minh họa -->
          <section class="mt-3 rounded-2xl border border-red-500/30 bg-red-950/20 p-3.5">
            <p class="text-white text-[13px] font-black uppercase tracking-wide">📋 Nội dung cần bình luận</p>
            <div class="mt-2 min-h-[64px] rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 flex items-center">
              <p v-if="commentContent" class="w-full text-slate-100 text-[13px] font-medium leading-relaxed whitespace-pre-line break-words select-text">{{ commentContent }}</p>
              <p v-else class="w-full text-center text-slate-500 text-[13px] font-semibold italic">Nội dung đang được cập nhật</p>
            </div>
            <button @click="copyContent" :disabled="!commentContent"
                    class="mt-2.5 w-full h-11 rounded-xl text-[13px] font-black uppercase tracking-wide transition-colors"
                    :class="!commentContent
                      ? 'bg-slate-700/70 text-slate-400 cursor-not-allowed'
                      : copied ? 'bg-emerald-600 text-white' : 'bg-red-600 active:bg-red-500 text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)]'">
              {{ copied ? '✓ Đã sao chép' : 'Sao chép nội dung' }}
            </button>
          </section>

          <!-- 2 lưu ý nổi bật -->
          <section class="mt-3 rounded-2xl border-2 border-amber-400/50 bg-amber-500/10 p-3.5">
            <p class="text-amber-300 text-[13px] font-black uppercase tracking-wide">⚠️ Lưu ý</p>
            <div class="mt-2 space-y-2">
              <div v-for="(n, i) in notes" :key="i" class="flex items-start gap-2">
                <span class="mt-px shrink-0 rounded-md bg-amber-400 px-1.5 py-0.5 text-[#3a0a00] text-[10px] font-black uppercase whitespace-nowrap">Lưu ý {{ i + 1 }}</span>
                <p class="text-amber-50 text-[12.5px] font-medium leading-snug">
                  <template v-for="(part, j) in splitHighlight(n.text, n.highlight)" :key="j"><strong v-if="part.hl" class="text-yellow-300 font-black">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>
                </p>
              </div>
            </div>
            <p v-if="jobConfig?.noteReminder" class="mt-2.5 border-t border-amber-400/20 pt-2 text-amber-200 text-[12px] font-semibold leading-snug">
              🚫 {{ jobConfig.noteReminder }}
            </p>
          </section>

          <!-- Đơn đã gửi -->
          <section v-if="recentReports.length" class="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3.5">
            <div class="flex items-center justify-between gap-2">
              <p class="text-white text-[13px] font-black uppercase tracking-wide">🧾 Đơn đã gửi</p>
              <p class="text-slate-400 text-[11px] font-semibold">{{ pendingCount }} chờ duyệt · {{ approvedCount }} đã duyệt</p>
            </div>
            <ul class="mt-2 space-y-1.5">
              <li v-for="r in recentReports" :key="r.id" class="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-white text-[12.5px] font-bold">{{ r.commentCount ?? '?' }} bình luận</p>
                    <p class="text-slate-500 text-[11px] font-medium">{{ formatTime(r.createdAt) }}</p>
                  </div>
                  <div class="shrink-0 text-right">
                    <p v-if="r.status === 'pending'" class="text-yellow-300 text-[12px] font-black">⏳ Chờ duyệt</p>
                    <template v-else-if="r.status === 'approved' || r.status === 'collected'">
                      <p class="text-emerald-300 text-[12px] font-black">✅ +{{ fmtXu(creditedXu(r)) }} xu</p>
                      <p v-if="r.verifiedCommentCount != null" class="text-slate-400 text-[10.5px] font-medium">{{ r.verifiedCommentCount }}/{{ r.commentCount ?? '?' }} hợp lệ</p>
                    </template>
                    <p v-else class="text-rose-300 text-[12px] font-black">✗ Bị từ chối</p>
                  </div>
                </div>
                <p v-if="r.status === 'rejected' && r.note" class="mt-1 text-rose-300/90 text-[11px] font-medium leading-snug break-words">Lý do: {{ r.note }}</p>
              </li>
            </ul>
          </section>
        </div>

        <!-- Chân popup, luôn nằm dưới cùng (không phải cuộn): nút HƯỚNG DẪN (popup các bước) ngay cạnh nút GỬI BẰNG CHỨNG -->
        <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-3.5">
          <p class="mb-2 text-center text-slate-400 text-[11.5px] font-medium">Bình luận xong, chụp màn hình rồi bấm Gửi bằng chứng.</p>
          <div class="flex gap-2">
            <button @click="showGuide = true"
                    class="shrink-0 h-12 px-3 min-[375px]:px-4 rounded-xl border border-red-500/40 bg-red-500/10 active:bg-red-500/20 text-red-100 text-[12px] min-[375px]:text-[13px] font-black uppercase tracking-normal min-[375px]:tracking-wide whitespace-nowrap transition-colors">
              📖 Hướng dẫn
            </button>
            <button @click="openProof"
                    class="flex-1 min-w-0 h-12 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] text-[13px] min-[375px]:text-[14px] font-black uppercase tracking-normal min-[375px]:tracking-wide whitespace-nowrap shadow-[0_4px_16px_rgba(251,191,36,0.35)] active:scale-[0.98] transition-transform">
              GỬI BẰNG CHỨNG
            </button>
          </div>
        </div>
      </div>

      <!-- Popup HƯỚNG DẪN: các bước rút gọn (steps trong jobs.ts) -->
      <div v-if="showGuide" class="fixed inset-0 z-[5400] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75" @click="showGuide = false"></div>
        <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
          <button @click="showGuide = false" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
            <h3 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] font-black leading-tight uppercase">📖 Hướng dẫn thực hiện</h3>
            <ol class="mt-3.5 space-y-3">
              <li v-for="s in steps" :key="s.id" class="flex items-start gap-2.5">
                <span class="mt-px w-6 h-6 shrink-0 rounded-full bg-red-600/20 border border-red-500/40 text-red-300 text-[11px] font-black flex items-center justify-center">{{ s.id }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-[12.5px] font-black uppercase leading-snug tracking-wide">{{ s.title }}</p>
                  <p v-if="s.content" class="mt-0.5 text-slate-300 text-[12.5px] font-medium leading-relaxed break-words">
                    <template v-for="(part, i) in splitHighlight(s.content, s.highlight)" :key="i"><strong v-if="part.hl" class="text-yellow-300 font-black">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>
                  </p>
                  <!-- Nội dung cần bình luận + nút sao chép (dùng chung copyContent với khung ở popup chính) -->
                  <template v-if="s.showCommentContent">
                    <div class="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5">
                      <p v-if="commentContent" class="text-slate-100 text-[12.5px] font-medium leading-relaxed whitespace-pre-line break-words select-text">{{ commentContent }}</p>
                      <p v-else class="text-center text-slate-500 text-[12.5px] font-semibold italic">Nội dung đang được cập nhật</p>
                    </div>
                    <button @click="copyContent" :disabled="!commentContent"
                            class="mt-2 w-full h-10 rounded-xl text-[13px] font-black uppercase tracking-wide transition-colors"
                            :class="!commentContent
                              ? 'bg-slate-700/70 text-slate-400 cursor-not-allowed'
                              : copied ? 'bg-emerald-600 text-white' : 'bg-red-600 active:bg-red-500 text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)]'">
                      {{ copied ? '✓ Đã sao chép' : 'Sao chép nội dung' }}
                    </button>
                  </template>
                  <a v-if="s.downloadLink" :href="s.downloadLink" target="_blank" rel="noopener"
                     class="mt-1.5 inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 active:bg-red-500 text-white text-[11px] font-black uppercase">
                    {{ s.buttonText || 'Mở link' }}
                  </a>
                </div>
              </li>
            </ol>
          </div>

          <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-3.5">
            <button @click="showGuide = false"
                    class="w-full h-12 rounded-xl bg-red-600 active:bg-red-500 text-white text-[14px] font-black uppercase tracking-wide transition-colors">
              Đã hiểu
            </button>
          </div>
        </div>
      </div>

      <!-- Popup GỬI BẰNG CHỨNG: số bình luận khai báo + link bài viết đã bình luận + 1–5 ảnh -->
      <div v-if="showProof" class="fixed inset-0 z-[5400] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75" @click="closeProof"></div>
        <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
          <button @click="closeProof" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
            <h3 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] font-black leading-tight uppercase">📤 Gửi bằng chứng</h3>
            <p class="mt-1 pr-10 text-slate-400 text-[12.5px] font-medium">{{ jobConfig?.title }} · <span class="text-yellow-400 font-bold">{{ fmtXu(ratePerComment) }} xu / bình luận hợp lệ</span></p>

            <p v-if="lastReport" class="mt-3 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-yellow-100 text-[12px] font-medium leading-snug">
              Chỉ gửi bình luận <strong class="text-yellow-300 font-black">mới</strong>. Đơn gần nhất của bạn gửi lúc {{ formatTime(lastReport.createdAt) }} — bình luận đã gửi ở đơn trước không được tính lại.
            </p>

            <!-- Số bình luận khai báo -->
            <label for="tc-comment-count" class="mt-4 block text-white text-[13px] font-black uppercase tracking-wide">Số bình luận đã thực hiện</label>
            <input id="tc-comment-count" :value="commentCountInput" @input="onCommentCountInput"
                   type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="VD: 20"
                   class="mt-2 w-full h-12 rounded-xl border border-white/15 bg-black/40 px-3.5 text-white text-[16px] font-bold outline-none placeholder:text-slate-500 placeholder:font-medium focus:border-yellow-400/60 transition-colors" />
            <p class="mt-1.5 text-[12px] font-medium leading-snug" :class="commentCount ? 'text-slate-300' : 'text-slate-500'">
              <template v-if="commentCount">Dự kiến tối đa <span class="text-yellow-400 font-black">{{ fmtXu(estimatedXu) }} xu</span> nếu cả {{ commentCount }} bình luận đều hợp lệ.</template>
              <template v-else>Admin kiểm tra và chỉ cộng xu cho số bình luận hợp lệ.</template>
            </p>

            <!-- Link bài viết đã bình luận dạo -->
            <label for="tc-post-url" class="mt-4 block text-white text-[13px] font-black uppercase tracking-wide">Link bài viết bạn đã bình luận dạo</label>
            <input id="tc-post-url" v-model.trim="postUrlInput" @blur="normalizePostUrlInput"
                   type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                   placeholder="https://www.threads.com/@ten.tac.gia/post/..."
                   class="mt-2 w-full h-12 rounded-xl border bg-black/40 px-3.5 text-white text-[16px] font-semibold outline-none placeholder:text-slate-500 placeholder:font-medium transition-colors"
                   :class="postUrlError ? 'border-rose-500/70 focus:border-rose-400' : 'border-white/15 focus:border-yellow-400/60'" />
            <p v-if="postUrlError" class="mt-1.5 text-rose-400 text-[12px] font-bold leading-snug">⚠️ {{ postUrlError }}</p>
            <p v-else class="mt-1.5 text-slate-500 text-[12px] font-medium leading-snug">Admin mở bài viết này để kiểm tra bình luận của bạn còn tồn tại.</p>

            <!-- Ảnh bằng chứng (1–5 ảnh) -->
            <div class="mt-4 flex items-center justify-between gap-2">
              <p class="text-white text-[13px] font-black uppercase tracking-wide">Ảnh bằng chứng</p>
              <span class="text-[11.5px] font-bold" :class="proofImages.length >= MAX_PROOF_IMAGES ? 'text-rose-400' : 'text-slate-500'">{{ proofImages.length }}/{{ MAX_PROOF_IMAGES }} ảnh</span>
            </div>
            <div v-if="processingImages && !proofImages.length" class="mt-2 h-[92px] rounded-xl border-2 border-dashed border-white/15 bg-black/30 flex items-center justify-center gap-2 text-slate-300 text-[12.5px] font-medium">
              <span class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
              Đang xử lý ảnh...
            </div>
            <button v-else-if="!proofImages.length" @click="pickImages"
                    class="mt-2 w-full h-[92px] rounded-xl border-2 border-dashed border-red-500/35 bg-red-500/[0.05] active:bg-red-500/10 flex flex-col items-center justify-center gap-1 transition-colors">
              <span class="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-300">
                <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
              </span>
              <span class="text-slate-200 text-[13px] font-semibold">Chạm để tải ảnh bằng chứng</span>
              <span class="text-slate-500 text-[11px] font-medium">1–{{ MAX_PROOF_IMAGES }} ảnh · JPG, PNG</span>
            </button>
            <div v-else class="mt-2 grid grid-cols-3 gap-2">
              <div v-for="(img, index) in proofImages" :key="img.id" class="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white">
                <button @click="zoomImage = img.preview" aria-label="Xem ảnh lớn" class="block w-full h-full cursor-zoom-in">
                  <img :src="img.preview" alt="Ảnh bằng chứng đã chọn" class="w-full h-full object-cover" />
                </button>
                <button @click="removeImage(index)" :disabled="submitting" aria-label="Xoá ảnh"
                        class="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 text-white text-[11px] font-black flex items-center justify-center shadow-md">✕</button>
              </div>
              <button v-if="proofImages.length < MAX_PROOF_IMAGES" @click="pickImages" :disabled="processingImages || submitting"
                      class="aspect-square rounded-lg border-2 border-dashed border-red-500/35 bg-red-500/[0.05] active:bg-red-500/10 flex flex-col items-center justify-center gap-0.5 text-red-300 transition-colors">
                <span v-if="processingImages" class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                <template v-else>
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m7-7H5"/></svg>
                  <span class="text-slate-300 text-[11px] font-bold">Thêm ảnh</span>
                </template>
              </button>
            </div>
            <input ref="fileInput" type="file" multiple accept="image/jpeg, image/png, image/jpg" class="hidden" @change="handleFiles" />

            <p v-if="imageError" class="mt-2 text-rose-400 text-[12px] font-bold leading-snug">⚠️ {{ imageError }}</p>
            <p class="mt-1.5 text-slate-500 text-[11.5px] font-medium leading-snug">
              Chụp rõ nick Threads và nội dung từng bình luận. Một ảnh có thể chứa nhiều bình luận, không cần 1 ảnh cho mỗi bình luận.
            </p>
          </div>

          <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-3.5">
            <p v-if="submitHint" class="mb-2 text-center text-slate-400 text-[11.5px] font-medium">{{ submitHint }}</p>
            <button @click="submitProof" :disabled="!canSubmit"
                    class="w-full h-12 rounded-xl text-[14px] font-black uppercase tracking-wide transition-transform"
                    :class="canSubmit
                      ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] shadow-[0_4px_16px_rgba(251,191,36,0.35)] active:scale-[0.98]'
                      : 'bg-slate-700/70 text-slate-400 cursor-not-allowed'">
              {{ submitStage === 'uploading' ? `ĐANG TẢI ẢNH ${uploadedCount}/${proofImages.length}...` : submitStage === 'saving' ? 'ĐANG GỬI...' : submitting ? 'ĐANG KIỂM TRA...' : 'GỬI BẰNG CHỨNG' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Xem ảnh lớn (ảnh minh họa / ảnh bằng chứng) — ảnh full chiều ngang, cuộn dọc được với ảnh chụp màn hình dài -->
      <div v-if="zoomImage" class="fixed inset-0 z-[5800] overflow-y-auto overscroll-contain bg-black cursor-zoom-out" @click="zoomImage = null">
        <button @click.stop="zoomImage = null" aria-label="Đóng ảnh" class="fixed top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <div class="min-h-full flex items-center justify-center px-2 py-14">
          <img :src="zoomImage" alt="Ảnh phóng to" class="block w-full max-w-3xl h-auto rounded-xl bg-white" />
        </div>
      </div>

      <!-- Nộp bằng chứng thành công — đơn chờ Admin xác minh, nhắc user nhắn tin Fanpage để được duyệt -->
      <div v-if="showSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="finishSuccess"></div>
        <div class="relative w-full max-w-sm rounded-[28px] border border-emerald-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] p-6 text-center shadow-2xl">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">✅</div>
          <h3 class="mt-4 text-white text-[18px] font-black leading-tight uppercase">Nộp bằng chứng thành công</h3>
          <p class="mt-2 text-slate-200 text-[14px] font-bold leading-relaxed">
            Vui lòng nhắn tin <span class="text-[#4f9bff] font-black">Fanpage Rạp Job</span> để được duyệt đơn.
          </p>
          <div class="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2.5 text-yellow-400 text-[13px] font-black leading-snug">
            Đơn {{ submittedCount }} bình luận · <span class="whitespace-nowrap">tối đa +{{ fmtXu(submittedCount * ratePerComment) }} xu</span> · <span class="whitespace-nowrap">CHỜ DUYỆT</span>
          </div>
          <p class="mt-2 text-slate-500 text-[11.5px] font-medium leading-snug">Xu nhận = số bình luận hợp lệ × {{ fmtXu(ratePerComment) }} xu.</p>
          <button @click="messageFanpage" class="mt-5 w-full h-12 rounded-xl bg-[#1877F2] active:bg-[#166FE5] text-white text-[14px] font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(24,119,242,0.4)] transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Nhắn tin Fanpage
          </button>
          <button @click="finishSuccess" class="mt-2 w-full h-10 rounded-xl text-slate-400 active:text-white text-[12px] font-black uppercase tracking-wide transition-colors">
            Để sau
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
