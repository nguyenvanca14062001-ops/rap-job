<script setup lang="ts">
import { computed } from 'vue'
import { formatVnDayMonth, type IncomeStats, type PeriodIncome } from '@/utils/incomeStats'

const props = withDefaults(defineProps<{
  username: string
  myReports: any[]
  isLoggedIn: boolean
  isDataLoading: boolean
  userBalance: number
  isBalanceVisible?: boolean
  income: IncomeStats
}>(), { isBalanceVisible: true })

const emit = defineEmits(['routerPush'])

const totalSubmitted = computed(() => props.myReports.length)

const totalApproved = computed(() =>
  props.myReports.filter((r: any) => r.status === 'approved' || r.status === 'collected').length
)

// Số dài (VD 1.250.000+) tự co cỡ chữ cho vừa card ở màn hẹp, tối đa vẫn 22px như thiết kế: bề rộng card (100cqi)
// trừ chỗ cho chữ "xu", chia cho bề rộng ước lượng của chuỗi số (chữ số 0.68em, dấu chấm 0.34em, dấu + 0.72em —
// làm tròn lên so với font hệ thống đậm 900). Trình duyệt không hỗ trợ cqi bỏ qua style này, giữ text-[22px].
const fitFontSize = (value: string) => {
  const em = [...value].reduce((sum, ch) => sum + (ch === '.' ? 0.34 : ch === '+' ? 0.72 : 0.68), 0)
  return `min(22px, calc((100cqi - 22px) / ${em.toFixed(2)}))`
}

// Card Hôm nay / Tuần này — value null = đang tải (skeleton). Kỳ có đơn đã cộng xu nhưng không lưu số xu
// (duyệt hàng loạt) → hiện phần đã biết kèm "+" và báo số đơn, không coi phần thiếu là 0.
type IncomeCard = { value: string | null; caption: string; hasUnit: boolean; fontSize?: string }
const describeIncome = (p: PeriodIncome, periodLabel: string): IncomeCard => {
  const xu = (value: string, caption: string): IncomeCard => ({ value, caption, hasUnit: true, fontSize: fitFontSize(value) })
  if (props.income.status === 'loading') return { value: null, caption: 'Đang tải...', hasUnit: false }
  if (props.income.status === 'error') return { value: '—', caption: 'Không tải được', hasUnit: false }
  if (p.unknownCount > 0) {
    const caption = `${p.unknownCount} đơn chưa rõ số xu`
    return p.amount > 0 ? xu(`${p.amount.toLocaleString('vi-VN')}+`, caption) : { value: '—', caption, hasUnit: false }
  }
  return xu(p.amount.toLocaleString('vi-VN'), periodLabel)
}

