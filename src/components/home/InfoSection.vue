<script setup lang="ts">
const props = defineProps<{ isLoggedIn?: boolean }>()
const emit = defineEmits(['contactSupport'])

const faqs = [
  { id: '01', q: 'KHI NÀO TÔI NHẬN ĐƯỢC TIỀN?', a: 'TIỀN THƯỞNG SẼ CỘNG VÀO VÍ TRONG VÒNG 1 GIỜ NGAY SAU KHI NỘP ẢNH BẰNG CHỨNG HỢP LỆ.' },
  { id: '02', q: 'RÚT TIỀN TỐI THIỂU LÀ BAO NHIÊU?', a: 'HẠN MỨC RÚT TỐI THIỂU TỪ 200.000 xu VỀ MỌI NGÂN HÀNG VIỆT NAM 24/7.' },
  { id: '03', q: 'LÀM NHIỀU VIỆC CÙNG LÚC ĐƯỢC KHÔNG?', a: 'HOÀN TOÀN ĐƯỢC! BẠN CÓ THỂ THỰC HIỆN TẤT CẢ NHIỆM VỤ HIỂN THỊ ĐỂ GIA TĂNG THU NHẬP.' },
  { id: '04', q: 'TẠI SAO BẰNG CHỨNG BỊ TỪ CHỐI?', a: 'VUI LÒNG ĐẢM BẢO ẢNH CHỤP MÀN HÌNH RÕ NÉT, KHÔNG CẮT GHÉP VÀ LÀM ĐÚNG YÊU CẦU.' }
]

const stats = [
  { icon: '🧑‍💻', value: '10.000+', label: 'Thành viên' },
  { icon: '💰', value: '20TR+', label: 'XU đã chi trả' },
  { icon: '⚡', value: '< 1 giờ', label: 'Duyệt bằng chứng' },
  { icon: '🏆', value: '100%', label: 'Minh bạch' },
]

const steps = [
  { num: '01', icon: '🚀', title: 'Tạo tài khoản', desc: 'Đăng ký miễn phí trong 30 giây, không cần nạp tiền hay cọc phí.' },
  { num: '02', icon: '📋', title: 'Chọn công việc', desc: 'Chọn nhiệm vụ phù hợp, làm theo hướng dẫn và chụp ảnh bằng chứng.' },
  { num: '03', icon: '💳', title: 'Rút tiền 24/7', desc: 'Xu tích lũy được quy đổi thành tiền thật, chuyển thẳng về ngân hàng.' },
]

const jobTypes = [
  {
    tag: 'CƠ BẢN', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',
    glow: 'rgba(52,211,153,0.15)',
    icon: '⚡', title: 'Công Việc Cơ Bản', reward: '10.000 – 30.000 XU / việc',
    items: ['Follow fanpage thương hiệu', 'Đánh giá Google Map', 'Vào nhóm Zalo / Telegram', 'Check-in địa điểm'],
  },
  {
    tag: 'VIP', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    glow: 'rgba(251,191,36,0.15)',
    icon: '💎', title: 'Công Việc VIP', reward: '85.000 – 100.000 XU / việc',
    items: ['Mở tài khoản ngân hàng', 'Đăng ký chứng khoán', 'Cài app tài chính', 'Nhận quà tặng cao cấp'],
  },
]

const trustBadges = [
  { icon: '🚫', title: 'Không nạp tiền', desc: 'Tuyệt đối không yêu cầu nạp tiền hay đặt cọc. Làm việc → nhận thưởng, đơn giản vậy thôi.' },
  { icon: '🏦', title: 'Thanh toán ngân hàng', desc: 'Rút tiền trực tiếp về tài khoản ngân hàng của bạn. Hoạt động 24/7, kể cả ngày lễ.' },
  { icon: '⚡', title: 'Duyệt nhanh trong 1h', desc: 'Admin duyệt bằng chứng nhanh chóng. Xu vào ví ngay, không phải chờ lâu.' },
]
</script>

