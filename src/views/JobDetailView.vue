<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jobsData } from '@/data/jobs'
import { useVipJobs } from '@/composables/useVipJobs'
import { usePostThreadsConfig } from '@/composables/usePostThreadsConfig'
import { POST_THREADS_JOB_ID } from '@/utils/postThreadsConfig'
import Swal from 'sweetalert2'
import LpbankPlusGuideModal from '@/components/LpbankPlusGuideModal.vue'
import LpbankPlusProofModal from '@/components/LpbankPlusProofModal.vue'
import LpbankPlusHistoryModal from '@/components/LpbankPlusHistoryModal.vue'
import VietcombankGuideModal from '@/components/VietcombankGuideModal.vue'
import VietcombankProofModal from '@/components/VietcombankProofModal.vue'
import VietcombankHistoryModal from '@/components/VietcombankHistoryModal.vue'
import ShopeePayGuideModal from '@/components/ShopeePayGuideModal.vue'
import ShopeePayProofModal from '@/components/ShopeePayProofModal.vue'
import ShopeePayHistoryModal from '@/components/ShopeePayHistoryModal.vue'

const props = defineProps<{ myReports?: any[] }>()

const route = useRoute()
const router = useRouter()
const showGuide = ref(true)
const baseUrl = import.meta.env.BASE_URL

const { vipJobs } = useVipJobs()

const jobId = route.params.id as string
const staticJob = jobsData[jobId] || jobsData['app-chung-khoan']

// --- Giao diện rút gọn cho các job CƠ BẢN trên mobile (không đụng tới các job VIP ngân hàng
// hay các job dùng popup riêng — chỉ áp dụng đúng 5 job cơ bản dùng chung layout "steps" này) ---
const BASIC_TIER_IDS = ['follow-cgv', 'review-cinema', 'checkin-cinema', 'post-threads', 'join-zalo']
const isBasicTierJob = BASIC_TIER_IDS.includes(jobId)

const BASIC_JOB_ICON: Record<string, string> = {
  'follow-cgv': '🎬', 'review-cinema': '⭐', 'checkin-cinema': '📸', 'post-threads': '🧵', 'join-zalo': '💬',
}
const basicJobIcon = BASIC_JOB_ICON[jobId] || '🎯'

// Danh sách "bạn cần gửi" hiển thị thuần UI — không ảnh hưởng validation thật của form nộp bằng chứng.
// Job nào chưa có cấu hình riêng thì dùng câu mặc định.
const PROOF_CHECKLIST: Record<string, string[]> = {
  'follow-cgv': ['Ảnh đã Follow fanpage CGV Cinemas VN', 'Ảnh bài Share trên tường Facebook'],
  'review-cinema': ['Ảnh review 5 sao trên Google Maps (rõ tên tài khoản)'],
  'checkin-cinema': ['Ảnh bài đăng công khai có tag + hashtag rạp phim'],
  'post-threads': ['Ảnh bài đăng Threads đã đăng', 'Ảnh bình luận có ghim mã QR'],
  'join-zalo': ['Ảnh màn hình đã tham gia nhóm Zalo'],
}
const proofChecklist = PROOF_CHECKLIST[jobId] || []
const requiredImageCount = proofChecklist.length || 1

// Trạng thái tạm dừng — hiện tại chỉ job "ĐĂNG BÀI THREADS" (post-threads) có cơ chế admin bật/tắt/tạm dừng
// qua basic_job_configs/dang_bai_threads. Các job cơ bản khác chưa có cơ chế paused nên luôn coi là mở.
const { config: postThreadsConfig } = usePostThreadsConfig()
const isJobPaused = computed(() => jobId === POST_THREADS_JOB_ID && postThreadsConfig.value.status === 'paused')

