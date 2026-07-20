// Hằng số + helper riêng cho job "ĐĂNG BÀI THREAD HẰNG NGÀY"
// Job này dùng collection Firestore riêng (daily_thread_reports), tách biệt hoàn toàn khỏi `reports`.

export const DAILY_THREAD_JOB_ID = 'daily_threads'
export const DAILY_THREAD_JOB_NAME = 'Đăng bài Thread hằng ngày'
export const DAILY_THREAD_COLLECTION = 'daily_thread_reports'

export const DAILY_THREAD_MAX_PENDING_PER_DAY = 5
export const DAILY_THREAD_LOW_VIEW_THRESHOLD = 50

// Bảng mức thưởng công khai cho user (khớp với getDailyThreadSuggestedReward bên dưới)
export const DAILY_THREAD_REWARD_TABLE = [
  { postViews: '500', qrViews: 50, reward: 20000 },
  { postViews: '500', qrViews: 200, reward: 40000 },
  { postViews: '500', qrViews: 400, reward: 60000 },
  { postViews: '500', qrViews: 600, reward: 80000 },
  { postViews: '500', qrViews: 1000, reward: 100000 },
]

export const DAILY_THREAD_REJECT_REASONS = [
  'Link sai',
  'Không thấy QR',
  'View không đạt',
  'Trùng bài',
  'Sai nick Thread',
  'Spam / nộp sai',
  'Khác',
]

export function getDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizeThreadNick(nick: any): string {
  return String(nick || '').trim().toLowerCase().replace(/^@+/, '')
}

export function normalizePostUrl(url: any): string {
  let u = String(url || '').trim().toLowerCase()
  u = u.replace(/^https?:\/\//, '').replace(/^www\./, '')
  u = u.replace(/[?#].*$/, '')
  u = u.replace(/\/+$/, '')
  return u
}

export function isValidThreadsUrl(url: any): boolean {
  const u = String(url || '').trim().toLowerCase()
  if (!u) return false
  return /(^|\/\/|\.)threads\.(net|com)(\/|$)/.test(u)
}

// Gợi ý reward theo BẢNG MỨC THƯỞNG công khai (DAILY_THREAD_REWARD_TABLE). Chỉ là số đề xuất — admin vẫn là người
// quyết định số xu thật khi duyệt (actualReward), có thể sửa tay trước khi cộng.
export function getDailyThreadSuggestedReward(qrViews: any): number {
  const views = Number(qrViews) || 0
  if (views < 50) return 0
  if (views < 200) return 20000
  if (views < 400) return 40000
  if (views < 600) return 60000
  if (views < 1000) return 80000
  return 100000
}

export function dailyThreadStatusLabel(status: string): string {
  if (status === 'paid' || status === 'approved') return 'Đã cộng xu'
  if (status === 'rejected') return 'Bị từ chối'
  return 'Đang chờ duyệt'
}

// --- Cấu hình hướng dẫn Threads hằng ngày (nội dung/ảnh mẫu) — quản lý realtime qua Firestore ---
export interface DailyThreadGuideConfig {
  contents: string[]
  postImages: string[]
  qrImage: string
}

export const DAILY_THREAD_GUIDE_COLLECTION = 'app_config'
export const DAILY_THREAD_GUIDE_DOC_ID = 'daily_threads_guide'
export const DAILY_THREAD_GUIDE_ITEM_COUNT = 10

export const DAILY_THREAD_GUIDE_DEFAULT: DailyThreadGuideConfig = {
  contents: [
    '🔥 Đang tuyển CTV làm nhiệm vụ online, không cọc phí, không thu tiền. Ai quan tâm inbox mình để được hướng dẫn nhé!',
    '💰 Kiếm thêm thu nhập tại nhà chỉ với vài phút mỗi ngày, nhận thưởng ngay sau khi hoàn thành nhiệm vụ. Ib mình tư vấn miễn phí.',
    '📌 Tuyển CTV part-time, việc nhẹ lương ổn, rút tiền nhanh trong 24h. Không yêu cầu kinh nghiệm, ai cũng làm được.',
    '✨ Cần tuyển thêm CTV hỗ trợ nhiệm vụ online, thu nhập theo task, minh bạch rõ ràng. Liên hệ ngay để nhận việc hôm nay.',
    '🚀 Việc làm online uy tín, không cần vốn, không cọc phí. Chỉ cần điện thoại là có thể bắt đầu kiếm thu nhập ngay.',
    '📢 Tuyển gấp CTV làm nhiệm vụ online, thưởng cao, thanh toán nhanh chóng. Ai cần việc thêm inbox mình liền nha.',
    '💡 Kiếm tiền online đơn giản, chỉ cần làm theo hướng dẫn là nhận thưởng. Không lừa đảo, không thu phí bất kỳ khoản nào.',
    '🎯 Cơ hội thu nhập thêm dành cho ai đang cần việc làm thêm tại nhà, làm bao nhiêu ăn bấy nhiêu, rút tiền dễ dàng.',
    '🌟 Tuyển CTV hỗ trợ nhiệm vụ online, không giới hạn số lượng, ai đăng ký sớm nhận thưởng sớm. Inbox để biết thêm chi tiết.',
    '📲 Việc nhẹ nhàng, làm online tại nhà, thu nhập minh bạch theo từng nhiệm vụ hoàn thành. Liên hệ ngay hôm nay để bắt đầu.'
  ],
  postImages: Array(10).fill(''),
  qrImage: ''
}

// Chọn ngẫu nhiên 1 phần tử không rỗng trong danh sách — dùng cho random content/ảnh mẫu.
export function pickRandomNonEmpty(items: (string | null | undefined)[]): string {
  const validItems = (items || []).filter(item => String(item || '').trim())
  if (!validItems.length) return ''
  return validItems[Math.floor(Math.random() * validItems.length)] as string
}

// Chuẩn hoá dữ liệu đọc từ Firestore về đúng shape DailyThreadGuideConfig, fallback default khi thiếu/rỗng.
export function normalizeDailyThreadGuideConfig(data: any): DailyThreadGuideConfig {
  const contents = Array.isArray(data?.contents) && data.contents.some((c: any) => String(c || '').trim())
    ? data.contents.map((c: any) => String(c || ''))
    : DAILY_THREAD_GUIDE_DEFAULT.contents
  const postImages = Array.isArray(data?.postImages)
    ? data.postImages.map((p: any) => String(p || ''))
    : DAILY_THREAD_GUIDE_DEFAULT.postImages
  const qrImage = typeof data?.qrImage === 'string' ? data.qrImage : DAILY_THREAD_GUIDE_DEFAULT.qrImage
  return { contents, postImages, qrImage }
}
