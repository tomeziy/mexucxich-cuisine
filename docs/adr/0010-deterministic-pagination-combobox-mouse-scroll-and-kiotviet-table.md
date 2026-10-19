# 0010. Phân Trang Tất Định, Tối Ưu Tương Tác Chuột Combobox và Phân Trang Khách Hàng Chuẩn KiotViet

## Bối cảnh & Vấn đề

Qua 2 video thực nghiệm vận hành do bạn Hằng ghi lại từ màn hình cửa hàng:
1. **Lỗi Nhân Bản 372 Khách Hàng và Mất Khách Hàng (`Yến Thanh Phan`)**:
   - Khi kéo dữ liệu từ Supabase theo từng trang 1.000 dòng, câu lệnh query `.order('created_at', { ascending: false })` thiếu trường phụ tiebreaker.
   - Do 3.077 khách hàng import từ Excel có cùng một mốc thời gian `created_at` (xuống tới mili-giây), PostgreSQL sắp xếp không tất định (non-deterministic), khiến 372 khách hàng bị trả về trùng lặp 2–4 lần ở các trang khác nhau (như `Yen Nguyen`, `Lê Yến`), đồng thời làm thất lạc 372 khách hàng khác (như `Yến Thanh Phan`).
2. **Lỗi Nhảy Đúp Cuộn & Click Trượt ở POS (`CustomerCombobox`)**:
   - Khi kéo thanh cuộn bằng chuột, sự kiện `onMouseEnter` trên các dòng khách hàng liên tục thay đổi `highlightedIndex`, kích hoạt `scrollIntoView` ép cuộn ngược về vị trí chuột.
   - Sự kiện `onClick` bị cạnh tranh bởi `mousedown` ngoài vùng hoặc blur input khiến thao tác chạm chọn khách hàng không phản hồi.
3. **Màn Hình Khách Hàng Quá Dài, Thiếu Diện Tích**:
   - Bảng khách hàng hiển thị toàn bộ 3.077 dòng cùng lúc, gây quá tải DOM, giật lag khi gõ tìm kiếm và thiếu diện tích hiển thị.
   - Thuật toán tìm kiếm substring đơn giản khiến từ khóa `"yến"` kéo theo hàng trăm khách hàng mang họ `"Nguyễn"`.

## Quyết định Thiết kế

Chúng tôi quyết định:

### 1. Phân Trang Tất Định & Bộ Lọc Trùng Phòng Thủ (Deterministic Pagination & Deduplication)
- Bổ sung trường tiebreaker vào Supabase query: `.order('created_at', { ascending: false }).order('id', { ascending: true })`.
- Tích hợp bộ đệm `seenIds = new Set<string>()` trong `fetchTableWithPagination` và `mergeCustomersWithConflictResolution`, loại bỏ hoàn toàn khả năng lọt bản ghi trùng lặp vào bộ nhớ client.

### 2. Tách Biệt Cuộn Phím và Tương Tác Chuột tại POS
- Sử dụng cờ ref `isKeyboardNavRef = useRef(false)`. Chỉ thực thi `scrollIntoView()` khi người dùng điều hướng bằng phím mũi tên (`ArrowUp`/`ArrowDown`). Khi di chuột hoặc kéo thanh cuộn, giao diện chỉ làm nổi bật dòng hover mà tuyệt đối không can thiệp vị trí cuộn.
- Bổ sung `onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}` để kích hoạt chọn khách hàng tức thì ngay khi nhấn chuột mà không bị mất focus.
- Nâng cấp thuật toán tìm kiếm token đa từ (`cleanQuery.split(/\s+/)`) và ưu tiên khớp nguyên từ (`Whole-Word Match`): xếp các khách hàng có từ "Yến" đứng đầu (điểm 110–120), phân biệt rạch ròi với họ "Nguyễn" (điểm 60).

### 3. Phân Trang Chuẩn KiotViet Cho Màn Hình Khách Hàng (`CustomersPage`)
- Bổ sung state phân trang mặc định 20 khách/trang (hỗ trợ tùy chọn 50, 100 khách/trang).
- Tự động chuyển về Trang 1 khi thay đổi từ khóa tìm kiếm hoặc bộ lọc công nợ.
- Thêm thanh điều khiển phân trang dưới chân bảng: hiển thị tổng số bản ghi, nút chuyển trang trước/sau, trang đầu/cuối và huy hiệu trang hiện tại.

## Hệ quả & Đánh đổi

- **Tích cực**:
  * Tải trọn vẹn và chuẩn xác 100% 3.077 khách hàng duy nhất từ Supabase (0 bản ghi trùng).
  * Tìm kiếm `Yến Thanh Phan` ra ngay kết quả chính xác.
  * Thao tác cuộn chuột và click chọn khách hàng tại quầy POS êm mượt, không giật nhảy.
  * Giao diện Quản lý Khách hàng & Công nợ nhẹ, gọn gàng, quen thuộc như KiotViet.
