<script setup lang="ts">
import { ref, computed } from 'vue'

interface Tier {
  name: string
  key: string
  rewardXu: number
  color: string
  bg: string
  border: string
  btnBg: string
  bar: string
  chest: string | null
  chestDesc: string | null
  icon: string
  min: number
}

const props = defineProps<{
  tier: Tier
  unlocked: boolean
  claimed: boolean
  count: number
}>()

const emit = defineEmits<{ toggle: [] }>()

const isShaking = ref(false)

const glowColor = computed(() => {
  const map: Record<string, string> = {
    bac: 'rgba(148,163,184,0.55)',
    vang: 'rgba(245,158,11,0.55)',
    kimcuong: 'rgba(6,182,212,0.55)',
  }
  return map[props.tier.key] || 'rgba(148,163,184,0.3)'
})

const colors = computed(() => {
  const map: Record<string, { lid: string; body: string; band: string; latch: string }> = {
    bac:      { lid: '#475569', body: '#1e293b', band: '#94a3b8', latch: '#e2e8f0' },
    vang:     { lid: '#b45309', body: '#451a03', band: '#fbbf24', latch: '#fef08a' },
    kimcuong: { lid: '#0891b2', body: '#0c4a6e', band: '#22d3ee', latch: '#cffafe' },
  }
  return map[props.tier.key] || map.bac
})

function handleClick() {
  if (!props.unlocked) {
    isShaking.value = true
    setTimeout(() => { isShaking.value = false }, 600)
    return
  }
  emit('toggle')
}
</script>

