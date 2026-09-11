# 02: Màn hình POS: Chọn Sản phẩm & Tạo Đơn hàng Tại chỗ

**What to build:** Màn hình bán hàng chính (POS) hiển thị danh sách Sản phẩm gọn gàng với ảnh/emoji thumbnail, thanh tìm kiếm tức thì (hỗ trợ tiếng Việt không dấu), thanh cuộn Danh mục ngang có đếm số lượng món, và bộ lọc trạng thái tồn kho (Tất cả, Còn hàng, Sắp hết <= 5). Chạm vào món để thêm vào giỏ hàng, tùy chỉnh số lượng (+/-) hoặc xóa. Tự động tính: Tổng tiền hàng, Giảm giá (tiền mặt hoặc %), Tổng khách phải trả. Ô nhập Tiền khách đưa tự động tính Tiền thừa. Nút Thanh toán lưu Đơn hàng ở trạng thái Đã hoàn thành, trừ Tồn kho, và hiển thị Hóa đơn in xem trước.

**Blocked by:** 01: Khởi tạo Project Vite + React + Tailwind & Cấu trúc Routing

**Status:** completed

- [x] Lưới danh sách Sản phẩm có ảnh/emoji, tên món, đơn vị tính, giá bán, số lượng tồn kho
- [x] Cảnh báo trực quan (badge đỏ) cho sản phẩm có Tồn kho <= 5
- [x] Thanh tìm kiếm siêu nhanh hỗ trợ gõ không dấu (vd: "xuc xich" tìm ra "Xúc xích")
- [x] Thanh lọc Danh mục ngang hiển thị số lượng sản phẩm mỗi nhóm
- [x] Giỏ hàng hiển thị danh sách món đã chọn, cho phép tăng giảm số lượng (+/-) hoặc xóa
- [x] Tự động tính Tổng tiền hàng, Giảm giá (nhập số tiền hoặc %), Tổng tiền khách phải trả
- [x] Ô nhập Tiền khách đưa tự động tính Tiền thừa trả khách
- [x] Nút "Thanh toán" lưu Đơn hàng (loại Tại chỗ, trạng thái Đã hoàn thành), trừ Tồn kho và mở Hóa đơn in xem trước

