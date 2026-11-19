# ADR-0021: Sentinel Recommendations, Safe Customer Delete, Persistent Acknowledgments, and Batch-Edit Controls

**Status:** Accepted  
**Date:** 2026-11-19  
**Context:** Customer Data Sentinel UX Optimization, Multi-Select Batch Directory Operations, Safe Deletion & Persistent Audit Dismissals  

---

## Context & Problem Statement

Following the rollout of Customer Sentinel (ADR-0017 / ADR-0018 / ADR-0020), field inspection of live store data revealed high manual friction when resolving contact anomalies at scale:

1. **Phantom Empty Profiles in Tone Twins (`Trùng tên khác dấu`):**
   - Duplicate empty profiles (e.g., `Ayse Nguyen #KH_1794983481321_4472` with no phone, no address, 0 orders, and 0 debt alongside real `Ayse Nguyen #KH_1791794372131_2305_i8p8`) offered only `Sửa thông tin` and `Xác nhận 2 khách độc lập`, forcing manual lookups and leaving no 1-click delete or merge option.
   - Decisions like `Xác nhận 2 khách độc lập` were stored in ephemeral component state and lost whenever the modal was closed.
2. **High Friction in Multi-Address & Multi-Phone Triage:**
   - Resolving 300+ multi-address rows required opening a separate preview toggle without inline search/filtering or multi-action batch controls (`Chuyển sang Đ/C phụ`, `Giữ nguyên / Ẩn cảnh báo`, `Tách thành 2 khách`).
3. **Naive Primary Selection & 2-Only Merge in `Trùng SĐT`:**
   - Duplicate phone groups defaulted to array index `0` as primary (risking keeping an empty duplicate over an active customer with orders/debt) and only merged `duplicates[0]`, ignoring 3+ duplicate records.
4. **Destructive-Only Historical Order Discrepancies (`Lệch với đơn cũ`):**
   - Historical discrepancies offered only `Khôi phục theo đơn này` (overwriting current fields) or `Tách thành 2 khách`, without 1-click non-destructive `+ Lưu thành SĐT 2`, `+ Thêm làm Đ/C phụ`, or persistent dismissal.
5. **Missing Directory Multi-Select & Customer Delete Controls:**
   - `CustomersPage.tsx` lacked checkboxes, a batch-edit toolbar (`Gộp thành 1 khách`, `Xóa đã chọn`, `Chuyển Đ/C phụ hàng loạt`), and individual customer delete with debt/order safety guards.

---

## Decisions

### 1. Sentinel Intelligence, Ranking & Merge Engine (`src/utils/customerSentinel.ts`)
- **`isEmptyGhostCustomer(customer, orders)`**: Identifies empty phantom profiles (no `phone`/`phone2`, no `address`/`extraAddresses`, `debt === 0`, and 0 matching orders).
- **`analyzeToneTwinGroup(group, orders)`**: Produces a concrete recommendation (`'delete_ghosts' | 'merge_into_primary' | 'keep_independent'`), `recommendedPrimaryId`, `ghostCustomerIds`, `reasonLabel`, and `actionLabel`.
- **`rankPrimaryCustomer(customers, orders)`**: Ranks candidate records deterministically by: orders count -> has debt -> has `phone`/`phone2` -> has `address`/`extraAddresses` -> oldest `createdAt`.
- **`mergeCustomerGroupHelper(primary, duplicates, orders)`**: Atomically merges 1+ duplicate customers into `primary`, preserving distinct phones in `phone2`, deduplicating `extraAddresses`, summing `debt`, `totalSpent`, and `orderCount`, and reassigning all orders pointing to any duplicate ID.
- **`analyzeDiscrepancyOrder(customer, order)`**, **`addSecondaryPhoneFromOrderHelper`**, and **`addExtraAddressFromOrderHelper`**: Classify differing historical orders (`add_phone2`, `add_extra_address`, `restore_order`, `split_customer`) and apply non-destructive additions without overwriting primary fields.
- **`deleteCustomersBatchHelper(customers, orders, ids, options)`**: Supports `onlySafe` filtering to skip customers with debt or order history when requested.
- **Persistent Acknowledgments (`mxc_sentinel_acks_v1`)**: Added `loadSentinelAcks`, `saveSentinelAcks`, `resetSentinelAcksStorage`, `filterAuditResultByAcks`, and `getSentinelAcknowledgedCount` storing `toneTwins`, `multiAddresses`, and `discrepancies` arrays in `localStorage`.