<template>
  <div
    class="chest-card relative flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-2xl border-[1.5px] cursor-pointer transition-all duration-200 select-none overflow-visible"
    :class="[
      isShaking ? 'is-shaking' : '',
      unlocked ? [tier.bg, tier.border, 'shadow-lg'] : 'bg-slate-800/30 border-slate-700/30',
    ]"
    :style="{ '--glow': glowColor }"
    @click="handleClick"
  >
    <!-- Tooltip khi locked -->
    <div v-if="!unlocked"
         class="chest-tooltip absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a0f0c] border border-slate-700/60 text-slate-400 text-[8px] font-black rounded-lg whitespace-nowrap z-30 pointer-events-none opacity-0 transition-opacity duration-200 shadow-lg">
      🔒 Cần {{ tier.min }} việc
    </div>

    <!-- ===== CHEST CSS ART ===== -->
    <div class="chest-art relative w-[52px] h-[46px]"
         :class="unlocked ? 'is-unlocked' : 'is-locked-chest'">

      <!-- Glow aura phía sau (chỉ khi unlocked) -->
      <div v-if="unlocked"
           class="absolute -inset-2 rounded-xl pointer-events-none"
           :style="{ background: `radial-gradient(circle at 50% 60%, ${glowColor} 0%, transparent 70%)`, opacity: 0.55 }"></div>

      <!-- LID (phần nắp — có thể rotate mở) -->
      <div class="lid-wrapper absolute top-0 left-0 right-0 z-10"
           style="height: 19px; perspective: 140px;">
        <div
          class="lid-face absolute inset-0 rounded-t-[8px] overflow-hidden"
          :style="{
            background: `linear-gradient(145deg, ${colors.lid} 0%, ${colors.body} 100%)`,
            transformOrigin: '50% 100%',
            transition: 'transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.35)`
          }">
          <!-- Shine strip trên nắp -->
          <div class="absolute top-[3px] left-[22%] right-[22%] h-[2px] rounded-full"
               :style="{ background: colors.latch, opacity: 0.25 }"></div>
          <!-- Thanh dưới nắp -->
          <div class="absolute bottom-0 left-0 right-0 h-[4px]"
               :style="{ background: colors.band, opacity: 0.9 }"></div>
        </div>
        <!-- Latch knob (chốt khóa) -->
        <div class="absolute z-20 w-[9px] h-[9px] rounded-full border-[1.5px] shadow-md"
             style="bottom: -4px; left: 50%; transform: translateX(-50%);"
             :style="{ background: colors.latch, borderColor: colors.body }"></div>
      </div>

      <!-- BODY (thân hòm) -->
      <div class="chest-body-art absolute left-0 right-0 bottom-0 rounded-b-[8px] overflow-hidden"
           style="top: 15px;"
           :style="{
             background: `linear-gradient(180deg, ${colors.lid} 0%, ${colors.body} 100%)`,
             boxShadow: `inset 0 -2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`
           }">
        <!-- Thanh ngang trên thân -->
        <div class="absolute top-0 left-0 right-0 h-[4px]"
             :style="{ background: colors.band, opacity: 0.85 }"></div>
        <!-- Icon trung tâm -->
        <div class="absolute inset-0 flex items-center justify-center mt-1">
          <span v-if="!unlocked" class="text-[14px] leading-none" style="filter: grayscale(1); opacity: 0.35;">🔒</span>
          <span v-else class="text-[14px] leading-none">{{ tier.icon }}</span>
        </div>
        <!-- Shine phía dưới thân -->
        <div class="absolute bottom-[3px] left-[28%] right-[28%] h-[1.5px] rounded-full"
             :style="{ background: colors.latch, opacity: 0.18 }"></div>
      </div>

    </div><!-- /chest-art -->

    <!-- Tên hòm -->
    <p class="text-[8px] font-black italic uppercase text-center leading-tight relative z-10"
       :class="unlocked ? tier.color : 'text-slate-600'">
      {{ tier.chest?.replace('🎁 ', '') }}
    </p>

    <!-- Badge trạng thái -->
    <span v-if="claimed"     class="text-[7px] font-black uppercase text-emerald-400 tracking-wide relative z-10">✅ ĐÃ NHẬN</span>
    <span v-else-if="unlocked" class="text-[7px] font-black uppercase text-emerald-400 tracking-wide relative z-10">✅ ĐÃ MỞ</span>
    <span v-else             class="text-[7px] font-black uppercase text-slate-600 tracking-wide relative z-10">🔒 {{ tier.min }} VIỆC</span>

    <!-- Ghi chú range thưởng — nổi bật -->
    <div v-if="tier.chestDesc" class="relative z-10 w-full px-1">
      <div class="rounded-lg px-2 py-1.5 text-center"
           :class="unlocked
             ? 'bg-gradient-to-r from-black/50 to-black/30 border border-white/10'
             : 'bg-slate-900/50 border border-slate-700/30'">
        <!-- Label + fire icon -->
        <div class="flex items-center justify-center gap-1 mb-0.5">
          <span class="text-[10px] leading-none">{{ unlocked ? '🔥' : '🔒' }}</span>
          <span class="text-[6.5px] font-black uppercase tracking-widest leading-none"
                :class="unlocked ? tier.color : 'text-slate-600'">THƯỞNG NGẪU NHIÊN</span>
        </div>
        <!-- Range amount -->
        <p class="text-[9px] font-black italic leading-tight tabular-nums"
           :class="unlocked ? tier.color : 'text-slate-600'"
           :style="unlocked ? 'filter: drop-shadow(0 0 5px currentColor)' : ''">
          {{ tier.chestDesc }}
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ===== HOVER: bounce + glow (chỉ khi unlocked) ===== */
.chest-card:hover .is-unlocked {
  animation: chestBounce 0.75s ease infinite;
}
.chest-card:hover .is-unlocked .lid-face,
.chest-card:hover .is-unlocked .chest-body-art {
  filter: brightness(1.15);
}
.chest-card:hover .is-unlocked .chest-body-art,
.chest-card:hover .is-unlocked .lid-face {
  filter: drop-shadow(0 0 6px var(--glow));
}

@keyframes chestBounce {
  0%, 100% { transform: translateY(0) scale(1.07); }
  50%       { transform: translateY(-4px) scale(1.07); }
}

/* ===== SHAKE khi click locked ===== */
@keyframes shakeLocked {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  15%      { transform: translateX(-6px) rotate(-2.5deg); }
  30%      { transform: translateX(6px) rotate(2.5deg); }
  45%      { transform: translateX(-4px) rotate(-1.5deg); }
  60%      { transform: translateX(4px) rotate(1.5deg); }
  80%      { transform: translateX(-2px); }
}
.is-shaking {
  animation: shakeLocked 0.55s ease !important;
}

/* ===== TOOLTIP hiện khi hover locked ===== */
.chest-card:hover .chest-tooltip {
  opacity: 1 !important;
}
</style>
