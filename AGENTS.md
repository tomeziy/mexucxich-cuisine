# MexucxichCuisine — Agent Guidelines & Project Memory

Ứng dụng Web quản lý bán hàng (POS), kho hàng, công nợ khách hàng và in ấn hóa đơn nhiệt theo phong cách KiotViet tối giản dành riêng cho thương hiệu **MexucxichCuisine**.

---

## 🎯 Thông tin Dự án & Chủ sở hữu
- **Chủ cửa hàng / Khách hàng:** Bạn Hằng — *Artisan Food Curator & Merchant* (Nhà sáng lập & Giám tuyển Ẩm thực Tuyển chọn).
- **Mô hình kinh doanh:** Vừa tự sản xuất các món thủ công (xúc xích phô mai, bò tiêu đen, pate truffle, chả...) vừa tuyển chọn đặc sản các vùng miền (lạp xưởng, khô bò, nem nướng...). Thực đơn phong phú lên đến hàng trăm món.
- **Kênh bán hàng:** Bán tại chỗ (quầy/bếp) kết hợp bán trực tuyến qua Zalo, Facebook, Điện thoại.
- **Kho lưu trữ GitHub:** [`https://github.com/tomeziy/mexucxich-cuisine`](https://github.com/tomeziy/mexucxich-cuisine)
- **Bản chạy thử Online (GitHub Pages):** [`https://tomeziy.github.io/mexucxich-cuisine/`](https://tomeziy.github.io/mexucxich-cuisine/)

---

## 🎨 Chuẩn mực Thiết kế Giao diện (UI/UX Standards)
- **Phong cách:** KiotViet tối giản, hiện đại, sạch sẽ, thao tác nhanh 1-chạm.
- **Màu sắc chủ đạo:** 
  - Vàng Mật Ong / Vàng Hổ Phách (`#F59E0B`, `#D97706`, `#B45309`)
  - Trắng Tinh tế (`#FFFFFF`) kết hợp Nền Xám Nhạt (`#F8FAFC`, `#F1F5F9`)
  - Điểm nhấn trạng thái: Xanh ngọc (`#10B981` - Thành công/Đủ tiền), Đỏ thắm (`#EF4444` - Cảnh báo tồn kho <= 5, Nợ).
- **Ngôn ngữ ứng dụng:** 100% Tiếng Việt có dấu, phông chữ sans-serif hiện đại (Plus Jakarta Sans hoặc Inter), tối ưu chống mỏi mắt dưới ánh đèn quầy hàng.
- **Khả năng tương thích thiết bị:** 
  - Màn hình Desktop/Laptop quầy bán: Bố cục 2 cột (Trái: Lưới sản phẩm & Danh mục; Phải: Hóa đơn & Thanh toán ghim cố định).
  - Màn hình Di động (Mobile/Tablet): Danh sách món gọn nhẹ có ảnh thumbnail, giỏ hàng dạng thanh trượt Bottom Sheet thao tác dễ dàng bằng một tay.

---

## 🏛️ Các Quyết định Kiến trúc Bất biến (Architectural Decisions)

| Quyết định | Mã ADR | Chi tiết áp dụng |
| :--- | :--- | :--- |
| **Lưu trữ Offline-First** | [ADR-0001](docs/adr/0001-offline-first-storage-and-backup.md) | Chạy 100% Client-side bằng `LocalStorage` & `IndexedDB`. Không tốn chi phí máy chủ ($0/tháng), hoạt động cả khi mất mạng. Cung cấp nút "Sao lưu & Khôi phục 1-Click" (JSON/Excel). |
| **Phân tách Luồng Đơn hàng & Sổ nợ** | [ADR-0002](docs/adr/0002-order-lifecycle-and-debt-ledger.md) | Hỗ trợ 2 luồng: **Đơn tại chỗ** (hoàn thành tức thì) và **Đơn giao hàng** (vòng đời: Đang chuẩn bị ➔ Đang giao ➔ Hoàn thành/Hủy). Quản lý công nợ theo **Sổ nợ lũy kế (Running Balance)**, trừ trực tiếp khi khách trả tiền. |
| **Trừ kho Tức thì & Tách riêng Phí ship** | [ADR-0003](docs/adr/0003-inventory-deduction-and-shipping-revenue.md) | Trừ tồn kho ngay khi tạo đơn; tự động hoàn kho (auto-restock) nếu đơn bị hủy. Phí vận chuyển thu hộ tài xế được tách riêng, không tính gộp vào Doanh thu thuần và Lợi nhuận của tiệm. |

---

## 🖨️ Tiêu chuẩn In ấn & Thanh toán
- **Khổ giấy in hóa đơn:**
  - In nhiệt K80 (80mm) — Chuẩn phổ biến của máy in nhiệt quầy hàng.
  - In nhiệt K57 (57mm) — Máy in cầm tay di động.
  - In A5/A4 — Hóa đơn bán sỉ/bán buôn số lượng lớn.
- **Tối ưu CSS in:** Phải cấu hình `@media print` ẩn toàn bộ menu, thanh nút bấm; căn lề chuẩn không bị tràn trang hay đè chữ.
- **Thanh toán VietQR:** Tự động sinh ảnh mã QR chuẩn Napas 24/7 theo số tài khoản cửa hàng và số tiền thực tế của đơn hàng.
- **Xuất / Nhập Excel:** Sử dụng thư viện `SheetJS (xlsx)` hỗ trợ chuẩn định dạng UTF-8 tiếng Việt, có bản xem trước (preview) trước khi ghi đè dữ liệu.

---

## 📚 Tài liệu Tham chiếu Nội bộ
- Thuật ngữ nghiệp vụ chuẩn: [`CONTEXT.md`](CONTEXT.md)
- Nhật ký quyết định kiến trúc: [`docs/adr/`](docs/adr/)
- Theo dõi tiến độ kỹ thuật: [`.tc/`](.tc/)
