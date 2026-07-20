export const LPBANK_REFERRAL_JOB_ID = 'referral_lpbank'
export const LPBANK_REFERRAL_CODE = '0366045803'

export const LPBANK_PLUS_COMPLETED_STATUSES = ['approved', 'paid', 'collected', 'completed']

export function isLpbankPlusReport(report: any): boolean {
  if (!report) return false
  if (report.jobId === 'lpbank-plus' || report.jobId === 'app_lpbank_plus') return true
  return String(report.jobName || '').toUpperCase().includes('LPBANK PLUS')
}

export function hasCompletedLpbankPlus(reports: any[]): boolean {
  return (reports || []).some(rp => isLpbankPlusReport(rp) && LPBANK_PLUS_COMPLETED_STATUSES.includes(rp.status))
}

// Thưởng tăng dần: lần 1 = 100k, lần 2 = 110k, lần 3 = 120k, từ lần 4 = 150k
export function getLpbankReferralRewardByCount(successCountBefore: number): number {
  const nextNumber = successCountBefore + 1
  if (nextNumber === 1) return 100000
  if (nextNumber === 2) return 110000
  if (nextNumber === 3) return 120000
  return 150000
}
