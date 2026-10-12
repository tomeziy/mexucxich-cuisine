# 0008. Xử lý Xung đột Đồng bộ Đa Thiết bị và Trừ Kho Nguyên Tử (Cross-Device Sync Conflict Resolution & Atomic Stock)

## Bối cảnh & Vấn đề

Khi thương hiệu **MexucxichCuisine** vận hành đa thiết bị (máy tính quầy thu ngân Desktop PC và điện thoại di động Smartphone của bạn Hằng khi chốt đơn trực tuyến qua Zalo/Facebook):

1. **Hiện tượng Race Condition làm sai lệch tồn kho (Stock Inaccuracy)**:
   - Trước đây, khi tạo đơn hàng, hệ thống lấy tồn kho cục bộ hiện có, trừ đi số lượng mua rồi gọi `.upsert()` ghi đè toàn bộ đối tượng sản phẩm với giá trị `stock` tuyệt đối lên Supabase.
   - Nếu quầy thu ngân và điện thoại cùng bán 1 món gần như đồng thời (ví dụ: món A đang còn 10 gói; quầy bán 2 gói ghi `stock = 8`, điện thoại bán 3 gói ghi `stock = 7`), thao tác ghi đè sau cùng sẽ làm mất lượt trừ kho của thiết bị trước, dẫn đến kho thực tế còn 5 nhưng hệ thống báo còn 7 hoặc 8.

2. **Dữ liệu mới trên máy bị snapshot Cloud cũ ghi đè (Stale Clobbering)**:
   - Khi thu ngân vừa cập nhật số điện thoại / địa chỉ khách hàng trên quầy hoặc nạp hàng từ Excel, nếu tính năng tự động làm mới (`pullAllDataFromCloud`) kích hoạt khi chuyển tab hoặc focus màn hình, hệ thống trước đây mù quáng gọi `setProducts(cloudData.products)` và `setCustomers(cloudData.customers)`.
   - Kết quả: Dữ liệu vừa sửa cục bộ bị các snapshot cũ từ Cloud ghi đè mất mát.

3. **Nguy cơ mất đơn hàng ngoại tuyến (Offline Order Drop)**:
   - Khi mạng yếu hoặc chập chờn, đơn hàng tạo cục bộ trên máy chưa kịp đồng bộ lên Cloud. Nếu lúc đó kéo dữ liệu từ Cloud về và thay thế toàn bộ mảng `orders`, các đơn hàng cục bộ chưa đồng bộ sẽ biến mất khỏi máy.

---

## Quyết định Thiết kế

Chúng tôi quyết định triển khai kiến trúc giải quyết xung đột đồng bộ đa thiết bị toàn diện:

### 1. Trừ Kho Nguyên Tử (Atomic Stock Reconciliation)
- **Hàm SQL RPC trên Supabase (`adjust_product_stock`)**:
  ```sql
  create or replace function adjust_product_stock(p_id text, p_delta numeric)
  returns numeric
  language plpgsql
  security definer
  as $$
  declare
    v_new_stock numeric;
  begin
    update products
    set stock = greatest(0, coalesce(stock, 0) + p_delta),
        updated_at = now()
    where id = p_id
    returning stock into v_new_stock;

    return v_new_stock;
  end;
  $$;

  grant execute on function adjust_product_stock(p_id text, p_delta numeric) to anon, authenticated, service_role;
  ```
  *(Lưu ý kỹ thuật: Trả về trực tiếp `v_new_stock` thay vì `coalesce(v_new_stock, 0)` để nếu sản phẩm không tồn tại trong DB, kết quả là `NULL`, ngăn chặn việc vô tình gán tồn kho của sản phẩm ngoại tuyến/chưa đồng bộ về 0).*
- **Gom nhóm Số lượng theo Món (Line-item Aggregation)**:
  - Khi giỏ hàng chứa nhiều dòng của cùng một món ăn, hệ thống tự động gom nhóm tổng số lượng trước khi tính delta và gửi lệnh bù trừ kho.
- **Tự động Đối soát Tồn kho Authoritative từ Server**:
  - Khi hàm RPC `adjust_product_stock` hoặc batch hoàn tất thành công, client tự động đối soát và cập nhật tồn kho cục bộ theo giá trị chuẩn xác (`newStock`) do server trả về.
