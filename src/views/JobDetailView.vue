<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jobsData } from '@/data/jobs'
import { useVipJobs } from '@/composables/useVipJobs'
import Swal from 'sweetalert2'

const route = useRoute()
const router = useRouter()
const showGuide = ref(true)
const baseUrl = import.meta.env.BASE_URL

const { vipJobs } = useVipJobs()

const jobId = route.params.id as string
const staticJob = jobsData[jobId] || jobsData['app-chung-khoan']

const currentJob = computed((): any => {
  const override = vipJobs.value.find((v: any) => v.id === jobId)
  if (!override) return staticJob
  return {
    ...staticJob,
    title: override.title ?? staticJob.title,
    reward: override.reward ?? staticJob.reward,
    warning: override.warning ?? staticJob.warning,
    badge: override.badge ?? staticJob.badge,
    color: override.color ?? staticJob.color,
    zaloGuideUrl: override.zaloGuideUrl ?? staticJob.zaloGuideUrl,
  }
})

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
      <div class="text-center">
        <h1 class="text-4xl md:text-5xl font-black text-white italic tracking-tighter leading-none mb-5 drop-shadow-xl">
          {{ currentJob.title }}
        </h1>
        <div class="bg-[#052e1f] border border-[#005c3c] rounded-full px-6 py-2.5 w-max mx-auto flex items-center gap-2 shadow-inner">
          <span class="text-[#f59e0b] text-xl">⚡</span>
          <span class="text-[#00df89] text-base md:text-lg font-black italic uppercase tracking-tighter">
            THƯỞNG: {{ currentJob.reward }}
          </span>
        </div>

        <div class="mt-6 max-w-xl mx-auto bg-[#1a0f14] border border-red-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-in fade-in zoom-in duration-500" v-if="currentJob.warning">
          <div class="flex items-start gap-3">
            <span class="text-red-500 text-xl animate-pulse">⚠️</span>
            <p class="text-red-500 text-[11px] md:text-xs font-black uppercase italic tracking-[1px] leading-relaxed text-left">
              {{ currentJob.warning }}
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
      </div>

      <div class="bg-[#111726] rounded-[45px] border border-slate-800/50 p-6 md:p-10 shadow-2xl relative">
        <div class="text-center space-y-5">

         <div class="mb-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden animate-in fade-in duration-700"
                v-if="['msb-bank', 'vpbank', 'tpbank', 'app-chung-khoan', 'app-chung-khoan-2', 'app-chung-khoan-3', 'abbank', 'liobank', 'app-chung-khoan-4', 'lpbank-plus'].includes(route.params.id as string)">

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
              <p class="text-slate-400 text-xs italic normal-case opacity-80 leading-relaxed mb-5">
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
                <div class="w-full md:max-w-[400px] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900 cursor-zoom-in group relative"
                     v-if="step.img"
                     @click="openImage(baseUrl + step.img)">
                  <img class="w-full h-auto object-contain hover:scale-105 transition-transform duration-500" :src="baseUrl + step.img" />
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

      <section class="bg-[#111726] rounded-[45px] border border-slate-800/50 p-8 md:p-10 text-center shadow-xl mb-20">
        <h2 class="text-lg text-slate-400 font-black italic mb-6 tracking-wide uppercase opacity-60">BẠN ĐÃ LÀM XONG?</h2>

        <button class="w-full bg-[#00df89] hover:bg-[#00c578] text-[#090e17] py-5 rounded-2xl text-xl font-black italic uppercase shadow-[0_10px_40px_rgba(0,223,137,0.25)] transition-all active:scale-95" @click="router.push(`/submit-report?job=${route.params.id}`)">
          NỘP BẰNG CHỨNG NGAY
        </button>
      </section>
    </div>
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