const guideSectionEl = ref<HTMLElement | null>(null)
const scrollToGuide = () => {
  guideSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const goSubmitReport = () => {
  if (isJobPaused.value) {
    alert('Công việc này đang tạm dừng, vui lòng quay lại sau.')
    return
  }
  router.push(`/submit-report?job=${jobId}`)
}

// Lịch sử nộp đơn của riêng job này — lọc từ myReports đã có sẵn (App.vue truyền qua router-view),
// không gọi thêm Firestore/backend nào mới.
const showJobHistory = ref(false)

// Job APP LPBANK PLUS dùng giao diện riêng: 3 nút CTA mở popup tại chỗ thay vì điều hướng trang
const isLpbankPlus = jobId === 'lpbank-plus'
const showLpGuide = ref(false)
const showLpProof = ref(false)
const showLpHistory = ref(false)
const showLpSuccess = ref(false)
const openLpGuide = () => { showLpGuide.value = true }
const openLpProof = () => { showLpGuide.value = false; showLpProof.value = true }
const openLpHistory = () => { showLpHistory.value = true }
const handleLpSubmitted = () => { showLpProof.value = false; showLpSuccess.value = true }

// Job VIETCOMBANK — clone của khối APP LPBANK PLUS ở trên, dùng giao diện popup riêng tương tự
const isVietcombank = jobId === 'vietcombank'
const showVcGuide = ref(false)
const showVcProof = ref(false)
const showVcHistory = ref(false)
const showVcSuccess = ref(false)
const openVcGuide = () => { showVcGuide.value = true }
const openVcProof = () => { showVcGuide.value = false; showVcProof.value = true }
const openVcHistory = () => { showVcHistory.value = true }
const handleVcSubmitted = () => { showVcProof.value = false; showVcSuccess.value = true }

// Job SHOPEE PAY — clone của khối VIETCOMBANK ở trên, dùng giao diện popup riêng tương tự
const isShopeePay = jobId === 'shopee-pay'
const isPopupJob = isLpbankPlus || isVietcombank || isShopeePay
const showSpGuide = ref(false)
const showSpProof = ref(false)
const showSpHistory = ref(false)
const showSpSuccess = ref(false)
const openSpGuide = () => { showSpGuide.value = true }
const openSpProof = () => { showSpGuide.value = false; showSpProof.value = true }
const openSpHistory = () => { showSpHistory.value = true }
const handleSpSubmitted = () => { showSpProof.value = false; showSpSuccess.value = true }

const openPopupGuide = () => { isLpbankPlus ? openLpGuide() : isVietcombank ? openVcGuide() : openSpGuide() }
const openPopupProof = () => { isLpbankPlus ? openLpProof() : isVietcombank ? openVcProof() : openSpProof() }
const openPopupHistory = () => { isLpbankPlus ? openLpHistory() : isVietcombank ? openVcHistory() : openSpHistory() }

const currentJob = computed((): any => {
  const override = vipJobs.value.find((v: any) => v.id === jobId)
  if (!override) return { ...staticJob, paused: !!staticJob.paused, soldout: false, status: staticJob.paused ? 'paused' : 'open' }
  return {
    ...staticJob,
    title: override.title ?? staticJob.title,
    reward: override.reward ?? staticJob.reward,
    warning: override.warning ?? staticJob.warning,
    badge: override.badge ?? staticJob.badge,
    color: override.color ?? staticJob.color,
    zaloGuideUrl: override.zaloGuideUrl ?? staticJob.zaloGuideUrl,
    paused: override.status === 'paused',
    soldout: override.status === 'soldout',
    status: override.status,
  }
})

// Cảnh báo quan trọng nhất của job — ưu tiên warning cấp job, nếu không có thì lấy note
// đầu tiên trong các bước (vd: "Facebook phải công khai để admin kiểm tra") để đẩy lên đầu trang.
const topWarning = computed(() => currentJob.value.warning || currentJob.value.steps?.find((s: any) => s.note)?.note || '')

const jobHistoryReports = computed(() =>
  (props.myReports || []).filter((r: any) => r.jobId === jobId || r.jobName === currentJob.value.title)
)

// --- Giao diện gọn cho 4 job VIP đang hiện trong popup "Công việc VIP" ---
// (ABBANK / LPBANK PLUS / VIETCOMBANK / SHOPEE PAY) — chỉ đổi cách hiển thị,
// vẫn dùng đúng steps/quickSteps/proofSampleImages/openPopupProof/openPopupHistory sẵn có.
const VIP_COMPACT_IDS = ['abbank', 'lpbank-plus', 'vietcombank', 'shopee-pay']
const isVipCompactJob = VIP_COMPACT_IDS.includes(jobId)

const VIP_JOB_ICON: Record<string, string> = {
  'abbank': '🏦', 'lpbank-plus': '🏦', 'vietcombank': '🏦', 'shopee-pay': '🛍️',
}
const vipJobIcon = VIP_JOB_ICON[jobId] || '💎'

// Số ảnh cần gửi hiển thị ở header — khớp đúng số ảnh validate thật (threeImageJobs trong SubmitReportView
// cho abbank, hoặc proofSampleImages.length mà các Proof Modal riêng đang yêu cầu). Chỉ dùng để hiển thị UI.
const VIP_REQUIRED_IMAGE_COUNT: Record<string, number> = { 'abbank': 3 }
const vipRequiredImageCount = computed(() => VIP_REQUIRED_IMAGE_COUNT[jobId] ?? (currentJob.value.proofSampleImages?.length || 3))

// Tóm tắt nhanh — dùng chung 1 nội dung cho mọi job VIP, chỉ hiển thị UI (không thay thế các bước xử lý thật bên dưới)
const vipQuickSummary = ['Chọn "Hướng dẫn" để xem chi tiết các bước', 'Gửi bằng chứng và chờ admin duyệt đơn để nhận hoa hồng']

// "Bạn cần gửi" — checklist hiển thị UI. Job chưa cấu hình riêng dùng câu mặc định.
const VIP_SUBMIT_CHECKLIST: Record<string, string[]> = {
  'abbank': ['Ảnh nhập mã giới thiệu', 'Ảnh đăng ký thành công', 'Ảnh giao dịch/hoàn tất'],
  'lpbank-plus': ['Ảnh nhập mã giới thiệu', 'Ảnh đăng ký thành công', 'Ảnh chuyển tiền vào/ra'],
  'vietcombank': ['Ảnh nhập mã giới thiệu', 'Ảnh đăng ký thành công', 'Ảnh chuyển tiền vào/ra'],
  'shopee-pay': ['Ảnh nhập mã giới thiệu', 'Ảnh xác thực tài khoản hoàn tất'],
}
const vipSubmitChecklist = computed(() => VIP_SUBMIT_CHECKLIST[jobId] || [])

// Job nào chuyển nút "VÀO NHÓM ZALO LẤY MÃ" vào trong Bước 2 của accordion (thay vì hiện phía trên accordion)
// và ẩn nút Copy mã giới thiệu ở Bước 2 — theo yêu cầu riêng cho từng app.
const ZALO_IN_STEP2_IDS = ['vietcombank', 'lpbank-plus']
const zaloInStep2 = ZALO_IN_STEP2_IDS.includes(jobId)

// Nguồn bước hướng dẫn cho accordion: job popup (lpbank-plus/vietcombank/shopee-pay) đã có sẵn quickSteps rút gọn,
// abbank dùng steps gốc (đã ngắn, 4 bước) — không tạo dữ liệu bước mới.
const vipSteps = computed(() => currentJob.value.quickSteps || currentJob.value.steps || [])

// SHOPEE PAY: thay nút "vào nhóm Zalo lấy mã" ở khu vực tóm tắt bằng nút copy mã giới thiệu thẳng —
// lấy đúng mã đã có sẵn trong bước hướng dẫn (referralCode), không hard-code trùng lặp.
const vipReferralCode = computed(() => vipSteps.value.find((s: any) => s.referralCode)?.referralCode || '')

// Accordion từng bước — mặc định mở bước 1, cho phép mở nhiều bước cùng lúc để mượt trên mobile
const openStepIds = ref<Set<number>>(new Set([1]))
const isStepOpen = (id: number) => openStepIds.value.has(id)
const toggleStep = (id: number) => {
  const next = new Set(openStepIds.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  openStepIds.value = next
}

const vipGuideSectionEl = ref<HTMLElement | null>(null)
const scrollToVipGuide = () => { vipGuideSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

const showVipToast = (title: string) => {
  Swal.fire({ title, icon: 'info', toast: true, position: 'top', timer: 2200, showConfirmButton: false })
}

// Nút "NỘP BẰNG CHỨNG NGAY" — job dùng popup riêng (lpbank-plus/vietcombank/shopee-pay) mở đúng Proof Modal
// sẵn có của job đó; job còn lại (abbank) điều hướng sang SubmitReportView với đúng jobId để form tự chọn job.
const handleVipCtaClick = () => {
  if (currentJob.value.paused) { showVipToast('Công việc này đang tạm dừng, vui lòng quay lại sau.'); return }
  if (currentJob.value.soldout) { showVipToast('Công việc đã hết slot, vui lòng quay lại sau.'); return }
  if (isPopupJob) { openPopupProof(); return }
  router.push(`/submit-report?job=${jobId}`)
}

const handleVipHistoryClick = () => {
  if (isPopupJob) { openPopupHistory(); return }
  showJobHistory.value = true
}

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const handleCopy = (text: string) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    Swal.fire({
      title: 'ĐÃ SAO CHÉP!',
      text: 'Đã lưu nội dung vào khay nhớ tạm.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    })
  }).catch(() => {
    const textArea = document.createElement("textarea")
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      Swal.fire({
        title: 'ĐÃ SAO CHÉP!',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      })
    } catch (err) {
      alert('Lỗi sao chép, hãy copy thủ công nhé!')
    }
    document.body.removeChild(textArea)
  })
}
</script>

<template>
  <div class="min-h-screen bg-transparent text-slate-300 p-4 md:p-8 font-black italic uppercase text-left relative">

    <Transition name="fade">
      <div class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" v-if="selectedImage" @click="closeImage">
        <button class="absolute top-6 right-6 md:top-10 md:right-10 w-12 h-12 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors z-[6010] shadow-2xl" @click.stop="closeImage">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-[6005] cursor-default" :src="selectedImage" @click.stop />
      </div>
    </Transition>

    <div class="flex justify-between items-center mb-8 max-w-4xl mx-auto border-b border-slate-800 pb-4">
      <button class="text-[10px] tracking-[3px] text-slate-500 hover:text-white active:text-white transition-colors flex items-center gap-1 px-3 py-2.5 -mx-3 -my-2 active:scale-95 transition-transform" @click="router.push('/')">
        <span class="text-base font-light not-italic font-sans">✕</span> QUAY LẠI
      </button>
      <span class="text-[10px] tracking-[4px] text-slate-600">HƯỚNG DẪN CHI TIẾT</span>
    </div>

    <div class="max-w-4xl mx-auto space-y-10">

      <!-- ============================================================ -->
      <!-- GIAO DIỆN RÚT GỌN CHO JOB CƠ BẢN (mobile-first) -->
      <!-- ============================================================ -->
      <template v-if="isBasicTierJob">
        <div class="space-y-4 normal-case not-italic font-sans">

          <!-- Header gọn: icon + tên + thưởng + số ảnh cần gửi -->
          <div class="flex items-center gap-3 bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0">{{ basicJobIcon }}</div>
            <div class="flex-1 min-w-0">
              <h1 class="text-white text-[15px] font-black italic uppercase leading-tight tracking-tight">{{ currentJob.title }}</h1>
              <p class="text-emerald-400 text-[12px] font-bold mt-1">Thưởng: {{ currentJob.reward }}</p>
              <p class="text-slate-400 text-[11px] font-semibold mt-0.5">Cần gửi: {{ requiredImageCount }} ảnh bằng chứng</p>
            </div>
          </div>

          <!-- Cảnh báo quan trọng — đẩy lên ngay đầu trang -->
          <div v-if="topWarning" class="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-3">
            <span class="text-red-400 text-base shrink-0">⚠️</span>
            <p class="text-red-300 text-[11.5px] font-semibold leading-snug">{{ topWarning }}</p>
          </div>

          <!-- Quick actions -->
          <div class="grid grid-cols-3 gap-2">
            <button @click="scrollToGuide" class="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors">
              <span class="text-base">📖</span>
              <span class="text-[9.5px] font-bold text-slate-300">Hướng dẫn</span>
            </button>
            <button @click="goSubmitReport" class="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 active:bg-emerald-500/25 transition-colors">
              <span class="text-base">📥</span>
              <span class="text-[9.5px] font-bold text-emerald-400">Nộp bằng chứng</span>
            </button>
            <button @click="showJobHistory = true" class="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors">
              <span class="text-base">📜</span>
              <span class="text-[9.5px] font-bold text-slate-300">Lịch sử</span>
            </button>
          </div>

          <!-- Hướng dẫn nhanh — checklist gọn -->
          <section ref="guideSectionEl" class="bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <h3 class="text-white text-[12px] font-black uppercase tracking-widest mb-3">Hướng dẫn nhanh</h3>
            <div class="space-y-3.5">
              <div v-for="step in currentJob.steps" :key="step.id" class="flex items-start gap-2.5">
                <span class="text-emerald-400 text-sm shrink-0 mt-0.5">✅</span>
                <div class="flex-1 min-w-0 space-y-2">
                  <div>
                    <p class="text-white text-[12.5px] font-bold leading-snug">Bước {{ step.id }}: {{ step.title }}</p>
                    <p v-if="step.content" class="text-slate-400 text-[11px] font-medium leading-relaxed mt-0.5 whitespace-pre-line">{{ step.content }}</p>
                  </div>

                  <p v-if="step.note" class="text-red-300 text-[10.5px] font-semibold bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2 leading-snug">
                    ⚠️ {{ step.note }}
                  </p>

                  <!-- Nội dung copy-paste (post-threads) -->
                  <div v-if="step.templates && step.templates.length" class="space-y-2">
                    <div v-for="(temp, idx) in step.templates" :key="idx" class="relative bg-[#0d121f] border border-slate-700/60 rounded-xl p-3 pr-16">
                      <p class="text-slate-300 text-[10.5px] leading-relaxed whitespace-pre-wrap select-all">{{ temp }}</p>
                      <button class="absolute top-1/2 -translate-y-1/2 right-2.5 bg-blue-600 active:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase" @click="handleCopy(temp)">Copy</button>
                    </div>
                  </div>

                  <!-- Link tải/mở ngoài -->
                  <div v-if="step.downloadLink" class="flex flex-wrap items-center gap-2">
                    <a class="inline-flex items-center gap-1.5 bg-blue-600 active:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-[10px] font-black uppercase" :href="step.downloadLink" target="_blank" :download="step.downloadLink.includes('.png') || step.downloadLink.includes('.jpg') ? 'Tai_Lieu_MMO_PRO' : false">
                      {{ step.buttonText || 'Mở Link' }}
                    </a>
                  </div>
                  <div v-if="step.extraLinks" class="flex flex-wrap items-center gap-2">
                    <a v-for="link in step.extraLinks" :key="link.url" class="inline-flex items-center gap-1.5 bg-blue-600 active:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-[10px] font-black uppercase" :href="link.url" target="_blank">
                      {{ link.text }}
                    </a>
                  </div>

                  <!-- Ảnh minh hoạ bước — thumbnail nhỏ, bấm để xem lớn -->
                  <div v-if="step.img" class="w-24 h-24 rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 cursor-zoom-in" @click="openImage(baseUrl + step.img)">
                    <img class="w-full h-full object-cover" loading="lazy" :src="baseUrl + step.img" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Bạn cần gửi -->
          <section class="bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <h3 class="text-white text-[12px] font-black uppercase tracking-widest mb-3">Bạn cần gửi</h3>
            <ul class="space-y-2">
              <li v-if="proofChecklist.length === 0" class="text-slate-400 text-[11.5px] font-medium">
                📸 Vui lòng gửi ảnh bằng chứng theo hướng dẫn.
              </li>
              <li v-for="(item, idx) in proofChecklist" :key="idx" class="text-slate-300 text-[11.5px] font-medium flex items-start gap-2">
                <span class="shrink-0">📸</span> {{ item }}
              </li>
            </ul>
          </section>

          <!-- Chừa khoảng trống để không bị nút sticky che nội dung cuối trang -->
          <div class="h-24 lg:hidden"></div>

          <!-- Nút nộp bằng chứng — bản thường cho desktop (không sticky) -->
          <button
            class="hidden lg:flex w-full items-center justify-center bg-emerald-500 active:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-[#090e17] py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-colors"
            :disabled="isJobPaused"
            @click="goSubmitReport">
            {{ isJobPaused ? 'CÔNG VIỆC ĐANG TẠM DỪNG' : 'NỘP BẰNG CHỨNG NGAY' }}
          </button>
        </div>

        <!-- Nút nộp bằng chứng — sticky trên mobile, luôn nổi trên bottom nav -->
        <Teleport to="body">
          <div class="fixed bottom-[90px] left-0 right-0 z-[3500] px-4 lg:hidden">
            <button
              class="w-full flex items-center justify-center bg-emerald-500 active:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-[#090e17] py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-colors"
              :disabled="isJobPaused"
              @click="goSubmitReport">
              {{ isJobPaused ? 'CÔNG VIỆC ĐANG TẠM DỪNG' : 'NỘP BẰNG CHỨNG NGAY' }}
            </button>
          </div>
        </Teleport>
      </template>

      <!-- Lịch sử nộp đơn — dùng chung cho job cơ bản và job VIP không có popup riêng (vd ABBANK).
           Lọc từ myReports đã có sẵn, không gọi backend mới. -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showJobHistory" class="fixed inset-0 z-[6200] flex items-end lg:items-center justify-center" @click.self="showJobHistory = false">
            <div class="absolute inset-0 bg-black/70"></div>
            <div class="relative w-full lg:max-w-md max-h-[75vh] flex flex-col bg-[#151b28] border border-slate-800 rounded-t-3xl lg:rounded-3xl overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
                <h3 class="text-white text-[13px] font-black uppercase tracking-tight">Lịch sử nộp đơn — {{ currentJob.title }}</h3>
                <button @click="showJobHistory = false" class="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-slate-400">✕</button>
              </div>
              <div class="overflow-y-auto p-3 space-y-2">
                <p v-if="jobHistoryReports.length === 0" class="text-slate-500 text-[11px] font-medium text-center py-8">Chưa có lượt nộp bằng chứng nào cho công việc này.</p>
                <div v-for="r in jobHistoryReports" :key="r.id" class="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
                  <div class="min-w-0">
                    <p class="text-white text-[11.5px] font-bold truncate">{{ r.jobName || currentJob.title }}</p>
                    <p class="text-slate-500 text-[10px] font-medium">{{ r.reward }}</p>
                  </div>
                  <span class="text-[9px] font-black uppercase px-2 py-1 rounded-md shrink-0"
                    :class="{
                      'bg-emerald-500/15 text-emerald-400': r.status === 'approved' || r.status === 'collected',
                      'bg-yellow-500/15 text-yellow-400': r.status === 'pending',
                      'bg-rose-500/15 text-rose-400': r.status === 'rejected',
                    }">
                    {{ r.status === 'approved' || r.status === 'collected' ? 'Đã duyệt' : r.status === 'pending' ? 'Đang chờ' : 'Từ chối' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- ============================================================ -->
      <!-- GIAO DIỆN GỌN CHO JOB VIP: ABBANK / LPBANK PLUS / VIETCOMBANK / SHOPEE PAY -->
      <!-- ============================================================ -->
      <template v-if="isVipCompactJob">
        <div class="space-y-4 normal-case not-italic font-sans">

          <!-- Header gọn: icon + tên + thưởng + tuổi + số ảnh cần gửi -->
          <div class="flex items-center gap-3 bg-[#111726]/60 border border-amber-500/20 rounded-2xl p-4">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl shrink-0">{{ vipJobIcon }}</div>
            <div class="flex-1 min-w-0">
              <h1 class="text-white text-[15px] font-black italic uppercase leading-tight tracking-tight">{{ currentJob.title }}</h1>
              <p class="text-amber-400 text-[12px] font-bold mt-1">
                Thưởng: {{ currentJob.reward }}
                <span v-if="currentJob.ageRequirement" class="text-slate-400 font-semibold"> · từ {{ currentJob.ageRequirement }} tuổi</span>
              </p>
              <p class="text-slate-400 text-[11px] font-semibold mt-0.5">Cần gửi: {{ vipRequiredImageCount }} ảnh bằng chứng</p>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="grid grid-cols-3 gap-2">
            <button @click="scrollToVipGuide" class="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors">
              <span class="text-base">📖</span>
              <span class="text-[9.5px] font-bold text-slate-300">Hướng dẫn</span>
            </button>
            <button @click="handleVipCtaClick" class="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 active:bg-amber-500/25 transition-colors">
              <span class="text-base">📥</span>
              <span class="text-[9.5px] font-bold text-amber-400">Nộp bằng chứng</span>
            </button>
            <button @click="handleVipHistoryClick" class="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors">
              <span class="text-base">📜</span>
              <span class="text-[9.5px] font-bold text-slate-300">Lịch sử</span>
            </button>
          </div>

          <!-- Tóm tắt nhanh -->
          <section v-if="vipQuickSummary.length" class="bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <h3 class="text-white text-[12px] font-black uppercase tracking-widest mb-3">Tóm tắt nhanh</h3>
            <ol class="space-y-2">
              <li v-for="(line, idx) in vipQuickSummary" :key="idx" class="flex items-start gap-2.5 text-[11.5px] font-medium text-slate-300 leading-snug">
                <span class="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-black flex items-center justify-center mt-0.5">{{ Number(idx) + 1 }}</span>
                {{ line }}
              </li>
            </ol>
          </section>

          <!-- Mẹo kiếm thêm — giữ nguyên nội dung gốc, gọn lại giao diện -->
          <section v-if="jobId === 'abbank' || isPopupJob" class="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-4 flex items-start gap-2.5">
            <span class="text-base shrink-0">🪝</span>
            <p class="text-slate-300 text-[11px] font-medium leading-relaxed">
              Nếu bạn đã đăng ký APP này rồi, có thể <span class="text-amber-400 font-bold">giới thiệu bạn bè / người thân đăng ký</span> và chụp lại ảnh bằng chứng gửi lên hệ thống, vẫn được nhận hoa hồng bình thường.
              <template v-if="jobId === 'abbank'"> Chỉ giới thiệu được <span class="text-amber-400 font-bold">1 lần duy nhất</span>.</template>
            </p>
          </section>

          <!-- Nhóm Zalo lấy mã / xem hướng dẫn, nếu job có cấu hình -->
          <a v-if="(currentJob.zaloGuideUrl || currentJob.zaloReferralLink) && jobId !== 'shopee-pay'" :href="currentJob.zaloGuideUrl || currentJob.zaloReferralLink" target="_blank"
             class="flex items-center justify-center gap-2 bg-[#0068FF] active:bg-blue-500 text-white px-4 py-3 rounded-xl text-[11px] font-black uppercase transition-colors">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-5 h-5" />
            VÀO NHÓM ZALO LẤY MÃ / XEM HƯỚNG DẪN
          </a>

          <!-- SHOPEE PAY: nút copy mã giới thiệu thẳng, thay cho nút vào nhóm Zalo -->
          <div v-if="jobId === 'shopee-pay' && vipReferralCode" class="bg-[#0d121f] border border-amber-500/40 p-3 rounded-xl flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-[8.5px] text-amber-400 font-black tracking-[1.5px] uppercase mb-0.5">Mã giới thiệu</p>
              <p class="text-white text-[14px] font-black italic tracking-wider select-all truncate">{{ vipReferralCode }}</p>
            </div>
            <button class="bg-amber-500 active:bg-amber-400 text-[#090e17] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase shrink-0" @click="handleCopy(vipReferralCode)">Copy</button>
          </div>

          <!-- Hướng dẫn — accordion từng bước, mặc định chỉ mở bước 1 -->
          <section ref="vipGuideSectionEl" class="bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <h3 class="text-white text-[12px] font-black uppercase tracking-widest mb-3">Hướng dẫn từng bước</h3>
            <div class="space-y-2">
              <div v-for="step in vipSteps" :key="step.id" class="rounded-xl border border-slate-800/60 overflow-hidden">
                <button @click="toggleStep(step.id)" class="w-full flex items-center gap-3 px-3 py-3 bg-white/[0.02] active:bg-white/[0.05] transition-colors text-left">
                  <span class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-black flex items-center justify-center shrink-0">{{ step.id }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-[12px] font-bold leading-snug">Bước {{ step.id }}: {{ step.title }}</p>
                    <p v-if="!isStepOpen(step.id)" class="text-slate-500 text-[10.5px] font-medium truncate mt-0.5">{{ step.content }}</p>
                  </div>
                  <svg class="w-4 h-4 text-slate-500 shrink-0 transition-transform" :class="isStepOpen(step.id) ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>

                <div v-if="isStepOpen(step.id)" class="px-3 pb-3.5 pt-1 space-y-2.5">
                  <p v-if="step.content" class="text-slate-400 text-[11px] font-medium leading-relaxed whitespace-pre-line">{{ step.content }}</p>

                  <p v-if="step.note" class="text-red-300 text-[10.5px] font-semibold bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2 leading-snug">⚠️ {{ step.note }}</p>

                  <div v-if="step.referralCode && !zaloInStep2" class="bg-[#0d121f] border border-amber-500/40 p-2.5 rounded-xl flex items-center gap-2.5">
                    <div class="flex-1 min-w-0">
                      <p class="text-[8.5px] text-amber-400 font-black tracking-[1.5px] uppercase mb-0.5">Mã giới thiệu</p>
                      <p class="text-white text-[13px] font-black italic tracking-wider select-all truncate">{{ step.referralCode }}</p>
                    </div>
                    <button class="bg-amber-500 active:bg-amber-400 text-[#090e17] px-3 py-2 rounded-lg text-[9.5px] font-black uppercase shrink-0" @click="handleCopy(step.referralCode)">Copy</button>
                  </div>

                  <!-- VIETCOMBANK / LPBANK PLUS: nút vào nhóm Zalo lấy mã chuyển vào đây (Bước 2) thay vì hiện phía trên accordion -->
                  <a v-if="zaloInStep2 && step.id === 2 && (currentJob.zaloGuideUrl || currentJob.zaloReferralLink)"
                     :href="currentJob.zaloGuideUrl || currentJob.zaloReferralLink" target="_blank"
                     class="flex items-center justify-center gap-2 bg-[#0068FF] active:bg-blue-500 text-white px-4 py-3 rounded-xl text-[11px] font-black uppercase transition-colors">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-5 h-5" />
                    VÀO NHÓM ZALO LẤY MÃ / XEM HƯỚNG DẪN
                  </a>

                  <div v-if="step.downloadLink" class="flex flex-wrap items-center gap-2">
                    <a class="inline-flex items-center gap-1.5 bg-blue-600 active:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-[10px] font-black uppercase" :href="step.downloadLink" target="_blank">
                      {{ step.buttonText || 'Mở Link' }}
                    </a>
                  </div>

                  <!-- Ảnh minh hoạ bước — thumbnail nhỏ, bấm để xem lớn; nhiều ảnh thì hiển thị grid -->
                  <div v-if="step.img" class="w-24 h-24 rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 cursor-zoom-in" @click="openImage(baseUrl + step.img)">
                    <img class="w-full h-full object-cover" loading="lazy" :src="baseUrl + step.img" />
                  </div>
                  <div v-if="step.images" class="grid grid-cols-3 gap-2">
                    <div v-for="(imgSrc, idx) in step.images" :key="idx" class="aspect-square rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 cursor-zoom-in" @click="openImage(baseUrl + imgSrc)">
                      <img class="w-full h-full object-cover" loading="lazy" :src="baseUrl + imgSrc" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Ảnh mẫu bằng chứng (job popup có sẵn proofSampleImages) -->
          <section v-if="currentJob.proofSampleImages?.length" class="bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <h3 class="text-white text-[12px] font-black uppercase tracking-widest mb-3">Ảnh mẫu bằng chứng</h3>
            <div class="grid gap-2" :class="currentJob.proofSampleImages.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
              <div v-for="(img, idx) in currentJob.proofSampleImages" :key="idx" class="aspect-[3/4] rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 cursor-zoom-in" @click="openImage(baseUrl + img)">
                <img class="w-full h-full object-cover" loading="lazy" :src="baseUrl + img" />
              </div>
            </div>
          </section>

          <!-- Bạn cần gửi -->
          <section class="bg-[#111726]/60 border border-slate-800/60 rounded-2xl p-4">
            <h3 class="text-white text-[12px] font-black uppercase tracking-widest mb-3">Bạn cần gửi</h3>
            <ul class="space-y-2">
              <li v-if="vipSubmitChecklist.length === 0" class="text-slate-400 text-[11.5px] font-medium">
                📸 Vui lòng gửi đủ ảnh bằng chứng theo hướng dẫn.
              </li>
              <li v-for="(item, idx) in vipSubmitChecklist" :key="idx" class="text-slate-300 text-[11.5px] font-medium flex items-start gap-2">
                <span class="shrink-0">📸</span> {{ item }}
              </li>
            </ul>
          </section>

          <!-- Chừa khoảng trống để không bị nút sticky che nội dung cuối trang -->
          <div class="h-24 lg:hidden"></div>

          <!-- Nút nộp bằng chứng — bản thường cho desktop (không sticky) -->
          <button
            class="hidden lg:flex w-full items-center justify-center bg-amber-500 active:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-[#090e17] py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-colors"
            :disabled="currentJob.paused || currentJob.soldout"
            @click="handleVipCtaClick">
            {{ currentJob.paused ? 'CÔNG VIỆC ĐANG TẠM DỪNG' : currentJob.soldout ? 'HẾT SLOT' : 'NỘP BẰNG CHỨNG NGAY' }}
          </button>
        </div>

        <!-- Nút nộp bằng chứng — sticky trên mobile, luôn nổi trên bottom nav -->
        <Teleport to="body">
          <div class="fixed bottom-[90px] left-0 right-0 z-[3500] px-4 lg:hidden">
            <button
              class="w-full flex items-center justify-center bg-amber-500 active:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-[#090e17] py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-colors"
              :disabled="currentJob.paused || currentJob.soldout"
              @click="handleVipCtaClick">
              {{ currentJob.paused ? 'CÔNG VIỆC ĐANG TẠM DỪNG' : currentJob.soldout ? 'HẾT SLOT' : 'NỘP BẰNG CHỨNG NGAY' }}
            </button>
          </div>
        </Teleport>
      </template>

      <div class="text-center" v-if="!isBasicTierJob && !isVipCompactJob">
        <h1 class="text-4xl md:text-5xl font-black text-white italic tracking-tighter leading-none mb-5 drop-shadow-xl">
          {{ currentJob.title }}
        </h1>
        <div class="bg-[#052e1f] border border-[#005c3c] rounded-full px-6 py-2.5 w-max mx-auto flex items-center gap-2 shadow-inner">
          <span class="text-[#f59e0b] text-xl">⚡</span>
          <span class="text-[#00df89] text-base md:text-lg font-black italic uppercase tracking-tighter">
            THƯỞNG: {{ currentJob.reward }}
          </span>
        </div>

        <div class="mt-6 max-w-xl mx-auto bg-[#1a0f14] border border-red-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-in fade-in zoom-in duration-500" v-if="currentJob.warning && jobId !== 'abbank' && !isPopupJob">
          <div class="flex items-start gap-3">
            <span class="text-red-500 text-xl animate-pulse">⚠️</span>
            <p class="text-red-500 text-[11px] md:text-xs font-black uppercase italic tracking-[1px] leading-relaxed text-left">
              {{ currentJob.warning }}
            </p>
          </div>
        </div>

        <div class="mt-6 max-w-xl mx-auto bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden animate-in fade-in duration-700 text-left" v-if="jobId === 'abbank' || isPopupJob">
          <div class="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-yellow-400 to-orange-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>
          <div class="text-2xl md:text-3xl animate-bounce drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] mt-1">🪝</div>
          <div>
            <h4 class="text-yellow-400 font-black italic uppercase text-[12px] md:text-sm tracking-widest mb-1.5 drop-shadow-md">
              MẸO KIẾM TIỀN:
            </h4>
            <p class="text-slate-300 text-[11px] md:text-[13px] font-medium leading-relaxed normal-case">
              Nếu bạn đã đăng ký APP này rồi, có thể <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">giới thiệu bạn bè / người thân đăng ký</span> và chụp lại ảnh bằng chứng gửi lên hệ thống, bạn <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">vẫn được nhận hoa hồng</span> bình thường nhé! 🚀
            </p>
            <p class="mt-2 text-slate-300 text-[11px] md:text-[13px] font-medium leading-relaxed normal-case" v-if="jobId === 'abbank'">
              Chỉ có thể giới thiệu <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">1 lần duy nhất</span>, vì ABBANK không có chương trình giới thiệu bạn bè.
            </p>
          </div>
        </div>

        <div class="mt-4" v-if="currentJob.zaloGuideUrl">
          <a :href="currentJob.zaloGuideUrl" target="_blank"
             class="inline-flex items-center gap-2 bg-[#0068FF] hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-5 h-5" />
            VÀO NHÓM ZALO XEM HƯỚNG DẪN
          </a>
        </div>

        <p v-if="isPopupJob && currentJob.shortDesc" class="mt-5 max-w-xl mx-auto text-slate-400 text-[11px] md:text-xs font-medium normal-case leading-relaxed">
          {{ currentJob.shortDesc }}
        </p>
      </div>

      <!-- KHỐI RIÊNG CHO APP LPBANK PLUS / VIETCOMBANK: 3 nút CTA mở popup tại chỗ -->
      <template v-if="isPopupJob && !isVipCompactJob">
        <section class="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button @click="openPopupGuide" class="py-4 px-3 rounded-2xl text-[11px] font-black uppercase tracking-tight bg-[#0d121f] border border-slate-700 hover:border-emerald-500/60 text-white active:scale-95 transition-all">
            📖 XEM HƯỚNG DẪN
          </button>
          <button @click="openPopupProof" class="py-4 px-3 rounded-2xl text-[11px] font-black uppercase tracking-tight bg-[#00df89] hover:bg-[#00c578] text-[#090e17] shadow-lg active:scale-95 transition-all">
            📥 GỬI BẰNG CHỨNG
          </button>
          <button @click="openPopupHistory" class="py-4 px-3 rounded-2xl text-[11px] font-black uppercase tracking-tight bg-[#0d121f] border border-slate-700 hover:border-emerald-500/60 text-white active:scale-95 transition-all">
            📜 LỊCH SỬ NỘP ĐƠN
          </button>
        </section>

        <section class="bg-[#111726] rounded-[45px] border border-slate-800/50 p-6 md:p-8 shadow-2xl">
          <h3 class="text-white text-base md:text-lg tracking-tight mb-5 text-center">{{ currentJob.proofSampleImages.length }} ẢNH BẰNG CHỨNG CẦN GỬI</h3>
          <div class="grid gap-3" :class="currentJob.proofSampleImages.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
            <div v-for="(img, idx) in currentJob.proofSampleImages" :key="idx" class="text-center">
              <div class="rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg bg-slate-900 aspect-[3/4] cursor-zoom-in group relative" @click="openImage(baseUrl + img)">
                <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" :src="baseUrl + img" />
              </div>
              <p class="mt-2 text-[10px] text-slate-500 font-sans not-italic normal-case">Ảnh {{ Number(idx) + 1 }}</p>
            </div>
          </div>
        </section>

        <section class="bg-[#111726] rounded-[45px] border border-slate-800/50 p-6 md:p-10 shadow-2xl">
          <h3 class="text-white text-base md:text-lg tracking-tight mb-6 text-center">CÁC BƯỚC THỰC HIỆN</h3>
          <div class="space-y-8">
            <div class="relative pl-10" v-for="step in currentJob.quickSteps" :key="step.id">
              <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>
              <div class="absolute left-0 top-1 w-8 h-8 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-sm font-black shadow-lg">{{ step.id }}</div>
              <div class="pb-2">
                <h4 class="text-[#3b82f6] text-base italic font-black mb-2 uppercase tracking-tight">BƯỚC {{ step.id }}: {{ step.title }}</h4>
                <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-4 whitespace-pre-line">{{ step.content }}</p>

                <div class="mb-4 bg-[#1a0f14] border border-red-500/40 rounded-2xl p-4 flex items-start gap-3" v-if="step.note">
                  <span class="text-red-500 text-lg shrink-0">⚠️</span>
                  <p class="text-red-400 text-[11px] font-black normal-case tracking-wide leading-relaxed">{{ step.note }}</p>
                </div>

                <div class="mb-4 max-w-sm" v-if="isShopeePay && step.referralCode">
                  <div class="bg-[#0d121f] border border-emerald-500/50 p-3 rounded-2xl flex items-center gap-3 shadow-xl">
                    <div class="flex-1 min-w-0">
                      <p class="text-[9px] text-emerald-400 font-black tracking-[2px] uppercase mb-0.5">MÃ GIỚI THIỆU</p>
                      <p class="text-white text-lg font-black italic tracking-wider select-all truncate">{{ step.referralCode }}</p>
                    </div>
                    <button
                      class="bg-emerald-500 hover:bg-emerald-400 text-[#090e17] px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg shrink-0"
                      @click="handleCopy(step.referralCode)">
                      📋 SAO CHÉP
                    </button>
                  </div>
                </div>
                <a v-else-if="step.id === 2 && currentJob.zaloReferralLink" :href="currentJob.zaloReferralLink" target="_blank"
                   class="mb-4 inline-flex items-center gap-2 bg-[#0068FF] hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-5 h-5" />
                  THAM GIA NHÓM ZALO
                </a>
                <button v-else-if="step.id === 2" disabled
                   class="mb-4 inline-flex items-center gap-2 bg-slate-800 text-slate-500 px-6 py-3 rounded-xl text-[11px] font-black uppercase cursor-not-allowed opacity-70">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-5 h-5 grayscale" />
                  THAM GIA NHÓM ZALO (SẮP CÓ)
                </button>

                <div class="w-full max-w-sm mx-auto flex items-center justify-center rounded-2xl overflow-hidden border border-slate-700/50 shadow-xl bg-slate-900 cursor-zoom-in" v-if="step.img" @click="openImage(baseUrl + step.img)">
                  <img class="max-w-full max-h-[42vh] sm:max-h-[380px] w-auto h-auto" :src="baseUrl + step.img" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <div class="bg-[#111726] rounded-[45px] border border-slate-800/50 p-6 md:p-10 shadow-2xl relative" v-if="!isPopupJob && !isBasicTierJob && !isVipCompactJob">
        <div class="text-center space-y-5">

         <div class="mb-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden animate-in fade-in duration-700"
                v-if="['msb-bank', 'vpbank', 'tpbank', 'app-chung-khoan', 'app-chung-khoan-2', 'app-chung-khoan-3', 'liobank', 'app-chung-khoan-4', 'lpbank-plus'].includes(route.params.id as string)">

            <div class="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-yellow-400 to-orange-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>

            <div class="text-2xl md:text-3xl animate-bounce drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] mt-1">🪝</div>

            <div class="text-left">
              <h4 class="text-yellow-400 font-black italic uppercase text-[12px] md:text-sm tracking-widest mb-1.5 drop-shadow-md">
                MẸO KIẾM TIỀN:
              </h4>
              <p class="text-slate-300 text-[11px] md:text-[13px] font-medium leading-relaxed normal-case">
                Nếu bạn đã đăng ký APP này rồi, có thể <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">giới thiệu bạn bè / người thân đăng ký</span> và chụp lại ảnh bằng chứng gửi lên hệ thống, bạn <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">vẫn được nhận hoa hồng</span> bình thường nhé! 🚀
              </p>
            </div>
          </div>
          <button
            class="group relative w-full flex items-center gap-4 p-5 rounded-3xl transition-all mt-4 overflow-hidden border-2 active:scale-[0.98]"
            :class="showGuide
              ? 'bg-gradient-to-r from-emerald-900/60 to-teal-900/40 border-emerald-500/60 shadow-[0_0_20px_rgba(0,223,137,0.15)]'
              : 'bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border-emerald-400/80 shadow-[0_0_25px_rgba(0,223,137,0.35)] guide-pulse'"
            @click="showGuide = !showGuide">

            <!-- Glow overlay khi đóng -->
            <div v-if="!showGuide" class="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none"></div>

            <!-- Icon -->
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-all"
                 :class="showGuide ? 'bg-emerald-900/50' : 'bg-emerald-500/20 shadow-[0_0_15px_rgba(0,223,137,0.4)]'">
              {{ showGuide ? '📖' : '👆' }}
            </div>

            <!-- Text -->
            <div class="text-left flex-1 relative z-10">
              <h3 class="text-white font-black italic uppercase tracking-tight leading-tight mb-1.5"
                  :class="showGuide ? 'text-base' : 'text-lg'">
                {{ showGuide ? 'ĐANG XEM HƯỚNG DẪN' : 'HƯỚNG DẪN TỪNG BƯỚC' }}
              </h3>
              <!-- Step number pills -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-for="step in currentJob.steps" :key="step.id"
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black"
                  :class="showGuide ? 'bg-emerald-800 text-emerald-300' : 'bg-emerald-400 text-[#090e17]'">
                  {{ step.id }}
                </span>
                <span class="text-[9px] font-black uppercase tracking-wider"
                      :class="showGuide ? 'text-emerald-600' : 'text-emerald-300'">
                  {{ currentJob.steps?.length || 0 }} BƯỚC
                </span>
              </div>
            </div>

            <!-- Chevron -->
            <svg class="w-5 h-5 shrink-0 transition-transform duration-300 relative z-10"
                 :class="showGuide ? 'rotate-180 text-emerald-600' : 'text-emerald-400'"
                 fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>

        <div class="mt-8 pt-8 border-t border-slate-800/50 space-y-8 animate-in fade-in duration-500" v-if="showGuide">
          <div class="relative pl-10" v-for="step in currentJob.steps" :key="step.id">
            <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>

            <div class="absolute left-0 top-1 w-8 h-8 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">
              {{ step.id }}
            </div>

            <div class="pb-8">
              <h4 class="text-[#3b82f6] text-base md:text-lg italic font-black mb-2 uppercase tracking-tight">
                {{ step.title }}
              </h4>
              <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-5 whitespace-pre-line">
                {{ step.content }}
              </p>

              <div class="mb-5 max-w-sm" v-if="step.referralCode">
                <div class="bg-[#0d121f] border border-emerald-500/50 p-3 rounded-2xl flex items-center gap-3 shadow-xl">
                  <div class="flex-1">
                    <p class="text-[9px] text-emerald-400 font-black tracking-[2px] uppercase mb-0.5">MÃ GIỚI THIỆU</p>
                    <p class="text-white text-lg font-black italic tracking-wider select-all">{{ step.referralCode }}</p>
                  </div>
                  <button
                    class="bg-emerald-500 hover:bg-emerald-400 text-[#090e17] px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg shrink-0"
                    @click="handleCopy(step.referralCode)">
                    📋 SAO CHÉP
                  </button>
                </div>
              </div>

              <div class="mb-8 space-y-4" v-if="step.templates && step.templates.length > 0">
                <div class="bg-[#0d121f] p-5 rounded-2xl border border-slate-700/80 relative group shadow-inner" v-for="(temp, idx) in step.templates" :key="idx">
                  <p class="text-slate-300 text-[12px] normal-case italic opacity-90 whitespace-pre-wrap leading-relaxed pr-24 select-all">
                    {{ temp }}
                  </p>
                  <button class="absolute top-1/2 -translate-y-1/2 right-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                    @click="handleCopy(temp)">
                    📋 COPY
                  </button>
                </div>
              </div>

              <div class="mb-8 space-y-4 max-w-lg" v-if="step.copyContents">
                <div class="bg-[#0d121f] border border-slate-700 rounded-2xl p-4 shadow-inner" v-for="(item, index) in step.copyContents" :key="index">
                  <p class="text-[10px] text-emerald-400 font-black mb-2 tracking-[2px] uppercase italic border-b border-slate-800 pb-2">⭐ {{ item.label }}</p>
                  <div class="text-slate-300 text-xs normal-case italic opacity-90 mb-4 whitespace-pre-wrap leading-relaxed select-all">
                    {{ item.text }}
                  </div>
                  <button class="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-[11px] font-black transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2" @click="handleCopy(item.text)">
                    📋 SAO CHÉP {{ item.label }}
                  </button>
                </div>
              </div>

              <div class="mb-6 max-w-md" v-if="step.referralLink">
                <div class="bg-[#0d121f] border border-slate-700 p-2 rounded-xl flex items-center gap-2 shadow-xl">
                  <input class="flex-1 bg-transparent border-none text-[10px] text-emerald-400 font-black italic px-2 outline-none overflow-hidden text-ellipsis whitespace-nowrap" readonly :value="step.referralLink" />
                  <button class="bg-emerald-500 hover:bg-emerald-600 text-[#090e17] px-4 py-2 rounded-lg text-[10px] font-black transition-all active:scale-95" @click="handleCopy(step.referralLink)">
                    SAO CHÉP LINK
                  </button>
                </div>
              </div>

              <div class="mb-6 flex flex-wrap items-center gap-3" v-if="step.downloadLink">
                <a class="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95" :href="step.downloadLink" target="_blank" :download="step.downloadLink.includes('.png') || step.downloadLink.includes('.jpg') ? 'Tai_Lieu_MMO_PRO' : false">
                  {{ step.buttonText || 'TẢI APP NGAY ➔' }}
                </a>

                <button class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 px-5 py-3 rounded-xl text-[11px] font-black uppercase transition-all shadow-md border border-slate-700 active:scale-95"
                  v-if="!step.downloadLink.includes('.png') && !step.downloadLink.includes('.jpg')"
                  @click="handleCopy(step.downloadLink)">
                  📋 SAO CHÉP LINK
                </button>
              </div>

              <div class="mb-6 flex flex-wrap items-center gap-3" v-if="step.extraLinks">
                <a v-for="link in step.extraLinks" :key="link.url"
                   class="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95"
                   :href="link.url" target="_blank">
                  {{ link.text }}
                </a>
              </div>

              <div class="flex flex-col md:flex-row gap-6 items-start">
                <div class="w-full md:max-w-[400px] flex items-center justify-center rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900 cursor-zoom-in group relative"
                     v-if="step.img"
                     @click="openImage(baseUrl + step.img)">
                  <img class="max-w-full max-h-[42vh] sm:max-h-[400px] w-auto h-auto hover:scale-105 transition-transform duration-500" :src="baseUrl + step.img" />
                  <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">🔍 CHẠM ĐỂ PHÓNG TO</div>
                </div>

                <div class="bg-[#0d121f] border-l-4 border-blue-500 p-6 rounded-2xl flex-1 shadow-lg" v-if="step.note">
                  <p class="text-blue-400 text-[10px] font-black tracking-[2px] mb-2 uppercase italic">Thông tin quan trọng</p>
                  <h5 class="text-white text-lg md:text-xl font-black italic leading-tight uppercase">{{ step.note }}</h5>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2 md:gap-4 mt-4" v-if="step.images">
                <div class="rounded-xl overflow-hidden border border-slate-700/50 shadow-lg relative group bg-slate-900 cursor-zoom-in"
                     v-for="(imgSrc, idx) in step.images" :key="idx"
                     @click="openImage(baseUrl + imgSrc)">
                  <img class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" :src="baseUrl + imgSrc" />
                  <div class="absolute top-1.5 left-1.5 bg-blue-600/90 backdrop-blur-sm text-white text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded shadow-sm">ẢNH {{ Number(idx) + 1 }}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <section class="bg-[#111726] rounded-[45px] border border-slate-800/50 p-8 md:p-10 text-center shadow-xl mb-20" v-if="!isPopupJob && !isBasicTierJob && !isVipCompactJob">
        <h2 class="text-lg text-slate-400 font-black italic mb-6 tracking-wide uppercase opacity-60">BẠN ĐÃ LÀM XONG?</h2>

        <button class="w-full bg-[#00df89] hover:bg-[#00c578] text-[#090e17] py-5 rounded-2xl text-xl font-black italic uppercase shadow-[0_10px_40px_rgba(0,223,137,0.25)] transition-all active:scale-95" @click="router.push(`/submit-report?job=${route.params.id}`)">
          NỘP BẰNG CHỨNG NGAY
        </button>
      </section>
      <div class="mb-20" v-else-if="isPopupJob || isVipCompactJob"></div>
    </div>

    <template v-if="isLpbankPlus">
      <LpbankPlusGuideModal :show="showLpGuide" @close="showLpGuide = false" @openProof="openLpProof" />
      <LpbankPlusProofModal :show="showLpProof" @close="showLpProof = false" @submitted="handleLpSubmitted" />
      <LpbankPlusHistoryModal :show="showLpHistory" @close="showLpHistory = false" />

      <Transition name="fade">
        <div v-if="showLpSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showLpSuccess = false"></div>
          <div class="relative bg-[#111726] border border-emerald-500/30 w-full max-w-sm rounded-[36px] p-7 text-center shadow-2xl font-black italic uppercase">
            <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <span class="text-3xl">✅</span>
            </div>
            <h2 class="text-lg text-white tracking-tight mb-2">GỬI BẰNG CHỨNG THÀNH CÔNG</h2>
            <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-6">
              Đã gửi bằng chứng APP LPBANK PLUS thành công. Vui lòng chờ admin xét duyệt.
            </p>
            <div class="space-y-2.5">
              <button @click="showLpSuccess = false; openLpHistory()" class="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
                XEM LỊCH SỬ NỘP ĐƠN
              </button>
              <button @click="showLpSuccess = false" class="w-full text-slate-500 py-2 text-[10px] tracking-widest hover:text-white transition-colors">
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <template v-if="isVietcombank">
      <VietcombankGuideModal :show="showVcGuide" @close="showVcGuide = false" @openProof="openVcProof" />
      <VietcombankProofModal :show="showVcProof" @close="showVcProof = false" @submitted="handleVcSubmitted" />
      <VietcombankHistoryModal :show="showVcHistory" @close="showVcHistory = false" />

      <Transition name="fade">
        <div v-if="showVcSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showVcSuccess = false"></div>
          <div class="relative bg-[#111726] border border-emerald-500/30 w-full max-w-sm rounded-[36px] p-7 text-center shadow-2xl font-black italic uppercase">
            <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <span class="text-3xl">✅</span>
            </div>
            <h2 class="text-lg text-white tracking-tight mb-2">GỬI BẰNG CHỨNG THÀNH CÔNG</h2>
            <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-6">
              Đã gửi bằng chứng VIETCOMBANK thành công. Vui lòng chờ admin xét duyệt.
            </p>
            <div class="space-y-2.5">
              <button @click="showVcSuccess = false; openVcHistory()" class="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
                XEM LỊCH SỬ NỘP ĐƠN
              </button>
              <button @click="showVcSuccess = false" class="w-full text-slate-500 py-2 text-[10px] tracking-widest hover:text-white transition-colors">
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <template v-if="isShopeePay">
      <ShopeePayGuideModal :show="showSpGuide" @close="showSpGuide = false" @openProof="openSpProof" />
      <ShopeePayProofModal :show="showSpProof" @close="showSpProof = false" @submitted="handleSpSubmitted" />
      <ShopeePayHistoryModal :show="showSpHistory" @close="showSpHistory = false" />

      <Transition name="fade">
        <div v-if="showSpSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showSpSuccess = false"></div>
          <div class="relative bg-[#111726] border border-emerald-500/30 w-full max-w-sm rounded-[36px] p-7 text-center shadow-2xl font-black italic uppercase">
            <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <span class="text-3xl">✅</span>
            </div>
            <h2 class="text-lg text-white tracking-tight mb-2">GỬI BẰNG CHỨNG THÀNH CÔNG</h2>
            <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-6">
              Đã gửi bằng chứng SHOPEE PAY thành công. Vui lòng chờ admin xét duyệt.
            </p>
            <div class="space-y-2.5">
              <button @click="showSpSuccess = false; openSpHistory()" class="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
                XEM LỊCH SỬ NỘP ĐƠN
              </button>
              <button @click="showSpSuccess = false" class="w-full text-slate-500 py-2 text-[10px] tracking-widest hover:text-white transition-colors">
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
::-webkit-scrollbar { width: 0px; }
.animate-in { animation-duration: 0.5s; }
.zoom-in { animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.guide-pulse {
  animation: guidePulse 2s ease-in-out infinite;
}
@keyframes guidePulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0,223,137,0.25), 0 0 0 0 rgba(0,223,137,0.15); }
  50%       { box-shadow: 0 0 30px rgba(0,223,137,0.5), 0 0 12px 4px rgba(0,223,137,0.1); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