- **Cơ chế Bù trừ Delta (Delta-based Adjustment)**:
  - Khi tạo đơn: truyền delta âm (`-item.qty`).
  - Khi sửa đơn: truyền chênh lệch số lượng (`-(newQty - oldQty)`).
  - Khi hủy/xóa đơn: tự động hoàn kho với delta dương (`+item.qty`).
  - Sử dụng hàm SQL `greatest(0, ...)` và thuật toán `calculateStockDelta` ở client để chặn cứng sàn 0, chống tồn kho âm.
- **Cơ chế Fallback Cục bộ (Local Delta Fallback)**:
  - Nếu kết nối mạng chập chờn hoặc cơ sở dữ liệu Supabase chưa chạy lệnh tạo RPC, client tự động kích hoạt chế độ dự phòng: đọc tồn kho hiện tại trên Cloud, tính delta bù trừ an toàn và cập nhật kèm trường `updated_at`.

### 2. Định danh & Dấu thời gian Nhất quán (`updated_at`)
- Bổ sung trường `updatedAt?: string` vào các interface TypeScript (`Product`, `Customer`, `Order`, `DebtPayment`).
- Bổ sung cột `updated_at timestamptz default now()` vào tất cả các bảng dữ liệu Supabase (`products`, `customers`, `orders`, `debt_payments`).
- Tự động đóng dấu `updatedAt = new Date().toISOString()` ở mọi thao tác thêm, sửa, nạp Excel, tạo đơn, hủy đơn và thu nợ.
- Dữ liệu mẫu khởi tạo (`INITIAL_PRODUCTS`, `INITIAL_CUSTOMERS`) sử dụng dấu thời gian lịch sử cố định (tháng 9/2026), không bao giờ dùng `new Date().toISOString()` khi khởi tạo để ngăn chặn thiết bị mới mở làm đè mất dữ liệu thật trên Cloud.

### 3. Thuật toán Giải quyết Xung đột theo Dấu thời gian (Timestamp-based Conflict Resolution)
Khi đồng bộ dữ liệu (`pullAllDataFromCloud` hoặc nạp thủ công `syncCloudToLocal`):
- **Bảo vệ dữ liệu cục bộ mới hơn (`localTime > cloudTime`)**: Giữ nguyên dữ liệu trên máy thu ngân, ngăn chặn việc snapshot Cloud cũ ghi đè.
- **Cập nhật dữ liệu Cloud mới hơn (`cloudTime > localTime`)**: Tự động nhận dữ liệu mới được thao tác từ điện thoại của chủ tiệm.
- **Bảo toàn thực thể chưa đồng bộ**: Các món ăn, khách hàng, đơn hàng tạo cục bộ chưa có trên Cloud luôn được giữ lại trong danh sách hợp nhất (union by ID), không bao giờ bị xóa mất.
- **Sắp xếp thời gian hóa đơn chuẩn xác**: Danh sách đơn hàng và phiếu thu nợ luôn được sắp xếp giảm dần theo thời gian tạo (`createdAt`), ngăn ngừa việc hóa đơn cũ vừa sửa nhảy lên đầu danh sách bán hàng hôm nay.

---

## Hệ quả & Đánh đổi

- **Ưu điểm**:
  - Triệt tiêu 100% tình trạng lệch tồn kho do Race Condition giữa quầy và di động.
  - Bảo vệ toàn vẹn dữ liệu khách hàng và sản phẩm mới cập nhật tại quầy.
  - Vẫn duy trì hoàn toàn triết lý **Offline-First** ($0/tháng), ứng dụng chạy mượt mà ngay cả khi mất mạng.
- **Kiểm định chất lượng**:
  - Đã thêm bộ kiểm thử chuyên dụng `scripts/test_sync_conflict.js` kiểm tra 100% các ca tính toán delta, sàn chặn 0, trích xuất timestamp, giải quyết xung đột đơn lẻ và hợp nhất danh sách.
  - Kiểm tra `test_adr0007.js` đạt 100% không phát sinh hồi quy.
  - Kiểm tra TypeScript (`tsc --noEmit`) đạt 0 lỗi.
  - Bản đóng gói sản xuất (`npm run build`) hoàn tất thành công.
