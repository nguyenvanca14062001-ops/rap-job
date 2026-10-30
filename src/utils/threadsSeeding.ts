// Job "ĐĂNG BÀI THREADS – SEEDING" (nhóm KHÔNG GIỚI HẠN — làm nhiều lần) — bấm vào job mở popup ThreadsSeedingModal (App.vue),
// không qua trang /job/:id hay form SubmitReportView. User đăng 1 bài Threads về các công việc được hướng dẫn rồi trả lời bình
// luận của người khác trong bài. Thưởng theo SỐ LƯỢT TRẢ LỜI HỢP LỆ: user gửi link bài + số lượt trả lời khai báo + 1–5 ảnh;
// Admin nhập số lượt hợp lệ khi duyệt (AdminView.approveReport) rồi mới cộng xu = số hợp lệ × mức thưởng / lượt trả lời
// (reward của job trong jobs.ts, hoặc cấu hình Admin vip_jobs nếu có).
// Đơn dùng chung tên field với BÌNH LUẬN DẠO để đi cùng luồng duyệt: commentCount = số lượt trả lời user khai báo,
// verifiedCommentCount = số lượt hợp lệ Admin nhập, rewardPerComment = xu / lượt. Riêng job này có thêm threadsPostUrl (link bài)
// và threadsPostCode (mã bài viết; link /share/ lưu '') để gom mọi đơn của CÙNG 1 bài — chống tính thưởng 2 lần cho cùng lượt trả lời.
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

// Link bài viết Threads — hàm kiểm tra DÙNG CHUNG cho form BÌNH LUẬN DẠO, form ĐĂNG BÀI THREADS – SEEDING và tab Admin (sửa ở đây là
// cả 2 job nhận thay đổi). Tách bằng URL parser: chỉ nhận đúng tên miền threads.com / threads.net (có hoặc không www), không kèm
// user:pass hay cổng → threads.com.gia-mao.vn, threads.com@gia-mao.vn, gia-mao.vn/?u=threads.com… đều bị từ chối. Đường dẫn:
// - /@nick/post/<mã bài>: link bài đầy đủ. Mã bài viết là định danh duy nhất của bài, không đổi theo nick hay tên miền.
// - /t/<mã bài>: dạng ngắn, Threads chuyển hướng 301 về /@nick/post/<cùng mã bài>.
// - /share/<mã chia sẻ>: "Sao chép liên kết" trên iPhone. Mã chia sẻ KHÔNG phải mã bài viết (1 bài có thể có nhiều link chia sẻ) và
//   trình duyệt không phân giải được ra bài gốc (CORS) → vẫn nhận, Admin mở link kiểm tra thủ công.
// "Sao chép liên kết" thường kèm ?xmt=... phía sau — bỏ khi chuẩn hóa. threads.net và threads.com không www đều được Threads chuyển
// hướng 301 về www.threads.com cùng đường dẫn nên link gọn luôn dùng www.threads.com.
const THREADS_HOSTS = ['threads.com', 'www.threads.com', 'threads.net', 'www.threads.net']
const THREADS_ORIGIN = 'https://www.threads.com'
const THREADS_SHARE_URL_PREFIX = `${THREADS_ORIGIN}/share/`
const THREADS_NICK_SEGMENT_RE = /^@([a-z0-9._]{1,30})$/i
const THREADS_CODE_RE = /^[a-z0-9_-]{5,}$/i
// Ký tự vô hình hay dính theo khi sao chép / dán trên điện thoại (zero-width, dấu định hướng chữ)
const INVISIBLE_CHARS_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g

// Trả về link gọn (https, bỏ tham số theo dõi) + mã bài viết (link /share/ → code '': chưa biết bài gốc); không phải link bài viết
// Threads → null.
export function parseThreadsPostUrl(input: any): { url: string; code: string } | null {
  const text = String(input || '').replace(INVISIBLE_CHARS_RE, '').trim()
  if (!text) return null
  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (!THREADS_HOSTS.includes(parsed.hostname) || parsed.username || parsed.password || parsed.port) return null
  const [first = '', second = '', third = '', ...rest] = parsed.pathname.split('/').slice(1)
  const kind = first.toLowerCase()
  if (kind === 'share') {
    // Chỉ đúng /share/<mã chia sẻ> (cho phép dấu / cuối) — đường dẫn dài hơn thì không đoán mã
    if (!THREADS_CODE_RE.test(second) || third || rest.some(Boolean)) return null
    return { url: THREADS_SHARE_URL_PREFIX + second, code: '' }
  }
  // Link bài viết: phần đường dẫn sau mã bài (nếu có) bỏ qua
  if (kind === 't') return THREADS_CODE_RE.test(second) ? { url: `${THREADS_ORIGIN}/t/${second}`, code: second } : null
  const nick = THREADS_NICK_SEGMENT_RE.exec(first)?.[1]
  if (!nick || second.toLowerCase() !== 'post' || !THREADS_CODE_RE.test(third)) return null
  return { url: `${THREADS_ORIGIN}/@${nick.toLowerCase()}/post/${third}`, code: third }
}

// Khóa so trùng link giữa các đơn (form gửi + tab Admin): mã bài viết; link /share/ → chính link chia sẻ đã chuẩn hóa, chỉ trùng với
// đơn có cùng đúng link đó — không so được với mã bài viết nên 2 link khác nhau không bị coi là cùng bài khi chưa có bằng chứng.
export const threadsLinkKey = (link: { url: string; code: string } | null) => link ? link.code || link.url : ''
// Khóa của 1 đơn đã gửi: ưu tiên threadsPostCode lưu lúc gửi (link /share/ lưu ''), thiếu thì tách lại từ threadsPostUrl
export const reportThreadsLinkKey = (r: any) => String(r?.threadsPostCode || '') || threadsLinkKey(parseThreadsPostUrl(r?.threadsPostUrl))
export const isThreadsShareKey = (key: string) => key.startsWith(THREADS_SHARE_URL_PREFIX)
