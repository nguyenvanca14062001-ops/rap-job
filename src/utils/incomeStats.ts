// Thống kê thu nhập "Hôm nay" / "Tuần này" (2 card trên trang chủ mobile — ProfileCard.vue).
// Chỉ tính số xu ĐÃ THỰC SỰ cộng vào ví, theo THỜI ĐIỂM CỘNG XU (không dùng ngày tạo đơn), giờ Việt Nam:
// - reports: approveReport() (AdminView) ghi status 'approved' + actualReward + approvedAt + approvedBy trong CÙNG
//   transaction với increment(balance). bulkApproveOtherJobs() chỉ ghi status + approvedAt, KHÔNG lưu số xu đã cộng
//   (trong khi nhiều modal nộp đơn VIP ghi sẵn actualReward: 0 lúc user gửi) → đơn thiếu approvedBy = "chưa rõ số xu",
//   không đoán từ report.reward (field client gửi) và không coi là 0.
// - daily_thread_reports: payOne() (DailyThreadReportsTab) ghi status 'paid' + actualReward + paidAt cùng transaction cộng xu.
// File thuần TS (không import Firebase) để test độc lập được.

const DAY_MS = 24 * 60 * 60 * 1000
// Asia/Ho_Chi_Minh luôn là UTC+7 (Việt Nam không dùng giờ mùa hè) → tính bằng offset cố định,
// không phụ thuộc múi giờ đang cài trên điện thoại người dùng.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export interface VnPeriods {
  dayStart: number   // 00:00 hôm nay giờ VN (epoch ms)
  dayEnd: number     // 00:00 ngày mai giờ VN
  weekStart: number  // 00:00 Thứ Hai tuần này giờ VN
  weekEnd: number    // 00:00 Thứ Hai tuần sau giờ VN
}

export function getVnPeriods(nowMs: number = Date.now()): VnPeriods {
  const vn = new Date(nowMs + VN_OFFSET_MS) // đọc bằng getUTC*() = giờ VN
  const dayStart = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS
  // getUTCDay(): 0 = Chủ nhật → Thứ Hai lùi 0 ngày, Chủ nhật lùi 6 ngày
  const weekStart = dayStart - ((vn.getUTCDay() + 6) % 7) * DAY_MS
  return { dayStart, dayEnd: dayStart + DAY_MS, weekStart, weekEnd: weekStart + 7 * DAY_MS }
}

// 'dd/MM' theo giờ VN
export function formatVnDayMonth(ms: number): string {
  const vn = new Date(ms + VN_OFFSET_MS)
  return `${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}`
}

// 1 lần cộng xu. amount = null: chắc chắn đã cộng (đã duyệt, có thời điểm cộng) nhưng hệ thống không lưu số xu.
export interface IncomeEntry {
  creditedAt: number
  amount: number | null
}

// Chỉ nhận Firestore Timestamp (serverTimestamp do Admin ghi) — không suy ra từ createdAt hay giờ hiện tại.
const toMillis = (t: any): number | null => (typeof t?.toMillis === 'function' ? t.toMillis() : null)
const toAmount = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)

export function reportIncomeEntry(report: any, uid: string): IncomeEntry | null {
  if (report.status !== 'approved' && report.status !== 'collected') return null
  // Ví được cộng = repairedUserUid || uid (giống effUid() trong AdminView) — đơn đã gắn sang ví khác không phải thu nhập của user này
  if ((report.repairedUserUid || report.uid) !== uid) return null
  const creditedAt = toMillis(report.approvedAt)
  // Đơn rất cũ duyệt trước khi hệ thống ghi approvedAt → không biết ngày cộng, không gán vào kỳ nào
  if (creditedAt === null) return null
  return { creditedAt, amount: report.approvedBy ? toAmount(report.actualReward) : null }
}

export function dailyThreadIncomeEntry(report: any): IncomeEntry | null {
  if (report.status !== 'paid') return null
  const creditedAt = toMillis(report.paidAt)
  if (creditedAt === null) return null
  return { creditedAt, amount: toAmount(report.actualReward) }
}

export interface PeriodIncome {
  amount: number        // tổng xu đã biết chắc
  unknownCount: number  // số lần cộng xu trong kỳ không rõ số xu
}

export interface IncomeStats {
  status: 'loading' | 'ready' | 'error'
  periods: VnPeriods
  today: PeriodIncome
  week: PeriodIncome
}

export function summarizeIncome(entries: IncomeEntry[], p: VnPeriods): { today: PeriodIncome; week: PeriodIncome } {
  const today: PeriodIncome = { amount: 0, unknownCount: 0 }
  const week: PeriodIncome = { amount: 0, unknownCount: 0 }
  for (const e of entries) {
    if (e.creditedAt < p.weekStart || e.creditedAt >= p.weekEnd) continue
    const isToday = e.creditedAt >= p.dayStart && e.creditedAt < p.dayEnd
    for (const period of isToday ? [today, week] : [week]) {
      if (e.amount === null) period.unknownCount++
      else period.amount += e.amount
    }
  }
  return { today, week }
}
