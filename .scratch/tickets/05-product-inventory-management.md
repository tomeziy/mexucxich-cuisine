# 05: Màn hình Quản lý Sản phẩm & Kho

**What to build:** Màn hình quản lý danh mục Sản phẩm và Tồn kho dạng bảng trực quan: Hình ảnh/emoji, Mã SP, Tên Sản phẩm, Danh mục, Đơn vị tính, Giá vốn, Giá bán, Tồn kho. Cảnh báo trực quan (màu đỏ / badge nổi bật) nếu Tồn kho <= 5. Nút "Thêm sản phẩm mới" với modal nhập: Tên, Mã SP (hoặc tự sinh), Giá vốn, Giá bán, Danh mục, Đơn vị tính, Số lượng ban đầu và tải ảnh/chọn icon. Cho phép Chỉnh sửa thông tin Sản phẩm hoặc Xóa Sản phẩm (có hộp thoại xác nhận an toàn).

**Blocked by:** 01: Khởi tạo Project Vite + React + Tailwind & Cấu trúc Routing

**Status:** ready-for-agent

- [ ] Bảng danh sách Sản phẩm hiển thị đầy đủ thông tin: Ảnh/emoji, Mã SP, Tên món, Danh mục, Đơn vị tính, Giá vốn, Giá bán, Tồn kho
- [ ] Cảnh báo đỏ nổi bật đối với các sản phẩm có Tồn kho <= 5
- [ ] Thanh tìm kiếm Sản phẩm theo Tên/Mã và bộ lọc theo Danh mục
- [ ] Modal "Thêm sản phẩm mới" đầy đủ các trường: Tên, Mã, Giá vốn, Giá bán, Danh mục, Đơn vị tính, Tồn kho ban đầu, Tải ảnh (hoặc chọn emoji)
- [ ] Modal "Chỉnh sửa sản phẩm" cập nhật thông tin và số lượng tồn kho
- [ ] Tính năng "Xóa sản phẩm" có cảnh báo xác nhận để tránh bấm nhầm
- [ ] Dữ liệu thay đổi tự động đồng bộ tức thì với màn hình POS và LocalStorage
