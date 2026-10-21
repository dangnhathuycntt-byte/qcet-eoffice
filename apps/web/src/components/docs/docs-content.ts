import type { DocGroup } from "./docs-types";

/** Nội dung tài liệu hướng dẫn (đối chiếu với mã nguồn ngày 14/10/2026; chỉ mô tả tính năng đang có). */
export const DOC_GROUPS: DocGroup[] = [
  {
    key: "bat-dau",
    title: "Bắt đầu",
    pages: [
      {
        slug: "gioi-thieu-qcet-e-office",
        title: "Giới thiệu QCET E-Office",
        description:
          "QCET E-Office là hệ thống làm việc nội bộ của Nhà trường, gồm nhiệm vụ, hộp thư, văn bản, cuộc họp và danh bạ đơn vị.",
        icon: "BookOpen",
        blocks: [
          {
            type: "p",
            text: "QCET E-Office là hệ thống làm việc nội bộ của Nhà trường. Thầy/Cô dùng hệ thống để theo dõi và xử lý nhiệm vụ, nhận thông báo trong Hộp thư, xử lý văn bản đến và đi, quản lý cuộc họp và tra cứu cơ cấu tổ chức cùng danh bạ.",
          },
          {
            type: "h2",
            text: "Các khu vực chính",
          },
          {
            type: "p",
            text: "Thanh bên bên trái liệt kê các khu vực dưới đây. Tên mục trùng với tên hiển thị trong hệ thống.",
          },
          {
            type: "ul",
            items: [
              "**Hộp thư**: mục đầu tiên của thanh bên. Thông báo gửi tới Thầy/Cô, có lọc và tìm kiếm.",
              "**Nhiệm vụ**: bảng nhiệm vụ, cùng hai mục con **Yêu cầu phối hợp** và **Mẫu và lặp lại**.",
              "**Cuộc họp**: danh sách cuộc họp theo giai đoạn **Sắp diễn ra** và **Đã họp**. Bấm một cuộc họp để mở chi tiết.",
              "**Văn bản**: **Văn bản đến**, **Văn bản đi**, **Tờ trình nội bộ** và **Hồ sơ công việc**.",
              "**Đơn vị**: **Cơ cấu & Danh bạ** và **Báo cáo** (số liệu văn bản trong phạm vi được xem).",
              "**Thêm**: mở menu gồm **Ủy quyền tác nghiệp**, **Tìm kiếm**, **Cài đặt hệ thống** và **Tài liệu hướng dẫn**. Tài khoản quản trị hệ thống thấy thêm nhóm **Quản trị**: **Tài khoản và vai trò**, **Nhật ký hệ thống**, **Hồ sơ chờ xóa hẳn**.",
            ],
          },
          {
            type: "h2",
            text: "Trên máy tính và điện thoại",
          },
          {
            type: "p",
            text: "Trên máy tính, thanh bên nằm bên trái và có thể thu gọn bằng `Ctrl` + `B` hoặc `⌘` + `B`. Trên điện thoại, thanh bên không hiện; các mục nằm trong ngăn menu mở bằng nút menu ở đầu trang, với cùng các nhóm mục.",
          },
          {
            type: "p",
            text: "Thầy/Cô cũng có thể thêm QCET E-Office vào màn hình chính điện thoại. Xem bài **Cài ứng dụng trên điện thoại** trong nhóm Bắt đầu.",
          },
          {
            type: "h2",
            text: "Bắt đầu từ đâu",
          },
          {
            type: "p",
            text: "Thầy/Cô nên đọc bài **Đăng nhập** để vào hệ thống bằng tài khoản Google của trường, rồi đọc bài **Làm quen giao diện** để nắm thanh bên, Hộp thư, tìm kiếm nhanh và phím tắt.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Gặp sự cố khi đăng nhập hoặc sử dụng, Thầy/Cô liên hệ hotro@cdktcnqn.edu.vn.",
          },
        ],
      },
      {
        slug: "dang-nhap",
        title: "Đăng nhập",
        description:
          "Đăng nhập bằng tài khoản Google của nhà trường, xử lý khi chưa được cấp quyền và cách phiên đăng nhập hoạt động.",
        icon: "LogIn",
        blocks: [
          {
            type: "p",
            text: "QCET E-Office chỉ nhận tài khoản Google thuộc miền @cdktcnqn.edu.vn, và tài khoản đó phải đã được cấp quyền trong hệ thống. Trang đăng nhập có tiêu đề **Đăng nhập** và dòng mô tả **Dùng tài khoản Google của nhà trường**.",
          },
          {
            type: "h2",
            text: "Đăng nhập lần đầu",
          },
          {
            type: "ol",
            items: [
              "Mở địa chỉ QCET E-Office trên trình duyệt. Khi chưa đăng nhập, hệ thống đưa Thầy/Cô tới trang **Đăng nhập**.",
              "Bấm **Đăng nhập bằng Google**.",
              "Chọn tài khoản @cdktcnqn.edu.vn rồi xác nhận trên màn hình Google.",
              "Khi đăng nhập xong, hệ thống mở lại trang Thầy/Cô định xem trước đó. Nếu không có, hệ thống mở **Nhiệm vụ**.",
            ],
          },
          {
            type: "p",
            text: "Nếu chọn tài khoản không thuộc miền trường, trang sẽ báo **Tài khoản này không thuộc @cdktcnqn.edu.vn** kèm liên kết **Chọn tài khoản khác**.",
          },
          {
            type: "p",
            text: "Lần sau, nếu trình duyệt còn nhớ tài khoản vừa dùng, trang hiện **Chào mừng quay lại** kèm thẻ tài khoản đó. Bấm thẻ để đăng nhập lại, hoặc bấm **Dùng tài khoản khác** để chọn tài khoản khác.",
          },
          {
            type: "h2",
            text: "Khi chưa được cấp quyền",
          },
          {
            type: "p",
            text: "Tài khoản đúng miền nhưng chưa có trong hệ thống sẽ thấy màn hình **Chưa được cấp quyền**. Thầy/Cô làm như sau:",
          },
          {
            type: "ol",
            items: [
              "Bấm **Gửi yêu cầu cấp quyền**. Yêu cầu chỉ gửi kèm email của Thầy/Cô.",
              "Chờ phản hồi. Sau khi gửi, màn hình hiện **Đã gửi yêu cầu** và dòng **Quản trị viên sẽ xem và báo qua email**.",
            ],
          },
          {
            type: "p",
            text: "Nếu đăng nhập nhầm tài khoản, bấm **Dùng tài khoản khác**. Ở màn hình **Đã gửi yêu cầu**, bấm **Quay lại đăng nhập** để về trang đăng nhập.",
          },
          {
            type: "h2",
            text: "Thông báo thường gặp",
          },
          {
            type: "ul",
            items: [
              "**Tài khoản đã bị khóa**: màn hình ghi tài khoản không còn dùng được QCET E-Office. Nếu đây là nhầm lẫn, bấm **liên hệ hỗ trợ** (hotro@cdktcnqn.edu.vn).",
              "**Chưa kết nối được Google**: kiểm tra mạng rồi bấm **Thử lại**.",
              "**Mở bằng trình duyệt**: khi mở trong ứng dụng chat hoặc mạng xã hội như Zalo, Facebook, Google không cho đăng nhập. Bấm **Sao chép liên kết** rồi dán vào Chrome hoặc Safari.",
            ],
          },
          {
            type: "h2",
            text: "Phiên đăng nhập và đăng xuất",
          },
          {
            type: "p",
            text: "Phiên đăng nhập có thời hạn 30 ngày. Khi phiên hết hạn, hệ thống đưa Thầy/Cô về trang đăng nhập và mở lại trang đang xem sau khi đăng nhập.",
          },
          {
            type: "p",
            text: "Khi máy chủ không xác nhận được phiên nhưng trình duyệt còn lưu thông tin đăng nhập cũ, menu tài khoản hiện dòng **Chế độ chỉ xem từ bộ nhớ tạm** và không cho sửa dữ liệu. Khi thấy dòng này, Thầy/Cô nên đăng nhập lại.",
          },
          {
            type: "p",
            text: "Để đăng xuất:",
          },
          {
            type: "ol",
            items: [
              "Bấm tên của Thầy/Cô ở đầu thanh bên để mở menu tài khoản.",
              "Chọn **Đăng xuất**.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Trên máy dùng chung, Thầy/Cô nhớ đăng xuất trước khi rời máy.",
          },
        ],
      },
      {
        slug: "lam-quen-giao-dien",
        title: "Làm quen giao diện",
        description:
          "Thanh bên, menu tài khoản, Hộp thư, tìm kiếm nhanh và các phím tắt đang có trong QCET E-Office.",
        icon: "LayoutDashboard",
        blocks: [
          {
            type: "h2",
            text: "Thanh bên",
          },
          {
            type: "p",
            text: "Thanh bên nằm bên trái trên máy tính. Mục đang mở được tô nền. Mục có mũi tên, như **Nhiệm vụ** hoặc **Văn bản đến**, có các mục con; bấm mũi tên bên phải để thu gọn hoặc mở lại. Nhóm **Văn bản** và **Đơn vị** cũng thu gọn được khi bấm tên nhóm.",
          },
          {
            type: "p",
            text: "Khi thu gọn, thanh bên chỉ còn biểu tượng; rê chuột vào biểu tượng để xem tên mục. Mục **Tờ trình nội bộ** chỉ hiện thêm **Báo cáo thời gian duyệt** khi tài khoản được phép xem báo cáo này. Mục **Thêm** ở cuối thanh bên mở một menu các trang ít dùng; trên điện thoại, mục này mở rộng ngay trong danh sách.",
          },
          {
            type: "h2",
            text: "Menu tài khoản",
          },
          {
            type: "p",
            text: "Bấm tên và ảnh đại diện ở đầu thanh bên. Menu hiện email của Thầy/Cô và các mục:",
          },
          {
            type: "ul",
            items: [
              "**Hồ sơ cá nhân**: mở hộp hồ sơ cá nhân.",
              "**Cài đặt hệ thống**: mở trang cài đặt.",
              "**Tài liệu hướng dẫn**: mở trang tài liệu này.",
              "**Cài ứng dụng trên điện thoại**: mở hướng dẫn cài QCET E-Office lên điện thoại.",
              "**Đăng xuất**: thoát khỏi hệ thống.",
            ],
          },
          {
            type: "h2",
            text: "Hộp thư",
          },
          {
            type: "p",
            text: "**Hộp thư** gom thông báo gửi tới Thầy/Cô:",
          },
          {
            type: "ul",
            items: [
              "Biểu tượng **Tùy chọn** cạnh tiêu đề có **Đánh dấu tất cả đã đọc** và **Làm mới**.",
              "Biểu tượng **Lọc** mở mục **Chỉ chưa đọc** và các nhóm **Tất cả**, **Việc cần làm**, **Nhắc hạn**.",
              "Biểu tượng tìm kiếm mở ô **Tìm kiếm thông báo**. Khi con trỏ đang ở trong Hộp thư, nhấn `Ctrl` + `F` hoặc `⌘` + `F` để mở ô tìm. Nhấn `Esc` khi ô tìm trống để đóng.",
              "Trên màn hình hẹp, chọn một thông báo sẽ mở chi tiết. Nhấn `Esc` hoặc bấm **Quay lại hộp thư** để về danh sách.",
            ],
          },
          {
            type: "h2",
            text: "Tìm kiếm nhanh",
          },
          {
            type: "p",
            text: "Bấm `Ctrl` + `K` hoặc `⌘` + `K` để mở **Tìm kiếm nhanh hệ thống**. Gõ tên nhiệm vụ, mã số, tên văn bản, viết tắt khoa như cntt, hoặc họ tên cán bộ. Kết quả chia theo nhóm **Đi tới**, **Nhiệm vụ**, **Văn bản**, **Cán bộ** và **Hành động**; nút **Tất cả** hiện mọi nhóm.",
          },
          {
            type: "ul",
            items: [
              "`↑` và `↓` để chọn kết quả, `Enter` để mở.",
              "`Ctrl` + `Enter` hoặc `⌘` + `Enter` để mở trong tab mới.",
              "`Esc` để đóng.",
            ],
          },
          {
            type: "h2",
            text: "Phím tắt",
          },
          {
            type: "p",
            text: "Phím tắt không chạy khi con trỏ đang nằm trong ô nhập liệu. Bấm `?` (hoặc `Ctrl` + `/`, `⌘` + `/`) để mở bảng **Phím tắt bàn phím**.",
          },
          {
            type: "ul",
            items: [
              "`Ctrl` + `B` hoặc `⌘` + `B`: thu gọn hoặc mở rộng thanh bên.",
              "`1`, `2`, `3`, `5`: mở lần lượt **Hộp thư**, **Nhiệm vụ**, **Cuộc họp**, **Cơ cấu & Danh bạ**. Phím `4` hiện không chuyển trang.",
              "`C`: mở hộp tạo nhiệm vụ mới trên trang **Nhiệm vụ**. Nhấn `N` rồi `P` liền nhau cũng mở hộp này.",
              "`Esc`: đóng hộp thoại hoặc bảng đang mở.",
            ],
          },
          {
            type: "h3",
            text: "Trong bảng nhiệm vụ",
          },
          {
            type: "ul",
            items: [
              "`J` hoặc `↓`, `K` hoặc `↑`: chuyển dòng đang chọn.",
              "`Space`: xem nhanh nhiệm vụ đang được rê chuột tới, hoặc dòng đang chọn bằng bàn phím.",
              "`Enter`: mở chi tiết nhiệm vụ.",
              "`X`: chọn hoặc bỏ chọn dòng.",
              "`/`: đưa con trỏ vào ô tìm trong bảng.",
              "`Esc`: bỏ chọn các dòng đang chọn.",
              "Khi menu thao tác của một dòng đang mở (chuột phải, phím **Menu**, hoặc `Shift` + `F10` khi con trỏ ở dòng đó): `S` mở **Đổi trạng thái**, `P` mở **Đặt độ ưu tiên**, `A` mở **Gán người chủ trì**, `D` mở **Đổi hạn hoàn thành** khi tài khoản được phép đổi hạn.",
            ],
          },
        ],
      },
      {
        slug: "cai-ung-dung-tren-dien-thoai",
        title: "Cài ứng dụng trên điện thoại",
        description:
          "Thêm QCET E-Office vào màn hình chính điện thoại để mở nhanh như một ứng dụng và nhận thông báo khi có việc mới.",
        icon: "Smartphone",
        blocks: [
          {
            type: "p",
            text: "Thầy/Cô có thể thêm QCET E-Office vào màn hình chính của điện thoại. Sau khi cài, ứng dụng mở nhanh như một ứng dụng riêng và có thể bật thông báo chuông khi có việc mới. Cách cài khác nhau tùy loại điện thoại.",
          },
          {
            type: "h2",
            text: "Trên iPhone",
          },
          {
            type: "p",
            text: "Thực hiện bằng Safari:",
          },
          {
            type: "ol",
            items: [
              "Mở QCET E-Office bằng **Safari** và đăng nhập.",
              "Nhấn **Chia sẻ**. Không thấy thì nhấn **Thêm** trước.",
              "Chọn **Thêm vào MH chính**, giữ bật mở dưới dạng ứng dụng web, rồi nhấn **Thêm**.",
              "Mở QCET E-Office từ màn hình chính, đăng nhập lại một lần để nhận thông báo.",
            ],
          },
          {
            type: "p",
            text: "Nếu đã đóng hộp hướng dẫn, mở ngăn menu bằng nút menu ở đầu trang, rồi chọn **Hướng dẫn cài đặt iOS** để xem lại các bước. Mục này chỉ hiện trên iPhone khi ứng dụng chưa được mở từ màn hình chính.",
          },
          {
            type: "h2",
            text: "Trên Android",
          },
          {
            type: "ol",
            items: [
              "Mở QCET E-Office bằng **Chrome**.",
              "Nhấn **Menu** ở góc trên bên phải.",
              "Chọn **Cài đặt ứng dụng** (hoặc **Thêm vào màn hình chính**), rồi xác nhận.",
            ],
          },
          {
            type: "p",
            text: "Khi trình duyệt cho phép cài, ngăn menu của ứng dụng có mục **Cài đặt lên màn hình chính** để cài ngay.",
          },
          {
            type: "h2",
            text: "Cài từ máy tính",
          },
          {
            type: "p",
            text: "Trên máy tính, mở menu tài khoản ở đầu thanh bên và chọn **Cài ứng dụng trên điện thoại**. Hộp hiện mã QR và địa chỉ để mở trên điện thoại; dùng camera điện thoại để quét mã. Sau đó mở QCET E-Office trên điện thoại và làm theo các bước ở trên.",
          },
          {
            type: "p",
            text: "Nếu trình duyệt trên máy tính cho phép cài, hộp còn có nút **Cài trên máy này**.",
          },
          {
            type: "h2",
            text: "Thanh nhắc cài đặt",
          },
          {
            type: "p",
            text: "Từ lần dùng thứ hai trở đi, nếu QCET E-Office chưa được cài, thanh **Cài đặt QCET E-Office** có thể hiện ở cuối màn hình. Bấm **Cài đặt ngay** để cài, hoặc **Để sau** để ẩn. Sau khi bấm **Để sau**, thanh sẽ không hiện lại trong 7 ngày.",
          },
          {
            type: "h2",
            text: "Lưu ý",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Trên iPhone, ứng dụng ở màn hình chính có bộ nhớ riêng, nên Thầy/Cô cần đăng nhập lại một lần sau khi mở từ màn hình chính.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Google không cho đăng nhập trong ứng dụng chat hoặc mạng xã hội. Hãy mở địa chỉ bằng Safari hoặc Chrome trước khi cài.",
          },
          {
            type: "p",
            text: "Khi mở hộp cài đặt từ chính ứng dụng đã cài, hộp chỉ báo **Bạn đang dùng ứng dụng đã cài**.",
          },
        ],
      },
    ],
  },
  {
    key: "nhiem-vu",
    title: "Nhiệm vụ",
    pages: [
      {
        slug: "tao-nhiem-vu",
        title: "Tạo nhiệm vụ",
        description:
          "Tạo nhiệm vụ mới với tên, chủ trì, hạn hoàn thành và các thông tin tùy chọn.",
        icon: "PenLine",
        blocks: [
          {
            type: "p",
            text: "Nhiệm vụ là một đầu việc có người chủ trì, hạn hoàn thành và kết quả cần đạt. Thầy/Cô tạo nhiệm vụ mới bằng nút **Tạo việc** trên thanh công cụ của trang Nhiệm vụ, hoặc nhấn phím `C`. Gõ `N` rồi `P` liền nhau trong vòng nửa giây, hoặc giữ `N` và nhấn `P`, cũng mở được hộp tạo. Nút chỉ hiện với tài khoản có quyền tạo nhiệm vụ.",
          },
          {
            type: "h2",
            text: "Các trường trong hộp tạo",
          },
          {
            type: "ul",
            items: [
              "**Tên nhiệm vụ**: bắt buộc, ít nhất 3 ký tự, tối đa 255 ký tự. Từ 200 ký tự trở lên, hộp hiện bộ đếm dạng số/255 ký tự.",
              "**Mô tả**: ô soạn lớn dưới tên, gợi ý nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu. Không bắt buộc.",
              "**Mức ưu tiên**: Khẩn cấp, Cao, Bình thường (mặc định) hoặc Thấp.",
              "**Chủ trì**: bắt buộc. Chọn người trong danh sách của đơn vị. Ô tìm theo tên hoặc email, gõ không dấu vẫn ra kết quả.",
              "**Bắt đầu** và **Hạn hoàn thành**: hạn là bắt buộc. Ngày bắt đầu không được sau hạn hoàn thành.",
              "**Văn bản nguồn**: gắn nhiệm vụ với một văn bản đến chưa gắn nhiệm vụ khác. Mục này không hiện khi tạo việc con. Văn bản đã hoàn thành hoặc đã lưu theo dõi không được chọn.",
              "**Đơn vị**: hiện ở đầu hộp, cạnh biểu tượng tòa nhà, khi tài khoản có nhiều đơn vị để chọn. Đổi đơn vị sẽ xóa người chủ trì đã chọn.",
            ],
          },
          {
            type: "h2",
            text: "Tạo nhiệm vụ từng bước",
          },
          {
            type: "ol",
            items: [
              "Nhập **Tên nhiệm vụ**. Nhấn `Enter` để chuyển xuống phần mô tả; phím này không gửi biểu mẫu.",
              "Chọn **Chủ trì** và **Hạn hoàn thành**. Chỉnh **Mức ưu tiên**, **Bắt đầu** hoặc **Văn bản nguồn** nếu cần.",
              "Bấm **Tạo nhiệm vụ**, hoặc nhấn `Ctrl` + `Enter` (trên Mac là `⌘` + `Enter`).",
            ],
          },
          {
            type: "p",
            text: "Khi tạo xong, hộp đóng lại và danh sách được làm mới. Nút **Tạo nhiệm vụ** chỉ bấm được khi đã nhập tên. Trong lúc gửi, nút hiện **Đang tạo…**.",
          },
          {
            type: "p",
            text: "Khi tạo việc con từ trang chi tiết nhiệm vụ cha, hộp có tiêu đề **Giao việc con**, ô tên hiện **Tên việc con** và nút gửi là **Giao việc con**.",
          },
          {
            type: "h2",
            text: "Nháp và lỗi khi gửi",
          },
          {
            type: "ul",
            items: [
              "Nội dung đang soạn được lưu tạm trong phiên trình duyệt hiện tại. Khi mở lại hộp, nếu có bản nháp, hộp báo **Đã tự động khôi phục bản nháp chưa lưu từ phiên làm việc trước** và có liên kết **Xóa bản nháp**.",
              "Đóng hộp bằng `Esc`, nút đóng hoặc bấm ra ngoài sẽ bỏ luôn nội dung đang soạn.",
              "Nếu máy chủ chưa xác nhận được kết quả, hộp giữ nguyên nội dung và báo có thể thử lại an toàn.",
            ],
          },
          {
            type: "callout",
            tone: "info",
            text: "Khi bấm gửi mà thiếu **Chủ trì** hoặc **Hạn hoàn thành**, hai ô đó đổi màu đỏ và con trỏ được đưa tới ô lỗi đầu tiên. Tên dưới 3 ký tự hoặc ngày bắt đầu sau hạn hoàn thành được báo bằng chữ ngay dưới ô.",
          },
        ],
      },
      {
        slug: "chu-tri-phoi-hop-va-viec-con",
        title: "Chủ trì, phối hợp và việc con",
        description:
          "Hiểu vai trò chủ trì và phối hợp của một nhiệm vụ, và cách chia nhiệm vụ thành việc con.",
        icon: "Users",
        blocks: [
          {
            type: "p",
            text: "Mỗi nhiệm vụ có một người chủ trì, chịu trách nhiệm chính cho việc thực hiện. Nhiệm vụ lớn có thể chia thành các việc con. Người chủ trì của các việc con sẽ hiện trong mục Phối hợp của nhiệm vụ cha.",
          },
          {
            type: "h2",
            text: "Chủ trì",
          },
          {
            type: "p",
            text: "Hộp tạo nhiệm vụ gọi người này là **Chủ trì**. Trên trang chi tiết, hàng **Phụ trách** trong khối **Thuộc tính** là cùng một người. Khi tài khoản có quyền đổi người phụ trách, Thầy/Cô bấm hàng **Phụ trách** để chọn người khác. Tài khoản không có quyền thì hàng này không chọn được.",
          },
          {
            type: "h2",
            text: "Phối hợp",
          },
          {
            type: "p",
            text: "Hàng **Phối hợp** chỉ để xem, không chọn trực tiếp được. Hệ thống gom người chủ trì của các việc con đang hoạt động, mỗi người một lần, và bỏ người phụ trách chính đã hiện ở hàng **Phụ trách**. Muốn thêm người phối hợp, Thầy/Cô tạo một việc con và giao cho người đó làm chủ trì của việc con.",
          },
          {
            type: "h2",
            text: "Việc con",
          },
          {
            type: "p",
            text: "Việc con là nhiệm vụ nhỏ thuộc một nhiệm vụ cha. Mục **Việc con** trong khối Thuộc tính hiện số việc con và phần trăm đã hoàn thành.",
          },
          {
            type: "ol",
            items: [
              "Mở nhiệm vụ cha tại trang chi tiết.",
              "Bấm **Thêm** ở mục **Việc con**. Nút có chú thích Tạo việc con.",
              "Trong hộp **Giao việc con**, nhập **Tên việc con**, chọn **Chủ trì** và **Hạn hoàn thành**, rồi bấm **Giao việc con**.",
            ],
          },
          {
            type: "ul",
            items: [
              "Hạn của việc con không được muộn hơn hạn của nhiệm vụ cha. Nếu sai, ô hạn báo đỏ và thông báo nêu ngày hạn của nhiệm vụ cha.",
              "Việc con không có mục **Văn bản nguồn**.",
              "Khi nhiệm vụ có việc con, tiến độ của cha được tính tự động theo tỷ lệ việc con đã hoàn thành, nên nút **Cập nhật** trong khối **Tiến độ mới nhất** không còn hiện.",
              "Việc con đã hủy không được tính vào tổng.",
              "Khi mọi việc con hoàn thành, nhiệm vụ cha đang ở **Mới** hoặc **Đang thực hiện** sẽ chuyển sang **Chờ duyệt**.",
            ],
          },
          {
            type: "callout",
            tone: "info",
            text: "Người phối hợp phải thuộc đơn vị chủ trì của nhiệm vụ. Để có người của đơn vị khác, Thầy/Cô dùng khối **Phối hợp liên đơn vị** thay vì giao việc con trực tiếp. Lãnh đạo trường và người được ủy quyền giao việc là ngoại lệ.",
          },
        ],
      },
      {
        slug: "tien-do-minh-chung-va-phe-duyet",
        title: "Tiến độ, minh chứng và phê duyệt",
        description:
          "Cập nhật tiến độ, nộp minh chứng và đưa nhiệm vụ qua bước nghiệm thu đến khi hoàn thành.",
        icon: "CheckSquare",
        blocks: [
          {
            type: "p",
            text: "Các bước dưới đây đưa một nhiệm vụ từ lúc đang làm đến khi được nghiệm thu.",
          },
          {
            type: "h2",
            text: "Trạng thái nhiệm vụ",
          },
          {
            type: "ul",
            items: [
              "**Mới**: nhiệm vụ chưa bắt đầu.",
              "**Đang thực hiện**: nhiệm vụ đã bắt đầu hoặc đã có tiến độ.",
              "**Chờ duyệt**: nhiệm vụ đã được gửi nghiệm thu.",
              "**Hoàn thành**: nhiệm vụ đã được phê duyệt.",
              "**Đã hủy**: nhiệm vụ đã bị hủy.",
            ],
          },
          {
            type: "p",
            text: "Thầy/Cô đổi trạng thái bằng hàng **Trạng thái** trong khối Thuộc tính. Menu này có bốn lựa chọn: **Mới**, **Đang thực hiện**, **Chờ duyệt** và **Hoàn thành**. Lựa chọn không hợp lệ với trạng thái hiện tại bị khóa, và rê chuột vào lựa chọn để xem lý do. Nhiệm vụ đang thực hiện không chuyển thẳng sang Hoàn thành. Nhiệm vụ đã **Hoàn thành** hoặc **Đã hủy** chỉ mở lại về **Đang thực hiện**, và chỉ Ban Giám hiệu hoặc Quản trị viên làm được việc đó.",
          },
          {
            type: "h2",
            text: "Cập nhật tiến độ",
          },
          {
            type: "p",
            text: "Trong khối **Tiến độ mới nhất**, bấm **Cập nhật** rồi chọn mốc 0%, 25%, 50%, 75% hoặc 100%, hoặc nhập số chính xác. Nút này không hiện khi nhiệm vụ có việc con, vì tiến độ khi đó được tính tự động.",
          },
          {
            type: "ol",
            items: [
              "Bấm **Cập nhật**.",
              "Chọn mốc hoặc nhập phần trăm trong ô số.",
              "Ghi chú vào ô ghi chú nếu cần.",
              "Bấm **Lưu tiến độ**, hoặc bấm **Hủy** để bỏ thay đổi.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Lưu 100% sẽ gửi nhiệm vụ sang Chờ duyệt. Tiến độ không tự đưa nhiệm vụ sang Hoàn thành; việc này do người duyệt quyết định.",
          },
          {
            type: "h2",
            text: "Minh chứng",
          },
          {
            type: "p",
            text: "Minh chứng là tài liệu hoặc liên kết thể hiện kết quả của nhiệm vụ. Khi đã có minh chứng, mục **Minh chứng** hiện thành khối trên trang; khi chưa có, mục nằm trong menu **+ Thêm**. Chỉ người có quyền nộp kết quả mới thấy nút **Thêm**.",
          },
          {
            type: "ol",
            items: [
              "Bấm **Thêm**.",
              "Nhập **Tên minh chứng** và **Liên kết tệp** (dạng https://…).",
              "Bấm **Nộp**. Nút này chỉ bấm được khi đã điền đủ hai ô.",
            ],
          },
          {
            type: "p",
            text: "Mỗi minh chứng là một dòng có tên và liên kết để mở. Để gỡ minh chứng, bấm nút **Xóa minh chứng** cạnh dòng đó, rồi xác nhận trong hộp **Xóa minh chứng?**.",
          },
          {
            type: "h2",
            text: "Duyệt nghiệm thu",
          },
          {
            type: "p",
            text: "Người có quyền duyệt xử lý nhiệm vụ chờ duyệt trong **Hộp việc xử lý** trên trang Nhiệm vụ. Nhãn nút ở mỗi dòng theo phạm vi đang xử lý: **Phê duyệt** (Toàn trường), **Thẩm định L1** (Đơn vị) hoặc **Thẩm định** (Cá nhân). Bấm nút để mở hộp quyết định gồm ba lựa chọn:",
          },
          {
            type: "ul",
            items: [
              "**Phê duyệt đạt yêu cầu**: nhiệm vụ chuyển sang Hoàn thành. Nếu còn tiêu chí chưa đạt, hệ thống hỏi xác nhận trước khi duyệt.",
              "**Yêu cầu chỉnh sửa**: nhiệm vụ quay về Đang thực hiện. Cần nêu lý do ít nhất 5 ký tự.",
              "**Không phê duyệt / Từ chối**: cần nêu lý do ít nhất 5 ký tự.",
            ],
          },
          {
            type: "p",
            text: "Người đã tạo nhiệm vụ, là chủ trì, thành viên thực hiện hoặc người nộp minh chứng không được tự duyệt. Nhiệm vụ cấp trường do Ban Giám hiệu hoặc Quản trị viên duyệt. Nhiệm vụ của đơn vị do trưởng đơn vị có thẩm quyền trên đơn vị đó duyệt.",
          },
          {
            type: "p",
            text: "Khi nhiệm vụ chờ duyệt đã đủ 96 giờ, người duyệt dự phòng (nếu đã được cử) có thể duyệt thay. Khi đó khối **Người duyệt dự phòng** ghi **Đang duyệt thay**.",
          },
        ],
      },
      {
        slug: "xem-va-loc-danh-sach",
        title: "Xem và lọc danh sách",
        description:
          "Chế độ xem, bộ lọc, tìm kiếm, sắp xếp, nhóm, cột và phím tắt trên trang Nhiệm vụ.",
        icon: "Filter",
        blocks: [
          {
            type: "p",
            text: "Trang Nhiệm vụ gom các việc Thầy/Cô được xem vào một danh sách. Bạn đổi chế độ xem, lọc theo nhiều tiêu chí và tìm kiếm, rồi sắp xếp hoặc nhóm kết quả.",
          },
          {
            type: "h2",
            text: "Chế độ xem",
          },
          {
            type: "p",
            text: "Phía trên danh sách có bốn chế độ xem: **Tất cả**, **Đang thực hiện**, **Trễ hạn** và **Hoàn thành**. Trên máy tính, các chế độ hiện thành dãy nút. Trên điện thoại, chế độ đang chọn hiện thành một nút, bấm để chọn chế độ khác.",
          },
          {
            type: "ul",
            items: [
              "**Đang thực hiện**: nhiệm vụ chưa hoàn thành, chưa hủy và chưa trễ hạn.",
              "**Trễ hạn**: nhiệm vụ chưa hoàn thành và chưa hủy, có hạn đã qua. Ngày hiện tại được tính theo múi giờ Việt Nam.",
              "**Hoàn thành**: nhiệm vụ đã hoàn thành.",
            ],
          },
          {
            type: "p",
            text: "Nếu địa chỉ trang đã mang sẵn bộ lọc, ví dụ khi mở từ một liên kết khác, trang tự dùng chế độ Tất cả để không che mất kết quả.",
          },
          {
            type: "h2",
            text: "Bộ lọc và tìm kiếm",
          },
          {
            type: "p",
            text: "Nhấn nút lọc trên thanh công cụ để mở menu **Bộ lọc**, gồm các nhóm sau:",
          },
          {
            type: "ul",
            items: [
              "**Trạng thái**: Mới, Đang thực hiện, Cần tôi duyệt (vai trò quản lý, như Ban Giám hiệu) hoặc Cần chỉnh sửa (các vai trò khác), Hoàn thành.",
              "**Mức ưu tiên**: Khẩn cấp, Cao, Bình thường, Thấp.",
              "**Người chủ trì** và **Người phối hợp**: chọn **Tôi**, **Chưa có người chủ trì** hoặc **Không có người phối hợp**, hoặc chọn tên người trong danh sách.",
              "**Mốc thời gian**: Trễ hạn, Đến hạn hôm nay, Trong tuần này; hoặc **Kỳ tháng** để chọn một tháng cụ thể, hoặc **Chọn ngày khác**.",
              "**Tiến độ**: Đúng tiến độ, Sắp tới hạn (≤ 7 ngày), Trễ hạn, Hoàn thành.",
            ],
          },
          {
            type: "p",
            text: "Khi có dữ liệu, mỗi lựa chọn hiện số nhiệm vụ tương ứng. Khi đang có bộ lọc, **Xóa bộ lọc** bỏ các bộ lọc đang chọn. Ô **Tìm nhiệm vụ…** (bấm biểu tượng kính lúp hoặc nhấn `/`) tìm theo tên, mô tả, người chủ trì, đơn vị và việc con.",
          },
          {
            type: "h2",
            text: "Sắp xếp, nhóm và cột",
          },
          {
            type: "ul",
            items: [
              "Bấm tiêu đề cột **Tiêu đề**, **Ưu tiên**, **Phụ trách**, **Đơn vị**, **Hạn** hoặc **Trạng thái** để sắp xếp.",
              "Mở **Tùy chọn hiển thị** rồi chọn **Sắp xếp** theo Hạn, Ưu tiên, Trạng thái hoặc Tên. Nút **Đổi chiều sắp xếp** đảo thứ tự tăng hoặc giảm.",
              "**Nhóm theo** có Không nhóm, Đơn vị, Ưu tiên hoặc Trạng thái.",
              "Trong **Tùy chọn hiển thị** cũng bật hoặc tắt các cột Mã, Việc con, Danh mục, Phối hợp, Bắt đầu và Ngày tạo, và chọn **Mật độ dòng** Gọn hoặc Thoải mái.",
              "Nút **Xuất Excel** xuất dữ liệu của danh sách.",
            ],
          },
          {
            type: "h2",
            text: "Phím tắt trong danh sách",
          },
          {
            type: "p",
            text: "Phím tắt không hoạt động khi con trỏ đang nằm trong ô nhập liệu.",
          },
          {
            type: "ul",
            items: [
              "`J` và `K`, hoặc phím mũi tên Lên và Xuống: di chuyển giữa các dòng.",
              "`Space`: xem nhanh dòng hiện tại. `Enter`: mở chi tiết toàn màn hình.",
              "`X`: chọn hoặc bỏ chọn dòng, đồng thời mở thanh thao tác hàng loạt.",
              "`/`: đưa con trỏ vào ô tìm nhanh. `C`: tạo nhiệm vụ mới.",
              "`Esc`: đóng hộp hoặc bỏ chọn.",
            ],
          },
        ],
      },
      {
        slug: "yeu-cau-phoi-hop",
        title: "Yêu cầu phối hợp",
        description:
          "Đề nghị đơn vị khác cử người phối hợp, và cách trưởng đơn vị trả lời yêu cầu gửi đến.",
        icon: "Handshake",
        blocks: [
          {
            type: "p",
            text: "Người phối hợp của một nhiệm vụ phải thuộc đơn vị chủ trì. Khi cần người của đơn vị khác, người giao việc gửi đề nghị cho đơn vị đó. Trưởng đơn vị được đề nghị sẽ cử người hoặc từ chối kèm lý do.",
          },
          {
            type: "h2",
            text: "Gửi đề nghị phối hợp",
          },
          {
            type: "ol",
            items: [
              "Mở nhiệm vụ tại trang chi tiết và tìm khối **Phối hợp liên đơn vị**.",
              "Bấm **Đề nghị đơn vị khác phối hợp**.",
              "Chọn **Đơn vị được đề nghị**, chọn **Hạn trả lời** (Trả lời trong 1, 3, 5 hoặc 7 ngày; mặc định là 3 ngày) và nhập **Nội dung đề nghị** nếu cần.",
              "Bấm **Gửi đề nghị**.",
            ],
          },
          {
            type: "ul",
            items: [
              "Mỗi nhiệm vụ chỉ có một yêu cầu đang chờ cho một đơn vị.",
              "Các trạng thái của yêu cầu: **Chờ trả lời**, **Đã cử người**, **Bị từ chối** và **Đã rút lại**.",
              "Khi yêu cầu còn ở **Chờ trả lời**, người đã gửi đề nghị bấm **Rút lại** để hủy yêu cầu.",
              "Không gửi đề nghị cho nhiệm vụ đã hoàn thành, đã hủy hoặc đã lưu trữ. Nút đề nghị chỉ hiện với người có quyền giao việc trên nhiệm vụ.",
            ],
          },
          {
            type: "h2",
            text: "Trả lời yêu cầu",
          },
          {
            type: "p",
            text: "Trưởng đơn vị được yêu cầu mở trang **Yêu cầu phối hợp từ đơn vị khác** (đường dẫn `/tasks/unit-requests`). Trang này dành cho trưởng đơn vị được yêu cầu.",
          },
          {
            type: "ol",
            items: [
              "Đọc tên nhiệm vụ, mã, hạn, chủ trì, người đề nghị và hạn trả lời trên từng dòng.",
              "Để cử người: bấm **Cử người phối hợp**, chọn **Người được cử** trong đơn vị mình, ghi chú nếu cần, rồi bấm **Cử phối hợp**.",
              "Để từ chối: bấm **Từ chối**, nhập lý do ít nhất 3 ký tự, rồi bấm **Từ chối** lần nữa để gửi.",
              "Bấm **Hủy** nếu muốn đóng ô nhập mà chưa gửi.",
            ],
          },
          {
            type: "callout",
            tone: "info",
            text: "Lý do từ chối là bắt buộc. Ghi chú khi cử người thì không bắt buộc. Danh sách người được cử chỉ gồm người thuộc đơn vị được đề nghị.",
          },
        ],
      },
      {
        slug: "mau-va-nhiem-vu-lap-lai",
        title: "Mẫu và nhiệm vụ lặp lại",
        description:
          "Tạo mẫu cho việc định kỳ hằng tháng, gắn lịch lặp lại và theo dõi các kỳ đã tạo.",
        icon: "Repeat",
        blocks: [
          {
            type: "p",
            text: "Mẫu dùng cho các việc định kỳ hằng tháng, như báo cáo tháng hoặc kiểm kê. Mẫu thuộc một đơn vị và gồm tiêu đề, mô tả, mức ưu tiên, ngày hạn trong tháng, tiêu chí hoàn thành và danh sách việc con. Lịch lặp lại gắn mẫu với người chủ trì và tạo nhiệm vụ cho từng kỳ. Trang quản lý có tên **Mẫu nhiệm vụ và nhiệm vụ lặp lại**, đường dẫn `/tasks/templates`.",
          },
          {
            type: "h2",
            text: "Tạo và sửa mẫu",
          },
          {
            type: "ol",
            items: [
              "Bấm **Tạo mẫu**.",
              "Nhập **Tên mẫu**, chọn **Đơn vị** và nhập **Tiêu đề nhiệm vụ**. Tiêu đề có thể dùng {thang} (dạng MM/YYYY), {nam} (YYYY) và {nam_hoc} (YYYY-YYYY) để chèn kỳ.",
              "Nhập **Ngày hạn trong tháng** từ 1 đến 28. Chọn **Ưu tiên**. Nhập **Tiêu chí hoàn thành** và **Việc con**, mỗi dòng một mục, tối đa 20 mục mỗi loại.",
              "Bấm **Lưu mẫu**, hoặc **Hủy** để bỏ.",
            ],
          },
          {
            type: "ul",
            items: [
              "**Sửa** mở lại form của mẫu.",
              "**Ngừng dùng** tạm ngưng mẫu. Mẫu ngừng dùng hiện mờ, kèm dòng đã ngừng dùng. Bấm **Dùng lại** để mở lại.",
              "Chỉ mẫu đang dùng mới có nút **Thêm lịch lặp lại**.",
            ],
          },
          {
            type: "h2",
            text: "Lịch lặp lại",
          },
          {
            type: "p",
            text: "Lịch lặp lại gắn một mẫu với người chủ trì cho từng kỳ tháng.",
          },
          {
            type: "ol",
            items: [
              "Bấm **Thêm lịch lặp lại** trên mẫu.",
              "Chọn **Người chủ trì** (bắt buộc) và **Người duyệt** (không bắt buộc).",
              "Nhập **Lặp mỗi (tháng)** từ 1 đến 12, **Kỳ bắt đầu** theo dạng YYYY-MM, và **Kỳ kết thúc** nếu cần.",
              "Chọn **Bù kỳ đã qua** (không bù, hoặc bù tối đa 1 đến 3 tháng đã qua), rồi bấm **Lưu lịch**.",
            ],
          },
          {
            type: "h2",
            text: "Theo dõi và xử lý lỗi",
          },
          {
            type: "ul",
            items: [
              "Mỗi lịch hiện kỳ gần nhất cùng trạng thái: Đã tạo, Tạo thiếu việc con, Đang tạo hoặc Lỗi. Lịch đang tạm dừng hiện thêm chữ tạm dừng.",
              "Nếu kỳ gần nhất ở trạng thái Lỗi, bấm **Thử lại**.",
              "Bấm **Tạm dừng** để dừng lịch, và **Tiếp tục** để chạy lại.",
            ],
          },
          {
            type: "p",
            text: "Hệ thống quét định kỳ để tạo nhiệm vụ của kỳ hiện tại. Mỗi lịch và mỗi kỳ chỉ tạo một lần. Nhiệm vụ sinh ra được tạo qua cùng đường xử lý như khi tạo thủ công, có kiểm quyền và thông báo giao việc.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Quản lý mẫu và lịch cần quyền giao việc trong đơn vị của mẫu, tức là Ban Giám hiệu hoặc trưởng đơn vị. Nếu không có quyền này, Thầy/Cô không thấy nút **Tạo mẫu**.",
          },
        ],
      },
      {
        slug: "binh-luan-va-nhac-ten",
        title: "Bình luận và nhắc tên",
        description:
          "Viết, nhắc tên, sửa, xóa và thả cảm xúc cho bình luận trong nhiệm vụ.",
        icon: "MessageSquare",
        blocks: [
          {
            type: "p",
            text: "Khu bình luận nằm ngay dưới tên nhiệm vụ trên trang chi tiết, để các trao đổi không bị khuất dưới phần mô tả dài. Ô **Thêm bình luận…** dùng để viết.",
          },
          {
            type: "h2",
            text: "Viết và gửi bình luận",
          },
          {
            type: "ul",
            items: [
              "Nhấn `Enter` để gửi. Nhấn `Shift` + `Enter` để xuống dòng.",
              "Bình luận là văn bản thuần, tối đa 2.000 ký tự. Giao diện không hiển thị HTML.",
              "Người giao việc, chủ trì, phối hợp, người theo dõi, người duyệt được chỉ định và trưởng đơn vị trong phạm vi có thể bình luận. Người chỉ quan sát chỉ đọc được.",
              "Nhiệm vụ đã lưu trữ không nhận thêm bình luận.",
            ],
          },
          {
            type: "h2",
            text: "Nhắc tên",
          },
          {
            type: "ol",
            items: [
              "Gõ `@` trong ô bình luận, hoặc bấm nút **Nhắc tên** (tooltip Nhắc tên (@)).",
              "Chọn người trong danh sách; ô sẽ chèn @Tên của người đó. Enter hoặc Tab chọn mục đang được tô sáng.",
              "Bấm nút gửi để đăng bình luận.",
            ],
          },
          {
            type: "ul",
            items: [
              "Chỉ nhắc được người đã có vai trò trong nhiệm vụ hoặc người cùng đơn vị với người viết.",
              "Người cùng đơn vị chưa có vai trò sẽ tự được thêm làm người theo dõi để mở được nhiệm vụ. Việc này được ghi vào nhật ký.",
              "Nếu xóa chữ @Tên khỏi nội dung trước khi gửi, người đó sẽ không được nhắc.",
            ],
          },
          {
            type: "h2",
            text: "Sửa, xóa và cảm xúc",
          },
          {
            type: "ul",
            items: [
              "Chỉ tác giả mới sửa hoặc xóa được bình luận của mình. Bấm nút **Thao tác bình luận**, rồi chọn **Sửa bình luận** hoặc **Xóa bình luận**. Khi sửa tại chỗ, `Enter` để lưu, `Shift` + `Enter` để xuống dòng, `Esc` để hủy. Bình luận đã sửa có nhãn đã sửa.",
              "Xóa bình luận cần xác nhận trong hộp **Xóa bình luận?**. Sau khi xóa, nội dung được thay bằng dòng Bình luận đã được xóa. Bản ghi vẫn được giữ lại.",
              "Thả cảm xúc: bấm nút **Thả cảm xúc** rồi chọn một trong sáu emoji có sẵn. Bấm lại vào emoji đã thả để gỡ lượt của mình. Thả cảm xúc cần quyền bình luận.",
              "Thả cảm xúc không gửi thông báo và không ghi nhật ký.",
            ],
          },
        ],
      },
    ],
  },
  {
    key: "van-ban",
    title: "Văn bản",
    pages: [
      {
        slug: "van-ban-den",
        title: "Văn bản đến",
        description:
          "Vào sổ, bút phê, giao đơn vị chủ trì và theo dõi xử lý văn bản đến.",
        icon: "FileInput",
        blocks: [
          {
            type: "p",
            text: "Văn bản đến là văn bản từ cơ quan bên ngoài gửi tới trường, đi qua bút phê, phân công và xử lý sau khi vào sổ.",
          },
          {
            type: "h2",
            text: "Vào sổ văn bản",
          },
          {
            type: "p",
            text: "Mở **Văn bản đến** trong nhóm **Văn bản** ở thanh bên, rồi bấm **Vào sổ văn bản đến**.",
          },
          {
            type: "ol",
            items: [
              "Điền **Số, ký hiệu** và **Cơ quan ban hành** theo văn bản gốc. Cả hai đều bắt buộc.",
              "Kiểm tra **Ngày ban hành**. Mặc định là ngày hôm nay.",
              "Ghi **Trích yếu nội dung** ngắn gọn (bắt buộc).",
              "Chọn **Đơn vị chủ trì xử lý** nếu đã biết. Để trống thì hiện **Chưa phân công**.",
              "Nếu cần, bấm **Thêm thông tin** để mở **Thể loại**, **Mức khẩn**, **Hạn giải quyết**; bấm **Đính kèm tệp** để chọn tệp PDF hoặc Word, tối đa 10MB.",
              "Bấm **Vào sổ** để lưu.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Nếu số ký hiệu và cơ quan ban hành trùng với văn bản đã vào sổ, hệ thống cảnh báo và hiện số đến của văn bản cũ. Nếu vẫn cần vào sổ, bấm **Vào sổ** thêm một lần.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Nếu văn bản đã lưu nhưng tệp chưa đính kèm được, hộp thoại sẽ báo và nút chính đổi thành **Đóng**. Khi đó, dùng **Thêm tệp** trong menu **Thao tác khác** của văn bản.",
          },
          {
            type: "h2",
            text: "Bút phê và giao đơn vị chủ trì",
          },
          {
            type: "p",
            text: "Thanh thao tác đầu văn bản luôn hiện các nút **Chuyển**, **Đánh dấu**, **Kết thúc** và **Lưu hồ sơ**. Nút chưa đến lượt sẽ bị mờ; rê chuột vào để xem đang chờ ai. Nút **Trả lại** chỉ hiện với Trưởng đơn vị chủ trì khi văn bản đã chuyển cho đơn vị.",
          },
          {
            type: "ul",
            items: [
              "**Trình lãnh đạo** (Văn thư, khi văn bản đã đăng ký): chuyển lên lãnh đạo.",
              "**Chuyển** (Ban Giám hiệu): trong **Chọn người nhận văn bản**, chọn một đơn vị ở cột **XLC** (xử lý chính) và nhập **Ý kiến chỉ đạo**, bắt buộc. Cột **PH** (phối hợp) và **Hạn xử lý** là tùy chọn.",
              "**Chuyển** (Trưởng đơn vị chủ trì): chọn đúng một người ở cột **XLC**, có thể chọn người ở cột **PH**, nhập **Ý kiến phân công** nếu cần. Mục **Giao thành nhiệm vụ** đang bật sẵn.",
              "**Trả lại** (Trưởng đơn vị chủ trì): nhập lý do, ít nhất 3 ký tự, rồi bấm **Trả lại văn bản**. Dùng khi văn bản chuyển nhầm đơn vị.",
              "**Chuyển đơn vị khác** (Văn thư, sau khi văn bản bị trả lại): chọn đơn vị nhận mới rồi bấm **Chuyển văn bản**.",
            ],
          },
          {
            type: "h2",
            text: "Xử lý và lưu hồ sơ",
          },
          {
            type: "p",
            text: "Văn bản đến đi qua các bước **Đăng ký**, **Lãnh đạo bút phê**, **Phân công**, **Xử lý** và **Lập hồ sơ**. Thanh tiến trình cho biết người đang được chờ.",
          },
          {
            type: "ol",
            items: [
              "Người được phân công bấm **Kết thúc**, nhập **Kết quả giải quyết** (bắt buộc), rồi bấm **Kết thúc** để xác nhận.",
              "Văn thư bấm **Lưu hồ sơ**. Chọn hồ sơ trong ô **Hồ sơ lưu** nếu cần; nếu chưa có, bấm **Tạo hồ sơ mới**, nhập **Tên hồ sơ mới**, chọn **Đơn vị quản lý hồ sơ** rồi bấm **Tạo hồ sơ**.",
              "Nhập **Ghi chú** nếu cần, rồi bấm **Lưu hồ sơ**.",
            ],
          },
          {
            type: "h2",
            text: "Chờ xử lý và Đã xử lý",
          },
          {
            type: "p",
            text: "Ở thanh bên, **Chờ xử lý** gồm văn bản chưa hoàn thành; **Đã xử lý** gồm văn bản đã hoàn thành, đã lập hồ sơ hoặc đã lưu trữ. Nhãn trạng thái trong danh sách gồm **Mới nhận**, **Đã đăng ký**, **Chờ bút phê**, **Đã chuyển**, **Đang xử lý**, **Hoàn thành**, **Đã lập hồ sơ** và **Đã lưu trữ**.",
          },
        ],
      },
      {
        slug: "van-ban-di",
        title: "Văn bản đi",
        description:
          "Soạn bản nháp, trình duyệt, cấp số, phát hành, thu hồi và theo dõi văn bản đi.",
        icon: "FileOutput",
        blocks: [
          {
            type: "p",
            text: "Văn bản đi là văn bản do trường ban hành gửi ra ngoài hoặc gửi các đơn vị. Mỗi văn bản đi qua các bước duyệt, ký và cấp số trước khi phát hành.",
          },
          {
            type: "h2",
            text: "Soạn bản nháp",
          },
          {
            type: "p",
            text: "Mở **Văn bản đi** ở thanh bên, rồi bấm **Soạn văn bản đi**. Trang soạn thảo có các bước sau.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Trang soạn thảo chỉ mở khi tính năng văn bản đi đã được bật. Nếu bấm nút mà vẫn quay về trang danh sách, hãy báo quản trị hệ thống.",
          },
          {
            type: "ol",
            items: [
              "Nhập **Tiêu đề văn bản**, tối thiểu 3 ký tự.",
              "Điền **Trích yếu**, **Loại văn bản**, **Mức độ bảo mật** và **Mức độ khẩn** nếu cần.",
              "Chọn **Đơn vị soạn thảo** và **Người ký**.",
              "Nhập **Nơi nhận** và **Ghi chú** nếu có.",
              "Bấm **Tạo bản nháp**.",
            ],
          },
          {
            type: "h2",
            text: "Trình duyệt và ký",
          },
          {
            type: "p",
            text: "Thanh tiến trình gồm **Dự thảo**, **Phê duyệt nội dung**, **Kiểm tra thể thức**, **Ký chức danh**, **Cấp số**, **Dấu cơ quan** và **Phát hành**. Khu **Hành động** hiện nút của bước hiện tại; nếu tài khoản chưa đủ quyền, hệ thống báo lỗi sau khi bấm **Xác nhận**.",
          },
          {
            type: "ul",
            items: [
              "**Trình phê duyệt nội dung** khi văn bản đang ở **Dự thảo**. Dự thảo được gửi lên Trưởng đơn vị để phê duyệt nội dung.",
              "**Phê duyệt nội dung** hoặc **Yêu cầu chỉnh sửa**. Yêu cầu chỉnh sửa phải có ghi chú và đưa văn bản về **Dự thảo**.",
              "**Xác nhận thể thức đạt** ở bước **Kiểm tra thể thức**.",
              "**Ký chức danh**, sau đó **Cấp số & ngày ban hành** do Văn thư thực hiện.",
              "**Đóng dấu cơ quan** sau khi đã cấp số.",
            ],
          },
          {
            type: "p",
            text: "Hệ thống không cho cùng một người vừa soạn vừa duyệt nội dung. Người đã ký chức danh không tự cấp số hoặc đóng dấu cơ quan cho văn bản đó.",
          },
          {
            type: "h2",
            text: "Phát hành và nơi nhận",
          },
          {
            type: "p",
            text: "Khi văn bản đã đóng dấu cơ quan, khối **Theo dõi nơi nhận** hiện nút **Phát hành**.",
          },
          {
            type: "ol",
            items: [
              "Bấm **Phát hành**.",
              "Tích các đơn vị nhận văn bản trong danh sách. Nhập cơ quan ngoài trường vào ô **Cơ quan, tổ chức ngoài trường**, mỗi nơi một dòng. Cần chọn ít nhất một nơi nhận.",
              "Tùy chọn: chọn **văn bản được thay thế** nếu có văn bản đã thu hồi hoặc đã có nơi nhận tiếp nhận.",
              "Bấm **Phát hành** để xác nhận.",
            ],
          },
          {
            type: "p",
            text: "Khi nơi nhận đã tiếp nhận, Văn thư bấm **Ghi nhận đã nhận** ở từng nơi.",
          },
          {
            type: "h2",
            text: "Thu hồi",
          },
          {
            type: "p",
            text: "Nút **Thu hồi** chỉ hiện khi văn bản đã phát hành, chưa có nơi nhận nào tiếp nhận và tài khoản có quyền thu hồi. Nhập lý do ít nhất 3 ký tự, rồi bấm **Thu hồi văn bản**. Số của văn bản đã thu hồi không được cấp lại.",
          },
          {
            type: "p",
            text: "Nếu đã có nơi nhận tiếp nhận thì không thu hồi được. Khi đó, khối nơi nhận hiện lý do và gợi ý phát hành văn bản thay thế với số mới.",
          },
          {
            type: "h2",
            text: "Các nhóm trong sổ",
          },
          {
            type: "ul",
            items: [
              "**Chờ xử lý**: văn bản đang ở **Dự thảo**, **Phê duyệt nội dung**, **Kiểm tra thể thức** hoặc **Ký chức danh**.",
              "**Đã xử lý**: văn bản đã cấp số hoặc đã đóng dấu cơ quan.",
              "**Đã phát hành**: văn bản đã phát hành, đã giao, đã lập hồ sơ hoặc đã lưu trữ.",
              "**Đã thu hồi**: văn bản đã thu hồi.",
            ],
          },
          {
            type: "p",
            text: "Nhãn trạng thái trong danh sách gồm **Nháp**, **Chờ duyệt**, **Chờ ký**, **Đã ký**, **Đã phát hành**, **Đã lưu hồ sơ**, **Đã lưu trữ** và **Đã thu hồi**.",
          },
        ],
      },
      {
        slug: "to-trinh-noi-bo",
        title: "Tờ trình nội bộ",
        description:
          "Lập tờ trình, trình duyệt qua các đơn vị liên quan và để lãnh đạo phê duyệt.",
        icon: "FileText",
        blocks: [
          {
            type: "p",
            text: "Tờ trình nội bộ là văn bản trình lãnh đạo xem xét và quyết định. Luồng duyệt đi qua trưởng các đơn vị liên quan, duyệt song song, rồi tới lãnh đạo phê duyệt.",
          },
          {
            type: "h2",
            text: "Tạo tờ trình",
          },
          {
            type: "ol",
            items: [
              "Mở **Tờ trình nội bộ** ở thanh bên, rồi bấm **Soạn tờ trình**.",
              "Điền **Số, ký hiệu**, **Đơn vị đề xuất** và **Trích yếu nội dung**. Ba trường này bắt buộc. **Ngày ban hành** đã có sẵn ngày hôm nay.",
              "Bấm **Tạo tờ trình**.",
            ],
          },
          {
            type: "h2",
            text: "Trình duyệt",
          },
          {
            type: "p",
            text: "Khi tờ trình còn ở **Nháp**, bấm **Trình duyệt**. Nếu tờ trình bị yêu cầu bổ sung, nút đổi thành **Trình lại**. Trong hộp thoại **Trình duyệt tờ trình**, tích các đơn vị liên quan. Đơn vị của người trình luôn có trong danh sách. Nếu người trình là trưởng của đơn vị đó, bước duyệt của đơn vị đó được bỏ qua.",
          },
          {
            type: "p",
            text: "Chân hộp thoại ghi đường đi của tờ trình, ví dụ **1 đơn vị duyệt → Lãnh đạo**, hoặc **Chuyển thẳng lãnh đạo** khi không chọn đơn vị nào.",
          },
          {
            type: "h2",
            text: "Duyệt tờ trình",
          },
          {
            type: "p",
            text: "Người được giao bước duyệt sẽ thấy các nút quyết định. Trưởng đơn vị có **Đồng ý** và **Cần bổ sung**. Lãnh đạo có thêm **Không phê duyệt**.",
          },
          {
            type: "ul",
            items: [
              "**Đồng ý**: khi mọi đơn vị đã đồng ý, tờ trình chuyển lên lãnh đạo. Với lãnh đạo, **Đồng ý** là phê duyệt.",
              "**Cần bổ sung**: trả cả tờ trình về người trình. Phải ghi lý do ít nhất 3 ký tự.",
              "**Không phê duyệt**: chỉ lãnh đạo mới có. Phải ghi lý do ít nhất 3 ký tự.",
            ],
          },
          {
            type: "p",
            text: "Kết quả từng bước và ghi chú hiện trong khu **Phê duyệt** của văn bản (Quick View) hoặc **Duyệt tờ trình** (trang chi tiết).",
          },
          {
            type: "h2",
            text: "Thao tác khác",
          },
          {
            type: "ul",
            items: [
              "**Xin ý kiến**: người đang được giao bước duyệt chọn người được hỏi, nhập nội dung cần hỏi (ít nhất 3 ký tự) rồi bấm **Gửi**. Câu trả lời hiện dưới tờ trình.",
              "**Xin trả lại**: chỉ dùng khi tờ trình đã có người mở hoặc đã có quyết định. Người trình nhập lý do, ít nhất 3 ký tự, rồi bấm **Gửi đề nghị**. Người đang chờ duyệt bấm **Đồng ý trả lại** hoặc **Từ chối**. Nếu đồng ý, tờ trình về **Nháp**.",
              "**Rút lại**: chỉ khi tờ trình đang chờ duyệt, chưa ai mở và chưa có quyết định nào. Tờ trình quay về **Nháp**.",
              "**Thay người**: hiện ở bước đang chờ khi người được giao nghỉ hoặc vắng. Chọn người mới, nhập lý do ít nhất 3 ký tự, rồi bấm **Thay người**. Việc thay người được ghi lại.",
            ],
          },
          {
            type: "callout",
            tone: "info",
            text: "Mục **Báo cáo thời gian duyệt** nằm dưới **Tờ trình nội bộ** ở thanh bên và chỉ hiện với tài khoản có quyền xem.",
          },
        ],
      },
      {
        slug: "ky-tren-van-ban",
        title: "Ký trên văn bản",
        description:
          "Ký chức danh, ký nháy, đóng dấu cơ quan và xem chữ ký số của văn bản đi.",
        icon: "PenLine",
        blocks: [
          {
            type: "p",
            text: "Ký là bước xác nhận của người có thẩm quyền, sau khi nội dung và thể thức đã được duyệt. Các nút ký nằm trong khu **Hành động** của văn bản đi, không nằm trong trình xem tệp.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Trình xem tệp dùng để đọc tài liệu: **Tìm trong tệp**, phóng to hoặc thu nhỏ, **Đi tới trang**, **Tải về** và **Mở trong tab mới**.",
          },
          {
            type: "h2",
            text: "Ký chức danh và cấp số",
          },
          {
            type: "p",
            text: "Khi văn bản đi đã được duyệt nội dung và xác nhận thể thức, văn bản chuyển sang bước **Ký chức danh**. Người có quyền làm theo các bước sau.",
          },
          {
            type: "ol",
            items: [
              "Bấm **Ký chức danh**, rồi bấm **Xác nhận** trong hộp thoại. Sau khi ký, văn bản vẫn ở bước này cho đến khi được cấp số.",
              "Văn thư bấm **Cấp số & ngày ban hành** để cấp số liên tục và xác nhận ngày ban hành.",
              "Sau khi cấp số, bấm **Đóng dấu cơ quan** để ký số tổ chức (dấu cơ quan điện tử) vào văn bản.",
            ],
          },
          {
            type: "p",
            text: "Hệ thống không cho người đã ký chức danh tự cấp số hoặc đóng dấu. Người đã kiểm tra thể thức cũng không được ký thẩm quyền của chính văn bản đó.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Văn bản đã ký chức danh không sửa được thông tin nữa. Muốn thay đổi nội dung, cần lập bản sửa đổi (revision). Trên giao diện hiện chưa có nút riêng cho việc này.",
          },
          {
            type: "h2",
            text: "Ký nháy (tùy chọn)",
          },
          {
            type: "p",
            text: "Ký nháy không bắt buộc. Mục **Ký nháy** hiện danh sách những người đã ký nháy, kèm ngày ký. Nếu văn bản có nhiều phiên bản, mục ghi thêm số bản. Người có quyền bấm **Ký nháy** để ký. Mỗi người chỉ ký nháy một lần cho mỗi phiên bản, và người soạn thảo không tự ký nháy văn bản của mình.",
          },
          {
            type: "p",
            text: "Chỉ ký nháy được khi văn bản đang trong bước **Phê duyệt nội dung**, **Kiểm tra thể thức** hoặc **Ký chức danh**, và lãnh đạo chưa ký chính thức.",
          },
          {
            type: "h2",
            text: "Xem chữ ký số",
          },
          {
            type: "p",
            text: "Khi văn bản đã có chữ ký số, mục **Xem chữ ký số** hiện trong menu **Thao tác khác** của văn bản. Hộp thoại **Chứng thực & ký số điện tử** có ba tab: **Dấu & chữ ký điện tử**, **Chứng thư số QCVN 102** và **Kiểm tra toàn vẹn**. Hộp thoại này dùng để xem và kiểm tra chữ ký.",
          },
        ],
      },
      {
        slug: "ho-so-cong-viec",
        title: "Hồ sơ công việc",
        description:
          "Theo dõi trạng thái hồ sơ, đóng hồ sơ, nộp lưu trữ và xét hủy hồ sơ hết hạn.",
        icon: "FolderOpen",
        blocks: [
          {
            type: "p",
            text: "Hồ sơ công việc gom các tài liệu của một việc để lưu trữ theo quy định. Hồ sơ đi qua các trạng thái từ đang mở, hoạt động, đóng, đến khi lưu trữ xong.",
          },
          {
            type: "h2",
            text: "Trạng thái hồ sơ",
          },
          {
            type: "ul",
            items: [
              "**Đang mở**: hồ sơ mới tạo, chưa có tài liệu.",
              "**Hoạt động**: hồ sơ chuyển sang trạng thái này khi thêm tài liệu đầu tiên.",
              "**Đã đóng**: hồ sơ không thêm hoặc bớt tài liệu được nữa.",
              "**Sẵn sàng lưu trữ**, **Đã nộp lưu trữ**, **Đã chấp nhận** và **Đã lưu trữ**: các bước lưu trữ theo đúng thứ tự.",
            ],
          },
          {
            type: "h2",
            text: "Tạo hồ sơ và lưu văn bản vào hồ sơ",
          },
          {
            type: "p",
            text: "Trên trang danh sách hồ sơ, nút **Tạo hồ sơ mới** hiện chỉ thông báo chức năng đang phát triển. Hãy tạo hồ sơ từ bước lưu văn bản đến.",
          },
          {
            type: "p",
            text: "Ở bước **Lưu hồ sơ** của văn bản đến, Thầy/Cô chọn hồ sơ có sẵn trong ô **Hồ sơ lưu**, hoặc bấm **Tạo hồ sơ mới**, nhập **Tên hồ sơ mới**, chọn **Đơn vị quản lý hồ sơ** và bấm **Tạo hồ sơ**.",
          },
          {
            type: "p",
            text: "Trang chi tiết không có nút thêm tài liệu thủ công. Mục **Danh mục tài liệu** chỉ liệt kê các tài liệu đã được ghi vào hồ sơ, kèm **Ngày VB**, **Trang** và **Người thêm**.",
          },
          {
            type: "h2",
            text: "Tìm kiếm và lọc",
          },
          {
            type: "p",
            text: "Trang danh sách hiển thị các thống kê **Tổng hồ sơ**, **Đang hoạt động**, **Chờ lưu trữ** và **Đã lưu trữ**. Thầy/Cô tìm theo mã hoặc tiêu đề trong ô **Tìm kiếm mã, tiêu đề...**, rồi lọc theo trạng thái và theo phân loại: **Công khai**, **Nội bộ**, **Hạn chế** hoặc **Dữ liệu cá nhân**.",
          },
          {
            type: "h2",
            text: "Đóng và lưu trữ",
          },
          {
            type: "p",
            text: "Ban Giám hiệu, Trưởng đơn vị, Văn thư và tài khoản quản trị có thể đóng hồ sơ và chuẩn bị lưu trữ. Các bước chấp nhận và hoàn tất lưu trữ chỉ dành cho Văn thư và tài khoản quản trị. Ngoài **Từ chối lưu trữ**, các bước đều có hộp xác nhận trước khi thực hiện.",
          },
          {
            type: "ul",
            items: [
              "**Đóng hồ sơ** khi hồ sơ ở trạng thái **Đang mở** hoặc **Hoạt động**.",
              "**Đánh dấu sẵn sàng lưu trữ** khi hồ sơ ở trạng thái **Đã đóng**.",
              "**Nộp lưu trữ** khi hồ sơ ở trạng thái **Sẵn sàng lưu trữ**.",
              "**Chấp nhận lưu trữ** hoặc **Từ chối lưu trữ** khi hồ sơ ở trạng thái **Đã nộp lưu trữ**. Từ chối cần nhập lý do trong hộp nhập của trình duyệt; hồ sơ quay về **Sẵn sàng lưu trữ**.",
              "**Hoàn tất lưu trữ** khi hồ sơ ở trạng thái **Đã chấp nhận**.",
            ],
          },
          {
            type: "h2",
            text: "Xét hủy hồ sơ hết hạn",
          },
          {
            type: "p",
            text: "Hồ sơ đã lưu trữ có thời hạn bảo quản. Khi hết hạn, mục **Xét hủy hồ sơ** hiện nút **Đề nghị xét hủy**. Hồ sơ bảo quản vĩnh viễn không bao giờ hết hạn, và mục hiện **Bảo quản vĩnh viễn**.",
          },
          {
            type: "ol",
            items: [
              "Bấm **Đề nghị xét hủy**, nhập **Số biên bản xét hủy** và **Lý do đề nghị** (mỗi ô ít nhất 3 ký tự), rồi bấm **Gửi đề nghị**.",
              "Người khác với người lập đề nghị bấm **Quyết định**. Chọn **Hủy hồ sơ**, hoặc nhập **Số năm gia hạn** rồi bấm **Gia hạn bảo quản**. Có thể ghi chú quyết định, không bắt buộc.",
            ],
          },
        ],
      },
    ],
  },
  {
    key: "lich-don-vi",
    title: "Cuộc họp và đơn vị",
    pages: [
      {
        slug: "cuoc-hop",
        title: "Cuộc họp",
        description:
          "Xem danh sách cuộc họp, tạo cuộc họp mới và mở trang chi tiết để soạn biên bản, ghi quyết nghị, ghi âm và chép lời.",
        icon: "CalendarDays",
        blocks: [
          {
            type: "p",
            text: "Trang **Cuộc họp** liệt kê các cuộc họp Thầy/Cô tổ chức hoặc được mời. Mở trang bằng mục **Cuộc họp** trong thanh bên; hai mục con **Sắp diễn ra** và **Đã họp** mở sẵn từng giai đoạn. Trang Lịch công tác (xem theo tuần hoặc tháng) đã được bỏ; nhiệm vụ có hạn xem ở trang **Nhiệm vụ**.",
          },
          {
            type: "h2",
            text: "Lọc và tìm kiếm",
          },
          {
            type: "ul",
            items: [
              "Hàng tab **Tất cả**, **Sắp diễn ra**, **Đã họp** chọn giai đoạn, cùng lựa chọn với hai mục con ở thanh bên. Hai giai đoạn tính theo thời gian, không theo trạng thái: **Sắp diễn ra** là cuộc họp chưa tới giờ kết thúc (kể cả đang họp), xếp cuộc gần nhất lên đầu. **Đã họp** là cuộc họp đã qua giờ kết thúc (không ghi giờ kết thúc thì tính theo giờ bắt đầu), kể cả khi trạng thái chưa chuyển. Cuộc họp đã hủy chỉ hiện ở **Tất cả**.",
              "Ô tìm theo tên cuộc họp; kết quả cập nhật sau khi ngừng gõ.",
              "Danh sách hiện 20 cuộc họp mỗi lần; bấm **Xem thêm** để tải tiếp.",
            ],
          },
          {
            type: "h2",
            text: "Tạo cuộc họp",
          },
          {
            type: "ol",
            items: [
              "Nhấn **Tạo cuộc họp**.",
              "Nhập **Tên cuộc họp** (ít nhất 3 ký tự) và chọn **Ngày**; hai mục này là bắt buộc. **Bắt đầu** mặc định 08:00, **Kết thúc** mặc định 09:30.",
              "Có thể điền thêm **Địa điểm** và **Nội dung và chương trình**.",
              "Nhấn **Tạo cuộc họp** hoặc phím Enter. Thiếu mục bắt buộc thì hệ thống báo ngay dưới ô còn thiếu. Tạo xong, trang chi tiết của cuộc họp mở ra.",
            ],
          },
          {
            type: "callout",
            tone: "info",
            text: "Thành phần dự họp và chủ tọa được thêm ở trang chi tiết, nơi chọn đúng người trong hệ thống. Cuộc họp chỉ chuyển sang **Đã mời** khi đã có người dự họp.",
          },
          {
            type: "h2",
            text: "Trang chi tiết",
          },
          {
            type: "p",
            text: "Bấm một hàng trong danh sách để mở chi tiết: thông tin cuộc họp, chương trình, thành phần tham dự, biên bản, nghị quyết, **Ghi chú của tôi** (chỉ mình Thầy/Cô xem được) và, với người tổ chức, chủ tọa hoặc thư ký, khung **Ghi âm cuộc họp** để ghi âm hoặc tải tệp rồi nhận bản chép lời và biên bản nháp để chỉnh sửa.",
          },
        ],
      },
      {
        slug: "co-cau-va-danh-ba",
        title: "Cơ cấu và danh bạ",
        description:
          "Tra cứu đơn vị, cán bộ và giảng viên toàn trường, xem chức vụ, thông tin liên hệ và xuất danh bạ ra file CSV.",
        icon: "Building2",
        blocks: [
          {
            type: "p",
            text: "Trang **Cơ cấu & Danh bạ** giúp Thầy/Cô tìm đơn vị, cán bộ và giảng viên trong toàn trường, xem chức vụ và thông tin liên hệ. Mở trang từ thanh bên, trong nhóm **Đơn vị**, mục **Cơ cấu & Danh bạ**. Đầu trang ghi số đơn vị và số người đang giữ chức vụ.",
          },
          {
            type: "h2",
            text: "Hai tab",
          },
          {
            type: "ul",
            items: [
              "**Danh bạ** (mặc định) liệt kê mọi người theo từng đơn vị. Trong mỗi đơn vị, lãnh đạo đứng đầu (Hiệu trưởng, cấp trưởng, cấp phó), những người còn lại xếp theo tên. Mỗi dòng gồm họ tên, email, chức vụ và số điện thoại.",
              "**Cơ cấu** liệt kê đơn vị theo nhóm **Cấp trường**, **Phòng chức năng**, **Khoa** và **Trung tâm**, kèm lãnh đạo và số nhân sự của từng đơn vị. Đơn vị chưa có ai giữ chức vụ vẫn hiện với số 0. Nhấn một đơn vị để mở danh bạ của đơn vị đó.",
              "Người giữ chức vụ ở hai đơn vị hiện ở cả hai đơn vị; số người ở đầu trang chỉ đếm một lần.",
            ],
          },
          {
            type: "p",
            text: "Trên điện thoại, dòng danh bạ chỉ hiện họ tên và chức vụ; nhấn vào dòng để xem email và số điện thoại.",
          },
          {
            type: "h2",
            text: "Tìm và lọc",
          },
          {
            type: "ol",
            items: [
              "Ở tab **Danh bạ**, nhập vào ô **Tìm người, chức vụ, email…** theo họ tên, email, chức vụ, tên đơn vị hoặc số điện thoại. Gõ không dấu cũng được; nhập nhiều từ thì người phải khớp tất cả các từ.",
              "Ở tab **Cơ cấu**, ô tìm kiếm lọc đơn vị theo tên đơn vị hoặc tên lãnh đạo.",
              "Nút **Bộ lọc** cạnh ô tìm kiếm lọc danh bạ theo **Đơn vị** hoặc chỉ **Lãnh đạo**. Bộ lọc đang áp dụng hiện thành nhãn dưới hai tab; nhấn × trên nhãn hoặc **Xóa lọc** để bỏ.",
            ],
          },
          {
            type: "p",
            text: "Tab, đơn vị đang lọc và từ khóa được giữ trên địa chỉ trang, nên Thầy/Cô có thể gửi đường dẫn cho đồng nghiệp hoặc quay lại đúng chỗ đang xem.",
          },
          {
            type: "h2",
            text: "Xem liên hệ",
          },
          {
            type: "p",
            text: "Nhấn một dòng trong danh bạ để mở thông tin liên hệ: mọi chức vụ người đó đang giữ (kèm đơn vị), **Email** và **Điện thoại**. Nhấn email để mở ứng dụng thư, nhấn số điện thoại để gọi. Thiếu thông tin thì hiển thị “Chưa cập nhật”.",
          },
          {
            type: "h2",
            text: "Xuất danh bạ",
          },
          {
            type: "ul",
            items: [
              "**Xuất CSV** tải về đúng danh sách đang hiển thị, theo đơn vị, bộ lọc và từ khóa đang chọn. Tên file có đơn vị (hoặc “toan-truong”) và ngày xuất.",
              "File có các cột Họ và tên, Chức vụ, Đơn vị, Email và Điện thoại, mã hóa UTF-8 để mở bằng Excel.",
              "**Xuất CSV** chỉ có ở tab **Danh bạ**, trên màn hình từ 640px trở lên.",
            ],
          },
          {
            type: "callout",
            tone: "info",
            text: "Danh bạ chỉ hiển thị cán bộ có phân công vị trí đang hiệu lực và tài khoản đang hoạt động. Người chưa được phân công vị trí sẽ không xuất hiện trong danh bạ.",
          },
        ],
      },
      {
        slug: "uy-quyen",
        title: "Ủy quyền tác nghiệp",
        description:
          "Xem danh sách văn bản ủy quyền tác nghiệp: người ủy quyền, người nhận, phạm vi, thời hạn hiệu lực và trạng thái.",
        icon: "Shield",
        blocks: [
          {
            type: "p",
            text: "Trang **Ủy quyền tác nghiệp** liệt kê các văn bản ủy quyền xử lý công việc thay mặt: ai ủy quyền, ai nhận, phạm vi và thời hạn hiệu lực. Trang hiện chỉ dùng để xem. Mở trang từ menu **Thêm** ở thanh bên, chọn **Ủy quyền tác nghiệp**.",
          },
          {
            type: "h2",
            text: "Đọc danh sách",
          },
          {
            type: "p",
            text: "Mỗi dòng là một văn bản ủy quyền, gồm các cột sau:",
          },
          {
            type: "ul",
            items: [
              "**Người ủy quyền** và **Người được ủy quyền**: họ tên, chức danh và đơn vị.",
              "**Phạm vi**: nhóm việc được ủy quyền (Nhiệm vụ, Văn bản, Cuộc họp, Hồ sơ) và phạm vi tài nguyên nếu có; dòng dưới ghi mã quyền.",
              "**Căn cứ**: số văn bản ủy quyền, nếu có.",
              "**Thời gian**: từ ngày đến ngày hiệu lực. Trên màn hình hẹp, kéo ngang bảng để xem đủ các cột.",
              "**Trạng thái**: **Có hiệu lực**, **Hết hiệu lực** hoặc **Đã thu hồi**. Ủy quyền còn hiệu lực dưới 7 ngày hiện **Hết hạn sau N ngày**.",
            ],
          },
          {
            type: "h2",
            text: "Lọc và tìm kiếm",
          },
          {
            type: "ol",
            items: [
              "Chọn một nút trạng thái: **Có hiệu lực** (mặc định), **Hết hiệu lực**, **Đã thu hồi** hoặc **Tất cả**. Đổi trạng thái sẽ tải lại danh sách từ máy chủ.",
              "Nhập vào ô **Tìm người, phạm vi, căn cứ…** ở đầu trang. Ô này lọc các dòng đã tải theo tên người ủy quyền, tên người được ủy quyền, mã quyền, phạm vi hoặc số văn bản căn cứ; gõ không dấu vẫn tìm được.",
              "Nhấn **Xem thêm** để hiện thêm 20 dòng.",
            ],
          },
          {
            type: "p",
            text: "Khi không có dòng nào khớp từ khóa, trang hiển thị “Không có ủy quyền phù hợp”.",
          },
          {
            type: "h2",
            text: "Ai thấy ủy quyền nào",
          },
          {
            type: "p",
            text: "Hệ thống chỉ hiển thị ủy quyền có liên quan đến Thầy/Cô, hoặc liên quan đến các đơn vị nơi Thầy/Cô đang có phân công còn hiệu lực. Tài khoản Ban Giám hiệu, quản trị viên và người giữ vị trí điều hành xem được toàn bộ ủy quyền.",
          },
          {
            type: "p",
            text: "Trang chưa có nút tạo mới hoặc thu hồi ủy quyền, nên mọi thay đổi về ủy quyền không thực hiện được từ trang này.",
          },
        ],
      },
    ],
  },
  {
    key: "tai-khoan",
    title: "Tài khoản",
    pages: [
      {
        slug: "ho-so-ca-nhan",
        title: "Hồ sơ cá nhân",
        description:
          "Xem và cập nhật họ và tên, chức danh và số điện thoại liên hệ trong hồ sơ cá nhân của Thầy/Cô.",
        icon: "UserCircle",
        blocks: [
          {
            type: "p",
            text: "Hồ sơ cá nhân cho Thầy/Cô xem tài khoản đang đăng nhập và cập nhật ba thông tin: họ và tên, chức danh và số điện thoại. Vai trò điều hành chỉ để xem và do Quản trị viên hệ thống quản lý.",
          },
          {
            type: "h2",
            text: "Mở hồ sơ cá nhân",
          },
          {
            type: "ol",
            items: [
              "Trên máy tính, nhấn vào tên và ảnh đại diện của Thầy/Cô ở thanh bên.",
              "Chọn **Hồ sơ cá nhân** trong menu tài khoản.",
            ],
          },
          {
            type: "p",
            text: "Trên điện thoại, mở menu của ứng dụng rồi chọn **Hồ sơ cá nhân**. Hộp thoại có tiêu đề **Hồ sơ Cán bộ & Viên chức**, email của Thầy/Cô nằm ngay bên dưới.",
          },
          {
            type: "h2",
            text: "Các trường thông tin",
          },
          {
            type: "ul",
            items: [
              "**Họ và tên đầy đủ**: bắt buộc nhập.",
              "**Chức danh / Vị trí**: nếu để trống, hệ thống lưu là Viên chức.",
              "**Số điện thoại liên hệ**: có thể để trống.",
              "**Đơn vị / Khoa / Phòng ban**: khi Nhà trường đã chuẩn hóa đơn vị, ô này hiện nhãn **Chuẩn hóa** và không sửa được. Khi chưa chuẩn hóa, ô là danh sách chọn, nhưng lựa chọn đơn vị không được lưu từ hộp thoại này.",
              "**Phân quyền điều hành (Vai trò hệ thống)**: nhãn **Chỉ đọc**. Quản trị viên hệ thống quản lý phần này theo cơ cấu tổ chức của Nhà trường.",
            ],
          },
          {
            type: "p",
            text: "Ô **Tiểu sử / Giới thiệu** có trong hộp thoại nhưng chưa được lưu khi nhấn **Lưu thay đổi**.",
          },
          {
            type: "h2",
            text: "Lưu thay đổi",
          },
          {
            type: "ol",
            items: [
              "Sửa các trường cần cập nhật.",
              "Nhấn **Lưu thay đổi**. Trong lúc lưu, nút hiện **Đang lưu...**.",
              "Khi thành công, hộp thoại hiện thông báo “Cập nhật thông tin cán bộ thành công!” và tự đóng sau khoảng 0,8 giây.",
            ],
          },
          {
            type: "p",
            text: "Nếu lưu thất bại, thông báo lỗi màu đỏ hiện ngay trong hộp thoại. Nội dung đang nhập vẫn còn để Thầy/Cô sửa và lưu lại.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Ở lần đăng nhập đầu tiên, hộp thoại có khung chào mừng cho biết tài khoản email trường đã được kích hoạt. Hãy hoàn thiện chức danh và số điện thoại để thuận tiện điều hành công việc.",
          },
          {
            type: "h2",
            text: "Đóng hộp thoại",
          },
          {
            type: "p",
            text: "Nhấn biểu tượng dấu X (nhãn **Đóng**), nhấn vùng nền bên ngoài hoặc nhấn phím `Esc`. Các thay đổi chưa lưu sẽ mất.",
          },
          {
            type: "p",
            text: "Với tài khoản chưa liên kết Khoa hoặc Phòng ban, hệ thống có thể tự mở hồ sơ này một lần trong mỗi phiên làm việc.",
          },
        ],
      },
      {
        slug: "thong-bao",
        title: "Thông báo",
        description:
          "Đọc, lọc và đánh dấu đã đọc thông báo trong Hộp thư, và bật thông báo đẩy trên thiết bị.",
        icon: "Bell",
        blocks: [
          {
            type: "p",
            text: "Thông báo về nhiệm vụ, văn bản và nhắc hạn được gom trong **Hộp thư**. Tại đây Thầy/Cô có thể lọc, tìm kiếm và đánh dấu đã đọc. Muốn nhận thông báo đẩy trên thiết bị đang dùng, Thầy/Cô bật thông báo đẩy trong Cài đặt hệ thống.",
          },
          {
            type: "h2",
            text: "Mở hộp thư",
          },
          {
            type: "p",
            text: "Chọn **Hộp thư** trên thanh bên, đường dẫn là `/inbox`. Đường dẫn `/notifications` vẫn mở trang **Trung tâm thông báo** với hai bộ lọc **Tất cả** và **Chưa đọc**; khi đó thanh bên vẫn chọn mục **Hộp thư**.",
          },
          {
            type: "h2",
            text: "Lọc và tìm thông báo",
          },
          {
            type: "ul",
            items: [
              "Nhấn nút lọc (tooltip **Lọc**), rồi chọn **Chỉ chưa đọc** để chỉ xem thông báo chưa đọc.",
              "Trong cùng menu, chọn **Tất cả**, **Việc cần làm** hoặc **Nhắc hạn** để xem theo nhóm.",
              "Nhấn biểu tượng kính lúp hoặc `Ctrl` + `F` (`⌘` + `F` trên macOS) để mở ô **Tìm trong hộp thư** khi con trỏ đang ở trong Hộp thư. Nhấn `Esc` để đóng ô tìm kiếm.",
              "Các thông báo cùng một nhiệm vụ hoặc văn bản được gom thành một hàng, xếp theo sự kiện mới nhất.",
            ],
          },
          {
            type: "h2",
            text: "Đọc và đánh dấu đã đọc",
          },
          {
            type: "ol",
            items: [
              "Nhấn một hàng để xem chi tiết.",
              "Ở phần chi tiết, nút mở đối tượng ghi **Mở nhiệm vụ** (thông báo về nhiệm vụ), **Mở văn bản** (thông báo về văn bản) hoặc **Mở chi tiết** (các thông báo khác).",
            ],
          },
          {
            type: "p",
            text: "Mở một nhóm sẽ tự đánh dấu đã đọc mọi thông báo chưa đọc của nhóm đó. Trên từng hàng, nút **Đánh dấu đã đọc** đánh dấu mọi thông báo chưa đọc của nhóm; khi nhóm đã đọc, nút **Đánh dấu chưa đọc** đánh dấu lại thông báo mới nhất của nhóm.",
          },
          {
            type: "p",
            text: "Nhấn biểu tượng ba chấm (**Tùy chọn hộp thư**) để dùng **Đánh dấu tất cả đã đọc**, áp dụng cho toàn bộ hộp thư, hoặc **Làm mới** để tải lại danh sách.",
          },
          {
            type: "h2",
            text: "Bật thông báo đẩy trên thiết bị",
          },
          {
            type: "p",
            text: "Thông báo đẩy hiện thông báo trên thiết bị và trình duyệt đang dùng. Các chủ đề được lưu theo tài khoản, và máy chủ kiểm tra chúng trước khi gửi.",
          },
          {
            type: "ol",
            items: [
              "Mở **Cài đặt hệ thống** (menu **Thêm** ở thanh bên), tìm dòng **Thông báo đẩy** trong nhóm **Thông báo** và nhấn **Cấu hình**. Nút không bật nếu trình duyệt không hỗ trợ thông báo đẩy.",
              "Nhấn **Tùy chỉnh các chủ đề nhận thông báo** để mở danh sách, rồi bật hoặc tắt từng chủ đề.",
              "Nhấn **Bật thông báo trên thiết bị** và cho phép trình duyệt hiện thông báo.",
            ],
          },
          {
            type: "p",
            text: "Nhấn **Để sau** để ẩn hộp thoại này trong 14 ngày. Nếu trình duyệt đã chặn thông báo, hộp thoại hướng dẫn cách mở lại quyền; sau khi đổi quyền, nhấn **Tải lại trang ngay** để áp dụng.",
          },
          {
            type: "h3",
            text: "Các chủ đề nhận thông báo",
          },
          {
            type: "ul",
            items: [
              "Nhiệm vụ được giao mới",
              "Yêu cầu phê duyệt sản phẩm",
              "Cảnh báo hạn chót 24 giờ",
              "Ý kiến chỉ đạo văn bản",
              "Yêu cầu gia hạn nhiệm vụ",
              "Từ chối nhận việc",
              "Phối hợp liên đơn vị",
            ],
          },
        ],
      },
      {
        slug: "cai-dat",
        title: "Cài đặt hệ thống",
        description:
          "Kiểm tra phiên bản, cập nhật ứng dụng, quản lý dữ liệu ngoại tuyến và hàng đợi đồng bộ trên thiết bị đang dùng.",
        icon: "Settings",
        blocks: [
          {
            type: "p",
            text: "Trang **Cài đặt hệ thống** quản lý phiên bản ứng dụng, dữ liệu ngoại tuyến và thông báo đẩy trên thiết bị Thầy/Cô đang dùng. Các thông tin này thuộc về thiết bị và trình duyệt đó, không đồng bộ sang máy khác.",
          },
          {
            type: "h2",
            text: "Mở trang",
          },
          {
            type: "p",
            text: "Mở menu **Thêm** ở thanh bên rồi chọn **Cài đặt hệ thống**, hoặc nhấn vào tên và ảnh đại diện ở đầu thanh bên rồi chọn **Cài đặt hệ thống**. Trang chia ba nhóm: **Ứng dụng**, **Thông báo** và **Dữ liệu ngoại tuyến**.",
          },
          {
            type: "p",
            text: "Dòng **Kết nối** ở nhóm **Ứng dụng** cho biết trạng thái hiện tại: **Trực tuyến**, **Máy chủ đang gián đoạn** hoặc **Ngoại tuyến**.",
          },
          {
            type: "h2",
            text: "Ứng dụng và phiên bản",
          },
          {
            type: "ul",
            items: [
              "**Phiên bản**: số phiên bản đang chạy trên thiết bị; dòng dưới cho biết trạng thái dùng ngoại tuyến, ví dụ **Đã sẵn sàng dùng ngoại tuyến** hoặc **Có bản cập nhật, tải lại trang để áp dụng**.",
              "**Kiểm tra cập nhật**: kiểm tra phiên bản mới. Kết quả hiện ngay dưới dòng **Phiên bản**.",
              "**Cài lên thiết bị**: nút **Cài đặt** chỉ hiện khi trình duyệt cho phép cài; nếu không, nút **Cài trên điện thoại** mở hướng dẫn cài. Khi đã cài, dòng này ghi **Đã cài** hoặc **Đang chạy như ứng dụng**.",
            ],
          },
          {
            type: "h2",
            text: "Dữ liệu ngoại tuyến",
          },
          {
            type: "p",
            text: "Dòng **Dung lượng đã dùng** hiển thị dung lượng đã dùng và hạn mức; nút làm mới bên cạnh cập nhật số liệu. Các thao tác khác:",
          },
          {
            type: "ul",
            items: [
              "**Lưu trữ lâu dài**: nút **Bật** chỉ hiện khi chưa bật. Khi đã bật, trình duyệt không tự xóa dữ liệu ngoại tuyến khi thiếu dung lượng.",
              "**Xóa dữ liệu ngoại tuyến**: nút **Xóa…** mở khối xác nhận với ba lựa chọn **Xóa bộ đệm, giữ hộp thư đi**, **Xóa toàn bộ, kể cả hộp thư đi** và **Hủy**.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "**Xóa toàn bộ, kể cả hộp thư đi** cũng xóa các thao tác đang chờ gửi trên thiết bị này. Những thao tác đó chưa được gửi lên máy chủ. Nếu chưa chắc, hãy chọn **Xóa bộ đệm, giữ hộp thư đi**.",
          },
          {
            type: "h2",
            text: "Hàng đợi đồng bộ ngoại tuyến",
          },
          {
            type: "p",
            text: "Khi làm việc ngoại tuyến, các thao tác điều hành được ghi nhận trên thiết bị. Dòng **Hàng đợi đồng bộ** cho biết số thao tác chờ gửi và số xung đột phiên bản, nếu có.",
          },
          {
            type: "ol",
            items: [
              "Kiểm tra dòng **Kết nối** đang là **Trực tuyến**.",
              "Nhấn **Đồng bộ ngay** để gửi các thao tác chờ lên máy chủ. Nút chỉ bật khi có thao tác chờ gửi và đang có kết nối.",
            ],
          },
          {
            type: "p",
            text: "Khi có xung đột phiên bản, dòng **Hàng đợi đồng bộ** ghi rõ là có thao tác bị xung đột, cần xử lý thủ công.",
          },
        ],
      },
      {
        slug: "vai-tro-va-pham-vi-xem",
        title: "Vai trò và phạm vi xem",
        description:
          "Giải thích các nhóm vai trò trong QCET E-Office và phạm vi xem, thao tác với nhiệm vụ và văn bản.",
        icon: "Shield",
        blocks: [
          {
            type: "p",
            text: "Quyền của Thầy/Cô trong QCET E-Office phụ thuộc vào vai trò, đơn vị công tác và phạm vi được giao. Vai trò không tự cho phép xem mọi thứ. Khi xem nhiệm vụ hoặc văn bản, hệ thống còn kiểm tra quan hệ của Thầy/Cô với đối tượng đó.",
          },
          {
            type: "h2",
            text: "Các nhóm vai trò",
          },
          {
            type: "ul",
            items: [
              "**Ban Giám hiệu**: xem nhiệm vụ toàn Trường, tạo nhiệm vụ cấp Trường và cấp đơn vị, phê duyệt hoặc từ chối nhiệm vụ đang chờ duyệt. Không trực tiếp làm nghiệp vụ văn thư như đăng ký, cấp số, ban hành hoặc lưu trữ văn bản.",
              "**Trưởng đơn vị** (ví dụ trưởng phòng): tạo nhiệm vụ cấp đơn vị, chỉnh sửa nhiệm vụ của đơn vị, phê duyệt hoặc từ chối nhiệm vụ đang chờ duyệt trong đơn vị.",
              "**Chuyên viên và viên chức** (gồm giảng viên): xem nhiệm vụ được giao hoặc thuộc đơn vị mình; nộp kết quả khi là người chủ trì hoặc người thực hiện và nhiệm vụ đang thực hiện. Tạo được nhiệm vụ cá nhân nếu tài khoản đã gắn với đơn vị.",
              "**Văn thư**: thực hiện nghiệp vụ văn thư như đăng ký văn bản, cấp số, ban hành và lưu trữ văn bản.",
              "**Quản trị viên kỹ thuật** (quyền quản trị hệ thống): quản trị tài khoản, tổ chức, vị trí và cấu hình hệ thống. Không can thiệp vào nghiệp vụ, hồ sơ hay văn bản điều hành của Nhà trường.",
            ],
          },
          {
            type: "h2",
            text: "Nhiệm vụ và phạm vi",
          },
          {
            type: "p",
            text: "Thanh **Phạm vi công việc** có ba mục **Cá nhân**, **Đơn vị** và **Toàn trường**. Mỗi phạm vi quyết định nhiệm vụ nào được hiển thị:",
          },
          {
            type: "ul",
            items: [
              "**Cá nhân**: chỉ người được giao trực tiếp thấy, gồm người giao việc, người chủ trì, người phối hợp, người theo dõi và người được chỉ định duyệt. Trưởng đơn vị trực tiếp của người chủ trì cũng thấy.",
              "**Đơn vị**: nhiệm vụ của đơn vị, người cùng đơn vị xem được.",
              "**Toàn trường**: nhiệm vụ cấp Trường. Chỉ Ban Giám hiệu hoặc người được ủy quyền hợp lệ mới tạo được.",
            ],
          },
          {
            type: "p",
            text: "Người tạo nhiệm vụ hoặc người chịu trách nhiệm chính không được tự phê duyệt chính việc đó.",
          },
          {
            type: "h2",
            text: "Văn bản",
          },
          {
            type: "ul",
            items: [
              "Văn bản công khai: mọi tài khoản đang hoạt động đều xem được.",
              "Văn bản nội bộ: cần thuộc đơn vị, là lãnh đạo, hoặc có liên quan trực tiếp.",
              "Văn bản hạn chế và dữ liệu cá nhân: cần liên quan trực tiếp, có quyền được cấp riêng hoặc ủy quyền còn hiệu lực. Chỉ thuộc đơn vị là chưa đủ.",
            ],
          },
          {
            type: "p",
            text: "Văn bản đóng dấu **Mật**, **Tối mật** hoặc **Tuyệt mật** bị từ chối mặc định, trừ khi có chính sách đặc thù về bí mật nhà nước đã được phê duyệt. Văn thư và Quản trị viên kỹ thuật không tự động xem các văn bản mật.",
          },
          {
            type: "h2",
            text: "Ủy quyền",
          },
          {
            type: "p",
            text: "Khi được ủy quyền, Thầy/Cô thực hiện đúng hành động và phạm vi ghi trong ủy quyền, trong thời hạn còn hiệu lực và chưa bị thu hồi. Một số việc không ủy quyền được, như ngân sách, tài chính, kỷ luật, cấu hình hệ thống và quản lý tài khoản.",
          },
          {
            type: "callout",
            tone: "info",
            text: "Vai trò hiển thị trên hồ sơ cá nhân chỉ để xem. Nếu vai trò chưa đúng với công việc, Thầy/Cô liên hệ Quản trị viên hệ thống.",
          },
        ],
      },
    ],
  },
];
