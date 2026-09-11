# 11: Sao lưu & Khôi phục 1-Click và Tự động Deploy GitHub Pages

**What to build:**
1. Tính năng "Sao lưu & Khôi phục 1-Click" (ADR-0001):
   - Nút "Sao lưu dữ liệu": Xuất toàn bộ dữ liệu hệ thống (Sản phẩm, Khách hàng, Lịch sử đơn hàng, Phiếu thu nợ, Cài đặt hóa đơn) thành 1 tệp JSON có đánh dấu ngày giờ (`mexucxich_backup_YYYY-MM-DD.json`).
   - Nút "Khôi phục dữ liệu": Tải tệp JSON backup lên ➔ hiển thị cảnh báo xác nhận ➔ khôi phục toàn bộ dữ liệu vào LocalStorage.
   - Nút "Xóa dữ liệu / Đặt lại về mặc định" (có xác nhận 2 lần) để kiểm thử dữ liệu mẫu.
2. Tự động Deploy GitHub Pages:
   - Cấu hình GitHub Actions workflow (`.github/workflows/deploy.yml`) để tự động build Vite React và deploy thư mục `dist/` lên GitHub Pages (`https://tomeziy.github.io/mexucxich-cuisine/`) mỗi khi push code lên nhánh `main`.
   - Kiểm tra build `npm run build` không có lỗi TypeScript hay linter.

**Blocked by:** 08: Xuất / Nhập Dữ liệu Excel & CSV (SheetJS)

**Status:** completed

- [x] Nút "Sao lưu toàn bộ dữ liệu" xuất tệp JSON đầy đủ cấu trúc
- [x] Nút "Khôi phục dữ liệu" đọc tệp JSON, kiểm tra tính hợp lệ và cập nhật LocalStorage
- [x] Tính năng "Đặt lại dữ liệu mẫu (Mock Data)" tiện lợi cho việc demo
- [x] Tệp GitHub Actions workflow tự động deploy lên GitHub Pages khi push `main`
- [x] Lệnh `npm run build` thành công, tạo thư mục `dist/` tối ưu
- [x] Ứng dụng chạy mượt mà trên URL chính thức của bạn Hằng