### 2. Cloud & Store Operations (`src/services/supabase.ts` & `src/context/StoreContext.tsx`)
- **`executeChunkedCustomerDelete` & `cloudDeleteCustomersBatch(ids)`**: Deletes customer IDs in chunks via `.from('customers').delete().in('id', chunk)` with clean error logging.
- **Pending-Delete Tombstone Safeguard (`mxc_deleted_customer_ids_v1`)**: `loadPendingDeletedCustomerIds`, `addPendingDeletedCustomerIds`, `removePendingDeletedCustomerIds`, and `filterOutDeletedCustomers` ensure locally deleted/merged customer IDs are flushed to Cloud before `pullAllDataFromCloud` and cannot be resurrected by concurrent tab-focus refreshes or offline-to-online syncs.
- **StoreContext Actions**: Added atomic state + `localStorage` + Cloud sync operations for `deleteCustomersBatch`, `mergeCustomerGroup`, `mergeDuplicateGroupsBatch`, `addCustomerSecondaryPhone`, `addCustomerExtraAddress`, `applyDiscrepancyRecommendationsBatch`, `acceptAllPhoneSplitsBatch`, `sentinelAcks`, `acknowledgeSentinelItems`, and `resetSentinelAcks` (plus `stateRef`-synchronized `promoteMultiAddressToExtra`, `promoteMultiAddressesBatch`, and `splitCustomerRecord`).

### 3. Full Sentinel UX Optimization (`src/components/customers/CustomerSentinelModal.tsx`)
- **All 5 Tabs Upgraded** with a prominent `"Phương án Đề xuất"` callout, side-by-side alternative actions, individual safe `Xóa` buttons, and section batch toolbars:
  - **Tab 1 (`Trùng tên khác dấu`)**: Ghost badges (`Hồ sơ trống`), per-card `Chọn làm Chính để gộp` & `Xóa`, group recommendations, and batch `Xóa tất cả hồ sơ trống (N)` + `Xác nhận độc lập hàng loạt (N)`.
  - **Tab 2 (`Gộp nhiều SĐT`)**: Batch `Chấp nhận tách tất cả SĐT hợp lệ (N)` alongside per-card split/edit/delete controls.
  - **Tab 3 (`Gộp nhiều địa chỉ`)**: Inline search filter across `name`/`phone`/`address`, tall `max-h-96` scrollable list with checkboxes (`Chọn tất cả đang lọc`, `Bỏ chọn`), and batch `Chuyển sang Đ/C phụ (N)` (recommended), `Giữ nguyên / Ẩn cảnh báo (N)`, and `Tách thành 2 khách (N)`.
  - **Tab 4 (`Trùng SĐT`)**: `(Đề xuất Chính)` badge via `rankPrimaryCustomer`, per-card `Đặt làm Chính` / `Sửa` / `Xóa`, 1-click `Gộp cả N khách vào Chính`, and batch `Gộp toàn bộ nhóm theo đề xuất (N)`.
  - **Tab 5 (`Lệch với đơn cũ`)**: Smart `"Đề xuất"` tag per differing order with `+ Lưu thành SĐT 2`, `+ Thêm làm Đ/C phụ`, `Khôi phục theo đơn này`, `Tách thành 2 khách`, `Bỏ qua (Đã đúng)`, and batch `Áp dụng đề xuất hàng loạt`.
- Added discrete `"Đặt lại X mục đã bỏ qua"` control to un-hide acknowledged items.

### 4. Customer Directory Multi-Select & Batch-Edit Toolbar (`src/pages/CustomersPage.tsx`)
- Added multi-select checkboxes on both Desktop Table rows/header and Mobile Cards (`Chọn trang này`, `Bỏ chọn tất cả`).
- Added sticky **Batch Edit Toolbar** when `selectedCustomerIds.size > 0`:
  - **`Gộp thành 1 khách`** (preview modal defaulting primary to `rankPrimaryCustomer`).
  - **`Chuyển Đ/C phụ hàng loạt`** (for selected customers with multi-address strings).
  - **`Xóa đã chọn`** (safety confirmation modal separating 0-debt/0-order profiles from customers with debt/orders).
- Added individual `Xóa` buttons in the Customer Detail Modal footer, Desktop Table row actions (preserving the 145px sticky action column), and Mobile Cards using the same safety confirmation modal.

---

## Verification

- **Unit & Integration Suite (`scripts/test_adr0021.js`)**: Verified ghost detection (`Ayse Nguyen`), `analyzeToneTwinGroup`, `rankPrimaryCustomer`, 3+ customer `mergeCustomerGroupHelper`, `analyzeDiscrepancyOrder`, non-destructive `phone2`/`extraAddresses` helpers, `deleteCustomersBatchHelper`, `executeChunkedCustomerDelete`, persistent acknowledgments, and UI/StoreContext integration contracts.
- **Full Regression Suite (`scripts/test_*.js`)**: All existing ADR test suites (ADR-0007 through ADR-0020 & sync conflict) passed.
- **Production TypeScript & Vite Build**: `npm run build` (`tsc --noEmit && vite build`) passed with 0 errors.
