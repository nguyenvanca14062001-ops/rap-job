<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { auth, db, storage } from '@/firebase'
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { compressImage, MAX_UPLOAD_BYTES, perfMark, perfLog } from '@/utils/imageCompress'
import { jobsData } from '@/data/jobs'
import { hashImageFile, extractThreadsNick, isValidThreadsNick } from '@/utils/threadsComment'
import { THREADS_SEEDING_JOB_ID, parseThreadsPostUrl } from '@/utils/threadsSeeding'
import { openFanpageMessenger } from '@/utils/fanpage'

// Popup job "ĐĂNG BÀI THREADS – SEEDING": tên job, badge KHÔNG GIỚI HẠN, khung thưởng / lượt trả lời, ví dụ quy đổi, ảnh minh
// họa và các đơn đã gửi. Chân popup có nút XEM HƯỚNG DẪN (popup con: 3 bước + quy định tính
// thưởng) cạnh nút NỘP BẰNG CHỨNG (popup con: nick Threads + link bài Threads + số lượt trả lời khai báo + 1–5 ảnh, nén
// compressImage, Storage proofs/{uid}/{reportId}/ giống ThreadsCommentModal). Làm nhiều lần và KHÔNG cộng xu ở đây — Admin nhập
// số lượt trả lời hợp lệ khi duyệt (AdminView.approveReport), xu = số hợp lệ × mức thưởng / lượt trả lời.
const props = defineProps<{ show: boolean; job?: any; myReports?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()

// job: bản đã merge cấu hình Admin (mergedJobs ở App.vue); thiếu thì dùng cấu hình tĩnh trong jobs.ts
const staticJob = jobsData[THREADS_SEEDING_JOB_ID]
const jobConfig = computed(() => props.job || staticJob)
// Xu cho 1 lượt trả lời hợp lệ — cùng nguồn Admin dùng khi duyệt (getTrustedReward: vip_jobs nếu có, không thì jobs.ts)
const ratePerReply = computed(() => Number(String(jobConfig.value?.reward ?? '').replace(/\D/g, '')) || 0)
const fmtXu = (n: number) => n.toLocaleString('vi-VN')

// Tiêu đề tách ở " – " để tô màu phần sau, giống tiêu đề BÌNH LUẬN DẠO – THREADS
const titleParts = computed(() => {
  const [main = '', ...rest] = String(jobConfig.value?.title || '').split(' – ')
  return { main, sub: rest.join(' – ') }
})

const exampleCount = computed(() => Number(jobConfig.value?.exampleReplyCount ?? staticJob.exampleReplyCount) || 0)
const exampleTiers = computed<number[]>(() =>
  (jobConfig.value?.exampleReplyCounts ?? staticJob.exampleReplyCounts ?? []).map(Number).filter((n: number) => n > 0)
)
const steps = computed<any[]>(() => jobConfig.value?.steps ?? staticJob.steps ?? [])
const rules = computed<string[]>(() => jobConfig.value?.rules ?? staticJob.rules ?? [])
// Popup XEM HƯỚNG DẪN riêng — chỉ mở khi bấm nút, không tự bật khi mở job
const showGuide = ref(false)

// --- Ảnh minh họa: chỉ hiện khi tải được thật. File chưa có (Vite / Cloudflare Pages trả về trang HTML thay vì 404,
// trình duyệt báo lỗi ảnh) → hiện "Ảnh minh họa đang được cập nhật", không hiện biểu tượng ảnh lỗi ---
const guideImageSrc = computed(() => {
  const path = String(jobConfig.value?.guideImage || '').trim()
  if (!path) return ''
  return /^https?:\/\//i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\/+/, '')
})
const guideImageState = ref<'loading' | 'loaded' | 'missing'>('loading')
watch([() => props.show, guideImageSrc], () => { guideImageState.value = guideImageSrc.value ? 'loading' : 'missing' }, { immediate: true })
const zoomImage = ref<string | null>(null)

// --- Nội dung trả lời mẫu (biến replyContent trong jobs.ts) — chỉ hiện ở popup XEM HƯỚNG DẪN, bước có showReplyContent ---
const replyContent = computed(() => String(jobConfig.value?.replyContent ?? '').trim())
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
const copyContent = async () => {
  const text = replyContent.value
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
  Swal.fire({ title: 'Đã sao chép thành công', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' })
}

// --- Đơn đã gửi của job này (myReports: 50 đơn gần nhất của user, realtime từ App.vue) ---
// createdAt chưa có = serverTimestamp đang ghi → coi là vừa gửi
const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : ts ? new Date(ts).getTime() : Date.now()
const formatTime = (ts: any) => {
  const d = new Date(getTime(ts))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${d.getDate()}/${d.getMonth() + 1}`
}
const isApproved = (r: any) => r.status === 'approved' || r.status === 'collected'
const mySeedingReports = computed(() =>
  (props.myReports || [])
    .filter(r => r.jobId === THREADS_SEEDING_JOB_ID)
    .slice()
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
)
const recentReports = computed(() => mySeedingReports.value.slice(0, 5))
const pendingCount = computed(() => mySeedingReports.value.filter(r => r.status === 'pending').length)
const approvedCount = computed(() => mySeedingReports.value.filter(isApproved).length)
const creditedXu = (r: any) => Number(r.actualReward ?? String(r.reward ?? '').replace(/\D/g, '')) || 0
const shortPostUrl = (url: any) => String(url || '').replace(/^https?:\/\/(www\.)?/i, '')

// --- Form nộp bằng chứng ---
const MAX_PROOF_IMAGES = 5
// Chỉ chặn gõ nhầm số quá lớn — không phải giới hạn số lượt trả lời (làm nhiều hơn thì gửi thêm đơn)
const MAX_REPLY_DIGITS = 4

const showProof = ref(false)
const threadsNickInput = ref('')
const postUrlInput = ref('')
const replyCountInput = ref('')
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

// Nick Threads: nhận "@nick", "nick" hoặc link trang cá nhân — cùng cách kiểm tra với BÌNH LUẬN DẠO (utils/threadsComment.ts)
const threadsNick = computed(() => extractThreadsNick(threadsNickInput.value))
const onThreadsNickInput = (event: Event) => {
  const el = event.target as HTMLInputElement
  // Ô nhập đã có sẵn "@" phía trước → bỏ "@" người dùng tự gõ thêm
  const clean = el.value.replace(/^@+/, '')
  if (clean !== el.value) el.value = clean
  threadsNickInput.value = clean
}
// Rời ô nhập: link trang cá nhân / chữ hoa → đổi về đúng nick sẽ gửi
const normalizeNickInput = () => {
  if (isValidThreadsNick(threadsNick.value)) threadsNickInput.value = threadsNick.value
}
const nickError = computed(() =>
  threadsNickInput.value.trim() && !isValidThreadsNick(threadsNick.value)
    ? 'Nick Threads chỉ gồm chữ, số, dấu chấm, gạch dưới (tối đa 30 ký tự).'
    : ''
)

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
// Đơn trước của CÙNG bài viết (trong 50 đơn gần nhất) — chỉ nhắc khai báo lượt trả lời mới, không chặn gửi: job không giới hạn,
// bài còn đơn chờ duyệt vẫn gửi tiếp được
const samePostReports = computed(() => {
  const code = parsedPost.value?.code
  return code ? mySeedingReports.value.filter(r => r.threadsPostCode === code) : []
})
const samePostVerified = computed(() =>
  samePostReports.value.filter(isApproved).reduce((sum, r) => sum + (Number(r.verifiedCommentCount) || 0), 0)
)

const onReplyCountInput = (event: Event) => {
  const el = event.target as HTMLInputElement
  const clean = el.value.replace(/\D/g, '').slice(0, MAX_REPLY_DIGITS)
  el.value = clean
  replyCountInput.value = clean
}
const replyCount = computed(() => Number(replyCountInput.value) || 0)
const estimatedXu = computed(() => replyCount.value * ratePerReply.value)

const canSubmit = computed(() =>
  isValidThreadsNick(threadsNick.value) && !!parsedPost.value && replyCount.value >= 1 &&
  proofImages.value.length > 0 && !processingImages.value && !submitting.value
)
const submitHint = computed(() => {
  if (submitting.value || processingImages.value) return ''
  const missing: string[] = []
  if (!isValidThreadsNick(threadsNick.value)) missing.push('nick Threads')
  if (!parsedPost.value) missing.push('link bài Threads')
  if (replyCount.value < 1) missing.push('số lượt trả lời')
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

// Không mở chồng 2 popup con: mở cái này thì đóng cái kia. Dữ liệu form nộp bằng chứng giữ nguyên khi đóng/mở popup.
const openGuide = () => {
  if (submitting.value) return
  showProof.value = false
  showGuide.value = true
}
const openProof = () => {
  // Điền sẵn nick Threads đã dùng ở đơn trước
  if (!threadsNickInput.value) {
    const lastNick = mySeedingReports.value.find(r => r.threadsNick)?.threadsNick
    if (lastNick) threadsNickInput.value = lastNick
  }
  showGuide.value = false
  showProof.value = true
}
const closeProof = () => {
  if (submitting.value) return
  zoomImage.value = null
  showProof.value = false
}
// Đóng popup job bằng bất kỳ cách nào thì lần mở sau luôn bắt đầu từ trang công việc
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
  const nick = threadsNick.value
  const count = replyCount.value
  const images = proofImages.value.slice()
  const hashes = images.map(img => img.hash).filter(Boolean)

  submitting.value = true
  const tSubmitStart = perfMark()
  try {
    // Không nhận lại ảnh của đơn trước (đang chờ / đã duyệt) — so SHA-256 file gốc. Đọc lại Firestore vì myReports chỉ có
    // 50 đơn gần nhất. Đơn bị từ chối không tính để user sửa lại và gửi lại được. Bài còn đơn chờ duyệt vẫn gửi tiếp được (job
    // không giới hạn) — tab duyệt của Admin gắn cảnh báo TRÙNG LINK cho các đơn cùng bài.
    if (hashes.length) {
      const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('jobId', '==', THREADS_SEEDING_JOB_ID)))
      const usedHashes = new Set<string>()
      snap.docs.forEach(d => {
        const r = d.data()
        if (r.status !== 'rejected' && Array.isArray(r.proofImageHashes)) r.proofImageHashes.forEach((h: string) => usedHashes.add(h))
      })
      const duplicateCount = hashes.filter(h => usedHashes.has(h)).length
      if (duplicateCount) {
        Swal.fire({
          icon: 'warning',
          title: 'ẢNH ĐÃ GỬI Ở ĐƠN TRƯỚC!',
          text: `Có ${duplicateCount} ảnh trùng với đơn bạn đã gửi. Mỗi lượt trả lời chỉ được nhận thưởng 1 lần — hãy bỏ ảnh đó và chỉ gửi ảnh các lượt trả lời mới.`,
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
      perfLog(`Upload ${images.length} ảnh đăng bài Threads – seeding (uploadBytes+getDownloadURL)`, tUpload)
    } catch (uploadError: any) {
      alert('❌ LỖI TẢI ẢNH LÊN: ' + (uploadError?.message || 'Vui lòng thử lại.'))
      return
    }

    submitStage.value = 'saving'
    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}
    const rate = ratePerReply.value

    await setDoc(reportRef, {
      uid: user.uid,
      username: userDoc.username || '',
      fullName: userDoc.fullName || '',
      phoneRef: userDoc.phoneRef || userDoc.phone || '',
      jobId: THREADS_SEEDING_JOB_ID,
      jobName: jobConfig.value?.title || staticJob.title,
      // Số xu DỰ KIẾN nếu mọi lượt trả lời khai báo đều hợp lệ — chỉ để hiện trong lịch sử lúc chờ duyệt. Admin không dùng số
      // này: khi duyệt, approveReport() ghi đè reward/actualReward = số lượt hợp lệ × mức thưởng lấy từ cấu hình job.
      reward: count * rate,
      rewardPerComment: rate,
      // Dùng chung field với BÌNH LUẬN DẠO (xem utils/threadsSeeding.ts): commentCount = số lượt trả lời khai báo
      commentCount: count,
      threadsNick: nick,
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
    postUrlInput.value = ''
    replyCountInput.value = ''
    proofImages.value = []
    imageError.value = ''
    showSuccess.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + (error?.message || 'Vui lòng thử lại!'))
  } finally {
    perfLog('TỔNG THỜI GIAN GỬI ĐĂNG BÀI THREADS – SEEDING (từ lúc bấm gửi)', tSubmitStart)
    submitting.value = false
    submitStage.value = 'idle'
  }
}

// Gửi xong quay về trang công việc (job làm nhiều lần) — đơn mới hiện ngay ở mục "Đơn đã gửi"
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
          <!-- 1. Tên công việc -->
          <h2 class="pr-10 text-white text-[18px] min-[375px]:text-[19px] font-black leading-tight uppercase text-balance">
            {{ jobConfig?.icon }} {{ titleParts.main }}<template v-if="titleParts.sub"> –&nbsp;<span class="text-red-400">{{ titleParts.sub }}</span></template>
          </h2>

          <!-- 2. Badge KHÔNG GIỚI HẠN -->
          <p class="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 min-[375px]:px-3 py-1 text-emerald-300 text-[10px] min-[375px]:text-[11px] font-black uppercase tracking-normal min-[375px]:tracking-wide whitespace-nowrap">
            ♾ Không giới hạn — làm nhiều lần
          </p>

          <!-- 3. Khung thưởng / lượt trả lời -->
          <div class="mt-3 rounded-2xl border border-yellow-400/40 bg-gradient-to-br from-yellow-400/15 via-amber-500/10 to-red-600/15 px-3 py-3.5 text-center shadow-[0_0_24px_rgba(250,204,21,0.12)]">
            <p class="text-yellow-300 font-black uppercase leading-tight">
              <span class="text-[26px] min-[375px]:text-[28px] tracking-tight">{{ fmtXu(ratePerReply) }} XU</span>
              <span class="block text-[13px] tracking-wide">/ lượt trả lời bình luận hợp lệ</span>
            </p>
          </div>

          <!-- 4. Ví dụ quy đổi: 1 ví dụ nổi bật + các mốc nhỏ -->
          <div v-if="exampleCount" class="mt-3 rounded-2xl border-2 border-yellow-400/50 bg-yellow-400/[0.08] px-3 py-3 text-center">
            <p class="text-slate-400 text-[11px] font-black uppercase tracking-wider">💰 Ví dụ quy đổi</p>
            <p class="mt-1 text-white text-[13px] min-[375px]:text-[14px] font-black uppercase leading-snug text-balance">
              {{ exampleCount }} người bình luận + trả lời đủ {{ exampleCount }} bình luận
            </p>
            <p class="mt-0.5 text-yellow-300 text-[20px] font-black leading-tight">= {{ fmtXu(exampleCount * ratePerReply) }} XU</p>
            <div v-if="exampleTiers.length" class="mt-2.5 grid grid-cols-4 gap-1.5">
              <div v-for="n in exampleTiers" :key="n" class="min-w-0 rounded-lg border border-white/10 bg-black/35 px-1 py-1.5">
                <p class="text-slate-400 text-[10.5px] font-bold leading-none">{{ n }} lượt</p>
                <p class="mt-1 text-yellow-400 text-[12px] font-black leading-none">{{ fmtXu(n * ratePerReply) }}</p>
              </div>
            </div>
          </div>

          <!-- 5. Ảnh minh họa (khung thu gọn, chạm để xem ảnh đầy đủ) -->
          <section class="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3.5">
            <p class="text-white text-[13px] font-black uppercase tracking-wide">📸 Ảnh minh họa</p>
            <div class="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <button v-if="guideImageSrc && guideImageState !== 'missing'" v-show="guideImageState === 'loaded'" type="button"
                      @click="zoomImage = guideImageSrc" aria-label="Phóng to ảnh minh họa" class="relative block w-full cursor-zoom-in">
                <img :src="guideImageSrc" alt="Ảnh minh họa cách đăng bài và trả lời bình luận trên Threads"
                     class="block w-full aspect-[8/5] object-cover object-top"
                     @load="guideImageState = 'loaded'" @error="guideImageState = 'missing'" />
                <span class="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2 py-1 text-white text-[10.5px] font-bold">🔍 Chạm để phóng to</span>
              </button>
              <div v-if="guideImageState !== 'loaded'" class="min-h-[132px] flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                <span v-if="guideImageState === 'loading'" class="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                <template v-else>
                  <span class="text-[26px] leading-none">🖼️</span>
                  <p class="text-slate-300 text-[13px] font-bold">Ảnh minh họa đang được cập nhật</p>
                </template>
              </div>
            </div>
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
                    <p class="text-white text-[12.5px] font-bold">{{ r.commentCount ?? '?' }} lượt trả lời</p>
                    <p class="text-slate-500 text-[11px] font-medium truncate">{{ formatTime(r.createdAt) }}<template v-if="r.threadsPostUrl"> · {{ shortPostUrl(r.threadsPostUrl) }}</template></p>
                  </div>
                  <div class="shrink-0 text-right">
                    <p v-if="r.status === 'pending'" class="text-yellow-300 text-[12px] font-black">⏳ Chờ duyệt</p>
                    <template v-else-if="isApproved(r)">
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

        <!-- 6. Chân popup, luôn nằm dưới cùng (không phải cuộn): XEM HƯỚNG DẪN cạnh NỘP BẰNG CHỨNG, chia đều 2 cột -->
        <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div class="grid grid-cols-2 gap-2">
            <button @click="openGuide"
                    class="h-12 rounded-xl border-2 border-amber-400/60 bg-black/40 active:bg-amber-400/10 text-amber-100 text-[12px] min-[375px]:text-[13px] font-black uppercase tracking-normal min-[375px]:tracking-wide whitespace-nowrap transition-colors">
              📖 Xem hướng dẫn
            </button>
            <button @click="openProof"
                    class="h-12 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 active:from-red-500 active:to-rose-500 text-white text-[12px] min-[375px]:text-[13px] font-black uppercase tracking-normal min-[375px]:tracking-wide whitespace-nowrap shadow-[0_4px_16px_rgba(220,38,38,0.4)] active:scale-[0.98] transition-transform">
              Nộp bằng chứng
            </button>
          </div>
        </div>
      </div>

      <!-- Popup XEM HƯỚNG DẪN: 3 bước + quy định tính thưởng (steps / rules trong jobs.ts) -->
      <div v-if="showGuide" class="fixed inset-0 z-[5400] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75" @click="showGuide = false"></div>
        <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
          <button @click="showGuide = false" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
            <h3 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] font-black leading-tight uppercase">📖 Hướng dẫn công việc</h3>
            <ol class="mt-3.5 space-y-2.5">
              <li v-for="s in steps" :key="s.id" class="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div class="flex items-center gap-2">
                  <span class="shrink-0 rounded-md bg-red-600 px-1.5 py-0.5 text-white text-[10px] font-black uppercase whitespace-nowrap">Bước {{ s.id }}</span>
                  <p class="min-w-0 text-white text-[13px] font-black uppercase leading-snug tracking-wide">{{ s.title }}</p>
                </div>
                <p v-if="s.content" class="mt-1.5 text-slate-300 text-[12.5px] font-medium leading-relaxed">{{ s.content }}</p>
                <div v-if="s.chips?.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="c in s.chips" :key="c" class="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-100 text-[11px] font-bold">{{ c }}</span>
                </div>
                <component :is="s.ordered ? 'ol' : 'ul'" v-if="s.items?.length" class="mt-2 space-y-1">
                  <li v-for="(item, i) in s.items" :key="i" class="flex items-start gap-2 text-slate-200 text-[12.5px] font-medium leading-snug">
                    <span v-if="s.ordered" class="mt-px w-4 h-4 shrink-0 rounded-full bg-white/10 text-slate-200 text-[10px] font-black flex items-center justify-center">{{ Number(i) + 1 }}</span>
                    <span v-else class="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-red-400"></span>
                    <span class="min-w-0">{{ item }}</span>
                  </li>
                </component>
                <p v-if="s.note" class="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-100 text-[11.5px] font-semibold leading-snug">⚠️ {{ s.note }}</p>
                <p v-if="s.showExample && exampleCount" class="mt-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-2 text-yellow-50 text-[12px] font-semibold leading-snug">
                  Ví dụ: có <strong class="font-black">{{ exampleCount }} người bình luận</strong> vào bài và bạn trả lời đủ
                  <strong class="font-black">{{ exampleCount }} bình luận hợp lệ</strong> thì được tính
                  <strong class="text-yellow-300 font-black whitespace-nowrap">{{ fmtXu(exampleCount * ratePerReply) }} xu</strong> sau khi Admin xác minh.
                </p>
                <!-- Nội dung trả lời mẫu + nút sao chép (replyContent / copyContent) -->
                <template v-if="s.showReplyContent">
                  <div class="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5">
                    <p v-if="replyContent" class="text-slate-100 text-[12.5px] font-medium leading-relaxed whitespace-pre-line break-words select-text">{{ replyContent }}</p>
                    <p v-else class="text-center text-slate-500 text-[12.5px] font-semibold italic">Nội dung đang được cập nhật</p>
                  </div>
                  <button @click="copyContent" :disabled="!replyContent"
                          class="mt-2 w-full h-10 rounded-xl text-[13px] font-black uppercase tracking-wide transition-colors"
                          :class="!replyContent
                            ? 'bg-slate-700/70 text-slate-400 cursor-not-allowed'
                            : copied ? 'bg-emerald-600 text-white' : 'bg-red-600 active:bg-red-500 text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)]'">
                    {{ copied ? '✓ Đã sao chép' : 'Sao chép nội dung' }}
                  </button>
                </template>
              </li>
            </ol>

            <section v-if="rules.length" class="mt-3 rounded-2xl border-2 border-amber-400/50 bg-amber-500/10 p-3">
              <p class="text-amber-300 text-[13px] font-black uppercase tracking-wide">⚠️ Quy định tính thưởng</p>
              <ul class="mt-1.5 space-y-1">
                <li v-for="(rule, i) in rules" :key="i" class="flex items-start gap-2 text-amber-50 text-[12px] font-medium leading-snug">
                  <span class="mt-[6px] w-1.5 h-1.5 shrink-0 rounded-full bg-amber-400"></span>
                  <span class="min-w-0">{{ rule }}</span>
                </li>
              </ul>
            </section>
          </div>

          <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <button @click="showGuide = false"
                    class="w-full h-12 rounded-xl bg-red-600 active:bg-red-500 text-white text-[14px] font-black uppercase tracking-wide transition-colors">
              Đã hiểu
            </button>
          </div>
        </div>
      </div>

      <!-- Popup NỘP BẰNG CHỨNG: nick Threads + link bài Threads + số lượt trả lời khai báo + 1–5 ảnh -->
      <div v-if="showProof" class="fixed inset-0 z-[5400] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75" @click="closeProof"></div>
        <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
          <button @click="closeProof" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
            <h3 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] font-black leading-tight uppercase">📤 Nộp bằng chứng</h3>
            <p class="mt-1 pr-10 text-slate-400 text-[12.5px] font-medium">{{ jobConfig?.title }} · <span class="text-yellow-400 font-bold">{{ fmtXu(ratePerReply) }} xu / lượt trả lời hợp lệ</span></p>

            <!-- 1. Nick Threads (điền sẵn nick của đơn trước) -->
            <label for="ts-threads-nick" class="mt-4 block text-white text-[13px] font-black uppercase tracking-wide">Tên nick Threads</label>
            <div class="relative mt-2">
              <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-[16px] font-bold">@</span>
              <input id="ts-threads-nick" :value="threadsNickInput" @input="onThreadsNickInput" @blur="normalizeNickInput"
                     type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ten.threads.cua.ban"
                     class="w-full h-12 rounded-xl border bg-black/40 pl-8 pr-3.5 text-white text-[16px] font-semibold outline-none placeholder:text-slate-500 placeholder:font-medium transition-colors"
                     :class="nickError ? 'border-rose-500/70 focus:border-rose-400' : 'border-white/15 focus:border-yellow-400/60'" />
            </div>
            <p v-if="nickError" class="mt-1.5 text-rose-400 text-[12px] font-bold leading-snug">⚠️ {{ nickError }}</p>
            <p v-else class="mt-1.5 text-slate-500 text-[12px] font-medium leading-snug">Nick bạn dùng để đăng bài — Admin đối chiếu với bài Threads bạn gửi.</p>

            <!-- 2. Link bài Threads -->
            <label for="ts-post-url" class="mt-4 block text-white text-[13px] font-black uppercase tracking-wide">Link bài Threads</label>
            <input id="ts-post-url" v-model.trim="postUrlInput" @blur="normalizePostUrlInput"
                   type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                   placeholder="https://www.threads.com/@ten.ban/post/..."
                   class="mt-2 w-full h-12 rounded-xl border bg-black/40 px-3.5 text-white text-[16px] font-semibold outline-none placeholder:text-slate-500 placeholder:font-medium transition-colors"
                   :class="postUrlError ? 'border-rose-500/70 focus:border-rose-400' : 'border-white/15 focus:border-yellow-400/60'" />
            <p v-if="postUrlError" class="mt-1.5 text-rose-400 text-[12px] font-bold leading-snug">⚠️ {{ postUrlError }}</p>
            <p v-else class="mt-1.5 text-slate-500 text-[12px] font-medium leading-snug">Link bài đăng của chính bạn — Admin mở bài này để kiểm tra các lượt trả lời.</p>

            <!-- Đã gửi bài này ở đơn trước (chờ duyệt / đã duyệt): chỉ nhắc khai báo lượt trả lời mới, không chặn gửi -->
            <p v-if="samePostReports.length" class="mt-2.5 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-yellow-100 text-[12px] font-medium leading-snug">
              Bạn đã gửi bài này ở {{ samePostReports.length }} đơn trước<template v-if="samePostVerified"> ({{ samePostVerified }} lượt đã được tính thưởng)</template>.
              Chỉ khai báo các lượt trả lời <strong class="text-yellow-300 font-black">mới</strong> — lượt đã tính không được tính lại.
            </p>

            <!-- 3. Số lượt trả lời khai báo -->
            <label for="ts-reply-count" class="mt-4 block text-white text-[13px] font-black uppercase tracking-wide">Số lượt trả lời bình luận</label>
            <input id="ts-reply-count" :value="replyCountInput" @input="onReplyCountInput"
                   type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="VD: 10"
                   class="mt-2 w-full h-12 rounded-xl border border-white/15 bg-black/40 px-3.5 text-white text-[16px] font-bold outline-none placeholder:text-slate-500 placeholder:font-medium focus:border-yellow-400/60 transition-colors" />
            <p class="mt-1.5 text-[12px] font-medium leading-snug" :class="replyCount ? 'text-slate-300' : 'text-slate-500'">
              <template v-if="replyCount">Dự kiến tối đa <span class="text-yellow-400 font-black">{{ fmtXu(estimatedXu) }} xu</span> nếu cả {{ replyCount }} lượt trả lời đều hợp lệ.</template>
              <template v-else>Đây là số bạn khai báo — Admin kiểm tra và chỉ cộng xu cho lượt trả lời hợp lệ.</template>
            </p>

            <!-- 4. Ảnh bằng chứng (1–5 ảnh) -->
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
              Chụp rõ bài đăng, bình luận của người khác và lượt trả lời của bạn. Một ảnh có thể chứa nhiều lượt trả lời.
            </p>
          </div>

          <div class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <p v-if="submitHint" class="mb-2 text-center text-slate-400 text-[11.5px] font-medium">{{ submitHint }}</p>
            <button @click="submitProof" :disabled="!canSubmit"
                    class="w-full h-12 rounded-xl text-[14px] font-black uppercase tracking-wide transition-transform"
                    :class="canSubmit
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_4px_16px_rgba(220,38,38,0.4)] active:scale-[0.98]'
                      : 'bg-slate-700/70 text-slate-400 cursor-not-allowed'">
              {{ submitStage === 'uploading' ? `ĐANG TẢI ẢNH ${uploadedCount}/${proofImages.length}...` : submitStage === 'saving' ? 'ĐANG GỬI...' : submitting ? 'ĐANG KIỂM TRA...' : 'GỬI ĐƠN' }}
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
            Đơn {{ submittedCount }} lượt trả lời · <span class="whitespace-nowrap">tối đa +{{ fmtXu(submittedCount * ratePerReply) }} xu</span> · <span class="whitespace-nowrap">CHỜ DUYỆT</span>
          </div>
          <p class="mt-2 text-slate-500 text-[11.5px] font-medium leading-snug">Xu nhận = số lượt trả lời hợp lệ × {{ fmtXu(ratePerReply) }} xu.</p>
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
