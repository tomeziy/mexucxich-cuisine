# 0005. Chuẩn hóa Mẫu in Hóa đơn KiotViet 2 Dòng, Cỡ chữ Lớn và Kiểm soát Số liên in (1 Liên)

## Bối cảnh & Vấn đề

Trong vận hành thực tế tại tiệm MexucxichCuisine, việc in ấn hóa đơn gặp 3 hạn chế nghiêm trọng:
1. **Chữ quá nhỏ và mờ nhạt**: Phiên bản trước dùng font monospace và cỡ chữ 8px - 11px, khi in qua kim nhiệt K80 bị mờ, khó đọc đối với khách hàng và tài xế giao hàng.
2. **Lỗi máy in tự cắt 2 liên (tràn trang)**: Thuộc tính `min-h-[120mm]` và lề trình duyệt làm lệnh in của trình duyệt (`window.print()`) vượt quá chiều dài 1 trang, khiến máy in nhiệt K80 ngắt trang và cắt giấy thành 2 tờ (khách tưởng phần mềm ấn định in 2 liên dù chỉ cần 1 liên).
3. **Tên món dài bị cắt ngắn**: Các món ẩm thực đặc sản (như xúc xích thảo mộc, chả mực giã tay, sốt chấm) có tên dài kèm quy cách đóng gói, khi nhét chung 1 dòng với số lượng và đơn giá sẽ bị co ngắn (`truncate`) gây mất thông tin.

## Quyết định Thiết kế

Chúng tôi quyết định:
1. **Chuyển đổi Bố cục Mẫu in 2 Dòng chuẩn KiotViet (KiotViet 2-Line Layout)**:
   - Dòng 1: Tên sản phẩm hiển thị đầy đủ trên toàn bộ chiều rộng hóa đơn, không bao giờ bị cắt ngắn.
   - Dòng 2: 3 cột căn lề chuẩn xác: `Đơn giá` (trái), `Số lượng` (giữa), `Thành tiền` (phải).
   - Mỗi món được phân cách bằng một đường nét đứt ngang (`border-b border-dashed`).
2. **Khắc phục Triệt để Lỗi Tràn trang (Single-Page Exact Cut)**:
   - Loại bỏ hoàn toàn `min-h-[120mm]`.
   - Cấu hình CSS `@media print` và `@page { margin: 0; size: auto; }`, `page-break-inside: avoid` để chiều dài trang in vừa khít 100% nội dung thực tế, đảm bảo in đúng **1 tờ duy nhất** và máy in chỉ cắt 1 lần.
3. **Cấu hình Số liên in (Print Copies)**:
   - Bổ sung thiết lập `printCopies: 1 | 2` trong Cài đặt (mặc định: `1 liên`).
   - Khi chọn `2 liên`, hệ thống tự động sinh 2 liên nối tiếp nhau có đánh dấu rõ ràng `--- LIÊN 1: LƯU QUẦY/BẾP ---` và `--- LIÊN 2: GIAO KHÁCH ---` kèm đường xé.
4. **Tùy biến Cỡ chữ in (Print Font Size)**:
   - Cung cấp 3 mức trong Cài đặt: `Nhỏ (11px)`, `Vừa (13px - Mặc định chuẩn KiotViet)`, `To (15px - Rõ nét)`.
   - Sử dụng phông chữ sans-serif chuẩn in nhiệt nét đậm, tăng độ tương phản đen/trắng tối đa.
5. **Nạp Dữ liệu Tiệm Thực tế của Hằng**:
   - Tên shop: `MEXUCXICH CUISINE`
   - Khẩu hiệu: `Đồ ăn homemade và đặc sản vùng miền`
   - Hotline/Facebook: `Facebook: Hoàng Minh Hằng - 0904047976`
   - Ngân hàng: `Techcombank - 10520110621010 - BÙI THỊ TUYẾT MAI`
   - Lời chúc chân trang: `Chúc quý khách có một bữa ăn hạnh phúc!`

## Hệ quả & Đánh đổi

- **Ưu điểm**:
  - Hóa đơn in ra đẹp, chuyên nghiệp, to rõ 100% giống KiotViet.
  - Tiết kiệm giấy in nhiệt, không còn tình trạng nhả giấy thừa hay cắt đôi trang.
  - Phù hợp hoàn hảo với thói quen sử dụng hàng ngày của chủ tiệm.
- **Đánh đổi**:
  - Bố cục 2 dòng làm chiều dài cuộn giấy tăng khoảng 15-20% so với bảng 1 dòng ép chữ, nhưng mang lại trải nghiệm đọc vượt trội.
