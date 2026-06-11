<script setup lang="ts">
import { ref } from 'vue';
import { jobsData } from '@/data/jobs';
import Logo from '@/components/Logo.vue';

defineProps<{
  username: string;
  isLoggedIn: boolean;
}>();

const emit = defineEmits(['receiveJob', 'contactSupport', 'routerPush']);

const VIP_JOBS = ['liobank', 'app-chung-khoan', 'app-chung-khoan-3', 'app-chung-khoan-4', 'msb-bank', 'vpbank', 'app-chung-khoan-2'];

const handleJobClick = (id: string) => {
  const job = jobsData[id];
  if (!job || (job as any).paused) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  emit('receiveJob', id);
};

const formatReward = (val: any) => {
  if (!val) return '0';
  return String(val).replace(/\D/g, '');
};

const isVip = (id: string) => VIP_JOBS.includes(id);

const getJobIcon = (id: string) => {
  const config: Record<string, { t: string, c: string }> = {
    'follow-cgv':     { t: '🎬', c: 'text-white' },
    'review-cinema':  { t: '⭐', c: 'text-white' },
    'checkin-cinema': { t: '📸', c: 'text-white' },
    'survey-cinema':  { t: '📋', c: 'text-white' },
    'post-threads': { t: '🧵', c: 'text-white' },
    'join-zalo': { t: 'ZALO', c: 'text-white' },
    'app-chung-khoan': { t: '📈', c: 'text-white' },
    'app-chung-khoan-2': { t: '📈', c: 'text-white' },
    'app-chung-khoan-3': { t: '📈', c: 'text-white' },
    'msb-bank': { t: 'MSB', c: 'text-white' },
    'vpbank': { t: 'VPB', c: 'text-white' },
    'app-chung-khoan-4': { t: '📈', c: 'text-white' },
  };
  const res = config[id] || { t: 'JOB', c: 'text-slate-400' };
  return { type: 'text', content: res.t, colorClass: res.c };
};

const getSocialProof = (id: string) => {
  const seeds: Record<string, string> = {
    'follow-cgv':        '1.847',
    'review-cinema':     '923',
    'checkin-cinema':    '654',
    'survey-cinema':     '2.103',
    'post-threads':      '812',
    'join-zalo':         '1.432',
    'app-chung-khoan':   '312',
    'app-chung-khoan-2': '287',
    'app-chung-khoan-3': '241',
    'msb-bank':          '198',
    'vpbank':            '176',
    'app-chung-khoan-4': '163',
  };
  return seeds[id] || '500';
};

const highlights = [
  'KHÔNG THU PHÍ, CỌC PHÍ',
  'KHÔNG NẠP TIỀN',
  'RÚT TIỀN 24/7 MINH BẠCH',
]

const getShortDesc = (id: string) => {
  const desc: Record<string, string> = {
    'follow-cgv':     'Follow fanpage + like & share trailer mới',
    'review-cinema':  'Đánh giá 5 sao rạp phim trên Google Maps',
    'checkin-cinema': 'Check-in tại rạp, đăng Facebook/Instagram',
    'survey-cinema':  'Trả lời 5 câu hỏi, xu vào ví ngay lập tức',
    'post-threads': 'Đăng bài tuyển CTV lên Threads nhận thưởng',
    'join-zalo': 'Vào nhóm cộng đồng nhận thông báo',
    'app-chung-khoan': 'Đăng ký tài khoản Kafi X',
    'app-chung-khoan-2': 'Đăng ký tài khoản DNSE',
    'app-chung-khoan-3': 'Đăng ký tài khoản KIS',
    'vpbank': 'Mở tài khoản số đẹp VPBank',
    'app-chung-khoan-4': 'Đăng ký tài khoản chứng khoán',
    'msb-bank': 'Nhận quà tặng khi mở thẻ MSB'
  };
  return desc[id] || 'Làm nhiệm vụ ngay';
}
</script>

