<script setup lang="ts">
const SUPPORT_FANPAGE_URL = 'https://www.facebook.com/rapjobfreelance/'

defineProps<{
  modelValue: boolean
  config: {
    title: string
    message: string
  }
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  close: []
}>()

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<template>
  <Transition name="support-fade">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[9500] flex items-end lg:items-center justify-center"
      @click.self="close"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close"></div>

      <!-- Panel -->
      <Transition name="support-slide">
        <div
          v-if="modelValue"
          class="relative w-full max-w-md mx-0 lg:mx-auto bg-[#0f1723] border border-slate-700/50 rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden"
        >
          <!-- Handle bar (mobile) -->
          <div class="flex justify-center pt-3 pb-1 lg:hidden">
            <div class="w-10 h-1 bg-slate-700 rounded-full"></div>
          </div>

          <div class="px-6 pt-4 pb-8 lg:py-6">
            <!-- Close button -->
            <button
              @click="close"
              class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm"
            >✕</button>

            <!-- Header -->
            <div class="flex items-center gap-3 mb-5 pr-10">
              <div class="w-11 h-11 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-xl flex-shrink-0">
                💬
              </div>
              <div>
                <p class="text-[9px] text-rose-400 font-black tracking-[3px] uppercase mb-0.5">TRUNG TÂM HỖ TRỢ</p>
                <h2 class="text-white font-black tracking-wider text-base uppercase">{{ config.title }}</h2>
              </div>
            </div>

            <!-- Message -->
            <div class="bg-slate-800/50 border border-slate-700/30 rounded-2xl p-4 mb-6">
              <p class="text-slate-200 text-sm leading-relaxed font-sans normal-case not-italic whitespace-pre-line">{{ config.message }}</p>
            </div>

            <!-- Action buttons -->
            <div class="flex flex-col gap-3">
              <a
                :href="SUPPORT_FANPAGE_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-center gap-2.5 w-full py-3.5 bg-[#1877F2] hover:bg-[#1a6fd8] text-white rounded-2xl font-black tracking-widest text-xs transition-all active:scale-95 shadow-[0_0_20px_rgba(24,119,242,0.35)]"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                NHẮN TIN FANPAGE
              </a>

              <button
                @click="close"
                class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300 rounded-2xl font-black tracking-widest text-xs transition-all active:scale-95"
              >
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.support-fade-enter-active,
.support-fade-leave-active {
  transition: opacity 0.25s ease;
}
.support-fade-enter-from,
.support-fade-leave-to {
  opacity: 0;
}

.support-slide-enter-active,
.support-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.support-slide-enter-from,
.support-slide-leave-to {
  transform: translateY(100%);
}

@media (min-width: 1024px) {
  .support-slide-enter-from,
  .support-slide-leave-to {
    transform: translateY(20px);
  }
}
</style>
