<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Swal from 'sweetalert2'

const router = useRouter()
const baseUrl = import.meta.env.BASE_URL
const FANPAGE_URL = 'https://www.facebook.com/rapjobfreelance/'
const REFERRAL_LINK = 'https://shorten.asia/jxg72pms'
const sampleImage = 'images/anh-kokomi1.jpg'

const isAuthChecking = ref(true)

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    isAuthChecking.value = false
    if (!user) router.push('/login')
  })
})

const rewardTiers = [
  { milestone: 'Mốc 1: 5 người', reward: '35.000 XU' },
  { milestone: 'Mốc 2: 10 người', reward: '115.000 XU' },
]

const copyReferralLink = () => {
  navigator.clipboard.writeText(REFERRAL_LINK).then(() => {
    Swal.fire({ title: 'Đã sao chép link giới thiệu', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' })
  }).catch(() => {
    const textArea = document.createElement('textarea')
    textArea.value = REFERRAL_LINK
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      Swal.fire({ title: 'Đã sao chép link giới thiệu', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' })
    } catch {
      alert('Lỗi sao chép, hãy copy thủ công nhé!')
    }
    document.body.removeChild(textArea)
  })
}

const openFanpage = () => window.open(FANPAGE_URL, '_blank')

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }
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
    <div v-if="isAuthChecking" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs text-slate-500 tracking-widest uppercase">Đang tải dữ liệu...</p>
    </div>

    <!-- Nội dung chính -->
    <div v-else class="max-w-3xl mx-auto space-y-6">

      <div class="flex justify-between items-center border-b border-slate-800 pb-4">
        <button class="text-[10px] tracking-[3px] text-slate-500 hover:text-white flex items-center gap-1 px-3 py-2.5 -mx-3 -my-2 active:scale-95 transition-transform" @click="router.push('/')">
          <span class="text-base font-light not-italic font-sans">✕</span> QUAY LẠI
        </button>
        <span class="text-[10px] tracking-[4px] text-slate-600">ZALO X KOKOMI</span>
      </div>

      <!-- HERO -->
      <div class="bg-gradient-to-br from-[#0a2540] to-[#051224] border border-sky-500/40 rounded-[36px] p-6 md:p-10 text-center shadow-2xl relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-40 h-40 bg-sky-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-3xl relative z-10">💬</div>
        <h1 class="text-2xl md:text-4xl text-white tracking-tighter leading-tight mb-3 relative z-10">
          ZALO <span class="text-sky-400">x</span> KOKOMI
        </h1>
        <div class="bg-[#052e1f] border border-[#005c3c] rounded-full px-6 py-2.5 w-max mx-auto flex items-center gap-2 shadow-inner relative z-10">
          <span class="text-[#f59e0b] text-xl">⚡</span>
          <span class="text-[#00df89] text-sm md:text-base tracking-tighter">THƯỞNG: 35.000 - 115.000 XU</span>
        </div>
        <p class="text-slate-400 text-[11px] md:text-xs font-medium normal-case leading-relaxed mt-4 max-w-md mx-auto relative z-10">
          Gửi link giới thiệu cho 5 người bạn bất kì, hoàn thành nhiệm vụ nhận thưởng.
        </p>
      </div>

      <!-- BẢNG GIÁ THƯỞNG GIỚI THIỆU -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 shadow-xl">
        <h3 class="text-amber-400 text-sm md:text-base tracking-tight mb-4">🎁 BẢNG GIÁ THƯỞNG GIỚI THIỆU</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-center border-separate border-spacing-y-2 font-sans not-italic normal-case min-w-[360px]">
            <thead>
              <tr class="text-slate-500 text-[9px] md:text-[10px] tracking-widest">
                <th class="pb-2 font-bold">SỐ NGƯỜI GIỚI THIỆU</th>
                <th class="pb-2 font-bold">THƯỞNG</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tier in rewardTiers" :key="tier.milestone" class="bg-[#0d121f]">
                <td class="py-3 rounded-l-2xl text-white text-[12px] font-bold">{{ tier.milestone }}</td>
                <td class="py-3 rounded-r-2xl text-emerald-400 text-[13px] font-black">{{ tier.reward }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- CHÚ Ý -->
      <div class="bg-gradient-to-r from-orange-950/70 to-red-950/50 border border-orange-600/40 rounded-2xl p-4 space-y-2 shadow-inner">
        <p class="text-orange-400 text-[11px] tracking-widest mb-1">⚠️ CHÚ Ý</p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>•</span><span>Mỗi mốc thưởng chỉ được hoàn thành và nhận thưởng 1 lần.</span>
        </p>
        <p class="text-orange-300 text-[11px] md:text-xs font-bold normal-case leading-relaxed flex items-start gap-2">
          <span>•</span><span>Hoàn thành Mốc 1 và đã nhận thưởng thì mới được nhận tiếp Mốc 2.</span>
        </p>
      </div>

      <!-- HƯỚNG DẪN -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 md:p-8 shadow-xl space-y-6">
        <h3 class="text-sky-400 text-sm md:text-base tracking-tight">📖 HƯỚNG DẪN</h3>
        <div class="relative pl-10">
          <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-sky-500 text-[#051224] flex items-center justify-center text-sm shadow-lg">1</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">
            Sao chép link giới thiệu bên dưới và gửi cho bạn bè qua Zalo, Messenger, Threads hoặc Instagram đều được.
          </p>
        </div>
        <div class="relative pl-10">
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-sky-500 text-[#051224] flex items-center justify-center text-sm shadow-lg">2</div>
          <p class="text-slate-300 text-xs font-medium normal-case leading-relaxed">
            Khi làm đủ Mốc 1 hoặc Mốc 2, hãy nhắn tin Fanpage để gửi bằng chứng và nhận thưởng.
          </p>
        </div>
      </div>

      <!-- LINK GIỚI THIỆU -->
      <div class="bg-[#111726] border border-emerald-500/30 rounded-[30px] p-6 shadow-xl">
        <p class="text-emerald-400 text-[10px] tracking-[2px] mb-2">LINK GIỚI THIỆU</p>
        <div class="bg-[#0d121f] border border-slate-800 rounded-2xl px-4 py-3 mb-4">
          <p class="text-white text-sm md:text-base tracking-wide select-all font-sans not-italic normal-case break-all">{{ REFERRAL_LINK }}</p>
        </div>
        <button @click="copyReferralLink" class="w-full bg-emerald-500 hover:bg-emerald-400 text-[#090e17] py-4 rounded-2xl text-[12px] md:text-sm shadow-lg active:scale-95 transition-all">
          📋 SAO CHÉP LINK GIỚI THIỆU
        </button>
      </div>

      <!-- ẢNH MẪU GỬI BẰNG CHỨNG -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 shadow-xl">
        <h3 class="text-slate-400 text-sm tracking-tight mb-4">ẢNH MẪU GỬI BẰNG CHỨNG</h3>
        <div class="rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 cursor-zoom-in max-w-xs mx-auto" @click="openImage(baseUrl + sampleImage)">
          <img class="w-full h-auto max-w-full object-contain" :src="baseUrl + sampleImage" />
        </div>
      </div>

      <!-- MẪU GỬI FANPAGE -->
      <div class="bg-[#111726] border border-slate-800/50 rounded-[30px] p-6 shadow-xl">
        <h3 class="text-slate-400 text-sm tracking-tight mb-4">MẪU GỬI FANPAGE</h3>
        <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-5 font-sans not-italic normal-case space-y-2 text-[12px] md:text-[13px] text-slate-300 leading-relaxed select-all">
          <p>Họ tên:</p>
          <p>Số điện thoại:</p>
          <p>Số lượt giới thiệu thành công:</p>
          <p>Ảnh bằng chứng:</p>
        </div>
      </div>

      <!-- NÚT NHẮN FANPAGE -->
      <button @click="openFanpage" class="w-full bg-[#1877F2] hover:bg-blue-600 text-white py-4 rounded-2xl text-[12px] md:text-sm tracking-widest shadow-lg active:scale-95 transition-all">
        💬 NHẮN TIN FANPAGE
      </button>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
