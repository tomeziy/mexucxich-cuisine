# 09: Cài đặt Mẫu Hóa đơn & Xem trước Trực quan (Live Preview)

**What to build:** Màn hình/Tab riêng "Cài đặt Hóa đơn" cho phép người dùng tùy biến mẫu hóa đơn in:
- Thông tin cửa hàng: Tên cửa hàng, Địa chỉ, Số điện thoại, Lời cảm ơn chân trang (Footer), tải Logo cửa hàng lên.
- Cấu hình khổ giấy: K80 (80mm), K57 (57mm), A5, A4.
- Cấu hình tài khoản ngân hàng nhận tiền: Danh sách hơn 40 ngân hàng Việt Nam (Vietcombank, MB, Techcombank, ACB, VPBank...), Số tài khoản, Tên chủ tài khoản.
- Công tắc Toggle bật/tắt các trường hiển thị trên hóa đơn:
  + Hiển thị Logo
  + Hiển thị Tên nhân viên bán hàng
  + Hiển thị Thông tin Khách hàng & Công nợ (nếu có)
  + Hiển thị Mã QR thanh toán VietQR (tự động tạo mã QR Napas dựa trên STK và số tiền đơn hàng)
- Khung xem trước trực quan (Live Preview): Thay đổi cài đặt bên trái đến đâu, mẫu hóa đơn bên phải cập nhật ngay lập tức đến đó.

**Blocked by:** 02: Màn hình POS: Chọn Sản phẩm & Tạo Đơn hàng Tại chỗ

**Status:** ready-for-agent

- [ ] Form nhập thông tin cửa hàng: Tên tiệm, Địa chỉ, Hotline, Lời chúc/cảm ơn footer, tải ảnh logo
- [ ] Lựa chọn khổ giấy in: K80 (mặc định), K57, A5, A4
- [ ] Dropdown chọn Ngân hàng (danh sách chuẩn VietQR), ô nhập STK và Tên chủ tài khoản
- [ ] 4 Công tắc bật/tắt: Logo, Tên nhân viên, Thông tin khách & nợ, Mã VietQR
- [ ] Khung Live Preview hiển thị hóa đơn mẫu cập nhật thời gian thực theo cấu hình
- [ ] Tích hợp API VietQR mở tạo ảnh QR động đúng chuẩn Napas theo số tiền mẫu
- [ ] Cài đặt được lưu bền vững vào LocalStorage
