// src/data/jobs.ts
export const jobsData: Record<string, any> = {
  
  // ==============================================
  // NHÓM JOB CINEMA RẠP PHIM
  // ==============================================

  'follow-cgv': {
    title: "FOLLOW FANPAGE RẠP PHIM",
    reward: "30.000 xu",
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
    reward: "25.000 xu",
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
    reward: "30.000 xu",
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
    reward: "30.000 xu",
    color: "text-violet-400",
    badge: "SURVEY 📋",
    steps: [
      { id: 1, title: "Trả lời 5 câu hỏi khảo sát", content: "Trả lời 5 câu hỏi trắc nghiệm về thói quen xem phim của bạn. Kết quả được ghi nhận tức thì, xu vào ví ngay khi hoàn thành." }
    ]
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
        downloadLink: "images/ma-qr1.jpg",
        buttonText: "📥 TẢI MÃ QR VỀ MÁY",
        img: "images/ma-qr1.jpg",
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
        content: "NẾU NHÓM 1,2 ĐÃ FULL THÌ THAM GIA NHÓM 3.",
        extraLinks: [
          { text: "THAM GIA NHÓM 1 ➔", url: "https://zalo.me/g/fambpb151" },
          { text: "THAM GIA NHÓM 2 ➔", url: "https://zalo.me/g/1ucvwyabtkhevegfg0s6" },
          { text: "THAM GIA NHÓM 3 ➔", url: "https://zalo.me/g/feyhu2samzen3gjirnqh" }
        ]
      },
      {
        id: 2,
        title: "CHỤP LẠI ẢNH TRONG NHÓM ZALO",
        content: "Tải ảnh vừa chụp lên hệ thống để xác nhận hoàn thành nhiệm vụ và nhận xu."
      }
    ]
  },

  'liobank': {
    title: "NGÂN HÀNG LIOBANK",
    reward: "65.000 xu",
    color: "text-blue-500",
    badge: "HOT",
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
    zaloGuideUrl: "",
    warning: "Người đăng ký phải từ 18 tuổi trở lên. Số điện thoại và CCCD/CMND chưa từng đăng ký ABBANK trước đó. Phải hoàn tất xác thực tài khoản mới được tính thưởng. Nghiêm cấm gian lận hoặc gửi bằng chứng giả.",
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
        title: "NHẬP MÃ GIỚI THIỆU: 0366045803",
        content: "Bắt buộc nhập mã giới thiệu 0366045803 và chụp lại ảnh màn hình.",
        img: "images/anh-abbank1.jpg",
        note: "NHẬP MÃ GIỚI THIỆU 0366045803 (BẮT BUỘC)",
        referralCode: "0366045803"
      },
      {
        id: 3,
        title: "ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG VÀ CHỤP ẢNH LẠI",
        content: "Sau khi đăng ký tài khoản ABBANK thành công, chụp lại ảnh màn hình hoàn tất.",
        img: "images/anh-abbank2.jpg"
      },
      {
        id: 4,
        title: "ĐĂNG NHẬP VÀO TÀI KHOẢN VÀ CHỤP ẢNH THEO MẪU",
        content: "Đăng nhập vào tài khoản ABBANK vừa tạo, chụp ảnh theo mẫu bên dưới rồi gửi vào phần bằng chứng.",
        img: "images/anh-abbank3.jpg"
      }
    ]
  }
};