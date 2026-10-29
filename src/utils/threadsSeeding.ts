// Job "ĐĂNG BÀI THREADS – SEEDING" (nhóm KHÔNG GIỚI HẠN — làm nhiều lần) — bấm vào job mở popup ThreadsSeedingModal (App.vue),
// không qua trang /job/:id hay form SubmitReportView. User đăng 1 bài Threads về các công việc được hướng dẫn rồi trả lời bình
// luận của người khác trong bài. Thưởng theo SỐ LƯỢT TRẢ LỜI HỢP LỆ: user gửi link bài + số lượt trả lời khai báo + 1–5 ảnh;
// Admin nhập số lượt hợp lệ khi duyệt (AdminView.approveReport) rồi mới cộng xu = số hợp lệ × mức thưởng / lượt trả lời
// (reward của job trong jobs.ts, hoặc cấu hình Admin vip_jobs nếu có).
// Đơn dùng chung tên field với BÌNH LUẬN DẠO để đi cùng luồng duyệt: commentCount = số lượt trả lời user khai báo,
// verifiedCommentCount = số lượt hợp lệ Admin nhập, rewardPerComment = xu / lượt. Riêng job này có thêm threadsPostUrl (link bài)
// và threadsPostCode (mã bài viết) để gom mọi đơn của CÙNG 1 bài — chống tính thưởng 2 lần cho cùng lượt trả lời.
export const THREADS_SEEDING_JOB_ID = 'threads-seeding'

// Lý do từ chối nhanh trong popup HỦY của Admin
export const THREADS_SEEDING_REJECT_REASONS = [
  'Link bài Threads sai / không mở được',
  'Không thấy lượt trả lời bình luận',
  'Lượt trả lời đã được tính ở đơn trước',
  'Bình luận tự tạo / tương tác giả',
  'Trả lời spam / không liên quan',
  'Ảnh trùng đơn trước',
  'Khác',
]

// Link bài viết Threads: threads.com (hoặc threads.net cũ) /@nick/post/<mã bài>, hoặc dạng ngắn /t/<mã bài>; bấm "Sao chép liên
// kết" trong app thường kèm ?xmt=... phía sau. Mã bài viết là định danh duy nhất của bài, không đổi theo nick hay tên miền.
const THREADS_POST_URL_RE = /^(?:https?:\/\/)?(?:www\.)?threads\.(net|com)\/(?:@([a-z0-9._]{1,30})\/post|t)\/([a-z0-9_-]{5,})(?:[/?#].*)?$/i

// Trả về link gọn (https, bỏ tham số theo dõi) + mã bài viết; không phải link bài viết Threads → null.
export function parseThreadsPostUrl(input: any): { url: string; code: string } | null {
  const match = String(input || '').trim().match(THREADS_POST_URL_RE)
  const code = match?.[3]
  if (!match || !code) return null
  const host = `www.threads.${(match[1] || 'com').toLowerCase()}`
  const nick = match[2]?.toLowerCase()
  return { url: nick ? `https://${host}/@${nick}/post/${code}` : `https://${host}/t/${code}`, code }
}
