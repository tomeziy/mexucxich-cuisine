# 0003. Cơ chế Trừ kho tức thì, Tự động Hoàn kho và Tách bạch Doanh thu Phí vận chuyển

## Bối cảnh & Quyết định

Với đặc thù bán thực phẩm tươi sống và đặc sản có hạn sử dụng ngắn, đơn hàng giao đi (Delivery Orders) cần tránh tuyệt đối việc bán trùng hoặc bán âm khi hàng đã được lấy ra đóng gói. Đồng thời, phí vận chuyển (shipper Ahamove, Grab, GHTK) thu hộ không phải là doanh thu thực tế của quán ẩm thực.

Chúng tôi quyết định:
1. **Trừ kho tức thì**: Tồn kho bị trừ ngay tại thời điểm tạo đơn hàng (ở cả trạng thái Đang chuẩn bị và Đang giao). Nếu đơn hàng bị hủy hoặc giao thất bại, hành động "Hủy đơn" sẽ kích hoạt cơ chế hoàn kho tự động (auto-restock) toàn bộ số lượng của các món trong đơn.
2. **Tách riêng Phí vận chuyển**: Phí ship được ghi nhận như một khoản thu hộ riêng biệt trên hóa đơn. Doanh thu thuần tính bằng: `Tổng tiền - Phí ship`. Lợi nhuận ước tính bằng: `Doanh thu thuần - Tổng giá vốn`.

## Hệ quả & Đánh đổi

- **Ưu điểm**: Quản lý tồn kho thực tế chính xác 100%, bảo vệ dữ liệu lợi nhuận ròng của cửa hàng.
- **Đánh đổi**: Đơn hàng khi hủy sẽ tạo biến động tồn kho ngược lại, cần lưu vết lịch sử rõ ràng.
