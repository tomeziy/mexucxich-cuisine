# 03: Mở rộng POS: Đơn Giao hàng & Phí vận chuyển

**What to build:** Bổ sung lựa chọn hình thức bán: "Đơn tại chỗ" và "Đơn giao hàng" (Online / Ship). Đơn giao hàng lưu ở trạng thái "Đang chuẩn bị" hoặc "Đang giao" (trừ Tồn kho ngay tại thời điểm tạo đơn theo ADR-0003). Bổ sung ô nhập Phí vận chuyển thu hộ, cộng vào tổng tiền khách trả nhưng tách riêng khỏi Doanh thu thuần của quán. Bổ sung tab trạng thái đơn hàng trên đầu màn hình POS: "Bán tại quầy / Đang chuẩn bị (n) / Đang giao (n)". Cho phép bấm chuyển trạng thái: Đang chuẩn bị ➔ Đang giao ➔ Đã hoàn thành. Nút "Hủy đơn" tự động hoàn kho (auto-restock) lại toàn bộ số lượng món trong đơn.

**Blocked by:** 02: Màn hình POS: Chọn Sản phẩm & Tạo Đơn hàng Tại chỗ

**Status:** ready-for-agent

- [ ] Công tắc chuyển đổi hình thức: "Tại chỗ" vs "Giao hàng"
- [ ] Trường nhập "Phí vận chuyển (Phí ship)" và ghi chú Shipper (Ahamove, Grab, GHTK, Ship nhà...)
- [ ] Đơn giao hàng tạo mới trừ Tồn kho ngay lập tức để tránh bán trùng hàng thực phẩm tươi sống
- [ ] Thanh tab trạng thái trên đỉnh POS: hiển thị số lượng đơn "Đang chuẩn bị" và "Đang giao"
- [ ] Nút cập nhật trạng thái đơn nhanh: Đang chuẩn bị ➔ Đang giao ➔ Đã hoàn thành
- [ ] Nút "Hủy đơn" kích hoạt cơ chế Hoàn kho tự động (cộng trả lại tồn kho vào kệ)
- [ ] Phí vận chuyển được lưu riêng trong đối tượng Đơn hàng, sẵn sàng cho báo cáo tài chính
