# 0007. Khớp Cột Excel Mềm Dẻo, Hộp Thoại Xử Lý Trùng Lặp, Sửa Khách Hàng Tại Quầy và Chuẩn Hóa Font In Arial

## Bối cảnh & Vấn đề

Qua phản hồi vận hành thực tế từ chủ tiệm (bạn Hằng), hệ thống ghi nhận 3 nhóm điểm nghẽn nghiêm trọng:
1. **Lỗi Nhập Excel Sản phẩm & Khách hàng ("vẫn ko dùng đc")**:
   - Bộ đọc tệp cũ khớp chuỗi tiêu đề cột quá cứng nhắc (`Tên Món Ăn`, `Tên Khách Hàng (*)`), khiến các bảng tính có tên cột thông dụng (`Tên sản phẩm`, `Mặt hàng`, `Đơn giá`, `SĐT`, `Khách hàng`...) bị từ chối 100%.
   - Số tiền có dấu chấm phân cách hàng nghìn (`"130.000"`) bị parse thành `130đ`, chuỗi có ký hiệu (`"130.000đ"`) bị chuyển về `NaN` (`0đ`).
   - Số điện thoại bị Excel cắt mất số `0` ở đầu khiến thuật toán tìm kiếm không nhận diện được khách cũ, dẫn đến sinh khách hàng trùng lặp.
   - Hàm sinh mã ID (`Date.now().slice(-4)`) trong vòng lặp đồng bộ gây trùng ID hàng loạt, khiến Supabase `.upsert()` tự động ghi đè và làm mất dữ liệu.
2. **Không có tính năng Sửa / Cập nhật Khách hàng**:
   - Giao diện `CustomersPage` thiếu hoàn toàn nút và Modal chỉnh sửa thông tin (Tên, SĐT, Địa chỉ).
   - Màn hình Bán hàng `PosPage` không có lối tắt sửa nhanh khi khách gọi điện thông báo đổi địa chỉ giao hàng hoặc số điện thoại mới.
3. **Mẫu in Hóa đơn Nhiệt K80 bị Đậm, Béo và Tốn diện tích**:
   - Sử dụng phông web bo tròn hình học (`Plus Jakarta Sans`) làm chữ nở to bề ngang, tốn diện tích cuộn giấy.
   - Lạm dụng `font-black` (độ đậm 900) kết hợp `tracking-wider` (khoảng cách chữ rộng) gây hiện tượng loang nhiệt (thermal dot gain) ở độ phân giải 203 DPI, khiến chữ bị bết dính mực và khoảng cách chữ rời rạc.
   - Nút "In thử (K80)" ở trang Cài đặt in ra trang trắng do thiếu cổng truyền dữ liệu portal `#print-root`.

## Quyết định Thiết kế

Chúng tôi quyết định:

### 1. Bộ máy Nhập Excel Mềm dẻo & Hộp thoại Xử lý Trùng lặp Thông minh (Fuzzy Import & Duplicate Resolution)
- **Khớp cột mềm dẻo (Fuzzy Alias Dictionary)**: Chuẩn hóa toàn bộ tiêu đề cột (bỏ dấu tiếng Việt, viết thường, loại bỏ khoảng trắng và ký tự đặc biệt). Khớp tự động qua từ điển bí danh:
  - Tên món: `tensanpham`, `tenmonan`, `tenmon`, `tenhang`, `mathang`, `sanpham`, `monan`, `name`.
  - Giá bán: `giaban`, `dongia`, `giale`, `gia`, `price`.
  - Giá vốn: `giavon`, `gianhap`, `giamua`, `cost`.
  - Tồn kho: `tonkho`, `soluong`, `ton`, `stock`, `qty`.
  - Khách hàng: `tenkhachhang`, `tenkhach`, `khachhang`, `hovaten`, `hoten`, `name`.
  - SĐT: `sodienthoai`, `sdt`, `dienthoai`, `phone`.
  - Địa chỉ: `diachi`, `diachigiaohang`, `address`.
  - Dư nợ: `dunobandau`, `duno`, `congno`, `nocu`, `tienno`, `debt`.
