<script setup lang="ts">
const props = defineProps<{ size?: 'lg' }>()
</script>

<template>
  <div class="logo-wrap flex items-center select-none cursor-default"
       :class="props.size === 'lg' ? 'gap-3' : 'gap-2.5'">

    <!-- ===== FILM REEL SVG ===== -->
    <svg class="reel flex-shrink-0" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"
         :width="props.size === 'lg' ? 50 : 38"
         :height="props.size === 'lg' ? 50 : 38">
      <defs>
        <filter id="hubGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="reelEdge" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.6" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <radialGradient id="reelBody" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#2a1010"/>
          <stop offset="100%" stop-color="#0e0707"/>
        </radialGradient>
      </defs>

      <!-- Outer body -->
      <circle cx="20" cy="20" r="19.5" fill="url(#reelBody)" stroke="#7f1d1d" stroke-width="0.8" filter="url(#reelEdge)"/>

      <!-- Outer ring highlight -->
      <circle cx="20" cy="20" r="18" stroke="#3f0f0f" stroke-width="0.5" fill="none" opacity="0.6"/>

      <!-- 8 sprocket holes (tọa độ tính sẵn, radius=15 từ tâm 20,20) -->
      <circle cx="35"   cy="20"   r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="30.6" cy="30.6" r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="20"   cy="35"   r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="9.4"  cy="30.6" r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="5"    cy="20"   r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="9.4"  cy="9.4"  r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="20"   cy="5"    r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>
      <circle cx="30.6" cy="9.4"  r="2.6" fill="#0e0a09" stroke="#5a1515" stroke-width="0.4"/>

      <!-- Inner ring -->
      <circle cx="20" cy="20" r="9.5" fill="#120808" stroke="#450a0a" stroke-width="0.7"/>
      <circle cx="20" cy="20" r="8"   fill="#0e0606" stroke="#3a0808" stroke-width="0.4" opacity="0.7"/>

      <!-- 3 spokes (nan hoa) — 120° apart -->
      <!-- Spoke 1: 90°  → (20, 11.5) -->
      <line x1="20" y1="20" x2="20"   y2="11.5" stroke="#991b1b" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
      <!-- Spoke 2: 210° → (13.2, 23.75) -->
      <line x1="20" y1="20" x2="13.2" y2="23.75" stroke="#991b1b" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
      <!-- Spoke 3: 330° → (26.8, 23.75) -->
      <line x1="20" y1="20" x2="26.8" y2="23.75" stroke="#991b1b" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>

      <!-- Center hub -->
      <circle cx="20" cy="20" r="3.8" fill="#dc2626" filter="url(#hubGlow)"/>
      <circle cx="20" cy="20" r="2"   fill="#ef4444" opacity="0.7"/>
      <circle cx="18.8" cy="18.8" r="0.7" fill="white" opacity="0.4"/>
    </svg>

    <!-- ===== TEXT BLOCK ===== -->
    <div class="flex flex-col leading-none gap-[3px]">

      <!-- RẠP JOB -->
      <div class="flex items-baseline gap-[3px]">
        <span class="rap-text font-black italic tracking-tighter leading-none" style="font-style: italic;"
              :class="props.size === 'lg' ? 'text-[23px]' : 'text-[18px] md:text-[20px]'">RẠP</span>
        <span class="text-white font-black italic tracking-tighter leading-none"
              :class="props.size === 'lg' ? 'text-[23px]' : 'text-[18px] md:text-[20px]'">JOB</span>
      </div>

      <!-- Film strip + slogan -->
      <div class="flex items-center gap-[5px]">
        <!-- Mini film strip running -->
        <div class="film-strip-clip flex-shrink-0" :style="props.size === 'lg' ? 'width:36px; height:10px; overflow:hidden;' : 'width:28px; height:8px; overflow:hidden;'">
          <svg class="film-run" :width="props.size === 'lg' ? 72 : 56" :height="props.size === 'lg' ? 10 : 8" viewBox="0 0 56 8" fill="none">
            <!-- Frame 1 -->
            <rect x="0.5"  y="0.5" width="12" height="7" rx="1" fill="#1a0f0c" stroke="#7f1d1d" stroke-width="0.6"/>
            <rect x="2"    y="1.5" width="9"  height="5" rx="0.5" fill="#3a0a0a" opacity="0.8"/>
            <!-- Frame 2 -->
            <rect x="14.5" y="0.5" width="12" height="7" rx="1" fill="#1a0f0c" stroke="#7f1d1d" stroke-width="0.6"/>
            <rect x="16"   y="1.5" width="9"  height="5" rx="0.5" fill="#3a0a0a" opacity="0.8"/>
            <!-- Frame 3 (duplicate for seamless loop) -->
            <rect x="28.5" y="0.5" width="12" height="7" rx="1" fill="#1a0f0c" stroke="#7f1d1d" stroke-width="0.6"/>
            <rect x="30"   y="1.5" width="9"  height="5" rx="0.5" fill="#3a0a0a" opacity="0.8"/>
            <!-- Frame 4 -->
            <rect x="42.5" y="0.5" width="12" height="7" rx="1" fill="#1a0f0c" stroke="#7f1d1d" stroke-width="0.6"/>
            <rect x="44"   y="1.5" width="9"  height="5" rx="0.5" fill="#3a0a0a" opacity="0.8"/>
          </svg>
        </div>

        <!-- Slogan text -->
        <span class="slogan-text text-slate-500 font-black uppercase tracking-widest leading-none whitespace-nowrap" style="font-style: normal;"
              :class="props.size === 'lg' ? 'text-[8.5px]' : 'text-[6.5px]'">FREELANCE • CINEMA • EARN</span>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ===== FILM REEL SPIN ===== */
.reel {
  animation: reelSpin 3s linear infinite;
  transform-origin: center;
  transform-box: fill-box;
}
@keyframes reelSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ===== RẠP FLICKER ===== */
.rap-text {
  color: #ef4444;
  animation: rapFlicker 2.5s ease-in-out infinite;
}
@keyframes rapFlicker {
  0%   { opacity: 1;    color: #ef4444; text-shadow: 0 0 8px rgba(239,68,68,0.6); }
  15%  { opacity: 0.65; color: #f87171; text-shadow: none; }
  20%  { opacity: 1;    color: #dc2626; text-shadow: 0 0 12px rgba(220,38,38,0.8); }
  45%  { opacity: 1;    color: #ef4444; text-shadow: 0 0 6px rgba(239,68,68,0.4); }
  55%  { opacity: 0.75; color: #fca5a5; text-shadow: none; }
  60%  { opacity: 1;    color: #dc2626; text-shadow: 0 0 10px rgba(220,38,38,0.7); }
  100% { opacity: 1;    color: #ef4444; text-shadow: 0 0 8px rgba(239,68,68,0.6); }
}

/* ===== FILM STRIP RUNNING ===== */
.film-run {
  animation: filmRun 1.2s linear infinite;
}
@keyframes filmRun {
  from { transform: translateX(0); }
  to   { transform: translateX(-28px); }
}
</style>
