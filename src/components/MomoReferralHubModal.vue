<script setup lang="ts">
import { ref, computed } from 'vue'
import Swal from 'sweetalert2'
import { jobsData } from '@/data/jobs'
import { MOMO_REFERRAL_JOB_ID } from '@/utils/referralMomo'
import MomoReferralProofModal from '@/components/MomoReferralProofModal.vue'

const props = defineProps<{ show: boolean; myReports?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const baseUrl = import.meta.env.BASE_URL

// Hướng dẫn copy nguyên từ job VÍ MOMO gốc (src/data/jobs.ts -> 'momo') — không bịa nội dung mới
const momoJob = jobsData['momo']
const momoSteps = momoJob.steps as any[]
const stepById = (id: number) => momoSteps.find(s => s.id === id)
const stripStepPrefix = (title: string) => title.replace(/^Bước\s*\d+:\s*/i, '')

type ViewState = 'hub' | 'guide' | 'history'
const view = ref<ViewState>('hub')

const showProof = ref(false)
const showSuccess = ref(false)
const lastSubmittedOrder = ref<{ friendName: string; friendPhone: string; orderCode: string; createdAt: Date } | null>(null)

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const resetAndClose = () => {
  view.value = 'hub'
  showProof.value = false
  showSuccess.value = false
  lastSubmittedOrder.value = null
  emit('close')
}

const openGuide = () => { view.value = 'guide' }
const openHistory = () => { view.value = 'history' }
const backToHub = () => { view.value = 'hub' }
const openProof = () => { showProof.value = true }

const handleSubmitted = (payload: { friendName: string; friendPhone: string; orderCode: string; createdAt: Date }) => {
  showProof.value = false
  lastSubmittedOrder.value = payload
  showSuccess.value = true
}

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
const copyReferralCode = () => copyText(stepById(2).referralCode, 'Đã sao chép mã giới thiệu')
const copyOrderCode = () => { if (lastSubmittedOrder.value) copyText(lastSubmittedOrder.value.orderCode, 'Đã sao chép mã đơn') }

const closeSuccessAndShowHistory = () => { showSuccess.value = false; openHistory() }

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()
const momoHistory = computed(() =>
  (props.myReports || [])
    .filter(r => r.jobId === MOMO_REFERRAL_JOB_ID)
    .slice()
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
)

const statusLabel = (rp: any) => {
  if (rp.status === 'pending') return 'ĐANG CHỜ DUYỆT'
  if (rp.status === 'rejected') return 'BỊ TỪ CHỐI'
  return `ĐÃ DUYỆT — +${(rp.actualReward || rp.reward || 0).toLocaleString()} XU`
}
const statusClass = (rp: any) => {
  if (rp.status === 'pending') return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
  if (rp.status === 'rejected') return 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
  return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="resetAndClose"></div>

      <!-- HUB: 3 nút CTA -->
      <div v-if="view === 'hub'" class="relative bg-gradient-to-br from-[#2A1C00] to-[#160E00] border border-amber-500/40 w-full max-w-md rounded-[36px] p-6 md:p-8 shadow-2xl text-center font-black italic uppercase">
        <button @click="resetAndClose" class="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-300 active:scale-90 transition-transform">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-3xl">👥</div>
        <h2 class="text-xl md:text-2xl text-white tracking-tighter leading-tight mb-2">GIỚI THIỆU BẠN BÈ<br/><span class="text-amber-400">ĐĂNG KÝ APP VÍ MOMO</span></h2>
        <div class="bg-[#052e1f] border border-[#005c3c] rounded-full px-5 py-2 w-max mx-auto flex items-center gap-2 shadow-inner mb-6">
          <span class="text-[#f59e0b] text-lg">⚡</span>
          <span class="text-[#00df89] text-[12px] md:text-sm tracking-tighter">THƯỞNG 85.000 XU / LƯỢT HỢP LỆ</span>
        </div>

        <div class="space-y-2">
          <button @click="openProof" class="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-xl shadow-lg active:scale-95 transition-all text-[11px]">
            📥 GỬI BẰNG CHỨNG
          </button>
          <button @click="openGuide" class="w-full py-2.5 bg-[#0d121f] border border-slate-700 hover:border-amber-500/60 text-white rounded-xl active:scale-95 transition-all text-[11px]">
            📖 XEM HƯỚNG DẪN
          </button>
          <button @click="openHistory" class="w-full py-2.5 bg-[#0d121f] border border-slate-700 hover:border-amber-500/60 text-white rounded-xl active:scale-95 transition-all text-[11px]">
            📜 LỊCH SỬ ĐƠN
          </button>
        </div>

        <div class="mt-5 bg-gradient-to-r from-orange-950/80 to-red-950/60 border-2 border-orange-500/60 rounded-2xl p-4 space-y-3 shadow-[0_0_25px_rgba(249,115,22,0.15)] text-left">
          <p class="text-orange-300 text-[13px] md:text-[15px] font-black normal-case leading-snug flex items-start gap-2">
            <span class="text-lg shrink-0">⚠️</span><span>1 điện thoại chỉ được đăng ký 1 tài khoản Ví MoMo duy nhất.</span>
          </p>
          <p class="text-orange-300 text-[13px] md:text-[15px] font-black normal-case leading-snug flex items-start gap-2">
            <span class="text-lg shrink-0">⚠️</span><span>1 CCCD/CMND chỉ được đăng ký 1 tài khoản Ví MoMo duy nhất.</span>
          </p>
          <p class="text-emerald-300 text-[13px] md:text-[15px] font-black normal-case leading-snug flex items-start gap-2">
            <span class="text-lg shrink-0">✅</span><span>Được giới thiệu bạn bè không giới hạn — 1 người = 1 nhiệm vụ VIP, 10 người = 10 nhiệm vụ VIP.</span>
          </p>
        </div>
      </div>

      <!-- HƯỚNG DẪN (copy từ job VÍ MOMO gốc) -->
      <div v-else-if="view === 'guide'" class="relative bg-[#111726] border border-slate-800 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto text-left font-black italic uppercase">
        <div class="flex items-center justify-between mb-5">
          <button @click="backToHub" class="text-[10px] tracking-[3px] text-slate-500 hover:text-white flex items-center gap-1">
            <span class="text-base font-light not-italic font-sans">‹</span> QUAY LẠI
          </button>
          <button @click="resetAndClose" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <h2 class="text-lg text-white tracking-tight mb-1">📖 HƯỚNG DẪN {{ momoJob.title }}</h2>
        <p class="text-slate-400 text-[10px] font-medium normal-case leading-relaxed mb-6">
          Hướng dẫn bạn bè làm theo các bước dưới đây để đăng ký thành công, sau đó bạn chụp lại ảnh và gửi bằng chứng.
        </p>

        <div class="space-y-7">
          <div class="relative pl-9">
            <div class="absolute left-3.5 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
            <div class="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-xs shadow-lg">1</div>
            <h4 class="text-sky-400 text-[13px] not-italic mb-1.5 tracking-tight">{{ stripStepPrefix(stepById(1).title) }}</h4>
            <p class="text-slate-400 text-[11px] italic normal-case opacity-80 leading-relaxed mb-3 whitespace-pre-line">{{ stepById(1).content }}</p>
            <a class="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-xl text-[11px] not-italic hover:shadow-lg transition-all active:scale-95"
               :href="stepById(1).downloadLink" target="_blank">
              📥 {{ stepById(1).buttonText }}
            </a>
          </div>

          <div class="relative pl-9">
            <div class="absolute left-3.5 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
            <div class="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-xs shadow-lg">2</div>
            <h4 class="text-sky-400 text-[13px] not-italic mb-1.5 tracking-tight">{{ stripStepPrefix(stepById(2).title) }}</h4>
            <p class="text-slate-400 text-[11px] italic normal-case opacity-80 leading-relaxed mb-3 whitespace-pre-line">{{ stepById(2).content }}</p>
            <div class="mb-3 bg-[#0d121f] border border-amber-500/40 p-3.5 rounded-xl flex items-center gap-3 shadow-xl not-italic">
              <div class="flex-1">
                <p class="text-[8px] text-amber-400 tracking-[2px] uppercase mb-0.5">Mã giới thiệu</p>
                <p class="text-white text-base tracking-wider select-all">{{ stepById(2).referralCode }}</p>
              </div>
              <button class="bg-amber-500 hover:bg-amber-400 text-[#090e17] px-3.5 py-2 rounded-lg text-[10px] active:scale-95 transition-all shrink-0" @click="copyReferralCode">
                📋 SAO CHÉP
              </button>
            </div>
            <div v-if="stepById(2).img" class="w-full sm:max-w-xs rounded-xl overflow-hidden border border-slate-700/50 shadow-xl bg-slate-900 cursor-zoom-in relative"
                 @click="openImage(baseUrl + stepById(2).img)">
              <img class="w-full h-auto object-contain" :src="baseUrl + stepById(2).img" />
            </div>
          </div>

          <div class="relative pl-9">
            <div class="absolute left-3.5 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
            <div class="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-xs shadow-lg">3</div>
            <h4 class="text-sky-400 text-[13px] not-italic mb-1.5 tracking-tight">{{ stripStepPrefix(stepById(3).title) }}</h4>
            <p class="text-slate-400 text-[11px] italic normal-case opacity-80 leading-relaxed mb-3 whitespace-pre-line">{{ stepById(3).content }}</p>
            <div v-if="stepById(3).img" class="w-full sm:max-w-xs rounded-xl overflow-hidden border border-slate-700/50 shadow-xl bg-slate-900 cursor-zoom-in relative"
                 @click="openImage(baseUrl + stepById(3).img)">
              <img class="w-full h-auto object-contain" :src="baseUrl + stepById(3).img" />
            </div>
          </div>

          <div class="relative pl-9">
            <div class="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-xs shadow-lg">4</div>
            <h4 class="text-sky-400 text-[13px] not-italic mb-1.5 tracking-tight">{{ stripStepPrefix(stepById(4).title) }}</h4>
            <p class="text-slate-400 text-[11px] italic normal-case opacity-80 leading-relaxed mb-3 whitespace-pre-line">{{ stepById(4).content }}</p>
            <div v-if="stepById(4).img" class="w-full sm:max-w-xs rounded-xl overflow-hidden border border-slate-700/50 shadow-xl bg-slate-900 cursor-zoom-in relative"
                 @click="openImage(baseUrl + stepById(4).img)">
              <img class="w-full h-auto object-contain" :src="baseUrl + stepById(4).img" />
            </div>
          </div>
        </div>

        <button @click="openProof" class="w-full mt-7 py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl text-[13px] shadow-lg active:scale-95 transition-all">
          💌 GỬI BẰNG CHỨNG
        </button>
      </div>

      <!-- LỊCH SỬ ĐƠN -->
      <div v-else-if="view === 'history'" class="relative bg-[#111726] border border-slate-800 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto text-left font-black italic uppercase">
        <div class="flex items-center justify-between mb-5">
          <button @click="backToHub" class="text-[10px] tracking-[3px] text-slate-500 hover:text-white flex items-center gap-1">
            <span class="text-base font-light not-italic font-sans">‹</span> QUAY LẠI
          </button>
          <h2 class="text-lg text-white tracking-tight">📜 LỊCH SỬ ĐƠN MOMO</h2>
          <button @click="resetAndClose" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div v-if="!momoHistory.length" class="text-center py-12">
          <div class="text-4xl mb-3">📭</div>
          <p class="text-slate-500 text-[11px] normal-case font-bold leading-relaxed">Bạn chưa có đơn giới thiệu MoMo nào.</p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="rp in momoHistory" :key="rp.id" class="bg-[#0d121f] border rounded-2xl p-4"
               :class="rp.status === 'rejected' ? 'border-rose-500/30' : rp.status === 'pending' ? 'border-yellow-500/20' : 'border-emerald-500/20'">
            <div class="flex justify-between items-start gap-3 mb-2">
              <div class="font-sans not-italic normal-case min-w-0">
                <p class="text-white text-[12px] font-bold truncate">{{ rp.friendName }}</p>
                <p class="text-slate-500 text-[10px]">SĐT: {{ rp.friendPhone }}</p>
                <p class="text-slate-600 text-[9px] mt-1 truncate">Mã đơn: {{ rp.referralOrderCode }}</p>
                <p class="text-slate-600 text-[9px]">{{ formatDate(rp.createdAt) }}</p>
              </div>
              <span class="shrink-0 text-[9px] px-2 py-1 rounded-full font-sans not-italic normal-case" :class="statusClass(rp)">
                {{ statusLabel(rp) }}
              </span>
            </div>
            <p v-if="rp.status === 'rejected' && rp.note" class="text-rose-400 text-[10px] font-sans not-italic normal-case mt-1 leading-relaxed">Lý do: {{ rp.note }}</p>
          </div>
        </div>
      </div>

      <!-- POPUP THÀNH CÔNG -->
      <div v-if="showSuccess && lastSubmittedOrder" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md"></div>
        <div class="relative bg-[#111726] border border-emerald-500/30 w-full max-w-sm rounded-[36px] p-7 text-center shadow-2xl font-black italic uppercase">
          <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <span class="text-3xl">✅</span>
          </div>
          <h2 class="text-xl text-white tracking-tight mb-2">NỘP ĐƠN THÀNH CÔNG</h2>
          <p class="text-slate-400 text-[10px] normal-case font-bold leading-relaxed mb-4">
            Đơn giới thiệu bạn bè APP VÍ MOMO đã được gửi. Vui lòng chờ admin phê duyệt.
          </p>

          <div class="bg-[#0d121f] border border-emerald-500/40 rounded-2xl p-4 mb-4 text-left space-y-2">
            <p class="text-emerald-400 text-[9px] tracking-widest">MÃ ĐƠN CỦA BẠN</p>
            <div class="flex items-center justify-between gap-2">
              <p class="text-white text-sm font-sans not-italic font-bold normal-case select-all break-all">{{ lastSubmittedOrder.orderCode }}</p>
              <button @click="copyOrderCode" class="bg-emerald-500 hover:bg-emerald-400 text-[#090e17] px-3 py-2 rounded-lg text-[10px] shrink-0">📋</button>
            </div>
          </div>

          <div class="space-y-2.5">
            <button @click="copyOrderCode" class="w-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
              📋 SAO CHÉP MÃ ĐƠN
            </button>
            <button @click="closeSuccessAndShowHistory" class="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 py-3 rounded-2xl text-[11px] tracking-widest active:scale-95 transition-all">
              XEM LỊCH SỬ ĐƠN
            </button>
            <button @click="resetAndClose" class="w-full text-slate-500 py-2 text-[10px] tracking-widest hover:text-white transition-colors">
              ĐÓNG
            </button>
          </div>
        </div>
      </div>

      <!-- ZOOM ẢNH HƯỚNG DẪN -->
      <div v-if="selectedImage" class="fixed inset-0 z-[5800] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="closeImage">
        <button class="absolute top-6 right-6 w-11 h-11 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[5810]" @click.stop="closeImage">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain cursor-default" :src="selectedImage" @click.stop />
      </div>

      <MomoReferralProofModal :show="showProof" @close="showProof = false" @submitted="handleSubmitted" />
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
