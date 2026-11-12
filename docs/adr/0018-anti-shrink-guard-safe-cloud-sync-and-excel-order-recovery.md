# ADR-0018: Catalog Anti-Shrink Guard, Defensive Cloud Sync, Emergency Vault & Native Excel Order Recovery

**Status:** Accepted  
**Date:** 2026-11-12  
**Context:** Mexucxich Cuisine Catalog Protection, Supabase Synchronization, Data Resilience & Incident Recovery  

---

## Context & Root Cause Analysis

On November 12, 2026, the store owner (Hằng - Mexucxich Cuisine) reported a critical data incident:
- The store's product menu abruptly shrank from **83 products to 28 products**.
- Recent order history and sales data over several days appeared missing from the active screen.
- Crucially, the owner noted: *"Fortunately, I download the sales report (`mexucxich_bao_cao_*.xlsx`) every single day!"*

### Root Cause Forensic Breakdown
1. **The 28 Product Mystery ($8 + 20 = 28$):**
   - The application defines 8 fallback mock items in `INITIAL_PRODUCTS`.
   - The production Supabase database contained 20 frozen products created prior to October 12, 2026.
   - When a fresh client session initialized without local cache (e.g. mobile Safari WebView, private browsing, or when cache was cleared), `INITIAL_PRODUCTS` (8 items) merged with the Cloud database (20 items), yielding exactly 28 items.
2. **PostgREST Schema Desynchronization (`PGRST204`):**
   - On October 12, 2026 (Commit `b71af76` / ADR-0008), the schema migration added `updated_at` to client-side payload transformers (`transformProductToDb`, `transformCustomerToDb`, `transformOrderToDb`, `transformDebtPaymentToDb`).
   - However, the production Supabase cloud database instance had not executed `ALTER TABLE ... ADD COLUMN updated_at`.
   - Consequently, for 31 consecutive days, every single cloud upsert attempt was rejected by Supabase with error code `PGRST204` (*"Could not find the 'updated_at' column in the schema cache"*). Single-item sync methods failed silently, leaving all 83 products and recent orders exclusively stored inside the client's local browser storage (`localStorage`).
3. **Hazardous Header Reset Button:**
   - `src/components/layout/Navbar.tsx` prominently featured a `"Dữ liệu mẫu"` (`RotateCcw`) button directly in the global navigation bar with a standard single-click `window.confirm` dialog. On mobile viewports or busy cashier shifts, accidental taps could easily wipe local state.
4. **Vulnerability of Unidirectional Downward Overwrites:**
   - Prior to this ADR, if cloud data was pulled into a client session with partial data, or if a sync occurred, there was no safeguard verifying that the cloud catalog was not smaller than the in-memory catalog, allowing local data to be compressed or hidden.

---

## Decisions

### 1. Removal of Hazardous Reset from Global Navbar (`Navbar.tsx` & `SettingsPage.tsx`)
- Completely removed the `"Dữ liệu mẫu"` (`RotateCcw`) button from the global header in `src/components/layout/Navbar.tsx`.
- Relocated and restricted the reset action strictly to the danger zone inside `SettingsPage.tsx`.
- Enforced **typed confirmation**: The reset action can no longer be triggered by an accidental click on a confirm dialog. The user must explicitly type `"XAC NHAN"` or `"RESET"`.
- Prior to executing `localStorage.clear()` in `resetToMockData`, the application automatically persists a full state snapshot into the Emergency Vault (`mxc_emergency_vault`).

### 2. Defensive Supabase Payload Sanitizer & Immediate Fallback (`supabase.ts`)
- Implemented `stripUpdatedAt<T>(data: T)` to sanitize payloads by removing `updated_at` without mutating original entity objects.
- Implemented `isMissingColumnError(error: any, column = 'updated_at')` to identify `PGRST204`, Postgres code `42703`, and schema cache mismatches.
- Implemented `safeUpsert(client, table, rows, onConflict)`:
  - Executes upsert with the full payload.
  - If PostgREST responds with `PGRST204` or missing column error, it logs a warning and immediately retries the upsert without `updated_at`.
  - Applied `safeUpsert` to chunked batch syncs (`upsertInChunks`) and single-item sync handlers (`cloudSyncProduct`, `cloudSyncCustomer`, `cloudSyncOrder`, `cloudSyncDebtPayment`, `cloudSyncSettings`).
  - Wrapped `cloudAdjustProductStock` fallback update to retry without `updated_at` if missing.
  - Ensures seamless two-way cloud persistence regardless of whether the Supabase instance has executed recent SQL migrations.

### 3. Catalog Anti-Shrink Guard & Safe Cloud Sync (`syncConflict.ts` & `StoreContext.tsx`)
- Created `applyCatalogAntiShrinkGuard(currentLocalProducts, incomingProducts)`:
  - If an incoming payload from Supabase has fewer products than the active local catalog (e.g. 20 items incoming vs 83 items local), the guard blocks catalog shrinkage and triggers a comprehensive merge via `mergeProductsWithConflictResolution`.
  - Guarantees that local products never get discarded or truncated during cloud pull operations.
  - Applied to automatic boot refresh, tab focus auto-sync, and manual cloud pull operations.

