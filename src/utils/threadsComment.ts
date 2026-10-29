import { normalizeThreadNick } from '@/utils/dailyThreads'

// Job "BÌNH LUẬN DẠO – THREADS" (nhóm KHÔNG GIỚI HẠN — làm nhiều lần) — bấm vào job mở popup ThreadsCommentModal (App.vue),
// không qua trang /job/:id hay form SubmitReportView. Thưởng theo SỐ BÌNH LUẬN HỢP LỆ: user gửi số bình luận khai báo
// (commentCount) + link bài viết đã bình luận (threadsPostUrl / threadsPostCode, cùng field với SEEDING; đơn trước 29/10/2026 lưu
// nick threadsNick thay cho link) + 1–5 ảnh; Admin nhập số bình luận hợp lệ khi duyệt (AdminView.approveReport) rồi mới cộng
// xu = số hợp lệ × mức thưởng/bình luận (reward của job trong jobs.ts, hoặc cấu hình Admin vip_jobs nếu có).
export const THREADS_COMMENT_JOB_ID = 'threads-comment'

// Lý do từ chối nhanh trong popup HỦY của Admin
export const THREADS_COMMENT_REJECT_REASONS = [
  'Bình luận đã bị xóa / không tồn tại',
  'Không xác minh được bình luận',
  'Ảnh trùng đơn trước',
  'Bình luận spam / không liên quan',
  'Link bài viết sai / không mở được',
  'Khác',
]

// Nick Threads = username Instagram: chữ thường, số, dấu chấm, gạch dưới, tối đa 30 ký tự.
// Nhận "@nick", "nick" hoặc link trang cá nhân threads.com/@nick (threads.net cũ).
export function extractThreadsNick(input: any): string {
  const text = String(input || '').trim()
  const fromUrl = text.match(/threads\.(?:net|com)\/@([^/?#\s]+)/i)
  return normalizeThreadNick(fromUrl ? fromUrl[1] : text)
}

export const isValidThreadsNick = (nick: string) => /^[a-z0-9._]{1,30}$/.test(nick)

export const threadsProfileUrl = (nick: string) => `https://www.threads.com/@${encodeURIComponent(nick)}`

// SHA-256 của file ảnh GỐC (trước khi nén) — so trùng ảnh bằng chứng giữa các đơn (chọn lại đúng file đã gửi).
// Chụp màn hình lại sẽ ra file khác nên không thay được bước Admin kiểm tra. Trình duyệt không hỗ trợ → ''.
export async function hashImageFile(file: Blob): Promise<string> {
  try {
    if (!globalThis.crypto?.subtle) return ''
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}