- **Bộ chuẩn hóa số & SĐT**: Tự động bóc tách dấu chấm/phẩy ngăn cách nghìn (`130.000` $\rightarrow$ `130000`), tự động bù số `0` ở đầu SĐT 9 chữ số.
- **Hộp thoại Xử lý Trùng lặp Trực quan (Duplicate Resolution Modal)**:
  - Với **Khách hàng**: Hiển thị cảnh báo trùng SĐT/Tên, hiển thị rõ số nợ cũ + nợ file. Cung cấp 3 lựa chọn cho từng dòng (`Cộng dồn nợ`, `Ghi đè`, `Bỏ qua`), cho phép sửa trực tiếp SĐT/Tên ngay trên bảng xem trước, và hỗ trợ nút thao tác hàng loạt (`Đồng ý tất cả (Cộng dồn)` / `Bỏ qua tất cả trùng`).
  - Với **Sản phẩm**: Tương tự, cho phép chủ tiệm chọn `Cộng dồn kho`, `Ghi đè` hoặc `Bỏ qua` cho từng món hoặc hàng loạt.
- **Triệt tiêu Trùng lặp ID**: Bổ sung hàm nạp hàng loạt `addProductsBatch` và `addCustomersBatch` với mã định danh độc nhất phân giải cao (ví dụ: `SP_${Date.now()}_${idx}`). Reset `e.target.value = ''` để cho phép chọn lại file ngay lập tức.

### 2. Quản trị Chỉnh sửa Khách hàng Đa điểm (Multi-touchpoint Customer Editing)
- **Trang Khách hàng (`CustomersPage`)**: Thêm nút Sửa (Icon Bút chì `Edit2`) tại từng dòng khách hàng; mở Modal chỉnh sửa Tên, SĐT, Địa chỉ.
- **Màn hình Bán hàng (`PosPage`)**: Thêm nút icon Sửa thông tin ngay cạnh tên khách khi đã chọn trong ô tìm kiếm. Thu ngân sửa trực tiếp SĐT/Địa chỉ giao hàng 1-chạm mà không cần rời màn hình POS.
- **Bảo toàn Dữ liệu Lịch sử**: Khi cập nhật thông tin khách hàng, hệ thống chỉ cập nhật hồ sơ danh bạ và biểu mẫu đơn hàng hiện tại; tuyệt đối bảo toàn snapshot địa chỉ và số điện thoại trên các hóa đơn cũ trong lịch sử để đảm bảo tính toàn vẹn chứng từ kế toán.

### 3. Chuẩn hóa Phông chữ In nhiệt Arial & Tối ưu Typography Hóa đơn
- **Phông chữ Arial chuyên dụng**:
  - Bổ sung tùy chọn `fontFamily: 'arial' | 'system'` trong `ReceiptSettings` (mặc định: `'arial'`).
  - Áp dụng cấu hình `@media print { #print-root, #print-root * { font-family: Arial, sans-serif !important; } }`.
- **Triệt tiêu hiện tượng Loang nhiệt (Thermal Dot-Gain Elimination)**:
  - Loại bỏ hoàn toàn `font-black` (900): chuyển Tên cửa hàng & Tổng thanh toán sang `font-bold` (700); Tên món sang `font-semibold` (600); các thông tin đơn giá, số lượng, ngày giờ, lời chúc sang `font-normal` (400) / `font-medium` (500).
  - Loại bỏ `tracking-wider`, đưa về `tracking-normal` / `tracking-tight` để chữ cái liền mạch, thanh mảnh, sắc nét và tiết kiệm 15-20% chiều dài giấy in.
- **Thống nhất Component Hóa đơn**:
  - Tạo component tái sử dụng `<ThermalReceipt />` dùng chung cho cả `ReceiptModal` (POS) và bản xem trước/in thử tại `SettingsPage`.
  - Khắc phục hoàn toàn lỗi nút "In thử (K80)" in ra trang trắng.

## Hệ quả & Đánh đổi

- **Ưu điểm**:
  - Khắc phục 100% tất cả các lỗi và rào cản bạn Hằng gặp phải.
  - Tương thích với hầu hết các định dạng bảng tính Excel xuất ra từ các phần mềm khác nhau hoặc file tự tạo.
  - Hóa đơn in nhiệt nét căng, chữ không bị béo mờ hay dính mực, tiết kiệm giấy in.
  - Vận hành linh hoạt, sửa thông tin khách hàng tức thì ngay tại quầy.
- **Đánh đổi**:
  - Modal xem trước Excel cần thêm logic xử lý trạng thái từng dòng (Cộng dồn / Ghi đè / Bỏ qua), làm tăng nhẹ kích thước mã nguồn giao diện nhưng mang lại trải nghiệm chuyên nghiệp vượt trội.