### 4. Rolling Daily Backup & 1-Click Emergency Vault (`vault.ts` & `StoreContext.tsx`)
- Designed an automated local persistence hierarchy:
  - **`mxc_emergency_vault`**: High-priority recovery vault. Automatically updated during active store operations, but strictly protected against overwrite if the incoming dataset is smaller than the vault's product count.
  - **`mxc_backup_daily_YYYY-MM-DD`**: Rolling daily snapshots automatically maintained and pruned after 7 days, protected with anti-shrink guards against accidental wipe overwrites.
  - **Boot Auto-Shielding:** On application startup, if local storage products or orders are empty or contain only default mock items, the store automatically shields and initializes from the Emergency Vault.
- Implemented `restoreFromVault(key)`: Enables 1-click restoration from the Emergency Vault or historical daily backups directly inside `SettingsPage.tsx`, immediately syncing restored catalogs and orders via `cloudSyncProductsBatch`, `cloudSyncCustomersBatch`, and `cloudSyncOrdersBatch`.
- Integrated `listVaultBackups()` providing full metadata (timestamp, product count, order count) for auditability.

### 5. Native Order Excel Importer & 1-Click Menu Reconstruction (`excel.ts` & `ReportsPage.tsx`)
- Built `parseOrdersExcel(file: File | ArrayBuffer | Uint8Array)`:
  - Reads standard daily export files (`mexucxich_bao_cao_*.xlsx`).
  - Scans and maps headers using fuzzy aliases (`ORDER_HEADER_ALIASES`), including full delivery address preservation (`customerAddress`).
  - Reconstructs full `Order` entities, including order ID, date, customer name, phone, delivery address, order type, status, and financial breakdown.
  - Robustly decomposes composite `"Món Đã Mua"` strings into individual `OrderItem` objects via parenthesis-aware splitting (`splitOutsideParens`) and regex matchers in `parseOrderItemsString`:
    - Handles fractional quantities (e.g. `0.59kg`), formatted Vietnamese currency (`145.000đ`), and complex names with parenthetical specifications (`Lõi vai bò vân tuyết Aukobe (Cân ký lẻ)`).
    - Seamlessly parses multi-line Excel cells (`\n`, `\r\n`), semicolons (`;`), pluses (`+`), prefix quantities (`2x Xúc xích Heo`), postfix quantities (`Xúc xích Heo x 2`), and colon specifications (`Xúc xích Heo: 2 gói - 145.000đ`).
- Implemented `extractMissingProductsFromOrders(orders, existingProducts)`:
  - Extracts all unique menu items referenced in imported orders.
  - For any dish missing from the current menu catalog, automatically synthesizes a complete product profile (inferred category, unit, image emoji, price, cost estimate, and stock).
- Added **"Nhập báo cáo Excel"** button in `src/pages/ReportsPage.tsx` next to "Xuất báo cáo Excel":
  - Enables the store owner to upload daily sales reports and recover all orders and missing menu items with a single click, batch-syncing new orders to Supabase Cloud via `cloudSyncOrdersBatch`.

### 6. Historical Order Discrepancy Scanner & 1-Click Snapshot Restore (`customerSentinel.ts` & `CustomerSentinelModal.tsx`)
- Enhanced `auditCustomerData` to cross-reference CRM customer profiles against historical order receipt snapshots, auditing differing phones, addresses, and names (including tone twins and alternate persons on the same ID).
- Added a dedicated **"Lệch với đơn cũ"** (Discrepancy) tab in the Customer Data Sentinel modal:
  - Identifies customer records where names, phones, or delivery addresses in the CRM profile differ from historical order snapshots.
  - Provides **"Khôi phục theo đơn này"** (Restore from order snapshot): 1-click rollback of customer contact info to the verified receipt data, with built-in safeguard against overwriting genuine customer names with generic placeholders ("Khách lẻ").
  - Provides **"Tách thành 2 khách"** (Split into 2 customers): 1-click decoupling when orders contain an alternative phone number, automatically decoupling combined phone numbers and cleanly partitioning order debt.

---

## Consequences

- **Fail-Safe Data Retention:** The store catalog can never shrink below its verified local size due to the Catalog Anti-Shrink Guard.
- **Robust Cloud Compatibility:** PostgREST payload sanitization guarantees that Supabase synchronization functions even if production database tables lack newly added timestamp columns.
- **Instant Recovery Mechanism:** Store owners who download daily Excel reports have a 1-click disaster recovery path that reconstructs both historical orders and menu items simultaneously.
- **Accidental Wipe Immunity:** Accidental header clicks are eliminated, and any intentional reset preserves a pre-reset emergency vault snapshot.
- **100% Verification Coverage:** Automated test suite `scripts/test_adr0018.js` validates order excel parsing, anti-shrink protection, PGRST204 fallback, emergency vault lifecycle, missing product extraction, and historical order discrepancy resolution. All prior ADR test suites pass without regression.
