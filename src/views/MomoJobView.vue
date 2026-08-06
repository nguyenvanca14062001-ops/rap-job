<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { jobsData } from '@/data/jobs'
import Swal from 'sweetalert2'

const router = useRouter()
const baseUrl = import.meta.env.BASE_URL
const job = jobsData['momo']
const steps = job.steps as any[]
const stepById = (id: number) => steps.find(s => s.id === id)

const stripStepPrefix = (title: string) => title.replace(/^Bước\s*\d+:\s*/i, '')

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const handleCopy = (text: string) => {
  if (!text) return
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
      Swal.fire({ title: 'ĐÃ SAO CHÉP!', icon: 'success', timer: 1000, showConfirmButton: false, toast: true, position: 'top-end' })
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

    <div class="flex justify-between items-center mb-6 max-w-4xl mx-auto border-b border-slate-800 pb-4">
      <button class="text-[10px] tracking-[3px] text-slate-500 hover:text-white active:text-white transition-colors flex items-center gap-1 px-3 py-2.5 -mx-3 -my-2 active:scale-95 transition-transform not-italic normal-case" @click="router.back()">
        <span class="text-base font-light not-italic font-sans">‹</span> QUAY LẠI
      </button>
      <span class="text-[10px] tracking-[4px] text-slate-600">HƯỚNG DẪN CHI TIẾT</span>
    </div>

    <div class="max-w-4xl mx-auto space-y-6">

      <!-- CARD JOB CHÍNH -->
      <div class="relative bg-gradient-to-br from-[#2A1C00] to-[#160E00] border-2 border-amber-500/60 rounded-[35px] p-6 md:p-8 shadow-[0_0_35px_rgba(245,158,11,0.15)] overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white/5 pointer-events-none rounded-[33px]"></div>
        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>

        <div class="absolute top-0 right-0 z-10 flex items-center gap-1 text-[10px] tracking-widest px-4 py-2 rounded-bl-2xl rounded-tr-[33px] font-black italic uppercase border-b border-l border-amber-300/30 shadow-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-900">
          VIP 💎
        </div>

        <div class="relative z-10 flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-500/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">💗</div>
          <div class="flex-1 pt-1">
            <p class="text-amber-400 text-[10px] font-black uppercase tracking-[3px] mb-1">Job VIP</p>
            <h1 class="text-2xl md:text-4xl font-black italic text-white tracking-tighter leading-none">{{ job.title }}</h1>
          </div>
        </div>

        <div class="relative z-10 mt-5 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-400/40 rounded-2xl px-5 py-3.5 flex items-center gap-3 w-max max-w-full shadow-inner">
          <span class="text-2xl">🪙</span>
          <div>
            <p class="text-amber-300/80 text-[9px] font-black uppercase tracking-widest leading-none mb-1">Thưởng khi hoàn thành</p>
            <p class="text-white text-lg md:text-xl font-black italic tracking-tighter leading-none">{{ job.reward.toUpperCase() }}</p>
          </div>
        </div>

        <div class="relative z-10 mt-5 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-inner" v-if="job.warning">
          <span class="text-amber-400 text-lg shrink-0">⚠️</span>
          <p class="text-amber-300 text-[11px] md:text-xs font-black uppercase italic tracking-[0.5px] leading-relaxed">{{ job.warning }}</p>
        </div>
      </div>

      <!-- MẸO KIẾM TIỀN -->
      <div class="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-yellow-400 to-orange-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>
        <div class="text-2xl md:text-3xl drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] mt-1">🪝</div>
        <div class="text-left">
          <h4 class="text-yellow-400 font-black italic uppercase text-[12px] md:text-sm tracking-widest mb-1.5 drop-shadow-md">MẸO KIẾM TIỀN:</h4>
          <p class="text-slate-300 text-[11px] md:text-[13px] font-medium leading-relaxed normal-case">
            Nếu bạn đã đăng ký ví MoMo rồi, có thể <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">giới thiệu bạn bè / người thân đăng ký</span> và chụp lại ảnh bằng chứng gửi lên hệ thống, bạn <span class="text-yellow-400 font-black italic text-[12px] md:text-[14px]">vẫn được nhận hoa hồng</span> bình thường nhé! 🚀
          </p>
        </div>
      </div>

      <!-- CÁC BƯỚC -->
      <div class="bg-[#111726] rounded-[35px] border border-slate-800/50 p-6 md:p-10 shadow-2xl space-y-9">

        <!-- BƯỚC 1 -->
        <div class="relative pl-10">
          <div class="absolute left-4 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">1</div>
          <h4 class="text-sky-400 text-base md:text-lg font-black not-italic mb-2 uppercase tracking-tight">{{ stripStepPrefix(stepById(1).title) }}</h4>
          <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-5 whitespace-pre-line">{{ stepById(1).content }}</p>
          <a class="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-2xl text-[12px] font-black uppercase hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95 w-full sm:w-auto justify-center"
             :href="stepById(1).downloadLink" target="_blank">
            📥 {{ stepById(1).buttonText }}
          </a>
        </div>

        <!-- BƯỚC 2 -->
        <div class="relative pl-10">
          <div class="absolute left-4 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">2</div>
          <h4 class="text-sky-400 text-base md:text-lg font-black not-italic mb-2 uppercase tracking-tight">{{ stripStepPrefix(stepById(2).title) }}</h4>
          <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-5 whitespace-pre-line">{{ stepById(2).content }}</p>

          <div class="mb-5 max-w-sm">
            <div class="bg-[#0d121f] border border-amber-500/40 p-4 rounded-2xl flex items-center gap-3 shadow-xl">
              <div class="flex-1">
                <p class="text-[9px] text-amber-400 font-black tracking-[2px] uppercase mb-0.5">Mã giới thiệu</p>
                <p class="text-white text-lg font-black italic tracking-wider select-all">{{ stepById(2).referralCode }}</p>
              </div>
              <button class="bg-amber-500 hover:bg-amber-400 text-[#090e17] px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg shrink-0"
                @click="handleCopy(stepById(2).referralCode)">
                📋 SAO CHÉP
              </button>
            </div>
          </div>

          <div v-if="stepById(2).img">
            <p class="text-blue-400 text-[10px] font-black tracking-[2px] mb-2 uppercase not-italic">Ảnh hướng dẫn nhập mã giới thiệu</p>
            <div class="w-full sm:max-w-sm rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900 cursor-zoom-in group relative"
                 @click="openImage(baseUrl + stepById(2).img)">
              <img class="w-full h-auto object-contain hover:scale-105 transition-transform duration-500" :src="baseUrl + stepById(2).img" />
              <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">🔍 CHẠM ĐỂ PHÓNG TO</div>
            </div>
          </div>
        </div>

        <!-- BƯỚC 3 -->
        <div class="relative pl-10">
          <div class="absolute left-4 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">3</div>
          <h4 class="text-sky-400 text-base md:text-lg font-black not-italic mb-2 uppercase tracking-tight">{{ stripStepPrefix(stepById(3).title) }}</h4>
          <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-4 whitespace-pre-line">{{ stepById(3).content }}</p>

          <div class="mb-5 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-inner" v-if="stepById(3).note">
            <span class="text-amber-400 text-lg shrink-0">📢</span>
            <p class="text-amber-300 text-[11px] md:text-xs font-black uppercase not-italic tracking-[0.5px] leading-relaxed">{{ stepById(3).note }}</p>
          </div>

          <div v-if="stepById(3).img" class="w-full sm:max-w-sm rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900 cursor-zoom-in group relative"
               @click="openImage(baseUrl + stepById(3).img)">
            <img class="w-full h-auto object-contain hover:scale-105 transition-transform duration-500" :src="baseUrl + stepById(3).img" />
            <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">🔍 CHẠM ĐỂ PHÓNG TO</div>
          </div>
        </div>

        <!-- BƯỚC 4 -->
        <div class="relative pl-10">
          <div class="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">4</div>
          <h4 class="text-sky-400 text-base md:text-lg font-black not-italic mb-2 uppercase tracking-tight">{{ stripStepPrefix(stepById(4).title) }}</h4>
          <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-5 whitespace-pre-line">{{ stepById(4).content }}</p>

          <div v-if="stepById(4).img" class="w-full sm:max-w-sm rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900 cursor-zoom-in group relative"
               @click="openImage(baseUrl + stepById(4).img)">
            <img class="w-full h-auto object-contain hover:scale-105 transition-transform duration-500" :src="baseUrl + stepById(4).img" />
            <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">🔍 CHẠM ĐỂ PHÓNG TO</div>
          </div>
        </div>

      </div>

      <section class="bg-[#111726] rounded-[35px] border border-slate-800/50 p-8 md:p-10 text-center shadow-xl mb-20">
        <h2 class="text-lg text-slate-400 font-black italic mb-6 tracking-wide uppercase opacity-60">BẠN ĐÃ LÀM XONG?</h2>
        <button class="w-full bg-[#00df89] hover:bg-[#00c578] text-[#090e17] py-5 rounded-2xl text-xl font-black italic uppercase shadow-[0_10px_40px_rgba(0,223,137,0.25)] transition-all active:scale-95" @click="router.push('/submit-report?job=momo')">
          💌 GỬI BẰNG CHỨNG
        </button>
      </section>

    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar { width: 0px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