<template>
  <div class="space-y-4 animate-in fade-in duration-700 text-left">
    <svg width="0" height="0" class="absolute">
      <defs>
        <linearGradient id="goldCoinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fde047" />
          <stop offset="50%" style="stop-color:#eab308" />
          <stop offset="100%" style="stop-color:#854d0e" />
        </linearGradient>
        <linearGradient id="vipGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fbbf24" />
          <stop offset="100%" style="stop-color:#f59e0b" />
        </linearGradient>
      </defs>
    </svg>

    <!-- HERO SECTION -->
    <div class="flex flex-col lg:flex-row gap-3">
      <section class="lg:w-2/3 relative bg-gradient-to-br from-[#1a1100] via-[#130d00] to-[#0c0800] rounded-[30px] border border-yellow-600/25 p-6 md:p-10 overflow-hidden flex items-center min-h-[200px] md:min-h-[400px] shadow-[0_0_60px_rgba(234,179,8,0.12),0_20px_80px_rgba(0,0,0,0.6)]">

        <!-- Gold glow orbs -->
        <div class="absolute inset-0 pointer-events-none hero-shimmer rounded-[30px]"></div>
        <div class="absolute -right-20 -top-20 w-[300px] h-[300px] bg-yellow-600/10 rounded-full blur-[90px]"></div>
        <div class="absolute -left-10 bottom-10 w-[200px] h-[200px] bg-amber-700/8 rounded-full blur-[80px]"></div>
        <div class="absolute right-1/3 bottom-0 w-[180px] h-[120px] bg-yellow-500/8 rounded-full blur-[60px]"></div>

        <!-- RẠP JOB glow header -->
        <div class="absolute top-4 left-1/2 -translate-x-1/2 text-center z-20 pointer-events-none hidden md:block whitespace-nowrap">
          <div class="neon-gold-text text-[15px] font-black uppercase tracking-[10px]">RẠP JOB</div>
          <div class="text-[7px] tracking-[3px] text-yellow-600/60 font-bold uppercase mt-0.5">FREELANCE · CINEMA · EARN</div>
        </div>

        <!-- LEFT SIDE — không đổi logic -->
        <div class="relative z-10 space-y-4 w-full md:w-[55%]">
          <!-- Logo — chỉ mobile -->
          <div class="lg:hidden">
            <Logo size="lg" />
          </div>

          <div class="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-[9px] md:text-[10px] px-3 py-1 rounded-full border border-emerald-500/20 font-bold uppercase tracking-wider">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE
          </div>

          <!-- Heading + circular buttons -->
          <div class="flex items-start justify-between gap-2">
            <h1 class="text-xl md:text-4xl text-white leading-tight tracking-tighter uppercase font-black italic">
              CHÀO MỪNG,<br/>
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400 text-2xl md:text-5xl">
                {{ username.toUpperCase() }}
              </span>
            </h1>

            <!-- Nút tròn FB + Zalo (chỉ khi logged in) -->
            <div v-if="isLoggedIn" class="flex flex-col gap-2 flex-shrink-0 mt-1">
              <button @click="emit('contactSupport', 'facebook')"
                      class="w-11 h-11 rounded-full bg-[#1877F2] hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/50 active:scale-90 transition-all hover:scale-110 border border-white/10"
                      title="Facebook Fanpage">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              <button @click="emit('contactSupport', 'zalo')"
                      class="w-11 h-11 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center shadow-lg active:scale-90 transition-all hover:scale-110 border border-slate-200"
                      title="Nhóm Zalo">
                <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" class="w-6 h-6" />
              </button>
            </div>
          </div>

          <!-- Nút đăng nhập (khi chưa login) -->
          <button v-if="!isLoggedIn" @click="emit('routerPush', '/login')"
                  class="bg-yellow-600 hover:bg-yellow-500 text-black w-full md:w-auto px-8 py-3.5 rounded-xl text-[10px] md:text-[12px] shadow-xl shadow-yellow-900/40 uppercase font-black italic transition-all active:scale-95">
            ĐĂNG KÝ / ĐĂNG NHẬP NGAY
          </button>

          <div class="border-l-4 border-yellow-600 pl-4 max-w-2xl space-y-2">
            <p class="hidden md:block text-slate-300 text-[12px] md:text-[15px] font-medium leading-relaxed">
              Nền tảng kiếm tiền Online minh bạch. Rút xu nhanh gọn 24/7 về mọi ngân hàng.
            </p>
            <p class="hidden md:block text-amber-400/80 text-[10px] md:text-[13px] font-bold tracking-wide">
              ⚠️ CẢNH BÁO: Nghiêm cấm gian lận hoặc gửi bằng chứng giả. Khóa vĩnh viễn nếu vi phạm.
            </p>
          </div>

          <!-- Trust badge pills -->
          <div class="space-y-2">
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wide">
                ✅ Không thu phí
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wide">
                ✅ Không nạp tiền
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wide">
                ✅ Công việc miễn phí
              </span>
            </div>
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/40 text-indigo-300 text-[11px] font-black uppercase tracking-wide">
                ⚡ Rút tiền trong 24h
              </span>
            </div>
          </div>
        </div>

        <!-- RIGHT SIDE — Maneki Neko + coins -->
        <div class="absolute right-0 top-0 bottom-0 w-[42%] flex items-end justify-center pointer-events-none opacity-40 md:opacity-100 overflow-hidden">

          <!-- Coin particles (CSS divs — không dùng emoji) -->
          <div class="coin-fx coin-shape" style="--tx:-28px;--ty:-75px;--tx2:-18px;--dur:2.1s;--delay:0s;right:52%;bottom:55%"></div>
          <div class="coin-fx coin-shape" style="--tx:30px;--ty:-90px;--tx2:20px;--dur:2.5s;--delay:0.4s;right:35%;bottom:52%"></div>
          <div class="coin-fx coin-shape" style="--tx:-40px;--ty:-60px;--tx2:-30px;--dur:1.9s;--delay:0.8s;right:45%;bottom:60%"></div>
          <div class="coin-fx coin-shape" style="--tx:18px;--ty:-80px;--tx2:10px;--dur:2.3s;--delay:0.2s;right:28%;bottom:58%"></div>
          <div class="coin-fx coin-shape" style="--tx:-50px;--ty:-50px;--tx2:-35px;--dur:2.7s;--delay:1s;right:55%;bottom:48%"></div>
          <div class="coin-fx coin-shape" style="--tx:45px;--ty:-70px;--tx2:28px;--dur:2s;--delay:0.6s;right:22%;bottom:54%"></div>
          <div class="coin-fx coin-shape" style="--tx:-20px;--ty:-100px;--tx2:-12px;--dur:2.2s;--delay:1.3s;right:40%;bottom:65%"></div>
          <div class="coin-fx coin-shape" style="--tx:35px;--ty:-55px;--tx2:22px;--dur:1.8s;--delay:0.9s;right:30%;bottom:50%"></div>

          <!-- Ground glow -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-36 h-10 bg-yellow-400/25 blur-2xl rounded-full"></div>

          <!-- Maneki Neko SVG -->
          <svg viewBox="0 0 140 185" class="neko-cat w-28 md:w-36 lg:w-44 relative z-10 mb-2" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 24px rgba(234,179,8,0.65))">
            <!-- Tail -->
            <path d="M38 180 Q2 155 10 112 Q18 86 40 110" stroke="#f59e0b" stroke-width="13" fill="none" stroke-linecap="round"/>
            <!-- Body -->
            <ellipse cx="70" cy="142" rx="40" ry="43" fill="#fbbf24"/>
            <!-- Left arm (lowered) -->
            <ellipse cx="30" cy="138" rx="13" ry="24" fill="#fbbf24" transform="rotate(12,30,132)"/>
            <!-- Belly patch -->
            <ellipse cx="70" cy="152" rx="25" ry="27" fill="#fef3c7"/>
            <!-- Coin on chest -->
            <circle cx="70" cy="130" r="14" fill="#f59e0b" stroke="#d97706" stroke-width="2.5"/>
            <text x="70" y="135" text-anchor="middle" fill="#7c2d12" font-size="13" font-weight="bold" font-family="serif">福</text>
            <!-- Head -->
            <circle cx="70" cy="76" r="38" fill="#fbbf24"/>
            <!-- Ears -->
            <polygon points="36,50 20,20 52,44" fill="#fbbf24"/>
            <polygon points="104,50 120,20 88,44" fill="#fbbf24"/>
            <polygon points="38,47 26,24 50,42" fill="#fca5a5"/>
            <polygon points="102,47 114,24 90,42" fill="#fca5a5"/>
            <!-- Face patch -->
            <ellipse cx="70" cy="80" rx="27" ry="23" fill="#fefce8"/>
            <!-- Eyes -->
            <circle cx="55" cy="72" r="8" fill="#1e1b4b"/>
            <circle cx="85" cy="72" r="8" fill="#1e1b4b"/>
            <circle cx="58" cy="69" r="3" fill="white"/>
            <circle cx="88" cy="69" r="3" fill="white"/>
            <!-- Nose -->
            <ellipse cx="70" cy="83" rx="5" ry="4" fill="#fda4af"/>
            <!-- Mouth -->
            <path d="M63 89 Q70 96 77 89" stroke="#92400e" stroke-width="2" fill="none" stroke-linecap="round"/>
            <!-- Whiskers -->
            <line x1="8" y1="80" x2="58" y2="83" stroke="#92400e" stroke-width="1.2" opacity="0.7"/>
            <line x1="8" y1="87" x2="58" y2="86" stroke="#92400e" stroke-width="1.2" opacity="0.7"/>
            <line x1="82" y1="83" x2="132" y2="80" stroke="#92400e" stroke-width="1.2" opacity="0.7"/>
            <line x1="82" y1="86" x2="132" y2="87" stroke="#92400e" stroke-width="1.2" opacity="0.7"/>
            <!-- Forehead stripe -->
            <path d="M57 57 Q70 51 83 57" stroke="#d97706" stroke-width="2" fill="none"/>
            <!-- Right arm WAVING (animated) -->
            <g class="neko-wave-arm">
              <ellipse cx="112" cy="108" rx="13" ry="26" fill="#fbbf24" transform="rotate(-28,108,128)"/>
              <circle cx="120" cy="80" r="16" fill="#fbbf24"/>
              <circle cx="113" cy="68" r="9" fill="#fbbf24"/>
              <circle cx="127" cy="71" r="9" fill="#fbbf24"/>
              <circle cx="121" cy="65" r="9" fill="#fbbf24"/>
            </g>
          </svg>
        </div>

      </section>
    </div>

    <!-- JOB LIST — hidden on mobile, shown via CÔNG VIỆC bottom sheet -->
    <section class="hidden lg:block space-y-4 pt-2">
      <div class="flex items-center gap-3 px-1">
        <div class="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
        <h3 class="text-lg md:text-3xl text-white tracking-tighter italic font-black uppercase">CÔNG VIỆC <span class="text-emerald-500">HOT</span></h3>
      </div>

      <div class="bg-[#150f0d]/40 border border-slate-800/50 rounded-[30px] p-3 md:p-8 shadow-inner space-y-6">

        <!-- TIER CƠ BẢN -->
        <div>
          <div class="flex items-center gap-2 mb-4 px-1">
            <span class="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 border border-slate-600/60 bg-slate-800/20 px-3 py-1 rounded-full">⚡ CƠ BẢN — NHANH & DỄ</span>
          </div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            <template v-for="(j, id) in jobsData" :key="id">
              <div v-if="!isVip(id as string)"
                @click="handleJobClick(id as string)"
                class="relative p-5 md:p-7 rounded-[28px] border-[2px] transition-all duration-500 flex flex-col group cursor-pointer active:scale-95 hover:-translate-y-1 shadow-2xl overflow-hidden"
                :class="[
                  id === 'follow-cgv'     ? 'bg-gradient-to-br from-[#4A1212] to-[#220606] border-red-600/80 shadow-[0_0_30px_rgba(220,38,38,0.45)]'
                  : id === 'review-cinema'  ? 'bg-gradient-to-br from-[#4A3500] to-[#221800] border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.45)]'
                  : id === 'checkin-cinema' ? 'bg-gradient-to-br from-[#4A1428] to-[#220610] border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.45)]'
                  : id === 'survey-cinema'  ? 'bg-gradient-to-br from-[#281555] to-[#100820] border-violet-600/80 shadow-[0_0_30px_rgba(124,58,237,0.45)]'
                  : id === 'google-map'   ? 'bg-gradient-to-br from-[#4A1E3D] to-[#240A1A] border-fuchsia-500/80 shadow-[0_0_30px_rgba(217,70,239,0.45)]'
                  : id === 'join-zalo'    ? 'bg-gradient-to-br from-[#1E2850] to-[#0C1226] border-indigo-500/80 shadow-[0_0_30px_rgba(99,102,241,0.45)]'
                  : 'bg-[#120b0a] border-slate-800'
                ]">
                <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white/5 pointer-events-none rounded-[26px]"></div>

                <!-- BADGE -->
                <div class="absolute -top-0 -right-0 z-20 flex items-center gap-1 text-[9px] md:text-[10px] tracking-widest px-3 py-1.5 rounded-bl-2xl rounded-tr-[26px] font-black italic uppercase border-b border-l border-white/20 shadow-lg"
                     :class="[
                       id === 'follow-cgv'    ? 'bg-red-700 text-white' :
                       id === 'review-cinema' ? 'bg-amber-600 text-white' :
                       id === 'checkin-cinema'? 'bg-rose-600 text-white' :
                       id === 'survey-cinema' ? 'bg-violet-700 text-white' :
                       id === 'google-map'    ? 'bg-fuchsia-600 text-white' :
                       'bg-indigo-600 text-white'
                     ]">
                  {{ j.badge || 'CƠ BẢN' }}
                </div>

                <div class="flex justify-between items-start mb-4 relative z-10">
                  <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-lg border-[1.5px] border-white/20 transition-transform group-hover:scale-110"
                       :class="[
                         id === 'follow-cgv'    ? 'bg-red-600/20 text-red-400' :
                         id === 'review-cinema' ? 'bg-amber-500/20 text-amber-400' :
                         id === 'checkin-cinema'? 'bg-rose-500/20 text-rose-400' :
                         id === 'survey-cinema' ? 'bg-violet-500/20 text-violet-400' :
                         id === 'google-map'    ? 'bg-fuchsia-500/20 text-fuchsia-400' :
                         id === 'join-zalo'     ? 'bg-indigo-500/20 text-indigo-400' :
                         'bg-[#150f0d]'
                       ]">
                    <template v-if="getJobIcon(id as string).content === '📈'">
                      <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 md:w-8 md:h-8">
                        <rect x="2" y="14" width="4" height="8" rx="1"/>
                        <rect x="9" y="9" width="4" height="13" rx="1"/>
                        <rect x="16" y="4" width="4" height="18" rx="1"/>
                        <polyline points="2,10 9,5 16,2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </template>
                    <span v-else class="font-black text-sm md:text-xl italic">{{ getJobIcon(id as string).content }}</span>
                  </div>
                </div>

                <h4 class="text-[13px] md:text-lg text-white font-black italic uppercase leading-tight mb-1"
                    :class="{
                      'text-red-400':    id === 'follow-cgv',
                      'text-amber-400':  id === 'review-cinema',
                      'text-rose-400':   id === 'checkin-cinema',
                      'text-violet-400': id === 'survey-cinema',
                      'text-fuchsia-400': id === 'google-map',
                      'text-indigo-400': id === 'join-zalo'
                    }">
                  {{ j.title }}
                </h4>

                <p class="text-[10px] md:text-[13px] text-slate-300 font-medium line-clamp-2 leading-relaxed mb-4 mt-1">
                  {{ getShortDesc(id as string) }}
                </p>

                <div class="flex flex-col mt-auto relative z-10">
                  <p class="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Thưởng ngay:</p>
                  <div class="flex items-center gap-1.5">
                    <p class="font-black text-xl md:text-3xl tracking-tighter italic leading-none" :class="j.color">
                      {{ formatReward(j.reward).toLocaleString() }}
                    </p>
                    <div class="flex flex-col items-start translate-y-[-2px]">
                      <svg class="w-4 h-4 md:w-5 md:h-5 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="url(#goldCoinGradient)" />
                        <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
                      </svg>
                      <span class="text-[7px] md:text-[9px] text-yellow-500 font-black not-italic tracking-tighter leading-none uppercase">Xu</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1 text-[9px] text-slate-400 opacity-70 mb-2 mt-3">
                  <span>👥</span>
                  <span>{{ getSocialProof(id as string) }} người đã nhận</span>
                </div>
                <button @click.stop="handleJobClick(id as string)"
                  class="w-full py-3 md:py-4 rounded-xl text-[10px] md:text-[11px] font-black italic uppercase transition-all shadow-lg relative z-10 border-t border-white/20"
                  :class="[
                    id === 'follow-cgv'    ? 'bg-gradient-to-r from-red-700 to-red-600 text-white' :
                    id === 'review-cinema' ? 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white' :
                    id === 'checkin-cinema'? 'bg-gradient-to-r from-rose-600 to-pink-500 text-white' :
                    id === 'survey-cinema' ? 'bg-gradient-to-r from-violet-700 to-purple-600 text-white' :
                    id === 'google-map'    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white' :
                    id === 'join-zalo'     ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white' :
                    'bg-[#1a0f0d] text-white'
                  ]">
                  BẮT ĐẦU ⚡
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- DIVIDER VIP -->
        <div id="vip-section" class="relative flex items-center gap-4 py-2">
          <div class="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
          <div class="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/40 px-5 py-2 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span class="text-amber-400 text-sm">👑</span>
            <span class="text-[10px] md:text-xs font-black uppercase tracking-[3px] text-amber-400">VIP — THU NHẬP CAO</span>
            <span class="text-amber-400 text-sm">👑</span>
          </div>
          <div class="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
        </div>

        <!-- TIER VIP -->
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          <template v-for="(j, id) in jobsData" :key="id">
            <div v-if="isVip(id as string)"
              @click="handleJobClick(id as string)"
              class="relative p-5 md:p-7 rounded-[28px] border-[2px] transition-all duration-500 flex flex-col group overflow-hidden"
              :class="(jobsData[id as string] as any).paused
                ? 'border-slate-600/50 bg-gradient-to-br from-[#1a1a1a] to-[#111111] cursor-not-allowed opacity-70'
                : 'vip-card border-amber-500/70 bg-gradient-to-br from-[#2A1C00] to-[#160E00] cursor-pointer active:scale-95'">

              <!-- Glow nền VIP -->
              <div class="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-yellow-300/5 pointer-events-none rounded-[26px]"></div>
              <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>

              <!-- Watermark số thứ tự mờ -->
              <div class="absolute bottom-3 right-4 text-[60px] md:text-[80px] font-black text-amber-400/5 pointer-events-none select-none leading-none">
                {{ ['msb-bank','vpbank','tpbank'].includes(id as string) ? '🏦' : '📊' }}
              </div>

              <!-- BADGE VIP -->
              <div class="absolute -top-0 -right-0 z-20 flex items-center gap-1 text-[9px] md:text-[10px] tracking-widest px-3 py-1.5 rounded-bl-2xl rounded-tr-[26px] font-black italic uppercase border-b border-l border-amber-300/30 shadow-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-900">
                VIP 💎
              </div>

              <div class="flex justify-between items-start mb-4 relative z-10">
                <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-lg border-[1.5px] border-amber-400/30 bg-amber-500/15 text-amber-400 transition-transform group-hover:scale-110 group-hover:border-amber-400/60">
                  <template v-if="getJobIcon(id as string).content === '📈'">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 md:w-8 md:h-8">
                      <rect x="2" y="14" width="4" height="8" rx="1"/>
                      <rect x="9" y="9" width="4" height="13" rx="1"/>
                      <rect x="16" y="4" width="4" height="18" rx="1"/>
                      <polyline points="2,10 9,5 16,2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </template>
                  <span v-else class="font-black text-sm md:text-xl italic">{{ getJobIcon(id as string).content }}</span>
                </div>
              </div>

              <h4 class="text-[13px] md:text-lg text-amber-300 font-black italic uppercase leading-tight mb-1">
                {{ j.title }}
              </h4>

              <p class="text-[10px] md:text-[13px] text-slate-400 font-medium line-clamp-2 leading-relaxed mb-4 mt-1">
                {{ getShortDesc(id as string) }}
              </p>

              <div class="flex flex-col mt-auto relative z-10">
                <p class="text-[9px] md:text-[10px] font-bold text-amber-500/70 uppercase tracking-widest mb-1">Thưởng ngay:</p>
                <div class="flex items-center gap-1.5">
                  <p class="font-black text-2xl md:text-4xl tracking-tighter italic leading-none text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">
                    {{ formatReward(j.reward).toLocaleString() }}
                  </p>
                  <div class="flex flex-col items-start translate-y-[-2px]">
                    <svg class="w-5 h-5 md:w-6 md:h-6 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="url(#goldCoinGradient)" />
                      <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    <span class="text-[7px] md:text-[9px] text-yellow-500 font-black not-italic tracking-tighter leading-none uppercase">Xu</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1.5 text-[9px] mt-3 mb-2"
                   :class="(jobsData[id as string] as any).paused ? 'text-red-400/80' : 'text-amber-500/70'">
                <span class="w-1.5 h-1.5 rounded-full"
                      :class="(jobsData[id as string] as any).paused ? 'bg-red-500' : 'bg-amber-500 animate-pulse'"></span>
                <span>{{ (jobsData[id as string] as any).paused ? 'TẠM DỪNG — Sẽ mở lại sớm' : `Đang mở đăng ký — ${getSocialProof(id as string)} người đã nhận` }}</span>
              </div>
              <button @click.stop="handleJobClick(id as string)"
                class="w-full py-3.5 md:py-4 rounded-xl text-[11px] md:text-[13px] font-black italic uppercase transition-all relative z-10 border"
                :class="(jobsData[id as string] as any).paused
                  ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed'
                  : 'vip-btn border-amber-400/40 bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-900 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)] hover:from-amber-400 hover:to-yellow-400 active:scale-95'">
                {{ (jobsData[id as string] as any).paused ? 'TẠM DỪNG ⏸' : 'NHẬN NGAY 💰' }}
              </button>
            </div>
          </template>
        </div>

      </div>
    </section>
  </div>

</template>

<style scoped>
.animate-jump-cycle {
  animation: jump-cycle 3s ease-in-out infinite;
}
@keyframes jump-cycle {
  0%, 100% { transform: translateY(0) rotate(12deg); }
  50% { transform: translateY(-20px) rotate(15deg); }
}

/* === MANEKI NEKO === */
.neko-wave-arm {
  transform-origin: 108px 128px;
  animation: nekoWave 0.75s ease-in-out infinite alternate;
}
@keyframes nekoWave {
  from { transform: rotate(-18deg); }
  to   { transform: rotate(14deg); }
}
.neko-cat {
  animation: nekoFloat 3s ease-in-out infinite;
}
@keyframes nekoFloat {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-10px); }
}