<template>
  <div class="font-black italic uppercase">

    <!-- ============================================================ -->
    <!-- LANDING SECTIONS — hiện cho mọi user                        -->
    <!-- ============================================================ -->

      <!-- SECTION 1: STATS BAR -->
      <section class="mb-16 mt-8">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            v-for="s in stats"
            :key="s.label"
            class="stat-card bg-[#1a0f0c]/70 border border-slate-800 rounded-2xl p-5 text-center hover:border-red-800/50 transition-all duration-300 group"
          >
            <div class="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{{ s.icon }}</div>
            <p class="text-white text-2xl font-black italic leading-none mb-1">{{ s.value }}</p>
            <p class="text-slate-500 text-[10px] font-black uppercase tracking-widest non-italic">{{ s.label }}</p>
          </div>
        </div>
      </section>

      <!-- SECTION 2: HOW IT WORKS -->
      <section class="mb-20">
        <!-- Header -->
        <div class="flex items-center gap-4 mb-10">
          <div class="w-2.5 h-10 bg-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)]"></div>
          <h3 class="text-3xl md:text-5xl text-white tracking-tighter uppercase italic leading-none font-black">
            CÁCH <span class="text-red-500">HOẠT ĐỘNG</span>
          </h3>
        </div>

        <!-- Steps -->
        <div class="relative grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Connector line (desktop only) -->
          <div class="hidden md:block absolute top-[52px] left-[calc(16.66%+12px)] right-[calc(16.66%+12px)] h-[2px] bg-gradient-to-r from-red-900/50 via-red-600/40 to-red-900/50 z-0"></div>

          <div
            v-for="(step, i) in steps"
            :key="step.num"
            class="step-card relative z-10 bg-[#1a0f0c]/80 border border-red-900/30 rounded-[24px] p-7 text-center hover:border-red-600/50 hover:bg-[#200f0c]/90 transition-all duration-300 group"
            :style="`animation-delay: ${i * 0.15}s`"
          >
            <!-- Big number -->
            <span class="block text-[52px] font-black italic leading-none text-red-700/30 mb-2 group-hover:text-red-600/50 transition-colors duration-300">{{ step.num }}</span>
            <!-- Icon -->
            <span class="block text-3xl mb-3">{{ step.icon }}</span>
            <!-- Title -->
            <h4 class="text-white text-base font-black italic uppercase mb-2 tracking-tight">{{ step.title }}</h4>
            <!-- Desc -->
            <p class="text-slate-400 text-[11px] font-black italic uppercase leading-relaxed tracking-wide">{{ step.desc }}</p>
          </div>
        </div>
      </section>

      <!-- SECTION 3: JOB TYPES -->
      <section class="mb-20">
        <!-- Header -->
        <div class="flex items-center gap-4 mb-10">
          <div class="w-2.5 h-10 bg-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)]"></div>
          <h3 class="text-3xl md:text-5xl text-white tracking-tighter uppercase italic leading-none font-black">
            LOẠI <span class="text-amber-400">CÔNG VIỆC</span>
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="jt in jobTypes"
            :key="jt.tag"
            class="job-type-card rounded-[28px] p-8 border transition-all duration-300 hover:scale-[1.02] group"
            :class="[jt.bg, jt.border]"
            :style="`box-shadow: 0 0 40px ${jt.glow}`"
          >
            <!-- Tag -->
            <div class="flex items-center gap-3 mb-5">
              <span class="text-2xl">{{ jt.icon }}</span>
              <span class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
                    :class="[jt.color, jt.border, jt.bg]">{{ jt.tag }}</span>
            </div>
            <!-- Title -->
            <h4 class="text-white text-xl font-black italic uppercase mb-2 tracking-tight">{{ jt.title }}</h4>
            <!-- Reward badge -->
            <div class="inline-flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-xl bg-black/30 border border-white/10">
              <span class="text-[10px]">🔥</span>
              <span class="text-[11px] font-black italic" :class="jt.color">{{ jt.reward }}</span>
            </div>
            <!-- Items list -->
            <ul class="space-y-2.5">
              <li
                v-for="item in jt.items"
                :key="item"
                class="flex items-center gap-2.5"
              >
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="jt.color.replace('text-', 'bg-')"></span>
                <span class="text-slate-300 text-[12px] font-black italic uppercase tracking-wide">{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- SECTION 4: TRUST BADGES -->
      <section class="mb-20">
        <div class="bg-gradient-to-br from-[#1a0f0c] to-[#120a08] rounded-[30px] border border-red-900/20 p-8 md:p-12">
          <!-- Header -->
          <div class="flex items-center gap-4 mb-10">
            <div class="w-2.5 h-10 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
            <h3 class="text-3xl md:text-4xl text-white tracking-tighter uppercase italic leading-none font-black">
              VÌ SAO <span class="text-emerald-400">TIN TƯỞNG</span> CHÚNG TÔI?
            </h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              v-for="badge in trustBadges"
              :key="badge.title"
              class="trust-badge flex flex-col items-center text-center p-6 rounded-2xl bg-black/20 border border-slate-800/60 hover:border-emerald-800/40 transition-all duration-300 group"
            >
              <div class="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{{ badge.icon }}</div>
              <h5 class="text-white text-base font-black italic uppercase mb-2">{{ badge.title }}</h5>
              <p class="text-slate-400 text-[11px] font-black italic uppercase leading-relaxed tracking-wide">{{ badge.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 5: CTA BANNER — chỉ khi chưa login -->
      <section v-if="!props.isLoggedIn" class="mb-20">
        <div class="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-red-900/25 via-[#1c0e0b] to-[#150a08] border border-red-700/30 py-16 px-8 text-center">
          <!-- Glow decorations -->
          <div class="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-red-700/10 blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-amber-700/10 blur-3xl pointer-events-none"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] rounded-full bg-red-900/10 blur-3xl pointer-events-none"></div>

          <!-- Content -->
          <div class="relative z-10">
            <!-- Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-900/40 border border-red-700/40 mb-6">
              <span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
              <span class="text-red-400 text-[10px] font-black uppercase tracking-widest">Miễn phí 100%</span>
            </div>

            <h2 class="text-4xl md:text-6xl font-black italic uppercase text-white tracking-tighter leading-tight mb-4">
              SẴN SÀNG<br/>
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-400 to-red-400 cta-shimmer">KIẾM TIỀN?</span>
            </h2>

            <p class="text-slate-400 text-[13px] font-black italic uppercase tracking-widest mb-10">
              Tham gia ngay hôm nay — không cần nạp tiền, không cần cọc phí.
            </p>

            <a
              href="#/register"
              class="inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-black italic uppercase text-base tracking-wider
                     bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500
                     shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)]
                     transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span>🚀</span>
              ĐĂNG KÝ MIỄN PHÍ NGAY
            </a>

            <p class="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-5">
              Đã có tài khoản?
              <a href="#/login" class="text-slate-400 hover:text-white underline underline-offset-2 transition-colors ml-1">Đăng nhập tại đây</a>
            </p>
          </div>
        </div>
      </section>

      <!-- SECTION 5 (ALT): LOGGED-IN MOTIVATIONAL BANNER -->
      <section v-else class="mb-20">
        <div class="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-emerald-900/20 via-[#0f1c10] to-[#0c1209] border border-emerald-700/30 py-12 px-8 text-center">
          <!-- Glow -->
          <div class="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-16 right-0 w-64 h-48 rounded-full bg-green-700/8 blur-3xl pointer-events-none"></div>

          <div class="relative z-10">
            <!-- Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-700/40 mb-5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Đang hoạt động</span>
            </div>

            <h2 class="text-3xl md:text-5xl font-black italic uppercase text-white tracking-tighter leading-tight mb-3">
              TIẾP TỤC<br/>
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400 logged-shimmer">KIẾM XU! 🔥</span>
            </h2>

            <p class="text-slate-400 text-[12px] font-black italic uppercase tracking-widest mb-8">
              Hoàn thành nhiệm vụ — xu vào ví ngay, rút 24/7 về ngân hàng.
            </p>

            <!-- 3 quick stats inline -->
            <div class="flex items-center justify-center gap-6 md:gap-12">
              <div class="text-center">
                <p class="text-emerald-400 text-xl md:text-2xl font-black italic">10K+</p>
                <p class="text-slate-500 text-[9px] font-black uppercase tracking-widest">Thành viên</p>
              </div>
              <div class="w-px h-8 bg-slate-700"></div>
              <div class="text-center">
                <p class="text-emerald-400 text-xl md:text-2xl font-black italic">&lt; 1H</p>
                <p class="text-slate-500 text-[9px] font-black uppercase tracking-widest">Duyệt bằng chứng</p>
              </div>
              <div class="w-px h-8 bg-slate-700"></div>
              <div class="text-center">
                <p class="text-emerald-400 text-xl md:text-2xl font-black italic">24/7</p>
                <p class="text-slate-500 text-[9px] font-black uppercase tracking-widest">Rút tiền</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- /LANDING SECTIONS -->

    <!-- ============================================================ -->
    <!-- FAQ — luôn hiện cho mọi user                                 -->
    <!-- ============================================================ -->
    <section class="space-y-10 mt-8 mb-20">
      <div class="flex items-center gap-4">
        <div class="w-2.5 h-10 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"></div>
        <h3 class="text-3xl md:text-5xl text-white tracking-tighter uppercase italic leading-none font-black">
          GIẢI ĐÁP <span class="text-blue-500">THẮC MẮC</span>
        </h3>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          v-for="f in faqs"
          :key="f.id"
          class="bg-[#111726]/40 p-10 rounded-[40px] border border-slate-800/50 hover:bg-[#111726]/60 transition-all group"
        >
          <p class="text-blue-500 text-xs font-black italic uppercase tracking-widest mb-4">
            #{{ f.id }}. {{ f.q }}
          </p>
          <p class="text-slate-400 text-sm italic font-black uppercase leading-relaxed group-hover:text-white transition-colors">
            {{ f.a }}
          </p>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
