// src/data/stories.ts

// ==============================================
// TRUYỆN CHO JOB "ĐỌC TRUYỆN – CHỌN CÁCH XỬ LÝ" (jobsData['story-choice'].stories) — nội dung hoàn toàn hư cấu.
// Popup StoryChoiceModal bốc ngẫu nhiên 1 truyện trong danh sách này → thêm / bớt / sửa truyện ngay tại đây là đủ.
// Mỗi truyện: id riêng, không trùng (lưu vào report để Admin đối chiếu) · 2–4 đoạn văn, khoảng 100–200 chữ
// · đúng 3 phương án A/B/C (bắt buộc bởi kiểu dữ liệu), mỗi phương án có đoạn kết riêng khoảng 30–50 chữ.
// ==============================================

export type StoryOptionId = 'A' | 'B' | 'C'

export interface StoryOption<Id extends StoryOptionId = StoryOptionId> {
  id: Id
  label: string   // tên phương án, VD "Chia tay ngay"
  hint: string    // 1 dòng giải thích ngắn dưới tên phương án
  ending: string  // đoạn kết chỉ hiện ra sau khi chọn phương án này
}

export interface Story {
  id: string
  title: string
  tags: string[]
  paragraphs: string[]
  options: [StoryOption<'A'>, StoryOption<'B'>, StoryOption<'C'>]
}

