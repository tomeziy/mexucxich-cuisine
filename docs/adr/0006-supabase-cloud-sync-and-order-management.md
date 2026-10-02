# 0006. Tích hợp Đồng bộ Cloud Supabase Linh hoạt, Quản trị Vòng đời Đơn hàng (Sửa/Xóa) và Nhập Khách hàng từ Excel

## Bối cảnh & Vấn đề

Trong quá trình triển khai thực tế, bạn Hằng phản ánh 3 điểm nghẽn nghiệp vụ quan trọng:
1. **Thiếu đồng bộ đa thiết bị**: Ứng dụng chạy theo kiến trúc Offline-First (ADR-0001) nên dữ liệu được lưu trên LocalStorage của máy tính tại cửa hàng. Khi về nhà mở máy tính cá nhân hoặc điện thoại, ứng dụng chỉ hiển thị dữ liệu mẫu demo ban đầu. Khách hàng cần cơ chế đồng bộ dữ liệu thời gian thực qua Cloud nhưng muốn có thể dễ dàng chuyển giao quyền sở hữu tài khoản Supabase độc lập sau này mà không cần build/deploy lại mã nguồn.
2. **Nhu cầu sửa và xóa hóa đơn**: Trong vận hành thực tế, việc tạo nhầm đơn để test, khách đổi ý thêm/bớt món, hoặc cần sửa thông tin thanh toán là phát sinh thường xuyên. Hệ thống trước đây chỉ cho phép hủy đơn đang giao, thiếu tính năng xóa triệt để và sửa hóa đơn toàn diện.
3. **Nhập danh sách khách hàng từ Excel**: Cửa hàng có sẵn tệp khách hàng quen thuộc nhưng mới chỉ hỗ trợ nhập món ăn từ Excel, chưa có tính năng nhập khách hàng và số dư nợ ban đầu.

## Quyết định Thiết kế

Chúng tôi quyết định:
1. **Tích hợp Supabase Cloud Sync với Cơ chế Cấu hình qua Giao diện (UI Config & Easy Handover)**:
   - Sử dụng Supabase (PostgreSQL) làm hạ tầng lưu trữ đám mây với gói Free-tier vĩnh viễn.
   - Bổ sung ô cấu hình `Project URL` và `Anon Key` trực tiếp trong trang Cài đặt (Settings), lưu trữ cấu hình an toàn trên thiết bị và hỗ trợ nạp sẵn từ biến môi trường (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   - Cung cấp tệp `supabase_schema.sql` sẵn sàng 1-click tạo cấu trúc 5 bảng dữ liệu (`products`, `customers`, `orders`, `debt_payments`, `settings`) với Row Level Security và quyền truy cập Public Anon.
   - Khi bàn giao cho Hằng: Hằng chỉ cần tạo tài khoản Supabase miễn phí, dán SQL chạy khởi tạo, và dán URL + Key vào trang Cài đặt là hệ thống tự động đẩy toàn bộ dữ liệu hiện tại lên Cloud.
   - **Offline-First Fallback**: Khi không có mạng hoặc chưa cấu hình Supabase, hệ thống tự động vận hành bằng LocalStorage ngoại tuyến 100%, không gây gián đoạn hay treo ứng dụng.
2. **Cơ chế Xóa vĩnh viễn Hóa đơn (Hard-delete Order) kèm Tự động Đảo ngược Nghiệp vụ**:
   - Cho phép xóa vĩnh viễn đơn hàng từ bảng Lịch sử đơn hàng (`ReportsPage`) và từ Modal xem hóa đơn (`ReceiptModal`), có hộp thoại xác nhận rõ ràng để chống bấm nhầm.
   - **Tự động hoàn kho (Auto-restock)**: Số lượng các món trong đơn hàng được cộng trả lại vào Tồn kho thực tế.
   - **Khấu trừ công nợ & doanh thu**: Nếu đơn có ghi nợ hoặc thanh toán một phần, hệ thống tự động trừ bớt Dư nợ của khách hàng, trừ số tiền chi tiêu lũy kế (`totalSpent`), giảm số lượng đơn (`orderCount`), và cập nhật lại Báo cáo doanh thu thuần và lãi gộp.
3. **Cơ chế Chỉnh sửa Hóa đơn Toàn diện (Comprehensive Order Editing)**:
   - Xây dựng Modal chỉnh sửa đơn hàng chuyên dụng (`EditOrderModal`): cho phép thêm/bớt món, tăng/giảm số lượng, sửa đơn giá bán, đổi khách hàng, phí ship và phương thức thanh toán.
   - Tự động tính toán chênh lệch tồn kho (`Stock Delta`) giữa đơn cũ và đơn mới để hoàn kho hoặc trừ kho bù trừ chính xác.
   - Tự động cập nhật số dư nợ khách hàng và doanh thu theo tổng tiền mới.
4. **Nhập Khách hàng Hàng loạt từ Excel (Customer Excel Import & Deduplication)**:
   - Cung cấp tệp mẫu Excel chuẩn `Mau_Danh_Sach_Khach_Hang_Mexucxich.xlsx` gồm 4 cột: `Tên khách hàng (*)` (bắt buộc), `Số điện thoại`, `Địa chỉ`, `Dư nợ ban đầu` (tùy chọn).
   - Xây dựng Modal xem trước (Preview Modal) phân loại trực quan: Huy hiệu xanh lá `Khách mới` vs Huy hiệu cam `Cập nhật khách cũ`.
   - Quy tắc trùng lặp: Nếu khách hàng trong file Excel có Số điện thoại trùng với khách đã tồn tại, hệ thống tự động cập nhật Địa chỉ mới nhất và cộng dồn Dư nợ ban đầu vào sổ nợ hiện có.

## Hệ quả & Đánh đổi

- **Ưu điểm**:
  - Dữ liệu đồng bộ tức thì giữa Cửa hàng và Nhà qua Supabase, dễ dàng bàn giao 100% quyền sở hữu cho tài khoản riêng của Hằng mà không cần can thiệp mã nguồn.
  - Vận hành linh hoạt, cho phép sửa sai và xóa đơn nhầm mà không làm lệch Tồn kho hay Công nợ.
  - Tiết kiệm thời gian nhập liệu danh bạ khách hàng từ file Excel có sẵn.
  - Bảo toàn tuyệt đối tính độc lập ngoại tuyến (Offline-First) khi mất mạng.
- **Đánh đổi**:
  - Cần khởi tạo cấu trúc bảng trên Supabase khi kích hoạt Cloud Sync (đã có script SQL 1-click giải quyết trọn vẹn).
