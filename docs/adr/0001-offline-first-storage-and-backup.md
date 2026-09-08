# 0001. Lưu trữ Offline-First bằng LocalStorage/IndexedDB và Cơ chế Sao lưu Độc lập

## Bối cảnh & Quyết định

Cửa hàng MexucxichCuisine cần một hệ thống quản lý bán hàng đơn giản, không phát sinh chi phí vận hành hàng tháng ($0/tháng), không yêu cầu đăng ký tài khoản hay cấu hình máy chủ phức tạp, và phải hoạt động ổn định ngay cả khi mất kết nối Internet.

Chúng tôi quyết định xây dựng kiến trúc Single Page Application chạy 100% Client-side, lưu trữ dữ liệu bền vững trên trình duyệt bằng LocalStorage (kết hợp IndexedDB cho tệp ảnh và dữ liệu lớn), đồng thời cung cấp tính năng "Sao lưu & Khôi phục 1-Click" (xuất/nhập file JSON toàn bộ hệ thống và file Excel). 

## Hệ quả & Đánh đổi

- **Ưu điểm**: Chi phí lưu trữ $0, tốc độ phản hồi tức thì (<10ms), dữ liệu thuộc quyền riêng tư tuyệt đối của chủ cửa hàng trên thiết bị cá nhân.
- **Đánh đổi**: Không tự động đồng bộ realtime giữa các thiết bị nếu mở trên 2 máy khác nhau mà cần thông qua thao tác sao lưu/khôi phục hoặc xuất/nhập Excel. Giải pháp này phù hợp tuyệt đối cho giai đoạn hiện tại của cửa hàng.
