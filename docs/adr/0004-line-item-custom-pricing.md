# 0004. Điều chỉnh Đơn giá trực tiếp trên Đơn hàng (Line-Item Custom Pricing) và Ràng buộc Lợi nhuận

## Bối cảnh & Vấn đề

Trong kinh doanh ẩm thực thủ công và đặc sản tuyển chọn của MexucxichCuisine, chủ tiệm thường xuyên cần sự linh hoạt về giá bán:
- Chiết khấu riêng cho khách quen, người thân hoặc đối tác mua số lượng lớn.
- Bán theo lốc/combo với mức giá thỏa thuận riêng mà không tạo mã sản phẩm mới.
- Tặng kèm sản phẩm với đơn giá 0đ để triên khách hàng.

Nếu chỉ cho phép giảm giá trên tổng hóa đơn (order-level discount), tiệm không thể theo dõi chính xác từng món được bán với giá bao nhiêu, gây khó khăn cho việc đối soát và tính lợi nhuận gộp từng mặt hàng. Ngược lại, nếu việc sửa giá làm thay đổi giá niêm yết trong kho, toàn bộ danh mục sản phẩm sẽ bị sai lệch giá chuẩn.

## Quyết định Thiết kế

Chúng tôi quyết định:
1. **Cô lập Đơn giá theo Đơn (Order Item Isolation)**:
   - Sửa giá trực tiếp trên dòng sản phẩm trong giỏ hàng chỉ cập nhật vào `OrderItem.price` của đơn hàng đó.
   - Tuyệt đối **không làm thay đổi Giá bán niêm yết (`Product.price`)** trong kho hàng / danh mục sản phẩm.
2. **Ràng buộc & Cảnh báo an toàn (Safeguards)**:
   - Cho phép nhập đơn giá tùy ý $\ge 0đ$ (hỗ trợ quà tặng 0đ).
   - Nếu đơn giá nhập vào thấp hơn Giá vốn (`OrderItem.cost`), hệ thống hiển thị cảnh báo mềm trực quan màu cam (*Bán dưới giá vốn*) để chống gõ nhầm số, nhưng không chặn quyền tạo đơn của chủ tiệm.
3. **Cơ chế Cộng dồn số lượng**:
   - Khi một món đã được điều chỉnh giá trong giỏ hàng, việc bấm tăng số lượng (`+`) hoặc bấm lại sản phẩm từ danh mục sẽ giữ nguyên đơn giá đã sửa đó.
4. **Hóa đơn in & Báo cáo Lợi nhuận**:
   - Hóa đơn in K80/A5 in trực tiếp đơn giá thực bán đã thỏa thuận (tinh gọn, rõ ràng phong cách KiotViet).
   - Báo cáo tài chính tính Doanh thu và Lợi nhuận gộp theo công thức chuẩn: `(Đơn giá thực bán - Giá vốn) * Số lượng`.

## Hệ quả & Đánh đổi

- **Ưu điểm**:
  - Tối đa tính linh hoạt cho chủ tiệm trong các tình huống bán hàng thực tế.
  - Bảo toàn 100% tính toàn vẹn của danh mục sản phẩm và bảng giá niêm yết chuẩn trong kho.
  - Báo cáo lợi nhuận phản ánh chính xác từng đồng lãi/lỗ thực tế của từng đơn hàng.
- **Đánh đổi**:
  - Dữ liệu đơn hàng (`OrderItem`) cần lưu trữ độc lập cả `price` (đơn giá bán) và `cost` (giá vốn tại thời điểm bán) để đảm bảo lịch sử báo cáo không bị phụ thuộc vào biến động giá trong tương lai.
