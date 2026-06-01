<script setup lang="ts">
defineProps<{
  userBalance: number
  username: string
}>()
</script>

<template>
  <header class="w-full p-6 flex justify-between items-center font-black italic uppercase">
    <!-- ĐỊNH NGHĨA MÀU VÀNG KIM LOẠI (DÙNG CHUNG CHO SVG) -->
    <svg width="0" height="0" class="absolute">
      <defs>
        <linearGradient id="headerGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fde047" />
          <stop offset="50%" style="stop-color:#eab308" />
          <stop offset="100%" style="stop-color:#854d0e" />
        </linearGradient>
      </defs>
    </svg>

    <div class="flex items-center gap-2">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl shadow-lg">M</div>
      <span class="text-white text-xl tracking-tighter">PRO</span>
    </div>
    
    <div class="flex items-center gap-4 bg-[#111726] border border-slate-800 py-2 px-5 rounded-2xl shadow-2xl group hover:border-yellow-500/30 transition-all">
      <div class="text-right">
        <p class="text-[8px] text-slate-500 mb-0.5 tracking-[2px]">VÍ CỦA {{ username }}</p>
        <div class="flex items-baseline justify-end gap-1">
          <p class="text-white text-xl leading-none tracking-tighter">{{ userBalance.toLocaleString() }}</p>
          <span class="text-yellow-500 text-[10px] font-black not-italic">XU</span>
        </div>
      </div>
      
      <!-- ĐỒNG XU VÀNG VẼ BẰNG SVG (CHỐNG LỖI 100%) -->
      <div class="relative w-8 h-8 flex items-center justify-center">
        <div class="absolute inset-0 bg-yellow-500/20 blur-md rounded-full group-hover:bg-yellow-500/40 transition-all"></div>
        <svg class="w-7 h-7 relative z-10 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="url(#headerGoldGradient)" />
          <circle cx="12" cy="12" r="7" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 1" opacity="0.3" />
          <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Thêm hiệu ứng lấp lánh nhẹ cho đồng xu */
svg {
  animation: shine 3s infinite;
}
@keyframes shine {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.2) contrast(1.1); }
}
</style>