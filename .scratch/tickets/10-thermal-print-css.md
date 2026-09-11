# 10: Tối ưu Hóa đơn In ấn & CSS @media print

**What to build:** Xây dựng cơ chế in ấn hoàn hảo từ màn hình bán hàng và báo cáo lịch sử:
- Khi bấm nút "In hóa đơn" tại màn hình bán hàng hoặc màn hình báo cáo, tự động kích hoạt hộp thoại in ấn của trình duyệt (`window.print()`).
- Tối ưu CSS chuyên biệt cho bản in qua `@media print`:
  + Ẩn toàn bộ giao diện app (thanh điều hướng, menu, thanh cuộn, các nút bấm).
  + Chỉ hiển thị duy nhất tờ hóa đơn nằm gọn gàng theo đúng khổ giấy đã chọn (K80: đúng 80mm, K57: đúng 57mm, A5/A4).
  + Chữ in màu đen tuyền (#000) độ tương phản cao, phông chữ monospaced hoặc sans-serif nét đậm, căn chỉnh lề chuẩn 0mm-2mm chống tràn giấy hoặc đè chữ.
  + Mã VietQR in ra rõ nét, máy ảnh điện thoại quét được ngay trên giấy in nhiệt.

**Blocked by:** 09: Cài đặt Mẫu Hóa đơn & Xem trước Trực quan (Live Preview)

**Status:** completed

- [x] Hàm kích hoạt in ấn gọi `window.print()` chuẩn xác trên cả Chrome, Safari, Edge
- [x] CSS `@media print` ẩn 100% các thành phần giao diện không liên quan
- [x] Căn chỉnh kích thước chính xác cho khổ in nhiệt K80 (80mm) và K57 (57mm)
- [x] Xử lý ngắt trang (`page-break-inside: avoid`), không bị cắt ngang dòng chữ giữa chừng
- [x] Ảnh mã VietQR và logo hiển thị rõ ràng trên bản in nhiệt đơn sắc
- [x] Kiểm thử in thử trên trình duyệt (Print Preview) đạt độ nét cao

