export const LPBANK_REFERRAL_JOB_ID = 'referral_lpbank'
export const LPBANK_REFERRAL_CODE = '0366045803'

// Thưởng tăng dần: lần 1 = 100k, lần 2 = 110k, lần 3 = 120k, từ lần 4 = 150k
export function getLpbankReferralRewardByCount(successCountBefore: number): number {
  const nextNumber = successCountBefore + 1
  if (nextNumber === 1) return 100000
  if (nextNumber === 2) return 110000
  if (nextNumber === 3) return 120000
  return 150000
}