section {
  scroll-margin-top: 100px;
}

/* Stat card entrance */
.stat-card {
  animation: fadeUp 0.5s ease both;
}
.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.12s; }
.stat-card:nth-child(3) { animation-delay: 0.19s; }
.stat-card:nth-child(4) { animation-delay: 0.26s; }

/* Step card entrance */
.step-card {
  animation: fadeUp 0.55s ease both;
}
.step-card:nth-child(1) { animation-delay: 0.1s; }
.step-card:nth-child(2) { animation-delay: 0.22s; }
.step-card:nth-child(3) { animation-delay: 0.34s; }

/* Job type cards */
.job-type-card {
  animation: fadeUp 0.55s ease both;
}
.job-type-card:nth-child(1) { animation-delay: 0.1s; }
.job-type-card:nth-child(2) { animation-delay: 0.22s; }

/* Trust badges */
.trust-badge {
  animation: fadeUp 0.55s ease both;
}
.trust-badge:nth-child(1) { animation-delay: 0.05s; }
.trust-badge:nth-child(2) { animation-delay: 0.15s; }
.trust-badge:nth-child(3) { animation-delay: 0.25s; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* CTA text shimmer */
.cta-shimmer {
  background-size: 200% auto;
  animation: ctaShimmer 3s linear infinite;
}
@keyframes ctaShimmer {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}

/* non-italic override */
.non-italic {
  font-style: normal;
}

/* Logged-in banner shimmer */
.logged-shimmer {
  background-size: 200% auto;
  animation: loggedShimmer 3s linear infinite;
}
@keyframes loggedShimmer {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}
</style>
