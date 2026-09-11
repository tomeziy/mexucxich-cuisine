# 08: Xuất / Nhập Dữ liệu Excel & CSV (SheetJS)

**What to build:** Tích hợp thư viện SheetJS (xlsx) để xuất và nhập dữ liệu chuẩn định dạng UTF-8 tiếng Việt:
1. Xuất dữ liệu:
   - Màn hình Quản lý Sản phẩm: Nút "Xuất file Excel" tải về toàn bộ danh sách sản phẩm (Mã SP, Tên, Danh mục, Đơn vị, Giá vốn, Giá bán, Tồn kho).
   - Màn hình Báo cáo: Nút "Xuất báo cáo Excel" tải danh sách hóa đơn theo khoảng thời gian đã lọc.
   - Màn hình Khách hàng: Nút "Xuất danh sách nợ" tải danh sách khách hàng kèm số dư nợ hiện tại.
2. Nhập dữ liệu:
   - Màn hình Quản lý Sản phẩm: Nút "Nhập từ Excel" tải file lên để thêm nhanh danh sách sản phẩm hàng loạt vào kho.
   - Màn hình Khách hàng: Nút "Nhập từ Excel" tải file danh sách khách hàng.
   - Modal xem trước (Preview) dữ liệu trước khi bấm xác nhận nhập.
   - Thông báo kết quả rõ ràng: Nhập thành công bao nhiêu dòng hoặc báo lỗi nếu sai định dạng cột.
   - Nút "Tải file mẫu Excel (.xlsx)" cho cả Sản phẩm và Khách hàng.

**Blocked by:** 05: Màn hình Quản lý Sản phẩm & Kho, 06: Màn hình Khách hàng & Quản lý Công nợ, 07: Màn hình Báo cáo & Lịch sử Đơn hàng

**Status:** completed

- [x] Cài đặt và tích hợp thư viện `xlsx` (SheetJS) hoạt động 100% trên trình duyệt
- [x] Tính năng Xuất Excel cho Sản phẩm, Báo cáo Đơn hàng, và Danh sách Công nợ
- [x] Đảm bảo file Excel xuất ra hiển thị đúng font tiếng Việt có dấu và định dạng cột đẹp mắt
- [x] Tính năng Nhập Excel cho Sản phẩm có bảng xem trước (Preview) dữ liệu trước khi lưu
- [x] Tính năng Nhập Excel cho Khách hàng có bảng xem trước dữ liệu
- [x] Cung cấp nút tải về File mẫu Excel chuẩn để người dùng nhập liệu dễ dàng
- [x] Kiểm tra và xử lý lỗi dữ liệu (dòng trống, giá sai định dạng, thiếu tên...) kèm thông báo thân thiện

