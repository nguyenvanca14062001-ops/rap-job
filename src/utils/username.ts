// Chuẩn hoá username dùng làm document ID cho collection usernames/{normalizedUsername}.
// Dùng CHUNG cho: đăng ký mới (RegisterView), kiểm tra trùng, và migration user cũ
// (scripts/migrate-usernames.mjs) — phải giữ đúng cùng 1 quy tắc ở cả 2 nơi, nếu không
// user cũ và user mới sẽ normalize ra 2 key khác nhau cho cùng 1 username.
export function normalizeUsername(username: any): string {
  return String(username || '').trim().toLowerCase()
}
