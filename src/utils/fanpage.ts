// Fanpage Facebook chính thức của Rạp Job (trang "Rạp Job Freelance") — cùng URL các nút "Nhắn tin Fanpage" đang dùng.
export const FANPAGE_URL = 'https://www.facebook.com/rapjobfreelance/'

// Khung chat Messenger của chính Fanpage trên: m.me/<tên trang>, dựng từ FANPAGE_URL để 2 link luôn khớp nhau
// (m.me/rapjobfreelance chuyển thẳng tới khung nhắn tin của trang "Rạp Job Freelance").
export const FANPAGE_MESSENGER_URL = `https://m.me/${FANPAGE_URL.split('/').filter(Boolean).pop()}`

// Nút HỖ TRỢ: mở thẳng khung chat Messenger với Fanpage. Máy có app Messenger → hệ điều hành mở app; không có app →
// trình duyệt mở bản web nhắn tin của Fanpage. Trình duyệt / WebView chặn mở tab mới → mở Fanpage ngay trong tab
// hiện tại để người dùng vẫn liên hệ được.
export function openFanpageMessenger() {
  const win = window.open(FANPAGE_MESSENGER_URL, '_blank')
  if (win) win.opener = null
  else window.location.href = FANPAGE_URL
}
