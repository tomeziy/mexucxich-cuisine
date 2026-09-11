# 04: Mở rộng POS: Chọn Khách hàng, Ghi nợ & Thanh toán một phần

**What to build:** Cho phép chọn Khách hàng từ danh sách hoặc bấm "Thêm nhanh Khách hàng mới" (Tên, Số điện thoại, Địa chỉ) ngay tại màn hình POS. Bổ sung 4 phương thức thanh toán: Tiền mặt, Chuyển khoản (VietQR), Cho nợ (Ghi nợ), và Thanh toán một phần (nhập số tiền trả trước, tự động tính số tiền còn nợ lại). Nếu đơn hàng phát sinh nợ, hệ thống tự động cộng số nợ đó vào Dư nợ lũy kế của Khách hàng theo nguyên tắc Sổ nợ lũy kế (ADR-0002).

**Blocked by:** 02: Màn hình POS: Chọn Sản phẩm & Tạo Đơn hàng Tại chỗ

**Status:** completed

- [x] Dropdown chọn Khách hàng hiển thị Tên, SĐT và Dư nợ hiện tại (nếu có)
- [x] Modal/Popup "Thêm nhanh Khách hàng mới" (Tên, SĐT, Địa chỉ) không làm mất giỏ hàng đang chọn
- [x] 4 Phương thức thanh toán: Tiền mặt / Chuyển khoản / Ghi nợ / Trả 1 phần
- [x] Trường nhập "Khách trả trước" khi chọn "Trả 1 phần", tự tính "Còn nợ lại"
- [x] Cảnh báo rõ ràng khi chọn Ghi nợ cho khách hàng
- [x] Tự động cập nhật cộng dồn Dư nợ vào hồ sơ Khách hàng khi đơn hàng phát sinh nợ
- [x] Lưu vết khoản nợ phát sinh gắn liền với Mã Đơn hàng

