import { jobsData } from '@/data/jobs'
import { STORY_CHOICE_JOB_ID } from '@/utils/storyChoice'
import { THREADS_COMMENT_JOB_ID } from '@/utils/threadsComment'
import { THREADS_SEEDING_JOB_ID } from '@/utils/threadsSeeding'

// Mô tả ngắn công khai của từng job — dùng chung cho card job desktop (JobSection.vue) và popup giới thiệu job
// ở trang chủ khách mobile (App.vue). Sửa ở đây là cả 2 nơi cùng đổi. Job có cardDesc trong jobs.ts thì lấy từ đó.
export const JOB_SHORT_DESCS: Record<string, string> = {
  'follow-cgv':     'Follow fanpage + like & share trailer mới',
  'review-cinema':  'Đánh giá 5 sao rạp phim trên Google Maps',
  'checkin-cinema': 'Check-in tại rạp, đăng Facebook/Instagram',
  'survey-cinema':  'Trả lời 5 câu hỏi, xu vào ví ngay lập tức',
  'view-tiktok':    'Xem video, thả tim, follow & bình luận',
  'view-youtube':   'Xem video 3p, like & subscribe',
  'music-vote':     'Nghe 2 đoạn nhạc, chọn bài hay hơn',
  'poster-design':  'Thiết kế poster fanmade bằng Canva',
  [STORY_CHOICE_JOB_ID]: jobsData[STORY_CHOICE_JOB_ID].cardDesc,
  'post-threads': 'Đăng bài tuyển CTV lên Threads nhận thưởng',
  'daily_threads': 'Đăng bài mỗi ngày, nhập link nhận xu',
  [THREADS_COMMENT_JOB_ID]: jobsData[THREADS_COMMENT_JOB_ID].cardDesc,
  [THREADS_SEEDING_JOB_ID]: jobsData[THREADS_SEEDING_JOB_ID].cardDesc,
  'join-zalo': 'Vào nhóm cộng đồng nhận thông báo',
  'app-chung-khoan': 'Đăng ký tài khoản Kafi X',
  'app-chung-khoan-2': 'Đăng ký tài khoản DNSE',
  'app-chung-khoan-3': 'Đăng ký tài khoản KIS',
  'vpbank': 'Mở tài khoản số đẹp VPBank',
  'app-chung-khoan-4': 'Đăng ký tài khoản chứng khoán',
  'msb-bank': 'Nhận quà tặng khi mở thẻ MSB',
  'abbank': 'Mở tài khoản ABBANK',
  'tpbank': 'Mở tài khoản TPBANK',
  'tpbank-new': 'Mở tài khoản TPBANK',
  'lpbank-plus': 'Đăng ký APP LPBANK PLUS nhận thưởng',
  'vietcombank': 'Đăng ký VIETCOMBANK nhận thưởng',
  'mbv-bank': 'Đăng ký MBV BANK nhận thưởng',
  'shopee-pay': 'Đăng ký Shopee Pay nhận thưởng',
  'referral-hub': 'Mời bạn bè đăng ký app nhận thưởng tăng dần',
  'momo': 'Đăng ký ví MoMo nhận thưởng',
  'referral_momo': 'Mời bạn bè đăng ký APP VÍ MOMO',
  'referral-friends': 'Chọn app muốn giới thiệu để nhận thưởng',
}