/* === GOLD COINS === */
.coin-fx {
  position: absolute;
  animation: coinBurst var(--dur, 2.2s) var(--delay, 0s) ease-in-out infinite;
}
.coin-shape {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fde047, #f59e0b 55%, #b45309);
  border: 2px solid #fbbf24;
  box-shadow: 0 0 8px rgba(234,179,8,0.85), inset 0 1px 3px rgba(255,255,255,0.3);
}
@keyframes coinBurst {
  0%   { transform: translate(0,0) rotate(0deg) scale(1);    opacity: 0; }
  10%  { opacity: 1; }
  45%  { transform: translate(var(--tx,-25px), var(--ty,-70px)) rotate(200deg) scale(1.3); opacity: 1; }
  80%  { transform: translate(var(--tx2,-15px), 30px)  rotate(340deg) scale(0.7); opacity: 0.5; }
  100% { transform: translate(var(--tx2,-15px), 55px)  rotate(360deg) scale(0.3); opacity: 0; }
}

/* === RẠP JOB NEON GOLD === */
.neon-gold-text {
  color: #fde047;
  text-shadow:
    0 0 8px rgba(234,179,8,0.9),
    0 0 20px rgba(234,179,8,0.6),
    0 0 40px rgba(234,179,8,0.3);
  animation: goldPulse 2.5s ease-in-out infinite;
}
@keyframes goldPulse {
  0%, 100% { text-shadow: 0 0 8px rgba(234,179,8,0.9), 0 0 20px rgba(234,179,8,0.6), 0 0 40px rgba(234,179,8,0.3); }
  50%       { text-shadow: 0 0 14px rgba(234,179,8,1),  0 0 35px rgba(234,179,8,0.8), 0 0 60px rgba(234,179,8,0.4); }
}

