# 0011. Hỗ Trợ Số Lượng Thập Phân (Fractional Quantities) và Tùy Chỉnh Cỡ Chữ Khối Giao Hàng Cho Shipper

## Bối cảnh & Vấn đề

Qua phản hồi bằng ảnh hóa đơn thực tế và tin nhắn trao đổi từ bạn Hằng tại cửa hàng:
1. **Thiếu Hỗ Trợ Bán Cân Ký Lẻ (Fractional Quantities)**:
   - Các mặt hàng thịt, thực phẩm tươi (như *Lõi vai bò vân tuyết Aukobe 1kg*) thường được khách mua theo trọng lượng lẻ thực tế (ví dụ: `0,5kg`, `0,59kg`, `1,25kg`).
   - Giao diện giỏ hàng tại POS và hộp thoại Sửa đơn trước đây chỉ có nút bấm stepper `[-] 1 [+]` cố định ở số nguyên. Hằng không thể gõ số lẻ mà phải in bill ra rồi **lấy bút bi viết tay `0,59 kg` và gạch giá tính lại bằng tay**, vừa mất thời gian vừa dễ sai lệch doanh thu và tồn kho.
2. **Khó Đọc Thông Tin Giao Hàng Khi Tiết Kiệm Giấy In Nhiệt**:
   - Để tiết kiệm chi phí giấy in nhiệt K80, Hằng luôn chọn cỡ chữ hóa đơn nhỏ nhất (`small` - 11.5px).
   - Tuy nhiên, khi in cỡ nhỏ, khối thông tin người nhận (`Khách hàng`, `SĐT`, `Địa chỉ`) bị co nhỏ theo (~10px), khiến tài xế giao hàng (shipper) đang đi xe máy ngoài đường rất khó đọc địa chỉ và bấm số điện thoại.
   - Các tùy chọn phóng to toàn bộ hóa đơn (`large` - 16px) trước đó lại làm dài cả danh sách món ăn và bảng tổng tiền, gây lãng phí giấy in nhiệt không cần thiết.

## Quyết định Thiết kế

Chúng tôi quyết định triển khai các thay đổi sau:

### 1. Nhập Số Lượng Thập Phân Trực Tiếp (Fractional Quantities) tại POS & Sửa Đơn
- **Ô nhập số lượng linh hoạt**: Biến phần hiển thị số lượng giữa 2 nút `[-]` và `[+]` thành một ô `<input>` trực tiếp. Thu ngân có thể click thẳng vào số lượng để gõ phím.
- **Xử lý dấu chấm/phẩy linh hoạt**: Bộ phân tích tự động chấp nhận cả dấu phẩy tiếng Việt (`,`) và dấu chấm (`.`) (ví dụ: gõ `0,59` hoặc `0.59` đều được chuẩn hóa thành số thực `0.59`).
- **Nút stepper thông minh**: Giữ nguyên hai nút `[-]` và `[+]` bên cạnh: bấm `+` tăng 1 đơn vị, bấm `-` giảm 1 đơn vị (hoặc xóa món nếu giá trị $\le 0$). Khi cần cân ký số lẻ chính xác (như `0.59`), thu ngân gõ phím trực tiếp.
- **Tính toán tài chính và tồn kho chuẩn xác**:
  * Thành tiền dòng món: $\text{Đơn giá} \times \text{Số lượng thực}$ (ví dụ: $380.000 \times 0.59 = 224.200đ$). Thu ngân vẫn có thể chủ động sửa giá trực tiếp hoặc giảm giá nếu muốn bớt tiền lẻ cho khách tròn số ($224.000đ$).
  * Trừ tồn kho: Hệ thống trừ chính xác số lượng thực trong cơ sở dữ liệu (ví dụ tồn 10kg bán 0.59kg $\rightarrow$ còn 9.41kg).

### 2. Định Dạng Số Lượng Trên Hóa Đơn Nhiệt K80
- Nếu số lượng là số nguyên: in định dạng gọn `x1`, `x2` (không in `x1.00`).
- Nếu số lượng là số thập phân: in đúng số thực và tự động loại bỏ số 0 thừa ở đuôi (ví dụ: `x0.59`, `x0.5`, `x1.25`).

### 3. Tối Giản Cỡ Chữ Toàn Bill & Phóng To Riêng Khối Giao Hàng Cho Shipper (`Delivery Callout Header`)
- **Mặc định cỡ chữ nhỏ toàn bill**: Cố định phần danh sách món ăn, đơn giá, tổng tiền và chân trang ở cỡ Nhỏ (`small` - 11.5px) để tiết kiệm giấy in nhiệt tối đa đúng thói quen của cửa hàng. Loại bỏ các tùy chọn phóng to toàn bill gây tốn giấy.
- **Khối thông tin người nhận phóng to chuyên biệt (`Delivery Callout Header`)**:
  * Thiết kế khối thông tin giao hàng (`Khách hàng`, `SĐT`, `Địa chỉ`, `Ghi chú ship`) với đường viền nét đứt rõ ràng và cỡ chữ lớn nổi bật.
  * Hỗ trợ 2 mức cấu hình trực quan trong trang Cài đặt hóa đơn (`deliveryCalloutSize`):
    1. **Khuyên dùng cho Shipper (`standard_large` - Mặc định)**: Cỡ chữ ~15px (gấp ~1.5x cỡ bill nhỏ), in đậm nét `font-black`, Tên + SĐT + Địa chỉ ngắt dòng tối ưu, bill chỉ dài thêm ~1cm giấy.
    2. **Cỡ Đại nổi bật (`extra_large`)**: Cỡ chữ ~18px (gấp ~1.8x), cực kỳ to rõ, kiểm soát line-height để không bị tràn lề K80 và không làm dài hóa đơn quá mức.

## Hệ quả & Đánh đổi

- **Tích cực**:
  * Cửa hàng hoàn toàn chấm dứt tình trạng phải viết bút bi tay và tính nhẩm tiền lẻ cho các món cân ký.
  * Tồn kho và doanh thu thực tế khớp tuyệt đối giữa quầy và hệ thống cloud.
  * Shipper đọc thông tin giao hàng nhanh chóng, rõ ràng trong 1 giây, hạn chế tối đa việc giao nhầm hoặc lạc đường.
  * Tiết kiệm giấy in nhiệt tối đa do chỉ phóng to 3 dòng thông tin người nhận thay vì kéo dài toàn bộ hóa đơn.
- **Đánh đổi**:
  * Phép nhân đơn giá với số lẻ có thể sinh ra tiền lẻ hàng trăm đồng (ví dụ: $224.200đ$). Thu ngân có thể dùng ô sửa giá có sẵn trên giỏ hàng để làm tròn theo ý muốn nếu cần.
