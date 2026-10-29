// src/data/jobs.ts
import { STORY_CHOICE_STORIES } from '@/data/stories'

// ==============================================
// CẤU HÌNH JOB VÍ MOMO — điền link/ảnh thật vào đây khi có, không cần sửa gì khác
// ==============================================
const MOMO_CONFIG = {
  momoDownloadLink: "https://onelink.momo.vn/WZPv/aM9rCxWt?utm_source=referral_others",
  momoReferralCode: "0366045803",
  momoReferralGuideImage: "images/anh-momo-2.jpg",
  momoBankLinkGuideImage: "images/anh-momo-1.png",
  momoTopupImage: "images/anh-momo-6.jpg",
}

// ==============================================
// CẤU HÌNH JOB BÌNH LUẬN DẠO – THREADS ('threads-comment') — sửa mức thưởng / ảnh minh họa / nội dung mẫu ở đây là card job,
// popup hướng dẫn, bảng ví dụ quy đổi và Admin duyệt đơn cùng đổi theo, không cần sửa gì khác.
// ==============================================
const THREADS_COMMENT_CONFIG = {
  // Số xu cho 1 bình luận hợp lệ. Xu thực nhận = số bình luận Admin xác minh hợp lệ × mức này.
  rewardPerComment: 500,
  // Ảnh minh họa trong popup hướng dẫn (bấm để phóng to) — chép ảnh thật vào public/images/ đúng tên này.
  // Chưa có file thì popup hiện "Ảnh hướng dẫn đang được cập nhật" thay vì ảnh lỗi.
  guideImage: "images/cmt-threads.jpg",
  // Nội dung ở khung "NỘI DUNG CẦN BÌNH LUẬN" + nút SAO CHÉP (popup chính và bước 2 popup HƯỚNG DẪN) — mỗi phần tử là 1 dòng,
  // "" là dòng trống. Để mảng rỗng [] → hiện "Nội dung đang được cập nhật" và khóa nút sao chép.
  commentContent: [
    "Bạn nhắn Zalo 0366.045.803 (Quỳnh) để nhận job nhá 💬",
    "",
    "Bên mình có các job:",
    "🎧 Nghe nhạc, đọc truyện",
    "🎬 Khảo sát phim",
    "📱 Cày view TikTok, YouTube",
    "✍️ Đăng bài Threads, bình luận dạo"
  ].join("\n")
}

// ==============================================
// CẤU HÌNH JOB ĐĂNG BÀI THREADS – SEEDING ('threads-seeding') — sửa mức thưởng / ảnh minh họa / nội dung trả lời mẫu ở đây là
// card job, popup công việc, popup hướng dẫn, ví dụ quy đổi và Admin duyệt đơn cùng đổi theo, không cần sửa gì khác.
// ==============================================
const THREADS_SEEDING_CONFIG = {
  // Số xu cho 1 lượt trả lời hợp lệ (trả lời bình luận của người khác trong bài của mình).
  // Xu thực nhận = số lượt trả lời Admin xác minh hợp lệ × mức này.
  rewardPerReply: 1000,
  // Ảnh minh họa trong popup công việc (bấm để phóng to) — chép ảnh thật vào public/images/ đúng tên này.
  // Chưa có file thì popup hiện "Ảnh minh họa đang được cập nhật" thay vì ảnh lỗi.
  guideImage: "images/cmt-threads.jpg",
  // Nội dung trả lời mẫu + nút SAO CHÉP ở bước 2 popup XEM HƯỚNG DẪN — mỗi phần tử là 1 dòng, "" là dòng trống.
  // Để mảng rỗng [] → hiện "Nội dung đang được cập nhật" và khóa nút sao chép.
  replyContent: [
    "Bạn nhắn Zalo 0366.045.803 (Quỳnh) để nhận job nhá 💬",
    "",
    "Bên mình có các job:",
    "🎧 Nghe nhạc, đọc truyện",
    "🎬 Khảo sát phim",
    "📱 Cày view TikTok, YouTube",
    "✍️ Đăng bài Threads, bình luận dạo"
  ].join("\n")
}

// ==============================================
// HƯỚNG DẪN APP TPBANK — dùng chung cho 'tpbank' (APP TPBANK) và 'referral_tpbank' (Mời bạn bè đăng ký APP TPBANK).
// Sửa bước / ảnh / mã giới thiệu ở đây là cả 2 trang cùng cập nhật.
// APP TPBANK (NEW) chỉ dùng chung Bước 1 (tải app) — phần còn lại nằm ở TPBANK_NEW_GUIDE bên dưới.
// ==============================================
const TPBANK_GUIDE = {
  // 3 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + làm ảnh mẫu trong popup gửi bằng chứng
  proofSampleImages: [
    "images/anh-tpbank2.jpg",
    "images/anh-tpbank3.jpg",
    "images/anh-tpbank6.jpg"
  ],
  // Dòng chữ vàng ở header trang chi tiết, ngay dưới dòng "Nhập mã giới thiệu" (mã lấy từ referralCode của bước 2)
  headerNote: "Phát sinh giao dịch 50k",
  steps: [
    {
      id: 1,
      title: "VÀO CHPLAY HOẶC APPSTORE TẢI APP",
      content: "Tải APP TPBank Mobile về điện thoại theo hình hướng dẫn bên dưới.",
      img: "images/anh-tpbank1.jpg"
    },
    {
      id: 2,
      title: "NHẬP MÃ GIỚI THIỆU: AT09",
      content: "Bắt buộc nhập mã giới thiệu AT09 và chụp lại ảnh màn hình.",
      img: "images/anh-tpbank2.jpg",
      note: "NHẬP MÃ GIỚI THIỆU AT09 (BẮT BUỘC)",
      referralCode: "AT09"
    },
    {
      id: 3,
      title: "ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG VÀ CHỤP ẢNH LẠI",
      content: "Sau khi đăng ký tài khoản TPBANK thành công, chụp lại ảnh màn hình hoàn tất.",
      img: "images/anh-tpbank3.jpg"
    },
    {
      id: 4,
      title: "PHÁT SINH GIAO DỊCH 50K",
      content: "Sau khi đăng nhập APP TPBANK, bạn cần phát sinh giao dịch 50k theo hướng dẫn dưới đây:\n✅ Chuyển vào tài khoản TPBANK: 50k\n✅ Chuyển ra lại: 50k\n\nLàm đủ các bước trên rồi chụp lại bill chuyển tiền ra theo ảnh mẫu để gửi bằng chứng.",
      note: "LƯU Ý: CHUYỂN RA CHO 1 NGƯỜI KHÁC (NGƯỜI CHUYỂN RA VÀ NGƯỜI NHẬN TIỀN TÊN KHÁC NHAU)",
      img: "images/anh-tpbank6.jpg"
    }
  ]
}

// ==============================================
// HƯỚNG DẪN APP TPBANK (NEW) — dùng chung cho 'tpbank-new' (APP TPBANK (NEW)) và 'referral_tpbank_new'
// (Mời bạn bè đăng ký APP TPBANK (NEW)). Sửa bước / ảnh / link nhóm Zalo ở đây là cả 2 trang cùng cập nhật.
// Không có mã AT09 / nút sao chép — mã giới thiệu lấy qua nút "XEM MÃ GIỚI THIỆU" (dẫn vào zaloReferralLink).
// ==============================================
const TPBANK_NEW_GUIDE = {
  // Link nhóm Zalo để lấy mã giới thiệu — nút "XEM MÃ GIỚI THIỆU" (hàng mã giới thiệu ở trang chi tiết, Bước 2 popup
  // hướng dẫn, thanh nút cuối trang) dẫn vào đây. Để trống thì nút không hiện.
  zaloReferralLink: "https://zalo.me/g/qojnuzrueomzhhy0wmsf",
  // 3 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + làm ảnh mẫu trong popup gửi bằng chứng
  proofSampleImages: [
    "images/tpbank-new1.jpg",
    "images/tpbank-new2.jpg",
    "images/tpbank-new3.jpg"
  ],
  // Dòng chữ vàng ở header trang chi tiết — khớp yêu cầu giao dịch của Bước 4
  headerNote: "Phát sinh giao dịch 60k trở lên",
  // Bước 1 y hệt APP TPBANK. Bước 2 không có referralCode (bỏ nút sao chép AT09) — hiện nút "XEM MÃ GIỚI THIỆU" thay thế.
  steps: [
    TPBANK_GUIDE.steps[0],
    {
      id: 2,
      title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU",
      content: "Chọn nút \"XEM MÃ GIỚI THIỆU\" để lấy mã giới thiệu, nhập mã rồi chụp lại ảnh màn hình.",
      img: "images/tpbank-new1.jpg",
      note: "NHẬP MÃ GIỚI THIỆU LẤY TỪ NHÓM ZALO (BẮT BUỘC)"
    },
    {
      id: 3,
      title: "ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG VÀ CHỤP ẢNH LẠI",
      content: "Sau khi đăng ký tài khoản TPBANK thành công, chụp lại ảnh màn hình hoàn tất.",
      img: "images/tpbank-new2.jpg"
    },
    {
      id: 4,
      title: "PHÁT SINH GIAO DỊCH 60K TRỞ LÊN",
      content: "Sau khi đăng nhập APP TPBANK, bạn cần phát sinh giao dịch 60k trở lên theo hướng dẫn dưới đây:\n✅ Chuyển vào tài khoản TPBANK: 61k\n✅ Chuyển ra lại: 61k\n\nLàm đủ các bước trên rồi chụp lại bill chuyển tiền ra theo ảnh mẫu để gửi bằng chứng.",
      note: "LƯU Ý: CHUYỂN RA CHO 1 NGƯỜI KHÁC (NGƯỜI CHUYỂN RA VÀ NGƯỜI NHẬN TIỀN TÊN KHÁC NHAU)",
      img: "images/tpbank-new3.jpg"
    }
  ]
}