/* VIP card: border glow nhấp nháy */
@keyframes vip-border-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.3), 0 0 0px rgba(245,158,11,0); }
  50%       { box-shadow: 0 0 45px rgba(245,158,11,0.6), 0 0 80px rgba(245,158,11,0.15); }
}
.vip-card {
  animation: vip-border-pulse 2.8s ease-in-out infinite;
}

/* VIP button: glow pulse */
@keyframes vip-btn-pulse {
  0%, 100% { box-shadow: 0 0 15px rgba(245,158,11,0.35); }
  50%       { box-shadow: 0 0 30px rgba(245,158,11,0.75), 0 0 50px rgba(245,158,11,0.2); }
}
.vip-btn {
  animation: vip-btn-pulse 1.8s ease-in-out infinite;
}

/* Hide scrollbar for stats carousel */
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* === AGE MODAL === */
.age-modal-enter-active { transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
.age-modal-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.age-modal-enter-from  { opacity: 0; }
.age-modal-leave-to    { opacity: 0; }
.age-modal-enter-from .age-modal-box { transform: scale(0.85) translateY(20px); }
.age-modal-enter-to   .age-modal-box { transform: scale(1) translateY(0); }
.age-modal-leave-to   .age-modal-box { transform: scale(0.9); }

@keyframes shield-pulse {
  0%, 100% { box-shadow: 0 0 24px rgba(245,158,11,0.3); }
  50%       { box-shadow: 0 0 40px rgba(245,158,11,0.6), 0 0 70px rgba(245,158,11,0.15); }
}
.age-shield-icon { animation: shield-pulse 2s ease-in-out infinite; }

@keyframes confirm-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.4); }
  50%       { box-shadow: 0 0 35px rgba(245,158,11,0.8), 0 0 60px rgba(245,158,11,0.2); }
}
.age-confirm-btn { animation: confirm-glow 1.6s ease-in-out infinite; }

/* Hero shimmer sweep */
@keyframes hero-shimmer-sweep {
  0%   { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(250%) skewX(-15deg); }
}
.hero-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.035) 50%, transparent 100%);
  animation: hero-shimmer-sweep 6s ease-in-out infinite;
}

/* === HIGHLIGHT DOT PULSE === */
@keyframes dotRing {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(52,211,153,0.7); }
  50%       { transform: scale(1.3); box-shadow: 0 0 0 7px rgba(52,211,153,0); }
}
.dot-ring {
  animation: dotRing 2s ease-in-out infinite;
}

/* === HIGHLIGHT ROW SLIDE IN === */
@keyframes textSlideIn {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0); }
}
.highlight-row {
  animation: textSlideIn 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

/* === HIGHLIGHT TEXT SHIMMER === */
@keyframes textShimmer {
  0%, 100% { opacity: 0.85; }
  50%       { opacity: 1; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
}
.highlight-text {
  animation: textShimmer 2.8s ease-in-out infinite;
}
</style>
