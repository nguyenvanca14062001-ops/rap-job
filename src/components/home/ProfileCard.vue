<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  username: string
  myReports: any[]
  vipProgress: { count: number; tier: any; tierIdx: number; nextTier: any; progress: number }
  vipTiers: any[]
  claimedChests: string[]
  isLoggedIn: boolean
  isDataLoading: boolean
  userBalance: number
}>()

const totalSubmitted = computed(() => props.myReports.length)

const totalApproved = computed(() =>
  props.myReports.filter((r: any) => r.status === 'approved' || r.status === 'collected').length
)

const activeChest = computed(() => {
  const all = props.vipTiers.slice(1).map((t: any) => ({
    ...t,
    remaining: Math.max(0, t.min - props.vipProgress.count),
    unlocked: props.vipProgress.count >= t.min,
    claimed: props.claimedChests.includes(t.key),
    percent: Math.min(100, (props.vipProgress.count / t.min) * 100),
  }))
  return all.find(c => !c.claimed) ?? null
})

const allChestsClaimed = computed(() =>
  props.vipTiers.slice(1).every((t: any) => props.claimedChests.includes(t.key))
)

const characterEmoji = computed(() => {
  const map: Record<string, string> = {
    '': '🧑‍💻',
    bac: '🧑‍💼',
    vang: '🫅',
    kimcuong: '🦸',
  }
  return map[props.vipProgress.tier?.key ?? ''] ?? '🧑‍💻'
})

const tierGlow = computed(() => {
  const map: Record<string, string> = {
    bac: 'rgba(148,163,184,0.45)',
    vang: 'rgba(245,158,11,0.45)',
    kimcuong: 'rgba(6,182,212,0.45)',
  }
  return map[props.vipProgress.tier?.key ?? ''] ?? 'rgba(100,116,139,0.2)'
})

const bgGlowClass = computed(() => {
  const k = props.vipProgress.tier?.key
  if (k === 'kimcuong') return 'bg-cyan-500/10'
  if (k === 'vang') return 'bg-amber-500/10'
  if (k === 'bac') return 'bg-slate-400/8'
  return 'bg-slate-500/5'
})
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

    <!-- BG glow tier -->
    <div class="absolute -right-8 -top-8 w-36 h-36 rounded-full blur-[70px] pointer-events-none"
         :class="bgGlowClass"></div>

    <!-- ===== ROW 1: Avatar + User Info ===== -->
    <div class="flex items-center gap-4 relative z-10">

      <!-- AVATAR -->
      <div class="avatar-wrapper relative flex-shrink-0">
        <!-- Glow aura -->
        <div class="absolute -inset-2 rounded-full blur-md pointer-events-none glow-ring"
             :style="{ background: `radial-gradient(circle, ${tierGlow} 10%, transparent 70%)` }"></div>

        <!-- Ring + character -->
        <div class="relative w-[76px] h-[76px] rounded-full border-2 flex items-center justify-center"
             :class="[vipProgress.tier?.bg, vipProgress.tier?.border]">
          <!-- Character emoji float -->
          <span class="char-float text-[40px] leading-none select-none">{{ characterEmoji }}</span>
          <!-- Tier badge bottom-right -->
          <div class="absolute -bottom-1 -right-1 w-[26px] h-[26px] rounded-full border-[1.5px] flex items-center justify-center text-[13px] shadow-md"
               :class="[vipProgress.tier?.bg, vipProgress.tier?.border]">
            {{ vipProgress.tier?.icon }}
          </div>
        </div>

        <!-- Sparkle ring (Kim Cương only) -->
        <div v-if="vipProgress.tierIdx >= 3" class="sparkle-ring absolute inset-0 pointer-events-none"></div>
      </div>

      <!-- USER INFO -->
      <div class="flex-1 min-w-0 space-y-1.5">
        <!-- Username -->
        <h2 class="text-white text-[17px] font-black italic uppercase tracking-tighter truncate leading-tight">
          {{ username || 'Member' }}
        </h2>
        <!-- Tier badge -->
        <div class="flex items-center gap-1.5">
          <span class="text-sm leading-none">{{ vipProgress.tier?.icon }}</span>
          <span class="text-[10px] font-black italic uppercase tracking-wide"
                :class="vipProgress.tier?.color">{{ vipProgress.tier?.name }}</span>
        </div>

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

    </div><!-- /row 1 -->

    <!-- Divider -->
    <div class="border-t border-slate-700/30 relative z-10"></div>

    <!-- ===== ROW 2: Chest Progress (1 bar tại 1 thời điểm) ===== -->
    <div class="space-y-2 relative z-10">
      <p class="text-slate-600 text-[8px] font-black uppercase tracking-[2px]">🎯 TIẾN ĐỘ NHẬN THƯỞNG</p>

      <!-- Tất cả đã nhận -->
      <div v-if="allChestsClaimed"
           class="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <span class="text-lg">🏆</span>
        <span class="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Đã nhận hết thưởng!</span>
      </div>

      <!-- 1 hòm đang tiến độ -->
      <div v-else-if="activeChest" class="space-y-1">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-sm" :style="activeChest.unlocked ? '' : 'filter: grayscale(1); opacity: 0.4;'">{{ activeChest.icon }}</span>
            <span class="text-[9px] font-black uppercase"
                  :class="activeChest.unlocked ? activeChest.color : 'text-slate-500'">
              {{ activeChest.name }}
            </span>
          </div>
          <span class="text-[8px] font-black tabular-nums"
                :class="activeChest.unlocked ? 'text-amber-400' : activeChest.color">
            <template v-if="activeChest.unlocked">🎁 Chưa nhận</template>
            <template v-else>Còn {{ activeChest.remaining }} đơn</template>
          </span>
        </div>
        <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/20">
          <div class="h-full rounded-full transition-all duration-700"
               :class="activeChest.bar"
               :style="{ width: activeChest.percent + '%' }"></div>
        </div>
        <p class="text-right text-[7px] font-black text-slate-600 tabular-nums">
          {{ Math.min(vipProgress.count, activeChest.min) }}/{{ activeChest.min }}
        </p>
      </div>
    </div><!-- /row 2 -->

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

/* ===== GLOW RING PULSE ===== */
@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%       { opacity: 0.9; transform: scale(1.1); }
}
.glow-ring {
  animation: glowPulse 2.5s ease-in-out infinite;
  will-change: opacity, transform;
}

/* ===== SPARKLE (Kim Cương) ===== */
@keyframes sparkleSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.sparkle-ring {
  animation: sparkleSpin 5s linear infinite;
}
.sparkle-ring::before,
.sparkle-ring::after {
  content: '✦';
  position: absolute;
  font-size: 9px;
  color: #22d3ee;
  opacity: 0.75;
}
.sparkle-ring::before { top: -2px; left: 50%; transform: translateX(-50%); }
.sparkle-ring::after  { bottom: -2px; left: 50%; transform: translateX(-50%); }

/* ===== UNLOCKED CHEST PULSE ===== */
@keyframes pulseSlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.3); }
  50%       { box-shadow: 0 0 0 6px rgba(251,191,36,0); }
}
.animate-pulse-slow {
  animation: pulseSlow 2s ease-in-out infinite;
}
</style>
