# 07: Màn hình Báo cáo & Lịch sử Đơn hàng

**What to build:** Màn hình Báo cáo kinh doanh và tra cứu lịch sử đơn hàng: Hiển thị các chỉ số nhanh ở trên cùng: Tổng doanh thu hôm nay, Số đơn hàng hôm nay, Tổng lợi nhuận ước tính (tính bằng Doanh thu thuần trừ Tổng giá vốn theo ADR-0003, loại trừ Phí ship thu hộ). Bảng lịch sử đơn hàng đã bán: Mã đơn, Thời gian, Khách hàng, Hình thức (Tại chỗ / Giao hàng), Danh sách món và số lượng, Phí ship, Tổng tiền, Trạng thái đơn, Trạng thái thanh toán (Đã trả đủ / Còn nợ). Bộ lọc lịch sử đơn hàng theo Ngày/Tháng/Khoảng thời gian hoặc trạng thái đơn. Cho phép bấm xem lại chi tiết và in lại hóa đơn.

**Blocked by:** 02: Màn hình POS: Chọn Sản phẩm & Tạo Đơn hàng Tại chỗ

**Status:** completed

- [x] 3 Thẻ chỉ số tổng quan: Tổng doanh thu hôm nay, Số đơn hàng hôm nay, Lợi nhuận ước tính
- [x] Công thức tính Lợi nhuận ước tính chuẩn xác: Doanh thu thuần (Tổng tiền trừ Phí ship) - Tổng giá vốn
- [x] Bảng lịch sử Đơn hàng đầy đủ cột: Mã đơn, Thời gian, Tên KH, Loại đơn, Món đã mua, Phí ship, Tổng tiền, Trạng thái đơn, Trạng thái thanh toán
- [x] Bộ lọc đơn hàng theo Ngày, Tháng, hoặc tùy chọn Hôm nay / Hôm qua / 7 ngày qua / Tháng này
- [x] Bộ lọc theo trạng thái: Tất cả, Đang chuẩn bị, Đang giao, Đã hoàn thành, Đã hủy
- [x] Bấm vào dòng đơn hàng để mở popup xem chi tiết và nút "In lại hóa đơn"

