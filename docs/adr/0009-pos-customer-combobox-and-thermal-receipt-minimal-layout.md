# 0009. Hộp Tìm Kiếm Khách Hàng Thông Minh (Customer Combobox) và Tối Giản Hóa Mẫu In Nhiệt

## Bối cảnh & Vấn đề

Từ dữ liệu vận hành thực tế của cửa hàng và phản ánh trực tiếp từ chủ tiệm (bạn Hằng):
1. **Lỗi Trải nghiệm Chọn Khách hàng tại POS**:
   - Khi cơ sở dữ liệu khách hàng tăng lên hơn 3.000 bản ghi, việc sử dụng thẻ `<select>` HTML đơn giản bộc lộ điểm yếu chết người: không hiển thị chữ người dùng đang gõ, không có con trỏ nhập liệu, phím gõ chỉ nhảy theo ký tự đơn lẻ và tự xóa sau 1 giây. Thu ngân không thể tìm kiếm theo cụm từ tiếng Việt có dấu, số điện thoại hay địa chỉ.
2. **Dư Thừa Dòng Trên Hóa Đơn In Nhiệt K80**:
   - Hóa đơn thực tế in ra chứa 4 dòng dư thừa đã bị chủ tiệm gạch bỏ trực tiếp trên bản in giấy:
     * `Hình thức: TẠI CHỖ`
     * `Phương thức: Ghi nợ 100%` (hoặc Tiền mặt / Chuyển khoản)
     * `Ghi nợ đơn này: +290.000đ`
     * `Mexucxich Cuisine - Ẩm thực thủ công & Đặc sản tuyển chọn` (dòng slogan phụ lặp lại)
   - Các dòng này chiếm diện tích giấy cuộn nhiệt K80 và làm rối mắt khách nhận bill.

## Quyết định Thiết kế

Chúng tôi quyết định:

### 1. Xây dựng Component Customer Combobox Chuyên dụng
- Thay thế thẻ `<select>` bằng component `<CustomerCombobox>` có ô text input hiển thị trực quan ký tự đang gõ, hỗ trợ phím xóa nhanh và phím tắt bàn phím (Mũi tên Lên/Xuống, Enter, Escape).
- **Thuật toán Xếp hạng (Ranking Algorithm)**:
  1. *Hạng 1*: Khớp tiền tố (Prefix match) ở đầu tên khách hàng hoặc đầu số điện thoại.
  2. *Hạng 2*: Khách hàng có phát sinh đơn gần đây hoặc đang có dư nợ (`debt > 0`).
  3. *Hạng 3*: Khớp chuỗi con bất kỳ trong tên hoặc địa chỉ (loại bỏ dấu tiếng Việt qua `removeVietnameseTones`).
- **Tối ưu Hiệu năng Render**: Giới hạn hiển thị 25–30 kết quả phù hợp nhất trong popover có thanh cuộn mượt mà để chống giật lag DOM khi danh mục khách vượt 10.000 người.
- **Tạo Khách Nhanh Trực tiếp (Inline Quick Add)**: Nếu từ khóa không tìm thấy ai trong hệ thống, hiển thị ngay nút `+ Thêm nhanh khách "[Tên vừa gõ]"` mở modal tạo khách với tên đã điền sẵn.

### 2. Tối Giản Mẫu In Hóa Đơn Nhiệt K80 (4-Line Omission)
- **Xóa vĩnh viễn dòng slogan phụ**: Loại bỏ dòng lặp `Mexucxich Cuisine - Ẩm thực thủ công & Đặc sản tuyển chọn` ở chân bill, giữ lại duy nhất lời chúc `Chúc quý khách có một bữa ăn hạnh phúc!`.
- **Bổ sung 3 công tắc cấu hình trong ReceiptSettings với mặc định TẮT (Ẩn)**:
  * `showOrderType`: Mặc định `false`. Ẩn triệt để dòng `Hình thức: ...` trên hóa đơn. Nếu đơn là Giao hàng, hệ thống chỉ in `Địa chỉ` và `Ghi chú ship`.
  * `showPaymentMethod`: Mặc định `false`. Ẩn dòng `Phương thức: Tiền mặt / Chuyển khoản / Ghi nợ 100%`.
  * `showDebtInfo`: Mặc định `false`. Ẩn dòng `Ghi nợ đơn này: +...đ` bên dưới tổng tiền.
- Hóa đơn in ra chuyển ngay từ `TỔNG THANH TOÁN` sang `THÔNG TIN CHUYỂN KHOẢN (VietQR)` một cách gọn gàng, súc tích và tiết kiệm giấy in nhiệt.

## Hệ quả & Đánh đổi

- **Tích cực**:
  * Tốc độ tìm và chọn khách quen tại quầy giảm từ hàng chục giây xuống dưới 2 giây.
  * Hóa đơn in ra tiết kiệm 2–3 cm chiều dài giấy mỗi đơn, đáp ứng 100% yêu cầu thực tế của tiệm.
- **Đánh đổi**:
  * Nếu sau này cửa hàng muốn hiển thị lại phương thức thanh toán hoặc dòng ghi nợ trên bill, quản lý chỉ cần vào Cài đặt gạt bật lại công tắc tương ứng.
