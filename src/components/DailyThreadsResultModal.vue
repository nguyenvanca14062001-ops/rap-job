<script setup lang="ts">
defineProps<{
  show: boolean
  type: 'paid' | 'rejected'
  threadNick?: string
  actualReward?: number
  rejectReason?: string
  rejectNote?: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[8000] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/90 backdrop-blur-md"></div>

      <!-- ĐÃ CỘNG XU -->
      <div v-if="type === 'paid'" class="relative bg-gradient-to-b from-[#042a2e] to-[#021617] border-2 border-emerald-500/60 w-full max-w-sm rounded-[36px] p-7 text-center shadow-[0_0_60px_rgba(16,185,129,0.35)] animate-in zoom-in-95 duration-300">
        <div class="w-20 h-20 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-full mx-auto flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(16,185,129,0.6)] mb-4">
          🎉
        </div>
        <h2 class="text-xl text-white tracking-tight mb-2">ĐÃ CỘNG XU THÀNH CÔNG!</h2>
        <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-bold leading-relaxed mb-4">
          Bài đăng Threads hằng ngày của bạn đã được duyệt và cộng xu vào ví.
        </p>
        <div class="bg-[#0d121f] border border-emerald-500/30 rounded-2xl p-4 mb-5 text-left space-y-1.5 font-sans not-italic normal-case text-[11px] text-slate-400">
          <p v-if="threadNick">Nick Threads: <span class="text-white font-bold">🧵 {{ threadNick }}</span></p>
          <p class="text-emerald-400 text-[9px] tracking-widest mt-1">SỐ XU ĐÃ CỘNG</p>
          <p class="text-emerald-400 text-2xl font-black">+{{ (actualReward || 0).toLocaleString() }} XU</p>
        </div>
        <button @click="emit('close')" class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-2xl text-[12px] tracking-widest active:scale-95 transition-all">
          TUYỆT VỜI, ĐÃ NHẬN XU
        </button>
      </div>

      <!-- BỊ TỪ CHỐI -->
      <div v-else class="relative bg-gradient-to-b from-[#2a0a0a] to-[#170505] border-2 border-red-500/60 w-full max-w-sm rounded-[36px] p-7 text-center shadow-[0_0_60px_rgba(239,68,68,0.3)] animate-in zoom-in-95 duration-300">
        <div class="w-20 h-20 bg-gradient-to-tr from-red-500 to-rose-600 rounded-full mx-auto flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(239,68,68,0.6)] mb-4">
          ⚠️
        </div>
        <h2 class="text-xl text-white tracking-tight mb-2">ĐƠN BỊ TỪ CHỐI</h2>
        <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-bold leading-relaxed mb-4">
          Bài đăng Threads hằng ngày của bạn không được duyệt.
        </p>
        <div class="bg-[#0d121f] border border-red-500/30 rounded-2xl p-4 mb-5 text-left space-y-1.5 font-sans not-italic normal-case text-[11px] text-slate-400">
          <p v-if="threadNick">Nick Threads: <span class="text-white font-bold">🧵 {{ threadNick }}</span></p>
          <p class="text-red-400 text-[9px] tracking-widest mt-1">LÝ DO TỪ CHỐI</p>
          <p class="text-white text-[12px] font-bold normal-case bg-red-500/10 border border-red-500/20 p-3 rounded-lg leading-relaxed">
            {{ rejectReason || 'Không đạt yêu cầu' }}<span v-if="rejectNote"> — {{ rejectNote }}</span>
          </p>
        </div>
        <button @click="emit('close')" class="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-[12px] tracking-widest active:scale-95 transition-all">
          TÔI ĐÃ HIỂU
        </button>
      </div>

    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