export const jobsData: Record<string, any> = {

  // Card tổng/parent gộp 3 job "giới thiệu bạn bè" (MoMo/ABBANK/LPBank Plus) — click mở popup chọn job con,
  // không phải job nộp đơn trực tiếp. 3 job con thật vẫn giữ nguyên jobId/report/logic riêng.
  'referral-friends': {
    title: "GIỚI THIỆU BẠN BÈ",
    subtitle: "Chọn app muốn giới thiệu để nhận thưởng",
    reward: "85.000",
    rewardText: "85.000 xu / lượt",
    color: "text-orange-500",
    badge: "VIP 💎",
    type: "friend_referral_group",
    route: null
  },

  // Card cũ, đã bị thay bởi 'referral_abbank' (đúng jobId dùng trong report/vip_jobs) — giữ lại
  // để không phá vỡ các nơi khác còn tham chiếu key 'referral-hub'. KHÔNG dùng key này cho job VIP mới.
  'referral-hub': {
    title: "GIỚI THIỆU BẠN BÈ ABBANK",
    subtitle: "Mời bạn bè đăng ký APP ABBANK nhận 85.000 xu/lần",
    reward: "85.000",
    rewardText: "85.000 xu",
    color: "text-orange-500",
    badge: "VIP 💎",
    type: "friend_referral",
    route: "/jobs/referral-abbank"
  },

  // jobId chuẩn thật sự dùng trong report (ABBANK_REFERRAL_JOB_ID) và trong vip_jobs — dùng key này
  // khi seed/tạo job VIP cho ABBANK, không dùng 'referral-hub' ở trên nữa.
  'referral_abbank': {
    title: "GIỚI THIỆU BẠN BÈ ABBANK",
    subtitle: "Mời bạn bè đăng ký APP ABBANK nhận 85.000 xu/lần",
    reward: "85.000",
    rewardText: "85.000 xu",
    color: "text-orange-500",
    badge: "VIP 💎",
    type: "friend_referral",
    bankType: "abbank",
    referralProgram: "abbank",
    route: "/jobs/referral-abbank"
  },

  'referral_momo': {
    title: "GIỚI THIỆU BẠN BÈ MOMO",
    subtitle: "Mời bạn bè đăng ký APP VÍ MOMO",
    reward: "65.000",
    rewardText: "65.000 xu",
    color: "text-orange-500",
    badge: "VIP",
    type: "friend_referral",
    bankType: "momo",
    referralProgram: "momo",
    route: null
  },

  'daily_threads': {
    title: "ĐĂNG BÀI THREAD HẰNG NGÀY",
    subtitle: "Đăng bài mỗi ngày, nhập link nhận xu",
    reward: "35.000",
    rewardText: "35.000 xu - 350.000 xu / số lượng bài đăng",
    color: "text-teal-400",
    badge: "HẰNG NGÀY",
    type: "daily_thread_post",
    route: "/jobs/daily-threads"
  },

  // Job BÌNH LUẬN DẠO – THREADS (nhóm KHÔNG GIỚI HẠN — làm nhiều lần, cùng nhóm 'daily_threads') — bấm vào job mở popup
  // ThreadsCommentModal (App.vue) thay vì trang /job/:id. Mức thưởng / ảnh / nội dung mẫu sửa ở THREADS_COMMENT_CONFIG đầu file.
  // icon / cardDesc dùng chung cho card job (App.vue, JobSection.vue) — sửa ở đây là mọi nơi cùng đổi.
  'threads-comment': {
    title: "BÌNH LUẬN DẠO",
    platform: "THREADS",
    // reward = xu cho 1 bình luận hợp lệ (không phải thưởng cố định của cả đơn)
    reward: `${THREADS_COMMENT_CONFIG.rewardPerComment} xu`,
    rewardText: `${THREADS_COMMENT_CONFIG.rewardPerComment.toLocaleString('vi-VN')} XU / BÌNH LUẬN`,
    color: "text-yellow-400",
    badge: "♾ KHÔNG GIỚI HẠN",
    icon: "💬",
    cardDesc: "Bình luận bài viết về việc làm trên Threads",
    guideImage: THREADS_COMMENT_CONFIG.guideImage,
    commentContent: THREADS_COMMENT_CONFIG.commentContent,
    // Ví dụ quy đổi duy nhất hiện dưới khung thưởng (xu = số bình luận × reward)
    exampleCommentCount: 20,
    // Các bước rút gọn trong popup HƯỚNG DẪN (nút cạnh GỬI BẰNG CHỨNG) — highlight = đoạn tô đậm trong content,
    // showCommentContent = khung nội dung cần bình luận (commentContent ở THREADS_COMMENT_CONFIG) + nút SAO CHÉP
    steps: [
      { id: 1, title: "MỞ THREADS, TÌM BÀI VỀ CÔNG VIỆC", content: "Mở Threads, tìm các bài viết về công việc, job online, nhận tiền, kiếm tiền online, việc làm thêm tại nhà..." },
      { id: 2, title: "TRẢ LỜI BÌNH LUẬN", content: "Rep bình luận của người khác trong bài theo câu bình luận dưới đây:", showCommentContent: true },
      { id: 3, title: "GỬI LINK BÀI VIẾT, NHẬN THƯỞNG", content: "Gửi link bài viết mà bạn vừa bình luận dạo vào phần bằng chứng để nhận thưởng." }
    ],
    // 2 lưu ý nổi bật trong khung LƯU Ý + nhắc nhở ngắn bên dưới
    notes: [
      { text: "Chỉ ưu tiên những bài đăng về công việc, job, nhận tiền, kiếm tiền online... được đăng trong ngày hôm nay.", highlight: "được đăng trong ngày hôm nay" },
      { text: "Ưu tiên các bài viết có lượt xem cao, đang có tương tác và có ít nhất 5–10 người bình luận trở lên.", highlight: "ít nhất 5–10 người bình luận trở lên" }
    ],
    noteReminder: "Bình luận phải liên quan đến nội dung bài viết, không spam hoặc đăng nội dung gây hiểu nhầm."
  },

  // Job ĐĂNG BÀI THREADS – SEEDING (nhóm KHÔNG GIỚI HẠN — làm nhiều lần, cùng nhóm 'daily_threads' + BÌNH LUẬN DẠO) — bấm vào job
  // mở popup ThreadsSeedingModal (App.vue) thay vì trang /job/:id. Mức thưởng / ảnh / nội dung mẫu sửa ở THREADS_SEEDING_CONFIG
  // đầu file. icon / cardDesc dùng chung cho card job (App.vue, JobSection.vue) — sửa ở đây là mọi nơi cùng đổi.
  'threads-seeding': {
    title: "ĐĂNG BÀI THREADS – SEEDING",
    // reward = xu cho 1 lượt trả lời hợp lệ (không phải thưởng cố định của cả đơn)
    reward: `${THREADS_SEEDING_CONFIG.rewardPerReply} xu`,
    rewardText: `${THREADS_SEEDING_CONFIG.rewardPerReply.toLocaleString('vi-VN')} XU / LƯỢT TRẢ LỜI`,
    color: "text-yellow-400",
    badge: "♾ KHÔNG GIỚI HẠN",
    icon: "📣",
    cardDesc: "Đăng bài Threads, trả lời bình luận nhận xu",
    guideImage: THREADS_SEEDING_CONFIG.guideImage,
    replyContent: THREADS_SEEDING_CONFIG.replyContent,
    // Ví dụ quy đổi nổi bật dưới khung thưởng + các mốc nhỏ bên dưới (xu = số lượt trả lời × reward)
    exampleReplyCount: 10,
    exampleReplyCounts: [5, 20, 50, 100],
    // 3 bước ngắn gọn trong popup XEM HƯỚNG DẪN — chips = các chủ đề bài viết, showReplyContent = khung nội dung trả lời mẫu
    // (replyContent ở THREADS_SEEDING_CONFIG) + nút SAO CHÉP. Popup cũng hiểu items = gạch đầu dòng (ordered → đánh số),
    // note = cảnh báo nhỏ, showExample = ví dụ quy đổi, nếu cần thêm lại.
    steps: [
      {
        id: 1,
        title: "ĐĂNG BÀI THREADS",
        content: "Mở Threads và tạo một bài viết liên quan đến một trong các công việc:",
        chips: ["Xem phim", "Nghe nhạc", "Đọc truyện", "Đăng bài Threads", "Đánh giá Google Maps", "Seeding", "Bình luận dạo"]
      },
      {
        id: 2,
        title: "TRẢ LỜI BÌNH LUẬN",
        content: "Sau khi đăng bài, có người bình luận thì bạn trả lời bình luận bằng nội dung này nhé:",
        showReplyContent: true
      },
      {
        id: 3,
        title: "GỬI BẰNG CHỨNG",
        content: "Bấm \"Nộp bằng chứng\", dán link bài Threads và tải ảnh chụp các lượt trả lời bình luận lên."
      }
    ],
    // Quy định tính thưởng — hiện cuối popup XEM HƯỚNG DẪN
    rules: [
      "Bài đăng phải có từ 300 lượt xem trở lên và ít nhất 5 người bình luận mới được tính thưởng.",
      "Không tính thưởng chỉ vì đăng bài.",
      "Không tính những bình luận bạn chưa trả lời.",
      "Không tính bình luận tự tạo, trả lời trùng một bình luận hoặc tương tác giả.",
      "Mỗi cặp bình luận và lượt trả lời hợp lệ chỉ được nhận thưởng một lần.",
      "Admin quyết định số lượt hợp lệ dựa trên bằng chứng.",
      "Không giới hạn số lần tham gia, nhưng phải tuân thủ quy định của Threads và điều kiện xác minh."
    ]
  },

  // ==============================================
  // NHÓM JOB CINEMA RẠP PHIM
  // ==============================================

  'follow-cgv': {
    title: "FOLLOW FANPAGE RẠP PHIM",
    reward: "10.000 xu",
    color: "text-red-400",
    badge: "HOT 🎬",
    steps: [
      { id: 1, title: "Truy cập Fanpage CGV Cinemas VN", content: "Vào Facebook tìm 'CGV Cinemas Vietnam' (trang chính thức có tick xanh) → Nhấn FOLLOW (theo dõi)." },
      { id: 2, title: "Like + Share bài trailer mới nhất", content: "Tìm bài đăng trailer phim mới nhất trên fanpage → Nhấn LIKE ❤️ và SHARE bài đó lên tường Facebook của bạn." },
      { id: 3, title: "Chụp màn hình bằng chứng", content: "Chụp 1 ảnh: màn hình fanpage CGV rõ trạng thái đã Follow. Chụp 1 ảnh: bài Share trên tường của bạn. Gửi cả 2 ảnh.", note: "BẮT BUỘC: Tài khoản Facebook phải công khai (public) để kiểm tra được." }
    ]
  },

  'review-cinema': {
    title: "ĐÁNH GIÁ 5 SAO RẠP PHIM",
    reward: "10.000 xu",
    color: "text-amber-400",
    badge: "CƠ BẢN",
    steps: [
      { id: 1, title: "Tìm rạp phim trên Google Maps", content: "Mở Google Maps → Tìm kiếm 'CGV' hoặc 'Lotte Cinema' hoặc 'BHD Star' gần bạn → Chọn chi nhánh bất kỳ." },
      { id: 2, title: "Viết review + chấm 5 sao", content: "Nhấn 'Viết đánh giá' → Chọn 5 sao ⭐⭐⭐⭐⭐ → Viết nhận xét tối thiểu 50 chữ (về chất lượng phim, ghế ngồi, âm thanh, v.v.)." },
      { id: 3, title: "Chụp màn hình review", content: "Sau khi đăng thành công, chụp màn hình review của bạn rõ tên Google Account, nội dung review và 5 sao.", note: "Review phải còn hiển thị khi admin kiểm tra. Không được xóa review sau khi nhận thưởng." }
    ]
  },

  'checkin-cinema': {
    title: "CHECK-IN TẠI RẠP + ĐĂNG MẠNG XÃ HỘI",
    reward: "10.000 xu",
    color: "text-rose-400",
    badge: "HOT 🎬",
    steps: [
      { id: 1, title: "Tải hoặc lưu ảnh liên quan đến rạp phim", content: "Tìm và lưu 1 ảnh bất kỳ liên quan đến CGV, Lotte Cinema hoặc BHD Star (ảnh sảnh rạp, poster phim, ảnh check-in, v.v.). Có thể tìm trên Google, Facebook hoặc trang chính thức của rạp." },
      { id: 2, title: "Đăng lên Facebook hoặc Instagram", content: "Đăng ảnh vừa lưu lên Facebook/Instagram ở chế độ công khai. Caption phải có tag fanpage rạp (@CGV Cinemas Vietnam hoặc tương đương) và hashtag #CGV hoặc #RapPhim." },
      { id: 3, title: "Gửi bằng chứng", content: "Chụp màn hình bài đăng rõ ảnh, caption có tag + hashtag, và trạng thái công khai (Public). Gửi lên hệ thống.", note: "BẮT BUỘC: Bài đăng phải để chế độ Public. Không đăng ảnh trống hoặc nội dung không liên quan đến rạp phim." }
    ]
  },

  'survey-cinema': {
    title: "KHẢO SÁT THÓI QUEN XEM PHIM",
    reward: "10.000 xu",
    color: "text-violet-400",
    badge: "SURVEY 📋",
    steps: [
      { id: 1, title: "Trả lời 5 câu hỏi khảo sát", content: "Trả lời 5 câu hỏi trắc nghiệm về thói quen xem phim của bạn. Kết quả được ghi nhận tức thì, xu vào ví ngay khi hoàn thành." }
    ]
  },

  // ==============================================
  // NHÓM JOB CÀY VIEW (TIKTOK / YOUTUBE)
  // ==============================================

  'view-tiktok': {
    title: "CÀY VIEW TIKTOK",
    reward: "10.000 xu",
    color: "text-pink-400",
    badge: "HOT 🔥",
    warning: "Không xoá bài đăng, huỷ follow hoặc rời nhóm sau khi hoàn thành. Tài khoản phải là tài khoản thật, không dùng tài khoản ảo/clone.",
    steps: [
      {
        id: 1,
        title: "TRUY CẬP VIDEO TIKTOK",
        content: "Nhấn vào nút bên dưới để mở video yêu cầu trên ứng dụng TikTok. Đảm bảo bạn đã đăng nhập tài khoản thật.",
        downloadLink: "https://www.tiktok.com/@nhaf.official/video/7565367864157277458",
        buttonText: "👉 MỞ VIDEO TIKTOK"
      },
      {
        id: 2,
        title: "TƯƠNG TÁC ĐẦY ĐỦ",
        content: "Xem hết video (tuyệt đối KHÔNG TUA), nhấn thả tim (Like), Follow kênh và để lại 1 bình luận tích cực trên 10 chữ."
      },
      {
        id: 3,
        title: "CHỤP MÀN HÌNH BẰNG CHỨNG",
        content: "Chụp lại màn hình cho thấy bạn ĐÃ TIM, ĐÃ FOLLOW và CÓ HIỂN THỊ BÌNH LUẬN của bạn ở phía dưới video."
      },
      {
        id: 4,
        title: "NỘP BÀI CHỜ DUYỆT",
        content: "Bấm \"Nộp bằng chứng ngay\" và tải ảnh màn hình đó lên. Admin sẽ check đối soát và cộng XU cho bạn!"
      }
    ]
  },

  'view-youtube': {
    title: "CÀY VIEW YOUTUBE",
    reward: "10.000 xu",
    color: "text-red-500",
    badge: "HOT 🔥",
    warning: "Không xoá bài đăng, huỷ follow hoặc rời nhóm sau khi hoàn thành. Tài khoản phải là tài khoản thật, không dùng tài khoản ảo/clone.",
    steps: [
      {
        id: 1,
        title: "MỞ VIDEO YOUTUBE",
        content: "Nhấn nút bên dưới để chuyển sang ứng dụng YouTube. (Yêu cầu dùng tài khoản thật, có avatar).",
        downloadLink: "https://www.youtube.com/watch?v=EOhrUX30yjc",
        buttonText: "👉 MỞ VIDEO YOUTUBE"
      },
      {
        id: 2,
        title: "XEM & TƯƠNG TÁC",
        content: "Xem video tối thiểu 3 phút (Nếu video ngắn hơn thì xem hết). Bấm ĐĂNG KÝ KÊNH (Subscribe), LIKE video và viết một bình luận liên quan đến nội dung video."
      },
      {
        id: 3,
        title: "CHỤP ẢNH XÁC NHẬN",
        content: "Chụp lại màn hình điện thoại hiển thị rõ chữ 'Đã đăng ký', Nút Like đã sáng và thời lượng xem đã qua 3 phút."
      },
      {
        id: 4,
        title: "GỬI BÁO CÁO",
        content: "Bấm \"Nộp bằng chứng ngay\" và tải ảnh vừa chụp lên hệ thống để xác nhận hoàn thành nhiệm vụ và nhận xu."
      }
    ]
  },

  // ==============================================
  // JOB NGHE NHẠC – CHỌN BÀI HAY HƠN (không cần ảnh bằng chứng)
  // ==============================================

  // Bấm vào job mở popup MusicVoteModal (App.vue) thay vì trang /job/:id. Nhạc là file MP3 tĩnh trong public/audio/
  // (Cloudflare Pages phục vụ trực tiếp, không qua Firebase Storage) — tự chép file thật vào đúng tên bên dưới.
  // Chưa có file thì popup báo "chưa có nhạc" và khóa nút gửi đánh giá.
  'music-vote': {
    title: "NGHE NHẠC – CHỌN BÀI HAY HƠN",
    reward: "10.000 xu",
    color: "text-yellow-400",
    badge: "MỚI 🎧",
    shortDesc: "Nghe 2 đoạn nhạc ngắn và chọn đoạn mà bạn thấy hay, bắt tai hơn.",
    // A = "Until You" (02:08–02:31), B = "Where Have You Gone" (01:00–01:27) — Admin đối chiếu musicChoice A/B theo đây
    audioTracks: [
      { id: "A", label: "ĐOẠN NHẠC A", src: "audio/Until_You_02m08s-02m31s_128kbps.mp3" },
      { id: "B", label: "ĐOẠN NHẠC B", src: "audio/Where_Have_You_Gone_01m00s-01m27s_128kbps.mp3" }
    ],
    // Số giây nghe thật tối thiểu mỗi đoạn (tua không tính; đoạn ngắn hơn thì phải nghe hết) trước khi được chọn A/B.
    // Chỉ để hướng dẫn trải nghiệm phía trình duyệt, không phải bằng chứng chống gian lận — Admin vẫn duyệt tay.
    minListenSeconds: 15
  },

  // ==============================================
  // JOB THIẾT KẾ POSTER / BANNER (Canva, 1 ảnh bằng chứng)
  // ==============================================

  // Bấm vào job mở popup PosterDesignModal (App.vue) thay vì trang /job/:id: chọn 1 trong 3 nghệ sĩ, xem hướng dẫn,
  // tải 1 ảnh thiết kế. Ảnh nén + lưu Storage proofs/{uid}/{reportId}/ giống SubmitReportView.
  'poster-design': {
    title: "THIẾT KẾ POSTER / BANNER",
    reward: "20.000 xu",
    color: "text-red-400",
    badge: "MỚI 🎨",
    shortDesc: "Thiết kế một poster hoặc banner fanmade đơn giản về ca sĩ yêu thích bằng Canva.",
    posterArtists: [
      { id: "son-tung-mtp", icon: "🎤", name: "Sơn Tùng M-TP" },
      { id: "j97", icon: "🎵", name: "J-97" },
      { id: "noo-phuoc-thinh", icon: "🎶", name: "Noo Phước Thịnh" }
    ],
    steps: [
      { id: 1, title: "Truy cập Canva tại https://www.canva.com/", downloadLink: "https://www.canva.com/", buttonText: "MỞ CANVA ➔" },
      { id: 2, title: "Tìm mẫu \"Poster âm nhạc\" hoặc \"Banner âm nhạc\"." },
      { id: 3, title: "Chọn một trong ba nghệ sĩ và thiết kế ảnh fanmade theo sở thích." },
      { id: 4, title: "Poster cần có tên nghệ sĩ, hình ảnh minh họa và dòng chữ nhỏ \"RAPJOB\"." },
      { id: 5, title: "Tải ảnh thiết kế về điện thoại hoặc máy tính." },
      { id: 6, title: "Quay lại Rạp Job, tải ảnh bằng chứng và gửi đơn." }
    ],
    guideNote: "Thiết kế đơn giản, không cần kỹ năng chuyên nghiệp. Được dùng mẫu Canva miễn phí và hình ảnh có quyền sử dụng phù hợp — không cần mua Canva Pro.",
    approvalRules: [
      "Có một poster hoặc banner hoàn chỉnh.",
      "Đúng chủ đề nghệ sĩ đã chọn (1 trong 3).",
      "Có tên nghệ sĩ và dòng chữ \"RAPJOB\".",
      "Nội dung rõ ràng, không phải ảnh trống.",
      "Không sử dụng ảnh có watermark trái phép.",
      "Không giả mạo poster sự kiện chính thức."
    ]
  },

  // ==============================================
  // JOB ĐỌC TRUYỆN – CHỌN CÁCH XỬ LÝ (không cần ảnh, không cần nhập chữ)
  // ==============================================

  // Bấm vào job mở popup StoryChoiceModal (App.vue) thay vì trang /job/:id: đọc 1 truyện bốc ngẫu nhiên trong
  // stories (sửa / thêm / bớt truyện ở src/data/stories.ts), chọn A/B/C, xem đoạn kết rồi gửi đơn chờ Admin duyệt.
  // icon / cardDesc dùng chung cho card job (App.vue, JobSection.vue) — sửa ở đây là mọi nơi cùng đổi.
  'story-choice': {
    title: "ĐỌC TRUYỆN – CHỌN CÁCH XỬ LÝ",
    reward: "15.000 xu",
    color: "text-rose-400",
    badge: "MỚI 📖",
    icon: "📖",
    cardDesc: "Đọc truyện ngắn, chọn cách xử lý A/B/C",
    shortDesc: "Đọc một câu chuyện ngắn và chọn cách xử lý theo suy nghĩ của bạn.",
    stories: STORY_CHOICE_STORIES
  },

  // ==============================================
  // CÁC JOB CŨ (GIỮ NGUYÊN)
  // ==============================================

  'post-threads': {
    title: "ĐĂNG BÀI THREADS",
    reward: "30.000 xu",
    color: "text-fuchsia-400",
    badge: "CƠ BẢN",
    warning: "KHÔNG ĐƯỢC XÓA BÀI SAU KHI ĐĂNG! Bài phải để chế độ công khai ít nhất 7 ngày. Phát hiện gian lận hoặc xóa bài → KHÓA TÀI KHOẢN VĨNH VIỄN.",
    steps: [
      {
        id: 1,
        title: "SAO CHÉP 1 TRONG 4 NỘI DUNG VÀ ĐĂNG LÊN THREADS KÈM ẢNH",
        content: "Chọn 1 trong 4 nội dung bên dưới, nhấn COPY rồi dán vào bài đăng Threads. Tải ảnh về và đăng kèm theo bài. Đăng bài ở chế độ công khai (Public).",
        templates: [
          `Góc khuất học sinh THPT, thức đêm làm job khảo sát, đánh giá phim , seeding phim =))) ít nhưng vẫn cố a`,
          `dm đời cuối cùng t cũng kiếm đc job online nghỉ hè rồi , chi tiết phần bình luận`,
          `flex ngày hôm nay  : nhận lương từ job khảo sát , đánh giá rạp phim , seeding phim`,
          `cần 10 bạn seeding , đánh giá 5 sao rạp phim , khảo sát phim tình cảm`
        ],
        img: "images/anh-thread1.jpg",
        downloadLink: "images/anh-thread1.jpg",
        buttonText: "📥 TẢI ẢNH VỀ MÁY ĐỂ ĐĂNG KÈM"
      },
      {
        id: 2,
        title: "TẢI MÃ QR VÀ GHIM VÀO BÌNH LUẬN ĐẦU TIÊN",
        content: "Sau khi đăng bài, vào phần bình luận → Tải QR về máy → Đăng ảnh QR làm bình luận đầu tiên để mọi người dễ truy cập đăng ký.",
        downloadLink: "images/anh-ma-qr17.jpg",
        buttonText: "📥 TẢI MÃ QR VỀ MÁY",
        img: "images/anh-ma-qr17.jpg",
        note: "BẮT BUỘC: Phải ghim QR làm bình luận đầu tiên bên dưới bài đăng."
      },
      {
        id: 3,
        title: "CHỤP BẰNG CHỨNG VÀ GỬI LÊN HỆ THỐNG",
        content: "Chụp 2 ảnh: (1) Ảnh bài đăng Threads với nội dung đã đăng — (2) Ảnh bình luận có QR được ghim bên dưới. Gửi cả 2 ảnh lên hệ thống."
      }
    ]
  },

  'join-zalo': {
    title: "NHÓM ZALO",
    reward: "10.000 xu",
    color: "text-blue-500",
    badge: "CƠ BẢN",
      steps: [
      {
        id: 1,
        title: "THAM GIA NHÓM ZALO RẠP JOB",
        content: "NẾU NHÓM 3 ĐÃ FULL THÌ THAM GIA NHÓM 5 HOẶC NHÓM 9.",
        extraLinks: [
          { text: "THAM GIA NHÓM 3 ➔", url: "https://zalo.me/g/feyhu2samzen3gjirnqh" },
          { text: "THAM GIA NHÓM 5 ➔", url: "https://zalo.me/g/j0kwaispbne09pbdwu1i" },
          { text: "THAM GIA NHÓM 9 ➔", url: "https://zalo.me/g/sm5jknirc3wn3glx6dal" },
          { text: "THAM GIA NHÓM 13 ➔", url: "https://zalo.me/g/zlsylzd7omrnqfjrcese" },
          { text: "THAM GIA NHÓM 14 ➔", url: "https://zalo.me/g/hcjdwagbtsirnbgkmxc4" },
          { text: "THAM GIA NHÓM 15 ➔", url: "https://zalo.me/g/n2sptqzddwip41yfbh9j" }
        ]
      }
    ]
  },

  'liobank': {
    title: "NGÂN HÀNG LIOBANK",
    reward: "65.000 xu",
    color: "text-blue-500",
    badge: "HOT",
    ageRequirement: 22,
    warning: "BẮT BUỘC TỪ 22 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "BẮT BUỘC PHẢI CHỌN ĐĂNG KÝ NGAY",
        content: "Chọn ĐĂNG KÝ NGAY để đăng ký tài khoản .",
        downloadLink: "https://shorten.asia/uEyTE3Sp",
        buttonText: "ĐĂNG KÝ NGAY ➔"
      },
      {
        id: 2,
        title: "CHỌN ĐĂNG KÝ THẺ 2 IN 1",
        content: "Mở App Liobank, tại màn hình đăng ký chọn gói THẺ 2 IN 1 và điền đầy đủ thông tin cá nhân."
      },
      {
        id: 3,
        title: "LÀM THEO HƯỚNG DẪN",
        content: "Thực hiện các bước đăng ký theo hình ảnh hướng dẫn bên dưới.",
        images: ["images/anh-liobank3a.jpg", "images/anh-liobank3b.jpg"]
      },
      {
        id: 4,
        title: "CHỤP ẢNH BẰNG CHỨNG THÀNH CÔNG",
        content: "Chụp màn hình xác nhận đăng ký tài khoản Liobank thành công và nộp vào mục bằng chứng.",
        img: "images/anh-liobank4.jpg"
      }
    ]
  },

  'app-chung-khoan': {
    title: "APP CHỨNG KHOÁN SỐ 1",
    reward: "85.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    paused: true,
    warning: "BẮT BUỘC TỪ 18 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "VÀO CHPLAY HOẶC APPSTORE TẢI APP",
        content: "Tải APP chứng khoán Kafi X về điện thoại theo hình hướng dẫn bên dưới.",
        img: "images/anh-kafi-b1.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU D0020029",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU D0020029 VÀ CHỤP LẠI ẢNH.",
        referralCode: "D0020029",
        img: "images/anh-kafi2.jpg",
        note: "NHẬP MÃ: D0020029 (BẮT BUỘC)"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG",
        content: "CHỤP LẠI ẢNH ĐĂNG NHẬP THÀNH CÔNG ĐỂ GỬI BẰNG CHỨNG.",
        img: "images/anh-kafi3.jpg"
      },
      {
        id: 4,
        title: "LƯU LẠI ẢNH VÀ GỬI",
        content: "GỬI 2 ẢNH ĐÓ VÀ CHỜ PHÊ DUYỆT HOA HỒNG TRONG 24H."
      }
    ]
  },

  'app-chung-khoan-3': {
    title: "APP CHỨNG KHOÁN SỐ 3",
    reward: "85.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 20,
    warning: "BẮT BUỘC TỪ 20 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "CHỌN ĐĂNG KÝ NGAY VÀ CHỌN TIẾP TÔI LÀ CÔNG DÂN VIỆT NAM ĐỂ ĐĂNG KÝ",
        content: "LƯU Ý : KHÔNG CHỌN TẢI APP BÊN DƯỚI , PHẢI ĐĂNG KÝ ONLINE TRÊN WEB.",
        downloadLink: "https://shorten.asia/vQxU96N8",
        buttonText: "🚀 ĐĂNG KÝ NGAY",
        img: "images/anh-kis4.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ ID MÔI GIỚI: AT03",
        content: "BẮT BUỘC NHẬP MÃ ID MÔI GIỚI AT03 VÀ CHỤP LẠI ẢNH.",
        referralCode: "AT03",
        img: "images/anh-kis1.jpg",
        note: "NHẬP ID MÔI GIỚI AT03 (BẮT BUỘC)"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ TÀI KHOÁN THÀNH CÔNG",
        content: "CHỤP LẠI ẢNH ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG.",
        img: "images/anh-kis2.jpg"
      },
      {
        id: 4,
        title: "LƯU LẠI ẢNH VÀ GỬI",
        content: "GỬI 2 ẢNH ĐÓ VÀ CHỜ PHÊ DUYỆT HOA HỒNG TRONG 24H."
      }
    ]
  },

  'app-chung-khoan-4': {
    title: "APP CHỨNG KHOÁN SỐ 4",
    reward: "85.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 18,
    warning: "BẮT BUỘC TỪ 18 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "VÀO CHPLAY HOẶC APPSTORE TẢI APP",
        content: "Tải APP chứng khoán về điện thoại theo hình hướng dẫn bên dưới.",
        img: "images/anh-maybank1.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU AT09",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU AT09 VÀ CHỤP LẠI ẢNH.",
        referralCode: "AT09",
        img: "images/anh-maybank2.jpg",
        note: "NHẬP MÃ: AT09 (BẮT BUỘC)"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG",
        content: "CHỤP LẠI ẢNH ĐĂNG NHẬP THÀNH CÔNG ĐỂ GỬI BẰNG CHỨNG.",

      },
      {
        id: 4,
        title: "LƯU LẠI ẢNH VÀ GỬI",
        content: "GỬI 2 ẢNH ĐÓ VÀ CHỜ PHÊ DUYỆT HOA HỒNG TRONG 1H."
      }
    ]
  },

  'msb-bank': {
    title: "NGÂN HÀNG MSB",
    reward: "100.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    paused: true,
    warning: "BẮT BUỘC TỪ 18 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "TẢI APP MSB MBANK CÁ NHÂN",
        content: "Lưu ý: CHỌN TẢI APP MSB (KHÔNG CÓ CHỮ TÀI TRỢ, QUẢNG CÁO).",
        img: "images/anh-msb1.png"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU ACT000",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU ACT000 VÀ CHỤP LẠI ẢNH.",
        img: "images/anh-msb2.jpg",
        note: "BẮT BUỘC NHẬP MÃ: ACT000 VÀ CHỤP ẢNH LẠI"
      },
      {
        id: 3,
        title: "CHỤP ẢNH BẰNG CHỨNG MỞ TÀI KHOẢN THÀNH CÔNG",
        content: "CHỤP LẠI ẢNH NHƯ BÊN DƯỚI ĐÂY, VÀ ĐĂNG NHẬP VÀO APP MSB ĐỂ HOÀN TẤT.",
        img: "images/anh-msb3.jpg"
      },
      {
        id: 4,
        title: "VÀO CÀI ĐẶT , CHỌN THÔNG TIN CÁ NHÂN , LẤY MÃ CIF MSB ",
        content: "CHỤP ẢNH GỬI VÀO BẰNG CHỨNG .",
        img: "images/anh-msb7.jpg"
      },
    ]
  },

  'vpbank': {
    title: "NGÂN HÀNG VPB",
    reward: "100.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    paused: true,
    warning: "BẮT BUỘC TỪ 18 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "TẢI APP VPBANK NEO",
        content: "TẢI ỨNG DỤNG VÀ TIẾN HÀNH ĐĂNG KÝ TÀI KHOẢN TRỰC TUYẾN.",
        img: "images/anh-vpbank1.jpg"
      },
      {
        id: 2,
        title: "NHẬP MÃ GIỚI THIỆU : AT420584",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU AT420584 VÀ CHỤP LẠI MÀN HÌNH.",
        img: "images/anh-vpbank2.jpg",
        note: "NHẬP MÃ: AT420584 (BẮT BUỘC)"
      },
      {
        id: 3,
        title: "ĐĂNG NHẬP ,  CHUYỂN VÀO VPBANK 20K,  XONG LẠI CHUYỂN RA ",
        content: "Chuyển 20k ra cho 1 người khác , xem ảnh hướng dẫn bên dưới .",
        img: "images/anh-vpbank6.jpg"
      }
    ]
  },

  'app-chung-khoan-2': {
    title: "APP CHỨNG KHOÁN SỐ 2",
    reward: "85.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    paused: true,
    warning: "BẮT BUỘC TỪ 18 TUỔI! (Nếu chưa đủ tuổi, có thể nhờ người thân đăng ký hộ, vẫn nhận 100% tiền thưởng).",
    steps: [
      {
        id: 1,
        title: "VÀO CHPLAY HOẶC APPSTORE TẢI APP",
        content: "Tải APP chứng khoán DNSE về điện thoại theo hình hướng dẫn bên dưới.",
        img: "images/anh-dnse1.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU AT00007",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU AT00007 VÀ CHỤP LẠI ẢNH.",
        referralCode: "AT00007",
        img: "images/anh-dnse2.jpg",
        note: "NHẬP MÃ: AT00007 (BẮT BUỘC)"
      },
      {
        id: 3,
        title: "CHỤP LẠI ẢNH ĐĂNG KÝ THÀNH CÔNG VÀ ĐĂNG NHẬP",
        content: "CHỤP LẠI ẢNH ĐĂNG KÝ THÀNH CÔNG HOẶC ẢNH ĐĂNG NHẬP VÀO APP.",
        img: "images/anh-dnse3.jpg",
      },
      {
        id: 4,
        title: "LƯU LẠI ẢNH NHẬP MÃ VÀ ẢNH ĐĂNG KÝ THÀNH CÔNG",
        content: "GỬI 2 ẢNH ĐÓ VÀ CHỜ PHÊ DUYỆT HOA HỒNG."
      }
    ]
  },

  'abbank': {
    title: "APP ABBANK",
    subtitle: "Mở tài khoản ABBANK",
    reward: "85.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 15,
    zaloGuideUrl: "",
    warning: "Người đăng ký phải từ 15 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký ABBANK trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    // Trang chi tiết dùng giao diện gọn + popup hướng dẫn giống APP TPBANK (VIP_FULL_GUIDE_IDS trong JobDetailView);
    // nộp bằng chứng vẫn qua form chung SubmitReportView.
    // 3 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + làm ảnh mẫu trong form nộp bằng chứng chung
    proofSampleImages: [
      "images/abbank-1.jpg",
      "images/abbank-2.jpg",
      "images/anh-abbank4.jpg"
    ],
    // Dòng chữ vàng ở header trang chi tiết, ngay dưới dòng "Nhập mã giới thiệu" (mã lấy từ referralCode của bước 2)
    headerNote: "Phát sinh giao dịch tổng 30k",
    steps: [
      {
        id: 1,
        title: "CHỌN NÚT TẢI ỨNG DỤNG VỀ ĐỂ ĐĂNG KÝ",
        content: "Chọn tải ứng dụng ABBANK để bắt đầu đăng ký.",
        downloadLink: "https://retail.abbank.vn/universal-link",
        buttonText: "🚀 TẢI ỨNG DỤNG"
      },
      {
        id: 2,
        title: "NHẬP MÃ GIỚI THIỆU: 0366076921",
        content: "Bắt buộc nhập mã giới thiệu 0366076921 và chụp lại ảnh màn hình.",
        img: "images/abbank-1.jpg",
        note: "NHẬP MÃ GIỚI THIỆU 0366076921 (BẮT BUỘC)",
        referralCode: "0366076921"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG VÀ CHỤP ẢNH LẠI",
        content: "Sau khi đăng ký tài khoản ABBANK thành công, chụp lại ảnh màn hình hoàn tất.",
        img: "images/abbank-2.jpg"
      },
      {
        id: 4,
        title: "THỰC HIỆN GIAO DỊCH TỔNG 30K",
        content: "Sau khi đăng nhập APP ABBANK, bạn cần phát sinh giao dịch 30k theo hướng dẫn dưới đây:\n✅ Chuyển vào tài khoản ABBANK: 30k\n✅ Chuyển ra ngoài 2 lần 10k: 10k (lần 1) + chuyển ra ngoài 10k (lần 2)\n✅ Nạp điện thoại: 10k\n\nLàm đủ các bước trên rồi chụp ảnh màn hình theo ảnh mẫu để gửi bằng chứng.",
        note: "TỔNG CẦN LÀM: 30K",
        img: "images/anh-abbank4.jpg"
      }
    ]
  },

  // Job VIP mới APP TPBANK — gửi bằng chứng qua popup riêng (TpbankProofModal); trang chi tiết dùng giao diện
  // gọn + popup hướng dẫn riêng (VIP_FULL_GUIDE_IDS trong JobDetailView). Bước hướng dẫn / ảnh mẫu / dòng ghi chú
  // nằm ở TPBANK_GUIDE đầu file (dùng chung với job giới thiệu bạn bè 'referral_tpbank').
  'tpbank': {
    title: "APP TPBANK",
    subtitle: "Mở tài khoản TPBANK",
    reward: "80.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 18,
    zaloGuideUrl: "",
    warning: "Người đăng ký phải từ 18 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký TPBANK trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    proofSampleImages: TPBANK_GUIDE.proofSampleImages,
    headerNote: TPBANK_GUIDE.headerNote,
    steps: TPBANK_GUIDE.steps
  },

  // Job VIP APP TPBANK (NEW) — giao diện giống hệt APP TPBANK (trang chi tiết gọn + popup hướng dẫn, VIP_FULL_GUIDE_IDS trong
  // JobDetailView), gửi bằng chứng qua popup riêng TpbankNewProofModal. Khác APP TPBANK: không hiện mã AT09 / nút sao chép,
  // mã giới thiệu lấy qua nút "XEM MÃ GIỚI THIỆU" (dẫn vào nhóm Zalo zaloReferralLink) giống APP LPBANK PLUS. Link nhóm Zalo,
  // ảnh mẫu, các bước và dòng ghi chú header nằm ở TPBANK_NEW_GUIDE đầu file (dùng chung với 'referral_tpbank_new').
  'tpbank-new': {
    title: "APP TPBANK (NEW)",
    subtitle: "Mở tài khoản TPBANK",
    reward: "90.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 15,
    zaloGuideUrl: "",
    warning: "Người đăng ký phải từ 15 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký TPBANK trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    zaloReferralLink: TPBANK_NEW_GUIDE.zaloReferralLink,
    proofSampleImages: TPBANK_NEW_GUIDE.proofSampleImages,
    headerNote: TPBANK_NEW_GUIDE.headerNote,
    steps: TPBANK_NEW_GUIDE.steps
  },

  // Job giới thiệu bạn bè "Mời bạn bè đăng ký APP TPBANK" (TPBANK_REFERRAL_JOB_ID) — trang chi tiết giống hệt
  // APP TPBANK (dùng chung TPBANK_GUIDE), gửi bằng chứng qua TpbankReferralProofModal (thông tin người bạn).
  'referral_tpbank': {
    title: "Mời bạn bè đăng ký APP TPBANK",
    subtitle: "Mời bạn bè đăng ký APP TPBANK nhận 85.000 xu/lượt",
    reward: "85.000 xu",
    rewardText: "85.000 xu",
    color: "text-orange-500",
    badge: "VIP 💎",
    type: "friend_referral",
    bankType: "tpbank",
    referralProgram: "tpbank",
    ageRequirement: 18,
    proofSampleImages: TPBANK_GUIDE.proofSampleImages,
    headerNote: TPBANK_GUIDE.headerNote,
    steps: TPBANK_GUIDE.steps
  },

  // Job giới thiệu bạn bè "Mời bạn bè đăng ký APP TPBANK (NEW)" (TPBANK_NEW_REFERRAL_JOB_ID) — trang chi tiết, popup hướng dẫn,
  // thanh nút cuối trang giống hệt APP TPBANK (NEW) (dùng chung TPBANK_NEW_GUIDE), gửi bằng chứng qua
  // TpbankNewReferralProofModal (thông tin người bạn).
  'referral_tpbank_new': {
    title: "Mời bạn bè đăng ký APP TPBANK (NEW)",
    subtitle: "Mời bạn bè đăng ký APP TPBANK (NEW) nhận 100.000 xu/lượt",
    reward: "100.000 xu",
    rewardText: "100.000 xu",
    color: "text-orange-500",
    badge: "VIP 💎",
    type: "friend_referral",
    bankType: "tpbank",
    referralProgram: "tpbank",
    ageRequirement: 15,
    zaloGuideUrl: "",
    zaloReferralLink: TPBANK_NEW_GUIDE.zaloReferralLink,
    proofSampleImages: TPBANK_NEW_GUIDE.proofSampleImages,
    headerNote: TPBANK_NEW_GUIDE.headerNote,
    steps: TPBANK_NEW_GUIDE.steps
  },

  // Job VIP APP LPBANK PLUS — trang chi tiết dùng giao diện gọn + popup hướng dẫn giống APP TPBANK / APP ABBANK
  // (VIP_FULL_GUIDE_IDS trong JobDetailView); gửi bằng chứng vẫn qua popup riêng LpbankPlusProofModal.
  'lpbank-plus': {
    title: "APP LPBANK PLUS",
    subtitle: "Mở tài khoản LPBank Plus",
    reward: "75.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 15,
    zaloGuideUrl: "",
    // Text ngắn hiển thị dưới khối tiêu đề ở trang chi tiết
    shortDesc: "Hoàn thành đăng ký APP LPBANK PLUS theo hướng dẫn để nhận thưởng.",
    warning: "Người đăng ký phải từ 15 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký LPBank Plus trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    // Link nhóm Zalo để lấy mã giới thiệu — trang chi tiết không hiện mã trực tiếp, nút "XEM MÃ GIỚI THIỆU" dẫn vào đây
    zaloReferralLink: "https://zalo.me/g/6hx6byuwxmj20dlny1pl",
    // 3 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + trong popup gửi bằng chứng
    proofSampleImages: [
      "images/anh-lpbank-new2.jpg",
      "images/anh-lpbank-new3.jpg",
      "images/anh-lpbank-new4.jpg"
    ],
    // Dòng chữ vàng ở header trang chi tiết, ngay dưới dòng "Nhập mã giới thiệu"
    headerNote: "Phát sinh giao dịch 100k",
    // 3 bước hướng dẫn rút gọn — dùng cho popup hướng dẫn "Mời bạn bè đăng ký APP LPBANK Plus" (LpbankPlusReferralHubModal)
    quickSteps: [
      {
        id: 1,
        title: "TẢI APP LPBANK PLUS",
        content: "Tải APP LPBank Plus về điện thoại để đăng ký.",
        note: "CHÚ Ý: CÓ 2 APP LPBANK, PHẢI TẢI ĐÚNG APP LPBANK PLUS CÓ CHỮ PLUS MỚI ĐÚNG NHÉ, KHÔNG CHỌN NHẦM APP LPBANK KHÁC.",
        img: "images/anh-lpbank-buoc1.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU",
        content: "Tham gia nhóm Zalo để lấy mã giới thiệu.",
        referralCode: "0366045803",
        img: "images/anh-lpbank-new1.jpg"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ THÀNH CÔNG VÀ HOÀN TẤT THEO HƯỚNG DẪN",
        content: "Sau khi đăng ký thành công, chuyển 100.000đ vào APP LPBank Plus rồi chuyển ra lại. Sau khi hoàn thành đầy đủ, chụp lại 3 ảnh bằng chứng rồi gửi nộp đơn.",
        img: "images/anh-lpbank-new4.jpg"
      }
    ],
    // 3 bước hướng dẫn (cùng khuôn với APP TPBANK / APP ABBANK) — hiển thị trong popup "Hướng dẫn" của trang chi tiết.
    // Bước 2 không có referralCode vì mã lấy qua nút "XEM MÃ GIỚI THIỆU" (dẫn vào nhóm Zalo zaloReferralLink).
    steps: [
      {
        id: 1,
        title: "TẢI ĐÚNG APP LPBANK PLUS - CHÚ Ý CHỮ PLUS",
        content: "Tải APP LPBank Plus về điện thoại để đăng ký. Tên APP: LPBank Plus hoặc chọn TẢI ỨNG DỤNG.",
        downloadLink: "https://content.lpbank.com.vn/share/down_app/index.html",
        buttonText: "🚀 TẢI ỨNG DỤNG",
        note: "CHÚ Ý: CÓ 2 APP LPBANK, PHẢI TẢI ĐÚNG APP LPBANK PLUS CÓ CHỮ PLUS MỚI ĐÚNG NHÉ, KHÔNG CHỌN NHẦM APP LPBANK KHÁC.",
        img: "images/anh-lpbank-buoc1.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU",
        content: "Chọn nút \"XEM MÃ GIỚI THIỆU\" để lấy mã giới thiệu.",
        note: "NHẬP MÃ GIỚI THIỆU LẤY TỪ NHÓM ZALO (BẮT BUỘC)",
        img: "images/anh-lpbank-new1.jpg"
      },
      {
        id: 3,
        title: "PHÁT SINH GIAO DỊCH 100K",
        content: "Sau khi đăng ký thành công, bạn cần phát sinh giao dịch 100k theo hướng dẫn dưới đây:\n✅ Chuyển vào tài khoản LPBank Plus: 100k\n✅ Chuyển ra lại: 100k\n\nLàm đủ các bước trên rồi chụp lại bill chuyển tiền ra theo ảnh mẫu, sau đó gửi đủ 3 ảnh bằng chứng.",
        img: "images/anh-lpbank-new4.jpg"
      }
    ]
  },

  // Job VIP mới VIETCOMBANK — clone gần như y hệt cấu trúc/hướng dẫn của 'lpbank-plus' theo yêu cầu,
  // ảnh/bước hướng dẫn/mã giới thiệu tạm thời vẫn là của LPBank Plus, chờ chỉnh sửa nội dung thật sau.
  'vietcombank': {
    title: "VIETCOMBANK",
    subtitle: "Đăng ký Vietcombank nhận thưởng",
    reward: "65.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 15,
    zaloGuideUrl: "",
    // Field phân loại — dùng khi seed vào Firestore vip_jobs và để nhận diện report là job VIP/bank
    category: "vip",
    jobCategory: "vip",
    jobType: "vip",
    isVip: true,
    bankType: "vietcombank",
    appType: "bank",
    campaignType: "bank",
    // Text ngắn hiển thị dưới khối tiêu đề ở trang chi tiết
    shortDesc: "Hoàn thành đăng ký VIETCOMBANK theo hướng dẫn để nhận thưởng.",
    warning: "Người đăng ký phải từ 15 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    // Link nhóm Zalo để lấy mã giới thiệu
    zaloReferralLink: "https://zalo.me/g/iobklj13hk0wxwvt85ru",
    // 3 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + trong popup gửi bằng chứng
    proofSampleImages: [
      "images/anh-vcb1.jpg",
      "images/anh-vcb2.jpg",
      "images/anh-vcb3.jpg"
    ],
    // 3 bước hướng dẫn rút gọn — dùng chung cho khối "CÁC BƯỚC THỰC HIỆN" ở trang chi tiết và popup "XEM HƯỚNG DẪN"
    quickSteps: [
      {
        id: 1,
        title: "TẢI APP VIETCOMBANK",
        content: "Tải APP về điện thoại để đăng ký.",
        note: "CHÚ Ý: TẢI ĐÚNG APP CHÍNH THỨC, KHÔNG CHỌN NHẦM APP KHÁC.",
        img: "images/anh-vcb.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU",
        content: "Tham gia nhóm Zalo để lấy mã giới thiệu.",
        referralCode: "0366045803",
        img: "images/anh-vcb1.jpg"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ THÀNH CÔNG VÀ HOÀN TẤT THEO HƯỚNG DẪN",
        content: "Sau khi đăng ký thành công, chuyển 15.000đ vào tài khoản VCB, sau đó chuyển ra lại 3 lần, mỗi lần 5.000đ. Sau khi hoàn thành đầy đủ, chụp lại 3 ảnh bằng chứng rồi gửi nộp đơn.",
        img: "images/anh-vcb3.jpg"
      }
    ],
    steps: [
      {
        id: 1,
        title: "TẢI ĐÚNG APP VIETCOMBANK",
        content: "Tên APP: VIETCOMBANK hoặc chọn TẢI ỨNG DỤNG.",
        downloadLink: "https://content.lpbank.com.vn/share/down_app/index.html",
        buttonText: "🚀 TẢI ỨNG DỤNG",
        img: "images/anh-vcb.jpg"
      },
      {
        id: 2,
        title: "NHẬP MÃ GIỚI THIỆU : 0366045803",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU 0366045803 VÀ CHỤP LẠI ẢNH.",
        img: "images/anh-vcb1.jpg",
        note: "NHẬP MÃ GIỚI THIỆU: 0366045803 (BẮT BUỘC)",
        referralCode: "0366045803"
      },
      {
        id: 3,
        title: "CHUYỂN VÀO TÀI KHOẢN 50K VÀ CHUYỂN RA",
        content: "CHỤP LẠI ẢNH CHUYỂN TIỀN RA VÀ GỬI BẰNG CHỨNG.",
        img: "images/anh-vcb3.jpg"
      },
      {
        id: 4,
        title: "VÀO GỬI BẰNG CHỨNG ĐỂ XEM ẢNH CẦN GỬI",
        content: "CHỜ ĐỢI BÊN MÌNH DUYỆT ĐƠN VÀ NHẬN HOA HỒNG.",

      }
    ]
  },

  // Job VIP mới MBV BANK — clone y hệt cấu trúc/logic của 'vietcombank' theo yêu cầu. Ảnh các bước, ảnh mẫu
  // bằng chứng (images/mbv-*.jpg) và link nhóm Zalo lấy mã đã cập nhật riêng cho MBV.
  'mbv-bank': {
    title: "MBV BANK",
    subtitle: "Đăng ký MBV Bank nhận thưởng",
    reward: "65.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 15,
    zaloGuideUrl: "",
    // Field phân loại — dùng khi seed vào Firestore vip_jobs và để nhận diện report là job VIP/bank
    category: "vip",
    jobCategory: "vip",
    jobType: "vip",
    isVip: true,
    bankType: "mbv",
    appType: "bank",
    campaignType: "bank",
    // Text ngắn hiển thị dưới khối tiêu đề ở trang chi tiết
    shortDesc: "Hoàn thành đăng ký MBV BANK theo hướng dẫn để nhận thưởng.",
    warning: "Người đăng ký phải từ 15 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    // Link nhóm Zalo để lấy mã giới thiệu
    zaloReferralLink: "https://zalo.me/g/ke5tadfgbjlhefh4aaqg",
    // 3 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + trong popup gửi bằng chứng
    proofSampleImages: [
      "images/mbv-1.jpg",
      "images/mbv-2.jpg",
      "images/mbv-3.jpg"
    ],
    // 4 bước hướng dẫn rút gọn — dùng chung cho khối "CÁC BƯỚC THỰC HIỆN" ở trang chi tiết và popup "XEM HƯỚNG DẪN"
    quickSteps: [
      {
        id: 1,
        title: "TẢI APP MBV BANK",
        content: "Tải APP về điện thoại để đăng ký.",
        note: "CHÚ Ý: TẢI ĐÚNG APP CHÍNH THỨC, KHÔNG CHỌN NHẦM APP KHÁC.",
        img: "images/mbv-taiapp.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU",
        content: "Tham gia nhóm Zalo để lấy mã giới thiệu.",
        referralCode: "0366045803",
        img: "images/mbv-1.jpg"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ THÀNH CÔNG VÀ CHỤP LẠI ẢNH GỬI BẰNG CHỨNG",
        content: "Sau khi đăng ký thành công, chụp lại màn hình \"Đăng ký thành công\" để gửi bằng chứng.",
        img: "images/mbv-2.jpg"
      },
      {
        id: 4,
        title: "CHUYỂN 50K VÀO MBV BANK VÀ CHUYỂN RA",
        content: "Chuyển 50.000đ vào tài khoản MBV BANK, sau đó chuyển 50.000đ ra lại. Chụp lại bill chuyển tiền ra, rồi gửi đủ 3 ảnh bằng chứng để nộp đơn.",
        img: "images/mbv-3.jpg"
      }
    ],
    steps: [
      {
        id: 1,
        title: "TẢI ĐÚNG APP MBV BANK",
        content: "Tên APP: MBV BANK hoặc chọn TẢI ỨNG DỤNG.",
        downloadLink: "https://content.lpbank.com.vn/share/down_app/index.html",
        buttonText: "🚀 TẢI ỨNG DỤNG",
        img: "images/mbv-taiapp.jpg"
      },
      {
        id: 2,
        title: "NHẬP MÃ GIỚI THIỆU : 0366045803",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU 0366045803 VÀ CHỤP LẠI ẢNH.",
        img: "images/mbv-1.jpg",
        note: "NHẬP MÃ GIỚI THIỆU: 0366045803 (BẮT BUỘC)",
        referralCode: "0366045803"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ THÀNH CÔNG VÀ CHỤP LẠI ẢNH",
        content: "CHỤP LẠI MÀN HÌNH ĐĂNG KÝ THÀNH CÔNG ĐỂ GỬI BẰNG CHỨNG.",
        img: "images/mbv-2.jpg"
      },
      {
        id: 4,
        title: "CHUYỂN VÀO MBV BANK 50K VÀ CHUYỂN RA",
        content: "CHỤP LẠI BILL CHUYỂN TIỀN RA VÀ GỬI BẰNG CHỨNG.",
        img: "images/mbv-3.jpg"
      },
      {
        id: 5,
        title: "VÀO GỬI BẰNG CHỨNG ĐỂ XEM ẢNH CẦN GỬI",
        content: "CHỜ ĐỢI BÊN MÌNH DUYỆT ĐƠN VÀ NHẬN HOA HỒNG.",

      }
    ]
  },

  // Job VIP mới SHOPEE PAY — clone cấu trúc/logic của 'vietcombank', ảnh + nội dung hướng dẫn (bước 1/2/3),
  // mã giới thiệu và 2 ảnh mẫu bằng chứng (anh-shopee2/3) đã cập nhật riêng cho Shopee Pay.
  'shopee-pay': {
    title: "SHOPEE PAY",
    subtitle: "Đăng ký Shopee Pay nhận thưởng",
    reward: "65.000 xu",
    color: "text-orange-500",
    badge: "SIÊU HOT",
    ageRequirement: 18,
    zaloGuideUrl: "",
    // Field phân loại — dùng khi seed vào Firestore vip_jobs và để nhận diện report là job VIP/bank
    category: "vip",
    jobCategory: "vip",
    jobType: "vip",
    isVip: true,
    bankType: "shopeepay",
    appType: "bank",
    campaignType: "bank",
    // Text ngắn hiển thị dưới khối tiêu đề ở trang chi tiết
    shortDesc: "Hoàn thành đăng ký SHOPEE PAY theo hướng dẫn để nhận thưởng.",
    warning: "Người đăng ký phải từ 18 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
    // Link nhóm Zalo để lấy mã giới thiệu
    zaloReferralLink: "https://zalo.me/g/iobklj13hk0wxwvt85ru",
    // 2 ảnh mẫu bằng chứng cần gửi — hiển thị ở trang chi tiết + trong popup gửi bằng chứng
    proofSampleImages: [
      "images/anh-shopee2.jpg",
      "images/anh-shopee3.jpg"
    ],
    // 3 bước hướng dẫn rút gọn — dùng chung cho khối "CÁC BƯỚC THỰC HIỆN" ở trang chi tiết và popup "XEM HƯỚNG DẪN"
    quickSteps: [
      {
        id: 1,
        title: "TẢI APP SHOPEE PAY",
        content: "Tải APP Shopee Pay về điện thoại để đăng ký.",
        note: "CHÚ Ý: TẢI ĐÚNG APP CHÍNH THỨC, KHÔNG CHỌN NHẦM APP KHÁC.",
        img: "images/anh-shopee1.jpg"
      },
      {
        id: 2,
        title: "ĐĂNG KÝ VÀ NHẬP MÃ GIỚI THIỆU",
        content: "Trong lúc đăng ký, bắt buộc nhập mã giới thiệu bên dưới rồi chụp lại ảnh.",
        note: "LƯU Ý: BẮT BUỘC NHẬP MÃ GIỚI THIỆU XW6JU8LUR.",
        referralCode: "XW6JU8LUR",
        img: "images/anh-shopee2.jpg"
      },
      {
        id: 3,
        title: "XÁC THỰC TÀI KHOẢN VÀ HOÀN TẤT THEO HƯỚNG DẪN",
        content: "Chụp CCCD, xác thực NFC và xác minh tài khoản đầy đủ theo hướng dẫn trong app. Sau khi hoàn thành, chụp lại 2 ảnh bằng chứng bên dưới rồi gửi nộp đơn.",
        img: "images/anh-shopee3.jpg"
      },
      {
        id: 4,
        title: "NẠP 10.000Đ VÀO SHOPEE PAY",
        content: "Vào Shopee Pay, chọn Nạp tiền, nạp 10.000đ vào Ví Shopee Pay. Chụp lại ảnh lịch sử giao dịch để gửi bằng chứng."
      }
    ],
    steps: [
      {
        id: 1,
        title: "TẢI ĐÚNG APP SHOPEE PAY",
        content: "Tên APP: SHOPEE PAY hoặc chọn TẢI ỨNG DỤNG.",
        downloadLink: "https://content.lpbank.com.vn/share/down_app/index.html",
        buttonText: "🚀 TẢI ỨNG DỤNG",
        img: "images/anh-shopee1.jpg"
      },
      {
        id: 2,
        title: "NHẬP MÃ GIỚI THIỆU : XW6JU8LUR",
        content: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU XW6JU8LUR VÀ CHỤP LẠI ẢNH.",
        img: "images/anh-shopee2.jpg",
        note: "NHẬP MÃ GIỚI THIỆU: XW6JU8LUR (BẮT BUỘC)",
        referralCode: "XW6JU8LUR"
      },
      {
        id: 3,
        title: "XÁC THỰC TÀI KHOẢN",
        content: "CHỤP CCCD, XÁC THỰC NFC, XÁC MINH TÀI KHOẢN THEO HƯỚNG DẪN TRONG APP RỒI CHỤP LẠI ẢNH GỬI BẰNG CHỨNG.",
        img: "images/anh-shopee3.jpg"
      },
      {
        id: 4,
        title: "NẠP 10.000Đ VÀO SHOPEE PAY",
        content: "VÀO SHOPEE PAY, CHỌN NẠP TIỀN, NẠP 10.000Đ VÀO VÍ SHOPEE PAY."
      },
      {
        id: 5,
        title: "VÀO GỬI BẰNG CHỨNG ĐỂ XEM ẢNH CẦN GỬI",
        content: "CHỜ ĐỢI BÊN MÌNH DUYỆT ĐƠN VÀ NHẬN HOA HỒNG.",

      }
    ]
  },

  'momo': {
    title: "VÍ MOMO",
    subtitle: "Đăng ký ví MoMo nhận thưởng",
    reward: "85.000 xu",
    color: "text-orange-500",
    badge: "VIP",
    ageRequirement: 15,
    warning: "1 điện thoại chỉ được phép đăng ký 1 tài khoản ví MoMo, không đăng xuất ra đăng ký tài khoản khác.",
    steps: [
      {
        id: 1,
        title: "Bước 1: Tải app MoMo về điện thoại",
        content: "Tải ứng dụng Ví MoMo về điện thoại (CH Play hoặc App Store) để bắt đầu đăng ký tài khoản.",
        downloadLink: MOMO_CONFIG.momoDownloadLink || "#",
        buttonText: "TẢI APP VỀ ĐIỆN THOẠI"
      },
      {
        id: 2,
        title: "Bước 2: Đăng ký và nhập mã giới thiệu",
        content: "Đăng ký tài khoản MoMo bằng số điện thoại của bạn. Trong lúc đăng ký, bắt buộc nhập mã giới thiệu bên dưới rồi chụp lại ảnh màn hình.",
        referralCode: MOMO_CONFIG.momoReferralCode,
        img: MOMO_CONFIG.momoReferralGuideImage,
        note: "BẮT BUỘC NHẬP MÃ GIỚI THIỆU KHI ĐĂNG KÝ"
      },
      {
        id: 3,
        title: "Bước 3: Liên kết ngân hàng với ví MoMo",
        content: "Vào mục Liên kết ngân hàng trong app MoMo, chọn ngân hàng của bạn để liên kết với ví.",
        img: MOMO_CONFIG.momoBankLinkGuideImage,
        note: "CHỈ CÓ CÁC NGÂN HÀNG DƯỚI ĐÂY MỚI LIÊN KẾT ĐƯỢC VỚI VÍ MOMO"
      },
      {
        id: 4,
        title: "Bước 4: Nạp 10.000đ vào ví MoMo",
        content: "Sau khi liên kết ngân hàng thành công, chọn Nạp vào Ví và nạp 10.000đ. Chụp lại ảnh lịch sử giao dịch để gửi bằng chứng.",
        img: MOMO_CONFIG.momoTopupImage
      }
    ]
  }
};