<script setup lang="ts">
import { ref } from 'vue'
import { jobsData } from '@/data/jobs'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'openProof'): void }>()

const baseUrl = import.meta.env.BASE_URL
const job = jobsData['lpbank-plus']
const quickSteps = job.quickSteps as any[]

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const handleClose = () => emit('close')
const handleOpenProof = () => emit('openProof')
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="handleClose"></div>

      <div class="relative bg-[#111726] border border-slate-800 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto text-left font-black italic uppercase">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg text-white tracking-tight">📖 HƯỚNG DẪN {{ job.title }}</h2>
          <button @click="handleClose" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="space-y-7">
          <div class="relative pl-9" v-for="step in quickSteps" :key="step.id">
            <div class="absolute left-3.5 top-1 bottom-0 w-[2px] bg-slate-700/30"></div>
            <div class="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#00df89] text-[#090e17] flex items-center justify-center text-xs shadow-lg">{{ step.id }}</div>
            <h4 class="text-sky-400 text-[13px] not-italic mb-1.5 tracking-tight">BƯỚC {{ step.id }}: {{ step.title }}</h4>
            <p class="text-slate-400 text-[11px] italic normal-case opacity-80 leading-relaxed mb-3 whitespace-pre-line">{{ step.content }}</p>

            <div class="mb-3 bg-[#1a0f14] border border-red-500/40 rounded-xl p-3.5 flex items-start gap-2 shadow-xl not-italic" v-if="step.note">
              <span class="text-red-500 text-base shrink-0">⚠️</span>
              <p class="text-red-400 text-[10px] font-black normal-case tracking-wide leading-relaxed">{{ step.note }}</p>
            </div>

            <a v-if="step.id === 2 && job.zaloReferralLink" :href="job.zaloReferralLink" target="_blank"
               class="mb-3 inline-flex items-center gap-2 bg-[#0068FF] hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[11px] not-italic hover:shadow-lg transition-all active:scale-95">
              <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-4 h-4" />
              THAM GIA NHÓM ZALO
            </a>
            <button v-else-if="step.id === 2" disabled
               class="mb-3 inline-flex items-center gap-2 bg-slate-800 text-slate-500 px-5 py-3 rounded-xl text-[11px] not-italic cursor-not-allowed opacity-70">
              <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-4 h-4 grayscale" />
              THAM GIA NHÓM ZALO (SẮP CÓ)
            </button>

            <div v-if="step.img" class="w-full sm:max-w-xs rounded-xl overflow-hidden border border-slate-700/50 shadow-xl bg-slate-900 cursor-zoom-in relative mt-1"
                 @click="openImage(baseUrl + step.img)">
              <img class="w-full h-auto object-contain" :src="baseUrl + step.img" />
              <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[8px] px-2 py-1 rounded">🔍 CHẠM ĐỂ PHÓNG TO</div>
            </div>
          </div>
        </div>

        <button @click="handleOpenProof" class="w-full mt-7 py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl text-[13px] shadow-lg active:scale-95 transition-all">
          💌 GỬI BẰNG CHỨNG
        </button>
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
