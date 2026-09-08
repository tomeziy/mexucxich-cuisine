# 0002. Phân tách Luồng Đơn tại chỗ - Đơn Giao hàng và Cơ chế Sổ nợ Lũy kế

## Bối cảnh & Quyết định

Là một cửa hàng ẩm thực đa dạng bán cả tại quầy và online (Zalo/Facebook), MexucxichCuisine có hai luồng bán hàng khác biệt: bán trực tiếp xong ngay, và đơn giao hàng có độ trễ qua shipper. Ngoài ra, việc khách quen mua nợ và thanh toán nhiều lần tròn tiền cần một cơ chế tinh gọn.

Chúng tôi quyết định:
1. Phân loại hai hình thức bán hàng: `Đơn tại chỗ` (hoàn thành và trừ kho tức thì) và `Đơn giao hàng` (có các trạng thái: Đang chuẩn bị -> Đang giao -> Hoàn thành / Hủy).
2. Xây dựng cơ chế Quản lý Công nợ theo hình thức **Sổ nợ lũy kế (Running Balance)**: các khoản thanh toán nợ được trừ trực tiếp vào tổng dư nợ của khách hàng và lưu lại nhật ký phiếu thu nợ, thay vì bắt buộc đối soát kế toán khớp từng hóa đơn cũ.

## Hệ quả & Đánh đổi

- **Ưu điểm**: Thao tác bán hàng tại chỗ trong 2 giây; quản lý được hàng đang giao ngoài đường; ghi nhận thu nợ cực nhanh cho khách quen mà không bị sai sót số liệu.
- **Đánh đổi**: Không quản lý chi tiết tuổi nợ của từng hóa đơn riêng biệt theo chuẩn kế toán ERP phức tạp, nhưng hoàn toàn tối ưu cho thực tế kinh doanh F&B bán lẻ.