export const STORY_CHOICE_STORIES: Story[] = [
  {
    id: "tin-nhan-nua-dem",
    title: "Tin nhắn lúc 0 giờ 17 phút",
    tags: ["Tình yêu", "Phản bội"],
    paragraphs: [
      "Đã 0 giờ 17 phút, Linh vẫn chưa ngủ được. Bên cạnh cô, Quân ngủ say sau một ngày tăng ca. Điện thoại anh đặt trên tủ đầu giường bỗng sáng lên, dòng tin nhắn hiện rõ trên màn hình khóa: “Anh về đến nhà chưa? Tối nay em vui lắm. Nhớ xóa tin nhắn nhé.”",
      "Người gửi được lưu tên “Kỹ thuật – Hùng”. Linh chết lặng. Tối nay Quân nói anh phải ở lại công ty sửa máy chủ đến mười một giờ.",
      "Cô nhớ lại những lần anh úp điện thoại xuống bàn, những cuộc gọi phải ra ban công nghe, và mật khẩu máy anh vừa đổi tuần trước. Ba năm bên nhau, Linh chưa từng nghĩ có ngày mình phải nghi ngờ người đang nằm ngay cạnh mình.",
      "Màn hình tắt dần. Quân trở mình, tay vẫn vô thức tìm tay cô như mọi đêm."
    ],
    options: [
      {
        id: "A",
        label: "Đánh thức Quân hỏi ngay",
        hint: "Không thể chờ thêm một phút nào.",
        ending: "Quân choàng tỉnh, nhìn màn hình rồi im lặng rất lâu. Anh thừa nhận đã gặp lại người yêu cũ suốt ba tháng nay. Linh không khóc, chỉ hỏi một câu: “Anh định giấu em đến bao giờ?” Đêm đó, hai người ngồi nói chuyện đến sáng."
      },
      {
        id: "B",
        label: "Đợi sáng mai bình tĩnh hỏi",
        hint: "Giữ cái đầu lạnh trước khi nói chuyện.",
        ending: "Sáng hôm sau, Linh đặt cốc cà phê trước mặt Quân rồi hỏi về “anh Hùng kỹ thuật”. Anh lúng túng, rồi kể hết. Vì cô không làm lớn chuyện, cuộc nói chuyện diễn ra thật lòng – dù sự thật vẫn khiến cô đau."
      },
      {
        id: "C",
        label: "Lặng lẽ thu dọn rời đi",
        hint: "Không cần thêm lời giải thích nào.",
        ending: "Linh lặng lẽ xếp vài bộ quần áo vào balo, để lại chiếc chìa khóa cạnh điện thoại của Quân. Sáng ra, anh gọi cho cô hai mươi cuộc. Cô chỉ nhắn lại đúng một dòng: “Anh nhớ xóa tin nhắn nhé.”"
      }
    ]
  },

  {
    id: "nguoi-cu-truoc-ngay-cuoi",
    title: "Ba ngày trước đám cưới",
    tags: ["Tình yêu", "Drama"],
    paragraphs: [
      "Còn ba ngày nữa là cưới, Thảo vừa thử xong váy cưới thì nhận được tin nhắn từ một số lạ: “Anh về rồi. Cho anh gặp em năm phút thôi.” Cô biết ngay đó là Nam – mối tình đầu đã sang Nhật bốn năm trước mà không một lời từ biệt.",
      "Tối đó, Nam đứng chờ dưới nhà cô với một phong bì cũ. Bên trong là bức thư anh viết từ ngày đi nhưng chưa bao giờ gửi: anh ra đi vì gia đình nợ nần, không muốn kéo cô vào cảnh khổ. “Anh không xin em quay lại,” Nam nói. “Anh chỉ muốn em biết, anh chưa từng hết thương em.”",
      "Thảo cầm lá thư mà tay run. Đúng lúc ấy, điện thoại rung lên. Là Minh, chồng sắp cưới của cô: “Anh biết Nam về rồi. Em cứ nói chuyện cho rõ ràng, anh tin em. Anh vẫn đợi em ở lễ đường.”"
    ],
    options: [
      {
        id: "A",
        label: "Từ chối Nam dứt khoát",
        hint: "Quá khứ đã khép lại, Minh mới là hiện tại.",
        ending: "Thảo trả lại lá thư: “Em trân trọng những gì anh viết, nhưng người em chọn là người đã ở bên em những ngày khó khăn nhất.” Ba ngày sau, cô bước lên lễ đường, nắm tay Minh thật chặt, không ngoảnh lại."
      },
      {
        id: "B",
        label: "Hoãn cưới để suy nghĩ",
        hint: "Không bước vào hôn nhân khi lòng còn rối.",
        ending: "Thảo xin hai gia đình dời ngày cưới. Họ hàng bàn tán, mẹ cô khóc suốt một tuần. Nhưng ba tháng sau, khi lòng đã thật sự bình yên, cô biết rõ mình muốn nắm tay ai đi hết cuộc đời."
      },
      {
        id: "C",
        label: "Kể hết với Minh",
        hint: "Cùng người sắp cưới đối diện chuyện cũ.",
        ending: "Thảo đưa lá thư cho Minh đọc. Anh im lặng rất lâu rồi nói: “Cảm ơn em đã không giấu anh.” Đêm trước đám cưới, họ ngồi bên nhau, nói về những điều chưa từng nói, và hiểu nhau hơn bao giờ hết."
      }
    ]
  },

  {
    id: "ban-than-va-nguoi-yeu",
    title: "Ghế đôi suất 21 giờ",
    tags: ["Phản bội", "Tình bạn"],
    paragraphs: [
      "Vy và Trang chơi thân từ thời cấp ba, thân đến mức Vy cho bạn mượn cả tài khoản đặt vé xem phim của mình. Tối thứ Sáu, Khoa – người yêu của Vy – nói phải về quê có việc gấp.",
      "Đang nằm lướt điện thoại, Vy nhận được thông báo từ ứng dụng rạp phim: “Đặt vé thành công: ghế đôi H7, suất 21 giờ tối nay.” Người đặt là Trang, dùng chính tài khoản của cô. Tò mò, Vy bắt xe đến rạp. Dưới ánh đèn sảnh, cô thấy Trang khoác tay Khoa, cười nói như một cặp đôi thật sự.",
      "Vy đứng sau cây cột, tim đập thình thịch. Cô nhớ tuần trước Trang còn an ủi mình: “Khoa hiền lắm, mày giữ cho chặt nhé.” Hai người bước vào phòng chiếu, không hề biết có người đang lặng lẽ nhìn theo."
    ],
    options: [
      {
        id: "A",
        label: "Bước tới đối mặt ngay",
        hint: "Để cả hai không kịp chối.",
        ending: "Vy bước tới, giơ màn hình có tấm vé đặt bằng tài khoản của mình. Trang tái mặt, Khoa lắp bắp không thành câu. Vy chỉ nói: “Phim hay thì nhớ kể tao nghe,” rồi quay đi. Lần đầu tiên, cô thấy lòng nhẹ tênh."
      },
      {
        id: "B",
        label: "Cắt đứt cả hai trong im lặng",
        hint: "Không cần một lời giải thích nào.",
        ending: "Vy về nhà, đổi mật khẩu tài khoản, chặn số cả hai người. Không cãi vã, không rơi nước mắt trước mặt ai. Một tháng sau, Trang nhắn tin xin lỗi dài cả trang. Vy đọc xong, xóa đi, rồi ngủ một giấc thật ngon."
      },
      {
        id: "C",
        label: "Hẹn riêng từng người nói chuyện",
        hint: "Nghe cả hai phía trước khi kết luận.",
        ending: "Vy hẹn gặp Trang trước. Trang khóc, thú nhận hai người đã qua lại nửa năm. Hôm sau gặp Khoa, anh lại đổ hết lỗi cho Trang. Nghe xong cả hai phía, Vy hiểu: người cần rời khỏi cuộc đời cô không chỉ có một."
      }
    ]
  },

  {
    id: "khoan-chuyen-tien-bi-mat",
    title: "Năm triệu mỗi ngày mùng năm",
    tags: ["Hôn nhân", "Bí mật"],
    paragraphs: [
      "Kết hôn sáu năm, Hà luôn tự hào chồng mình là người đàn ông chu đáo. Cho đến tối hôm ấy, khi Tuấn nhờ cô chuyển tiền điện hộ bằng ứng dụng ngân hàng trên điện thoại của anh.",
      "Trong lịch sử giao dịch, Hà thấy một khoản năm triệu đồng chuyển đều đặn vào ngày mùng năm mỗi tháng, suốt bốn năm, cho một người tên Nguyễn Thị Mai. Nội dung chuyển khoản chỉ vỏn vẹn: “Gửi hai mẹ con.”",
      "Tim Hà như ngừng đập. Cô nhớ Tuấn từng kể về một mối tình cũ tên Mai, từ trước khi quen cô. Tối đó, anh vẫn vui vẻ chơi với con gái, vẫn hỏi cô cuối tuần muốn đi đâu. Hà nhìn chồng và tự hỏi: suốt bốn năm qua, người đàn ông này còn giấu cô những gì nữa?"
    ],
    options: [
      {
        id: "A",
        label: "Hỏi thẳng chồng ngay tối nay",
        hint: "Vợ chồng không nên giấu nhau điều gì.",
        ending: "Tuấn sững người rồi thú nhận: ngày chia tay, Mai đã mang thai mà không nói. Hai năm sau đám cưới, anh mới biết mình có một cậu con trai. Sợ mất gia đình, anh chọn im lặng. Hà khóc – không vì khoản tiền, mà vì bốn năm bị giấu."
      },
      {
        id: "B",
        label: "Tự tìm gặp người tên Mai",
        hint: "Nghe sự thật từ phía bên kia.",
        ending: "Qua bạn cũ của chồng, Hà tìm đến nhà Mai. Người mở cửa là một cậu bé chừng bảy tuổi, đôi mắt giống hệt Tuấn. Mai mời cô vào và kể: anh chỉ gửi tiền nuôi con, chưa từng quay lại với cô ấy. Hà ra về, lòng ngổn ngang."
      },
      {
        id: "C",
        label: "Giả vờ chưa biết, chờ anh tự nói",
        hint: "Cho chồng một cơ hội để thành thật.",
        ending: "Hà im lặng chờ đợi. Một tháng, rồi hai tháng, Tuấn vẫn không nói gì. Đến ngày mùng năm, cô thấy anh đứng ngoài ban công rất lâu, tay cầm điện thoại. Tối đó, anh ngồi xuống cạnh cô: “Em ơi, anh có chuyện phải kể.”"
      }
    ]
  },

  {
    id: "chuyen-cong-tac-khong-co-that",
    title: "Chuyến công tác không có thật",
    tags: ["Tình yêu", "Nói dối"],
    paragraphs: [
      "Huy nói anh phải đi công tác Đà Nẵng ba ngày. Đúng dịp kỷ niệm hai năm yêu nhau, Ngọc muốn tạo cho anh một bất ngờ: gửi chiếc bánh kem nhỏ đến tận khách sạn nơi đoàn công ty anh ở.",
      "Cô gọi đến số tổng đài công ty để hỏi tên khách sạn. Cô lễ tân ngập ngừng: “Dạ, anh Huy nghỉ việc ở đây từ hai tháng trước rồi chị ạ. Công ty cũng không có chuyến công tác nào tuần này.”",
      "Ngọc sững sờ. Hai tháng qua, sáng nào Huy cũng mặc sơ mi, xách cặp ra khỏi nhà đúng bảy giờ. Tối qua anh còn nhắn: “Đà Nẵng nắng lắm, nhớ em.” Cô gọi cho anh, Huy bắt máy ngay, giọng vẫn vui vẻ: “Anh đang họp, tối anh gọi lại em nhé.”"
    ],
    options: [
      {
        id: "A",
        label: "Gọi lại hỏi cho ra lẽ",
        hint: "Không chấp nhận thêm một lời nói dối.",
        ending: "Ngọc gọi lại và nói thẳng điều cô vừa biết. Đầu dây im lặng rất lâu, rồi Huy bật khóc: anh bị cắt giảm nhân sự, xấu hổ không dám nói, mấy ngày nay đang đi phỏng vấn ở Sài Gòn. Ngọc giận vì bị lừa, nhưng cũng thương anh."
      },
      {
        id: "B",
        label: "Chờ anh về rồi nói chuyện",
        hint: "Nghe lời giải thích trực tiếp, mặt đối mặt.",
        ending: "Ba ngày sau, Huy về với chiếc áo nhàu và đôi mắt thâm quầng. Ngọc đặt chiếc bánh kỷ niệm lên bàn: “Công ty bảo anh nghỉ việc rồi.” Huy ngồi sụp xuống ghế, kể hết mọi chuyện. Lần đầu tiên, anh không cần giả vờ mạnh mẽ nữa."
      },
      {
        id: "C",
        label: "Hỏi bạn thân của Huy trước",
        hint: "Biết rõ sự thật trước khi đối mặt.",
        ending: "Bạn thân của Huy thở dài kể: anh mất việc hai tháng nay, ban ngày chạy xe công nghệ, tuần này vào Sài Gòn phỏng vấn. “Nó sợ em thất vọng.” Ngọc cúp máy, lặng lẽ cất chiếc bánh vào tủ lạnh, chờ anh về."
      }
    ]
  },

  {
    id: "nam-nam-yeu-nhau",
    title: "Năm năm và một lời cầu hôn",
    tags: ["Tình yêu", "Lựa chọn"],
    paragraphs: [
      "Phương và Đức yêu nhau từ năm nhất đại học. Năm năm, họ đi qua đủ cả: phòng trọ dột, những bữa mì tôm cuối tháng, cả hai lần suýt chia tay vì ghen tuông vớ vẩn.",
      "Tuần trước, Phương nhận được thư mời làm việc ở Singapore, hợp đồng ba năm, lương gấp bốn lần hiện tại. Cô định tối nay sẽ nói với Đức. Nhưng vừa bước vào quán quen, cả quán bỗng tắt đèn. Đức quỳ xuống, tay cầm chiếc nhẫn: “Mẹ anh yếu lắm rồi, bà chỉ mong thấy anh lấy vợ. Mình cưới nhau nhé?”",
      "Mọi người xung quanh vỗ tay rần rần. Phương nhìn chiếc nhẫn, rồi nghĩ đến lá thư mời đang nằm trong túi xách. Cô biết, dù trả lời thế nào, cuộc đời hai người cũng sẽ rẽ sang một hướng khác."
    ],
    options: [
      {
        id: "A",
        label: "Nhận lời, ở lại bên anh",
        hint: "Tình yêu và gia đình đặt lên trước.",
        ending: "Phương gật đầu trong tiếng reo hò. Tối đó, cô lặng lẽ gửi thư từ chối công việc ở Singapore. Ba tháng sau đám cưới, mẹ Đức khỏe dần lên. Thỉnh thoảng nhìn ảnh bạn bè ở nước ngoài, cô vẫn chạnh lòng, nhưng chưa từng hối hận."
      },
      {
        id: "B",
        label: "Xin anh chờ thêm ba năm",
        hint: "Đi để trở về, nếu anh chịu đợi.",
        ending: "Phương đỡ Đức đứng dậy: “Cho em ba năm, rồi em về cưới anh.” Cả quán im phăng phắc. Đức buồn suốt nhiều tuần, nhưng vẫn ra sân bay tiễn cô. Những cuộc gọi video lúc nửa đêm trở thành sợi dây giữ hai người bên nhau."
      },
      {
        id: "C",
        label: "Nói thật, cùng tìm hướng khác",
        hint: "Tương lai chung thì cùng nhau quyết định.",
        ending: "Phương kéo Đức ra ngoài, đưa anh xem lá thư mời. Hai người ngồi bên nhau đến khuya. Cuối cùng, họ quyết định đăng ký kết hôn trước để mẹ anh yên lòng, rồi Phương sang Singapore, còn Đức tìm việc để sang sau."
      }
    ]
  },

  {
    id: "mam-com-ra-mat",
    title: "Mâm cơm ra mắt",
    tags: ["Gia đình", "Tình yêu"],
    paragraphs: [
      "Lần đầu Lan đưa Tú về ra mắt, anh mặc chiếc sơ mi đẹp nhất, mang theo giỏ cam quê tự tay hái. Tú mở một tiệm sửa xe nhỏ, thu nhập đủ sống nhưng chưa có nhà riêng.",
      "Bữa cơm diễn ra trong im lặng. Mẹ Lan hỏi đúng ba câu: lương bao nhiêu, nhà ở đâu, bố mẹ làm gì. Nghe xong, bà đặt đũa xuống: “Bác nói thẳng, nhà bác không gả con gái cho người phải ở trọ.”",
      "Tú vẫn lễ phép chào ra về. Đến cổng, bố Lan chạy theo, dúi vào tay anh một phong bì dày: “Cầm lấy mà làm vốn, coi như bác xin cháu buông tha cho con bé.” Tú không nhận. Tối đó, anh chỉ nhắn cho Lan một dòng: “Anh không muốn em phải chọn giữa anh và gia đình.”"
    ],
    options: [
      {
        id: "A",
        label: "Kiên quyết đến với Tú",
        hint: "Hạnh phúc của mình, mình tự quyết.",
        ending: "Lan dọn ra ở riêng, cùng Tú mở rộng tiệm sửa xe. Hai năm đầu vất vả, mẹ cô không nhắc đến tên anh. Đến khi đứa cháu đầu lòng chào đời, bà lặng lẽ đến thăm, mang theo nồi cháo và một lời xin lỗi muộn."
      },
      {
        id: "B",
        label: "Chia tay để giữ hòa khí",
        hint: "Không muốn bố mẹ phải buồn lòng.",
        ending: "Lan khóc cả đêm rồi nhắn lời chia tay. Tú chỉ đáp: “Anh hiểu.” Một năm sau, cô nghe tin tiệm sửa xe nhỏ ngày nào đã thành gara lớn nhất phố. Mẹ cô buột miệng khen anh, còn Lan chỉ lặng im."
      },
      {
        id: "C",
        label: "Cùng Tú thuyết phục bố mẹ",
        hint: "Kiên nhẫn chứng minh bằng thời gian.",
        ending: "Chủ nhật nào Tú cũng ghé sửa xe giúp cả xóm nhà Lan, không lấy tiền. Bố cô là người đầu tiên mời anh ở lại ăn cơm. Nửa năm sau, chính mẹ Lan lên tiếng hỏi: “Bao giờ hai đứa định cưới?”"
      }
    ]
  },

  {
    id: "bi-mat-sau-dinh-hon",
    title: "Chín mâm lễ và tờ giấy nợ",
    tags: ["Hôn nhân", "Drama"],
    paragraphs: [
      "Lễ đính hôn của Hằng và Phúc diễn ra linh đình. Nhà trai mang sang chín mâm lễ phủ khăn đỏ, cùng bộ trang sức vàng khiến cả xóm trầm trồ. Mẹ Hằng cười không khép được miệng.",
      "Ba hôm sau, một người đàn ông lạ tìm đến tận nhà Hằng, chìa ra tờ giấy vay tiền có chữ ký của Phúc: hai trăm triệu, lãi tính theo ngày. “Nó bảo cưới xong vợ nó sẽ trả,” người đàn ông nói rồi bỏ đi.",
      "Hằng gọi cho Phúc. Anh im lặng một lúc rồi thừa nhận: toàn bộ tiền làm lễ đều đi vay, vì anh sợ nhà cô chê nghèo, sợ cô bị họ hàng dị nghị. “Anh định cưới xong sẽ làm thêm trả dần, không để em phải lo.” Hằng nhìn bộ trang sức trên bàn, bỗng thấy nó nặng trĩu."
    ],
    options: [
      {
        id: "A",
        label: "Hủy hôn ngay",
        hint: "Không bắt đầu hôn nhân bằng nợ và dối trá.",
        ending: "Hằng trả lại sính lễ và nói lời hủy hôn. Họ hàng xôn xao suốt mấy tháng. Phúc không trách cô, chỉ nhắn: “Anh xin lỗi vì đã sai từ đầu.” Hằng buồn, nhưng cô tin mình vừa tránh được một cuộc hôn nhân bắt đầu bằng dối trá."
      },
      {
        id: "B",
        label: "Cưới như dự định, cùng trả nợ",
        hint: "Đã thương thì cùng nhau gánh vác.",
        ending: "Hằng lấy khoản tiết kiệm của mình, cùng Phúc trả bớt phần nợ lãi cao. Đám cưới vẫn diễn ra đúng hẹn. Hai năm đầu, họ chi tiêu dè sẻn từng đồng, nhưng tối nào cũng cùng nhau tính sổ, cùng nhau cười."
      },
      {
        id: "C",
        label: "Bán trang sức, cưới giản dị",
        hint: "Không cần phô trương, chỉ cần thật lòng.",
        ending: "Hằng gom bộ trang sức, cùng Phúc mang đi bán để trả hết khoản vay. Đám cưới chỉ còn năm mâm cơm thân mật. Mẹ cô phàn nàn mất mấy hôm, nhưng ngày cưới, Hằng cười tươi hơn cả hôm đính hôn."
      }
    ]
  },

  {
    id: "bang-chung-tu-nguoi-la",
    title: "Mười hai tấm ảnh từ người lạ",
    tags: ["Phản bội", "Drama"],
    paragraphs: [
      "Đang ăn trưa ở công ty, Thu nhận được tin nhắn từ một tài khoản lạ: “Chị là người yêu của anh Bảo phải không? Em nghĩ chị cần xem cái này.” Kèm theo là mười hai tấm ảnh: Bảo ôm một cô gái trẻ ở biển Vũng Tàu, ở quán cà phê, ở cả rạp chiếu phim.",
      "Thu run tay gõ lại: “Em là ai? Em muốn gì?” Cô gái trả lời ngay: “Em tên Nhi. Anh ấy nói với em là anh ấy độc thân. Hôm qua em mới biết sự thật, khi thấy ảnh hai người trên Facebook. Em không cần gì cả, chỉ không muốn chị bị lừa giống em.”",
      "Thu nhìn ngày chụp trên những tấm ảnh. Có một tấm đúng vào đêm sinh nhật cô – đêm Bảo nói phải trực ở bệnh viện vì có ca cấp cứu."
    ],
    options: [
      {
        id: "A",
        label: "Hẹn cả Bảo và Nhi gặp mặt",
        hint: "Ba mặt một lời, không ai chối được.",
        ending: "Ba người ngồi đối diện nhau trong quán cà phê. Bảo lắp bắp đổ lỗi cho Nhi đã “bám theo” mình. Nhi lặng lẽ mở đoạn ghi âm anh tỏ tình với cô tuần trước. Thu đứng dậy, trả lại chiếc nhẫn đôi, không nói thêm lời nào."
      },
      {
        id: "B",
        label: "Hỏi riêng Bảo trước",
        hint: "Nghe lời giải thích từ chính anh.",
        ending: "Tối đó, Thu đưa ảnh cho Bảo xem. Anh chối, rồi bảo ảnh ghép, rồi nói chỉ là bạn bè. Đến khi cô đọc to tin nhắn của Nhi, anh mới cúi đầu im lặng. Thu hiểu: có những lời giải thích, nghe xong chỉ càng thêm đau."
      },
      {
        id: "C",
        label: "Chia tay, không cần hỏi",
        hint: "Bằng chứng đã quá rõ ràng.",
        ending: "Thu gửi cho Bảo đúng tấm ảnh chụp đêm sinh nhật cô, kèm dòng chữ: “Ca cấp cứu này đẹp nhỉ.” Rồi cô chặn mọi liên lạc. Cuối tuần ấy, cô và Nhi – hai người xa lạ – hẹn nhau đi ăn lẩu."
      }
    ]
  },

  {
    id: "su-that-trong-qua-khu",
    title: "Bức ảnh cưới trong album cũ",
    tags: ["Bí mật", "Tình yêu"],
    paragraphs: [
      "Yêu nhau gần hai năm, Ngân chưa từng được Khải đưa về quê. Lần này anh đồng ý, vì hai người đã tính đến chuyện cưới xin.",
      "Trong lúc giúp mẹ Khải dọn tủ, Ngân làm rơi một cuốn album cũ. Trang đầu tiên là ảnh cưới: Khải mặc vest, tươi cười bên một cô dâu xinh đẹp. Ngân lặng người. Mẹ Khải nhìn bức ảnh, khẽ thở dài: “Nó chưa kể với con à? Cái Thư mất vì tai nạn, chưa đầy một năm sau đám cưới.”",
      "Tối đó, Khải ngồi ngoài hiên rất lâu. Anh nói anh sợ: sợ Ngân nghĩ mình chỉ là người thay thế, sợ phải nhắc lại khoảng thời gian tăm tối nhất đời mình. Ngân nghe mà lòng rối bời – thương anh, nhưng cũng tủi thân vì gần hai năm qua, chỉ có mình cô là không biết."
    ],
    options: [
      {
        id: "A",
        label: "Chia tay vì bị giấu quá lâu",
        hint: "Niềm tin đã sứt mẻ thì khó lành.",
        ending: "Ngân về thành phố trước một ngày. Cô nhắn cho Khải: “Em không giận vì anh từng có vợ. Em buồn vì anh không tin em đủ để kể.” Khải đọc tin nhắn ấy rất nhiều lần, nhưng không biết phải trả lời thế nào."
      },
      {
        id: "B",
        label: "Ở bên, cho anh thời gian",
        hint: "Thấu hiểu nỗi đau của người mình thương.",
        ending: "Ngân ngồi xuống cạnh Khải, nắm lấy bàn tay lạnh ngắt của anh. Cô không hỏi thêm gì. Mấy tháng sau, chính Khải kể cho cô nghe về Thư, về những năm tháng tăm tối, và lần đầu tiên anh khóc trước mặt cô."
      },
      {
        id: "C",
        label: "Cùng anh đến thăm mộ Thư",
        hint: "Đối diện quá khứ để cùng bước tiếp.",
        ending: "Sáng hôm sau, Ngân mua một bó cúc trắng, nhờ Khải đưa đến mộ Thư. Cô thắp nén nhang, khẽ nói: “Chị yên tâm, em sẽ thương anh ấy thay phần chị.” Khải đứng phía sau, lần đầu thấy lòng mình nhẹ nhõm sau bao năm."
      }
    ]
  }
]
