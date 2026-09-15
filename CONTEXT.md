# MexucxichCuisine Context

Hệ thống quản lý bán hàng, kho hàng, công nợ và hóa đơn dành riêng cho mô hình cửa hàng ẩm thực đa dạng (vừa sản xuất thủ công vừa tuyển chọn đặc sản) của MexucxichCuisine.

## Ngôn ngữ Miền nghiệp vụ (Language)

### Hàng hóa & Kho (Product & Inventory)

**Sản phẩm (Product)**:
Một món ăn hoặc mặt hàng cụ thể trong thực đơn của tiệm, có định danh độc lập kèm đơn vị tính tự do (ví dụ: Gói 500g, Hộp, Kg).
_Avoid_: Hàng, item, món, đồ ăn

**Giá vốn (Cost Price)**:
Giá thành tự sản xuất hoặc giá nhập từ nguồn tuyển chọn cho một đơn vị sản phẩm, dùng để tính toán lợi nhuận gộp.
_Avoid_: Giá nhập, vốn

**Giá bán niêm yết (List Selling Price)**:
Mức giá chuẩn bán cho khách hàng được thiết lập cố định trong danh mục sản phẩm, làm mốc mặc định khi thêm vào giỏ hàng.
_Avoid_: Giá catalog, giá cố định

**Đơn giá bán theo đơn (Custom Order Price)**:
Mức giá của từng món được điều chỉnh trực tiếp trong giỏ hàng của một đơn hàng cụ thể. Chỉ có hiệu lực trong đơn hàng đó, không làm thay đổi Giá bán niêm yết trong kho. Cho phép nhập giá tùy ý $\ge 0đ$ (hỗ trợ quà tặng 0đ), có cảnh báo nếu thấp hơn Giá vốn.
_Avoid_: Giá sửa, giá phá giá, giá ưu đãi riêng


**Tồn kho (Stock Level)**:
Số lượng khả dụng của sản phẩm trong kho sẵn sàng để bán. Cảnh báo trực quan khi nhỏ hơn hoặc bằng 5 đơn vị.
_Avoid_: Số lượng còn, kho

---

### Bán hàng & Vòng đời Đơn hàng (Ordering & Sales)

**Đơn hàng (Order)**:
Giao dịch mua hàng bao gồm danh sách sản phẩm, số lượng, đơn giá, chiết khấu, hình thức bán (Tại chỗ hoặc Giao hàng) và trạng thái thanh toán.
_Avoid_: Bill, giao dịch, transaction

**Đơn tại chỗ (Direct POS Order)**:
Đơn hàng được phục vụ và thanh toán trực tiếp tại quầy/bếp, hoàn thành và trừ kho ngay lập tức.
_Avoid_: Đơn tại quầy, bán lẻ

**Đơn giao hàng (Delivery Order)**:
Đơn hàng đặt trước qua kênh trực tuyến (Zalo, Facebook, Điện thoại) có vòng đời chuẩn bị và vận chuyển.
_Avoid_: Đơn ship, đơn online

**Trạng thái Đơn hàng (Order Status)**:
Vòng đời của đơn hàng gồm: Đang chuẩn bị (Preparing), Đang giao (Delivering), Đã hoàn thành (Completed), Đã hủy (Cancelled).
_Avoid_: Tình trạng đơn

---

### Công nợ & Khách hàng (Customer & Debt)

**Khách hàng (Customer)**:
Cá nhân hoặc tổ chức mua hàng, được định danh bằng Số điện thoại, Tên và Địa chỉ giao hàng.
_Avoid_: Người mua, client, buyer

**Dư nợ (Outstanding Debt)**:
Tổng số tiền khách hàng còn thiếu lũy kế từ các đơn hàng chưa thanh toán đủ.
_Avoid_: Nợ xấu, credit, số dư âm

**Phiếu thu nợ (Debt Payment)**:
Giao dịch ghi nhận một lần khách hàng thanh toán bớt hoặc tất toán dư nợ, được trừ trực tiếp vào sổ nợ lũy kế.
_Avoid_: Trả nợ, phiếu thu, giải ngân

---

### Hóa đơn & In ấn (Receipt & Printing)

**Hóa đơn in (Receipt)**:
Bản in nhiệt hoặc khổ A4/A5 hiển thị chi tiết đơn hàng, thông tin tiệm và mã VietQR thanh toán.
_Avoid_: Hóa đơn đỏ, phiếu thanh toán, bill

**Số liên in (Print Copies)**:
Số bản in ra cho một lần in hóa đơn: 1 liên (mặc định) hoặc 2 liên (kèm nhãn phân biệt Liên 1 - Lưu quầy/bếp và Liên 2 - Giao khách có đường xé đứt đoạn).
_Avoid_: Bản sao, số bản in, copy count

**Cỡ chữ in (Print Font Size)**:
Mức kích thước phông chữ áp dụng khi xuất hóa đơn in (Nhỏ - 11px, Vừa chuẩn KiotViet - 13px, To rõ nét - 15px), đảm bảo chữ to, nét mực đậm rõ ràng trên máy in nhiệt K80.
_Avoid_: Font size, cỡ chữ bill

**Mẫu in KiotViet (KiotViet 2-Line Layout)**:
Cấu trúc hiển thị danh sách món ăn trên hóa đơn gồm 2 dòng: dòng trên hiển thị trọn vẹn Tên món ăn (không bị cắt cụt), dòng dưới hiển thị 3 cột Đơn giá | Số lượng | Thành tiền, phân cách bằng nét đứt ngang.
_Avoid_: Bảng 1 dòng, layout cũ

**Phí vận chuyển (Shipping Fee)**:
Khoản tiền thu hộ tài xế hoặc cước gửi hàng cho đơn giao hàng, được tách biệt khỏi doanh thu thuần của tiệm.
_Avoid_: Tiền ship, cước xe

**Mã VietQR (Dynamic VietQR)**:
Mã phản hồi nhanh chuẩn Napas sinh tự động theo số tài khoản cửa hàng và số tiền thực tế của đơn hàng.
_Avoid_: Mã QR tĩnh, QR code chuyển tiền

**Hoàn kho tự động (Auto-restock)**:
Hành động hệ thống tự động cộng trả lại số lượng tồn kho của các sản phẩm khi một đơn hàng giao đi bị hủy.
_Avoid_: Nhập lại hàng, hủy kho

