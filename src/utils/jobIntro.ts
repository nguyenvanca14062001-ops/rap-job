// Popup "KHÁM PHÁ CÔNG VIỆC DỄ LÀM" tự mở 1 lần cho tài khoản MỚI (thay popup Hỗ trợ tự bật trước đây).
// Không ghi Firestore (client không được sửa users/{uid}) mà dựa vào Firebase Auth: ngay sau
// createUserWithEmailAndPassword, lastSignInTime trùng creationTime; đăng nhập lại (sau khi đăng xuất, ở máy /
// trình duyệt khác) thì lastSignInTime đổi → không còn là phiên đầu tiên. Cờ đã xem lưu localStorage theo uid để
// F5 / chuyển trang trong phiên đầu không mở lại — LoginView và đăng xuất có localStorage.clear(), nhưng khi đó
// đã không còn là phiên đầu tiên nên popup cũng không mở lại.

// Tài khoản tạo quá 3 ngày (VD tài khoản cũ chưa từng đăng xuất) không còn là "người mới"
export const JOB_INTRO_MAX_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000
// creationTime / lastSignInTime là chuỗi UTC làm tròn theo giây → cho lệch vài giây vẫn coi là cùng lần đăng nhập
const SAME_SIGN_IN_TOLERANCE_MS = 10 * 1000

export const jobIntroSeenKey = (uid: string) => `mmo_job_intro_seen_${uid}`

export function isNewAccountFirstSession(
  metadata: { creationTime?: string; lastSignInTime?: string },
  nowMs: number = Date.now()
): boolean {
  const created = Date.parse(metadata.creationTime ?? '')
  const lastSignIn = Date.parse(metadata.lastSignInTime ?? '')
  if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false
  return Math.abs(lastSignIn - created) <= SAME_SIGN_IN_TOLERANCE_MS && nowMs - created < JOB_INTRO_MAX_ACCOUNT_AGE_MS
}
