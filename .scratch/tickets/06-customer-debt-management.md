# 06: Màn hình Khách hàng & Quản lý Công nợ

**What to build:** Màn hình quản lý danh sách Khách hàng và Sổ nợ: Thẻ tổng quan ở trên cùng "Tổng công nợ phải thu" (tổng tiền tất cả khách hàng đang nợ). Bảng danh sách Khách hàng gồm: Tên khách hàng, Số điện thoại, Địa chỉ, Số lần mua hàng, Tổng tiền đã mua, Tổng Dư nợ hiện tại. Nút "Thêm khách hàng mới". Khi bấm vào một Khách hàng, mở Drawer/Modal chi tiết: Lịch sử các đơn hàng nợ (Ngày mua, Mã đơn, Tổng đơn, Đã trả, Còn nợ) và Lịch sử các phiếu thu nợ đã trả. Nút "Thanh toán nợ" (Khách trả nợ): nhập số tiền khách vừa trả ➔ tự động trừ lùi Dư nợ lũy kế và lưu lịch sử Phiếu thu nợ.

**Blocked by:** 04: Mở rộng POS: Chọn Khách hàng, Ghi nợ & Thanh toán một phần

**Status:** completed

- [x] Thẻ tổng quan "Tổng công nợ phải thu" hiển thị số tiền lớn, rõ ràng
- [x] Bảng danh sách Khách hàng (Tên, SĐT, Địa chỉ, Lịch sử mua hàng, Tổng tiền đã mua, Dư nợ)
- [x] Tìm kiếm Khách hàng theo Tên hoặc Số điện thoại
- [x] Drawer/Modal Chi tiết Khách hàng hiển thị lịch sử đơn hàng phát sinh nợ và các lần thu nợ trước
- [x] Nút "Thanh toán nợ": popup nhập số tiền trả, phương thức (Tiền mặt / Chuyển khoản) và ghi chú
- [x] Tự động trừ lùi Dư nợ lũy kế theo nguyên tắc Sổ nợ lũy kế (ADR-0002)
- [x] Tạo bản ghi Phiếu thu nợ (Debt Payment) và lưu vết ngày giờ trả nợ

