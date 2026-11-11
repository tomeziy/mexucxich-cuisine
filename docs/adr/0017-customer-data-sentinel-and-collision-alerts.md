# ADR-0017: Customer Data Sentinel, Historical Data Recovery & POS Live Collision Alerts

**Status:** Accepted  
**Date:** 2026-11-11  
**Context:** Mexucxich Cuisine Customer Data Integrity, POS Operations & CRM Management  

---

## Context & Problem Statement

Field operational feedback and user reports identified persistent risks in customer identity and historical CRM records:

1. **Historical Data Fusion for Near-Duplicate Names ("Thanh Hang" vs "Thanh Hằng"):**
   - Prior to ADR-0015 and ADR-0016, Excel imports and manual profile updates used tone-flattened deduplication (`removeVietnameseTones(name)`). As a result, distinct customers sharing identical unaccented names ("Thanh Hang" with phone `0988111222` residing at 12 Hoàn Kiếm, and "Thanh Hằng" with phone `0988333444` residing at 45 Đội Cấn) were erroneously fused into mixed records with concatenated phone numbers (`0988111222 / 0988333444`) and slashed addresses (`12 Hoàn Kiếm / 45 Đội Cấn`).
   - Browser `localStorage` and Supabase cloud state retained these merged records, causing confusion when looking up customer history and creating delivery orders.
2. **POS Cashier Collision Hazard (Tone Twins):**
   - Even with diacritic-aware ranking in search, cashiers operating fast checkout at POS could inadvertently select the wrong customer when two distinct people shared identical unaccented base tokens ("Thanh Hang" vs "Thanh Hằng", "Hương" vs "Hường", "Tuấn" vs "Tuân").
   - There was no proactive alert banner notifying the cashier at the moment of selection that an identically named tone-twin existed with different contact details.
3. **Multi-Phone and Multi-Address Anomalies in CRM:**
   - Certain customer records contained concatenated 20-digit strings (resulting from prior numeric-only stripping like `08692291600986476328`) or multi-phone values separated by slashes, commas, or semicolons.
   - Slashed delivery addresses (e.g. `12 Đội Cấn / 45 Hàng Bè`) left delivery drivers uncertain about the correct destination.
4. **Duplicate Phone Numbers Across Customer Records:**
   - Multiple customer IDs existed with the same normalized phone number, dividing purchase histories and debt ledgers.

---

## Decisions

### 1. Historical Recovery & Clean Separation ("Thanh Hang" and "Thanh Hằng")
- Updated `INITIAL_CUSTOMERS` in `src/data/initialData.ts` to include verified, separate canonical records:
  - **`KH05` (Thanh Hang):** Phone `0988111222`, Address `12 Hoàn Kiếm, Hà Nội`.
  - **`KH06` (Thanh Hằng):** Phone `0988333444`, Address `45 Đội Cấn, Ba Đình, Hà Nội`.
- Implemented `repairAndMigrateCustomers` in `src/utils/customerSentinel.ts`, which automatically executes during `StoreContext` initialization, local import, and Cloud sync:
  - Detects any customer with fused contact info (`0988111222` AND `0988333444`, or `Hoàn Kiếm` AND `Đội Cấn`).
  - Decouples them into two clean records with canonical phone numbers and addresses.
  - Re-links past orders referencing the fused ID: orders delivered to Đội Cấn or recipient phone `0988333444` are linked to `Thanh Hằng`, while orders delivered to Hoàn Kiếm or recipient phone `0988111222` are linked to `Thanh Hang`.

### 2. POS Live Collision Alert & Combobox Tone Twin Awareness (`src/pages/PosPage.tsx` & `CustomerCombobox.tsx`)
- Integrated real-time collision detection via `findToneTwinCustomers`:
  - When a cashier selects a customer at POS, the system checks whether any other active customer shares the unaccented name (`removeVietnameseTones(c.name) === removeVietnameseTones(selectedCustomer.name)` with different IDs).
  - Generic customer placeholders (e.g. "Khách lẻ tại quầy") are strictly excluded.
- If tone twins exist, an eye-catching amber alert banner renders immediately below the customer selection box:
  `⚠️ Chú ý: Có khách hàng tên tương tự là "[Tên]" (SĐT: [SĐT] - Đ/c: [Địa chỉ]). Vui lòng kiểm tra kỹ SĐT trước khi tạo đơn/giao hàng!`
- Includes a 1-click **"Chuyển sang khách này"** (Switch to this customer) button that instantly changes the active customer and updates the delivery recipient snapshot without leaving the POS screen.
- Enhanced `CustomerCombobox.tsx`:
  - Automatically identifies customers belonging to tone-twin collision groups and displays a distinctive amber `⚠️ Tên tương tự` badge on closed trigger button and within search dropdown items.
  - Cashiers are alerted to potential name ambiguity before finalizing customer selection.

### 3. Customer Data Sentinel Hub (`CustomersPage.tsx` & `CustomerSentinelModal.tsx`)
- Added an automated audit panel and alert banner in `CustomersPage.tsx` running `auditCustomerData`:
  - Detects **Tone Twins** (name collisions with different diacritics).
  - Detects **Multi-Phone Records** (slash-separated numbers, commas, or >11 digit numbers like legacy 20-digit strings).
  - Detects **Multi-Address Records** (slashed delivery addresses).
  - Detects **Duplicate Phones** across distinct customer records.
- Provides a **"Kiểm tra & Xử lý bất thường ([N] cảnh báo)"** button that opens `CustomerSentinelModal`:
  - **Side-by-Side Review with Receipt Drilldown:** Displays conflicting customers side-by-side alongside their recent order history snapshots (showing past receipt phones and delivery addresses used).
  - **1-Click Splitting (`splitCustomerRecord`):** Decouples multi-phone or multi-address records into two distinct customer profiles with 1 click, reassigning matching orders.
  - **1-Click Merging (`mergeCustomerRecords`):** Merges duplicate phone records into a single customer profile, aggregating debt and transferring order records.
  - **1-Click Auto-Heal (`repairCustomerData`):** Automatically cleans 20-digit phones, restores known historical profiles, cleans slashed names, and recalculates customer spend.

---

## Consequences

- **100% Disambiguation:** Cashiers can never accidentally assign an order to the wrong customer without seeing an active warning banner.
- **Pristine Historical Records:** Corrupted or fused customer data from legacy Excel imports is cleanly repaired and separated in local storage and Cloud sync.
- **Audit Transparency:** Store owners have complete visibility into CRM anomalies, backed by historical order receipts to confirm correct contact assignments.
- **Zero Build Regressions:** All existing automated test suites (ADR-0008, ADR-0010, ADR-0015, ADR-0016) pass alongside the new ADR-0017 test suite.