const todayIncome = computed(() =>
  describeIncome(props.income.today, `Ngày ${formatVnDayMonth(props.income.periods.dayStart)}`)
)
const weekIncome = computed(() => {
  const { weekStart, weekEnd } = props.income.periods
  return describeIncome(props.income.week, `${formatVnDayMonth(weekStart)} – ${formatVnDayMonth(weekEnd - 1)}`)
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

  <!-- Cụm đầu trang chủ MOBILE — bố cục kiểu Máy Task, giữ tông đen – đỏ – vàng Rạp Job -->
  <div class="space-y-4">

    <!-- 1. Lời chào -->
    <div class="px-0.5">
      <p class="text-slate-400 text-[13px] font-semibold leading-tight">{{ isLoggedIn ? 'Chào mừng trở lại,' : 'Chào mừng bạn đến với' }}</p>
      <h2 class="mt-1 text-[26px] leading-[1.15] tracking-tight wrap-anywhere">
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400">{{ isLoggedIn ? (username || 'Member') : 'Rạp Job' }}</span><span class="text-red-500">!</span>
      </h2>
      <p class="mt-1.5 text-slate-500 text-[12px] font-medium leading-snug">
        {{ isLoggedIn ? 'Hoàn thành công việc hôm nay để nhận thêm xu nhé.' : 'Đăng nhập để nhận việc, tích xu và rút tiền nhanh chóng.' }}
      </p>
    </div>

    <!-- 2. Card số dư — đỏ đậm Rạp Job, số dư realtime từ users/{uid}.balance -->
    <div class="relative overflow-hidden rounded-2xl border border-red-400/25 bg-gradient-to-br from-red-600 via-red-800 to-[#3a0a0a] p-4 shadow-[0_10px_30px_rgba(185,28,28,0.35)]">
      <!-- Họa tiết chìm -->
      <div class="pointer-events-none absolute -right-12 -top-14 w-44 h-44 rounded-full border-[22px] border-white/[0.06]"></div>
      <div class="pointer-events-none absolute -right-4 -bottom-20 w-40 h-40 rounded-full bg-amber-400/15 blur-3xl"></div>

      <template v-if="isLoggedIn">
        <p class="relative text-red-100/80 text-[12px] font-semibold">Số dư khả dụng</p>
        <div class="relative mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-3">
          <div class="flex items-center gap-2">
            <span class="text-white text-[28px] min-[375px]:text-[30px] leading-none font-black tracking-tight tabular-nums">
              {{ isBalanceVisible ? userBalance.toLocaleString('vi-VN') : '******' }}
            </span>
            <div class="flex flex-col items-center shrink-0">
              <svg class="w-6 h-6 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="url(#profileCoin)" />
                <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span class="text-[8px] text-yellow-300 font-black leading-none">XU</span>
            </div>
          </div>
          <button @click="emit('routerPush', '/withdraw')"
                  class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] text-[12px] font-black shadow-[0_4px_14px_rgba(251,191,36,0.35)] active:scale-95 transition-transform">
            Rút tiền
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </template>

      <!-- Chưa đăng nhập: giữ lối vào Đăng ký / Đăng nhập (trước nằm trong card chào mừng cũ) -->
      <template v-else>
        <p class="relative text-white text-[15px] font-black leading-snug">Đăng nhập để xem số dư<br>và bắt đầu nhận việc</p>
        <button @click="emit('routerPush', '/login')"
                class="relative mt-3 w-full inline-flex items-center justify-center py-3 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] text-[12px] font-black uppercase shadow-[0_4px_14px_rgba(251,191,36,0.35)] active:scale-95 transition-transform">
          Đăng ký / Đăng nhập ngay
        </button>
      </template>
    </div>

    <!-- 3. Hôm nay / Tuần này — tổng xu Admin ĐÃ CỘNG vào ví trong ngày / tuần (Thứ Hai → Chủ nhật, giờ VN), theo
         thời điểm cộng xu của đơn reports (approvedAt) + Thread hằng ngày (paidAt). Không trừ tiền đã rút.
         Nguồn realtime: composables/useIncomeStats.ts, quy tắc tính: utils/incomeStats.ts. -->
    <div v-if="isLoggedIn" class="grid grid-cols-2 gap-3">
      <div class="@container rounded-[14px] border border-slate-700/40 bg-[#150f0d] p-3">
        <div class="flex items-center gap-1.5">
          <span class="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </span>
          <span class="text-slate-400 text-[11px] font-semibold">Hôm nay</span>
        </div>
        <span v-if="todayIncome.value === null" class="mt-2.5 block h-[22px] w-20 rounded bg-white/10 animate-pulse"></span>
        <p v-else :class="['mt-2.5 text-[22px] font-black leading-[22px] tabular-nums', todayIncome.hasUnit ? 'text-white' : 'text-slate-500']" :style="{ fontSize: todayIncome.fontSize }">{{ todayIncome.value }}<span v-if="todayIncome.hasUnit" class="ml-1 text-slate-400 text-[12px] font-bold leading-none">xu</span></p>
        <p class="mt-1 text-slate-600 text-[10px] font-medium">{{ todayIncome.caption }}</p>
      </div>
      <div class="@container rounded-[14px] border border-slate-700/40 bg-[#150f0d] p-3">
        <div class="flex items-center gap-1.5">
          <span class="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </span>
          <span class="text-slate-400 text-[11px] font-semibold">Tuần này</span>
        </div>
        <span v-if="weekIncome.value === null" class="mt-2.5 block h-[22px] w-20 rounded bg-white/10 animate-pulse"></span>
        <p v-else :class="['mt-2.5 text-[22px] font-black leading-[22px] tabular-nums', weekIncome.hasUnit ? 'text-white' : 'text-slate-500']" :style="{ fontSize: weekIncome.fontSize }">{{ weekIncome.value }}<span v-if="weekIncome.hasUnit" class="ml-1 text-slate-400 text-[12px] font-bold leading-none">xu</span></p>
        <p class="mt-1 text-slate-600 text-[10px] font-medium">{{ weekIncome.caption }}</p>
      </div>
    </div>

    <!-- 4. CÔNG VIỆC — giữ nguyên quy tắc đếm cũ (Đã nộp = số đơn tải về, Đã duyệt = approved + collected, Chờ = Đã nộp − Đã duyệt) -->
    <div v-if="isLoggedIn">
      <p class="px-0.5 text-slate-400 text-[11px] font-black uppercase tracking-widest">Công việc</p>
      <div class="mt-2 grid grid-cols-3 gap-2">
        <div class="rounded-xl border border-slate-700/40 bg-[#150f0d] px-1.5 py-2 flex flex-col items-center text-center">
          <span class="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-200">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </span>
          <span v-if="isDataLoading" class="mt-1.5 h-5 w-8 rounded bg-white/10 animate-pulse"></span>
          <p v-else class="mt-1.5 text-white text-[20px] font-black leading-none tabular-nums">{{ totalSubmitted }}</p>
          <p class="mt-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wide leading-tight">Đã nộp</p>
        </div>
        <div class="rounded-xl border border-slate-700/40 bg-[#150f0d] px-1.5 py-2 flex flex-col items-center text-center">
          <span class="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          </span>
          <span v-if="isDataLoading" class="mt-1.5 h-5 w-8 rounded bg-white/10 animate-pulse"></span>
          <p v-else class="mt-1.5 text-emerald-400 text-[20px] font-black leading-none tabular-nums">{{ totalApproved }}</p>
          <p class="mt-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wide leading-tight">Đã duyệt</p>
        </div>
        <div class="rounded-xl border border-slate-700/40 bg-[#150f0d] px-1.5 py-2 flex flex-col items-center text-center">
          <span class="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
          <span v-if="isDataLoading" class="mt-1.5 h-5 w-8 rounded bg-white/10 animate-pulse"></span>
          <p v-else class="mt-1.5 text-amber-400 text-[20px] font-black leading-none tabular-nums">{{ Math.max(0, totalSubmitted - totalApproved) }}</p>
          <p class="mt-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wide leading-tight">Chờ</p>
        </div>
      </div>
    </div>

  </div>
</template>
