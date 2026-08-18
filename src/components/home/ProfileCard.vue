<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  username: string
  myReports: any[]
  isLoggedIn: boolean
  isDataLoading: boolean
  userBalance: number
}>()

const totalSubmitted = computed(() => props.myReports.length)

const totalApproved = computed(() =>
  props.myReports.filter((r: any) => r.status === 'approved' || r.status === 'collected').length
)
</script>

<template>
  <!-- SVG gradient defs -->
  <svg width="0" height="0" class="absolute">
    <defs>
      <linearGradient id="profileCoin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#fde047" />
        <stop offset="50%" style="stop-color:#eab308" />
        <stop offset="100%" style="stop-color:#854d0e" />
      </linearGradient>
    </defs>
  </svg>

  <!-- Not logged in -->
  <div v-if="!isLoggedIn"
       class="bg-[#150f0d] border border-slate-800 rounded-[28px] p-8 text-center">
    <p class="text-slate-500 font-bold italic uppercase tracking-widest text-[10px]">Đăng nhập để xem hồ sơ</p>
  </div>

  <!-- Loading -->
  <div v-else-if="isDataLoading" class="text-center py-8">
    <div class="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
    <p class="text-slate-500 text-[10px] font-black italic uppercase">Đang tải hồ sơ...</p>
  </div>

  <!-- Main Card -->
  <div v-else
       class="bg-gradient-to-br from-[#1a0f0c] to-[#0e0a09] border border-slate-700/50 rounded-[28px] p-5 space-y-4 relative overflow-hidden">

    <!-- BG glow -->
    <div class="absolute -right-8 -top-8 w-36 h-36 rounded-full blur-[70px] pointer-events-none bg-slate-500/5"></div>

    <!-- ===== ROW: Avatar + User Info ===== -->
    <div class="flex items-center gap-4 relative z-10">

      <!-- AVATAR -->
      <div class="avatar-wrapper relative flex-shrink-0">
        <div class="relative w-[76px] h-[76px] rounded-full border-2 border-slate-700/50 bg-slate-800/40 flex items-center justify-center">
          <span class="char-float text-[40px] leading-none select-none">🧑‍💻</span>
        </div>
      </div>

      <!-- USER INFO -->
      <div class="flex-1 min-w-0 space-y-1.5">
        <!-- Username -->
        <h2 class="text-white text-[17px] font-black italic uppercase tracking-tighter truncate leading-tight">
          {{ username || 'Member' }}
        </h2>

        <!-- BALANCE CARD -->
        <div class="flex items-center justify-between bg-black/40 rounded-xl px-2.5 py-2 border border-slate-700/40 backdrop-blur-sm">
          <div class="min-w-0">
            <p class="text-slate-500 text-[7px] font-bold uppercase tracking-widest leading-none mb-0.5">SỐ DƯ VÍ</p>
            <p class="font-black italic leading-none tabular-nums text-[14px] text-amber-400 truncate">
              {{ userBalance.toLocaleString('vi-VN') }}
              <span class="text-yellow-500 text-[9px]"> XU</span>
            </p>
          </div>
          <!-- Gold coin icon -->
          <svg class="w-7 h-7 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)] flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="url(#profileCoin)" />
            <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>

        <!-- Stats mini row -->
        <div class="flex items-center gap-2">
          <div class="text-center flex-1">
            <p class="text-white text-[15px] font-black italic leading-none">{{ totalSubmitted }}</p>
            <p class="text-slate-500 text-[7px] font-bold uppercase">Đã nộp</p>
          </div>
          <div class="w-px h-7 bg-slate-700/50"></div>
          <div class="text-center flex-1">
            <p class="text-emerald-400 text-[15px] font-black italic leading-none">{{ totalApproved }}</p>
            <p class="text-slate-500 text-[7px] font-bold uppercase">Duyệt</p>
          </div>
          <div class="w-px h-7 bg-slate-700/50"></div>
          <div class="text-center flex-1">
            <p class="text-amber-400 text-[15px] font-black italic leading-none">
              {{ Math.max(0, totalSubmitted - totalApproved) }}
            </p>
            <p class="text-slate-500 text-[7px] font-bold uppercase">Chờ</p>
          </div>
        </div>
      </div>

    </div><!-- /row -->

  </div><!-- /main card -->
</template>

<style scoped>
/* ===== NHÂN VẬT FLOAT ===== */
@keyframes charFloat {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-7px); }
}
.char-float {
  animation: charFloat 2.5s ease-in-out infinite;
  will-change: transform;
}
</style>
