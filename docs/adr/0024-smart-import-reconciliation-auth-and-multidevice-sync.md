# ADR-0024: Smart Excel/JSON Import Reconciliation, Fast Username+Password Sign-In Gate, and Realtime Multi-Device Sync

**Status:** Accepted  
**Date:** 2026-11-21  
**Context:** Import Conflict/Override Prevention, Multi-Device Sync Architecture (WebSocket Realtime + Catch-up Reconciliation), and Store Access Security (Username & Password Auth Gate)  

---

## 1. Context & Problem Statement

Following the rollout of ADR-0023 (universal Cloud-Truth multi-device sync), three structural questions remained open for daily store operations across multiple devices (POS PC at the shop, owner's laptop/phone at home):

1. **Does importing an Excel file override the entire database?**
   - Answering accurately: Uploading an Excel file does **not** wipe unrelated records that are absent from the file (products, customers, or orders not listed in the spreadsheet stay in state). However, code inspection across the 4 import entry points revealed **4 dangerous override / duplication / blind-import bugs** whenever re-importing an exported sheet or importing updated figures:
     1. **Product Excel Import (`src/pages/ProductsPage.tsx`)**:
        - Every duplicate dish defaulted to `action: 'accumulate'` (`Cộng kho`), so re-importing an exported catalog doubled stock (`existing.stock + row.stock`) on every existing product.
        - Even in `'accumulate'` mode, the loop unconditionally overwrote `price`, `cost`, `unit`, `category`, and `name` (`row.price || row.existingProduct.price`) without surfacing field-level diffs (`Cũ → Mới`).
        - Products present in the catalog but omitted from the uploaded Excel sheet (`missingFromFile`) were invisible to the operator (no option to inspect or selectively remove discontinued dishes).
        - Confirmed updates invoked `updateProduct()` inside a `.forEach(...)` loop, triggering N React state updates and N individual Supabase requests.
     2. **Customer Excel Import (`src/pages/CustomersPage.tsx`)**:
        - Every phone-matched duplicate customer defaulted to `action: 'accumulate'` (`Cộng dồn nợ`), doubling `debt` (`baseDebt + row.debt`) whenever an exported directory was re-imported.
        - Lacked diff classification (`new`, `identical`, `enrich_contact`, `conflict`), did not flag `name_only` collisions (same normalized Vietnamese name with missing/different phone), and invoked `updateCustomer()` inside a loop (up to thousands of separate HTTP calls).
     3. **Order Excel Import (`src/pages/ReportsPage.tsx`)**:
        - Had no pre-import analysis or preview modal at all: choosing an `.xlsx` file immediately inserted new order IDs and silently ignored existing order IDs even when totals, items, payment status, or debt figures differed from the Excel file.
     4. **JSON Backup Restore (`src/pages/SettingsPage.tsx`)**:
        - Triggered `importAllData(json)` immediately upon selecting a `.json` file without displaying a summary comparing incoming record counts against current store state.

2. **How should Multi-Device Sync harden against concurrent edits, tab sleep, and cross-device latency?**
3. **What is the fastest, most secure Sign-In mechanism for a browser-based multi-device POS used by non-technical staff?**

---

## 2. Primary-Source Research Findings

### A. Multi-Device Sync Best Practices (Supabase Realtime + Offline-First Catch-Up)

- **Primary Sources:**
  - Supabase Realtime Postgres Changes Guide (`https://supabase.com/docs/guides/realtime/postgres-changes`)
  - Supabase Realtime Architecture & Limitations (`https://supabase.com/docs/guides/realtime/architecture`)
- **Verified Architectural Facts:**
  1. **Realtime WebSocket (`postgres_changes`) is push-based, best-effort, not a durable replication log**: Supabase Realtime decodes PostgreSQL Write-Ahead Log (WAL) changes and broadcasts them to subscribed clients in `<100ms`, evaluating RLS policies per subscriber. However, WebSockets disconnect when laptops sleep or mobile browser tabs enter the background, and Supabase Realtime **does not replay missed WAL events** during downtime.
  2. **Polling alone wastes bandwidth and leaves up to 45s staleness window**: Pure HTTP polling without WebSocket wakeups leaves two active devices out of sync between intervals.
  3. **Optimal 3-Layer Hybrid Sync Architecture for MexucxichCuisine**:
     - **Layer 1 — Realtime Push Trigger (`supabase.ts` -> `subscribeToCloudRealtimeChanges`)**: Subscribe to channel `mxc-realtime-sync` (`postgres_changes`, `{ event: '*', schema: 'public' }`) and debounce remote table events (`1500ms`) into `executeCloudPullRef` when the tab is foreground-visible. Note: Supabase Realtime only emits events for tables added to the `supabase_realtime` publication; when enabled on Supabase Dashboard -> Database -> Publications, remote changes wake other open browsers near-instantly.
     - **Layer 2 — Wake/Reconnect Catch-Up + Background Safety Poll (`StoreContext.tsx`)**: Trigger idempotent mutex-guarded pulls on `mount`, `focus`, `visibilitychange`, `online`, and a `45s` foreground `setInterval` so suspended tabs never miss intermediate changes.
     - **Layer 3 — Authoritative Reconciliation (`reconcileCloudAndLocalPullData`)**: Combine the Cloud Tombstone Ledger (`store_settings` row `cloud_tombstones_v1`) with explicit local dirty queues (`mxc_dirty_product_ids_v1`, `mxc_dirty_order_ids_v1`) plus fault-isolated per-table pull flags so transient network/table failures never wipe local state while Cloud deletions propagate cleanly across all devices.

### B. Sign-In & Access Security Best Practices (Username + Password vs Magic Link vs OAuth)

- **Primary Sources:**
  - Supabase Auth Password-Based Login (`signInWithPassword`) & Session Persistence (`persistSession`, `autoRefreshToken` in `localStorage`) (`https://supabase.com/docs/guides/auth/passwords`, `https://supabase.com/docs/reference/javascript/auth-signinwithpassword`)
  - Supabase Row Level Security (`authenticated` vs `anon` role) (`https://supabase.com/docs/guides/database/postgres/row-level-security`)
  - WHATWG HTML Specification — Autofill tokens `autocomplete="username"` and `autocomplete="current-password"` (`https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fe-autocomplete`)
- **Comparative Decision (Speed vs Security for POS Operations):**
  - **Magic Link / Email OTP**: Slow (`15–90s` mailbox switching on shared store PCs; fails if email is not logged into that browser; cannot authenticate offline).
  - **Google OAuth**: Requires logging the store owner's personal Google account into shop cashier browsers (security risk if staff use the counter PC).
  - **Username + Password with Browser Password Manager Autofill + Persistent Local Session**: Fastest (`<1s` autofill via `autocomplete="username"` / `autocomplete="current-password"`), zero inbox switching, remembers the device for 30 days (`sessionTtlDays: 30`), and allows an explicit 1-click **"Khóa máy"** lock button when stepping away.
- **Hybrid Store Auth Gate Design (`src/utils/auth.ts`, `store_auth_config_v1`)**:
  - Store-wide credentials configuration (`requireSignIn`, `username`, `passwordHash`, `salt`, `sessionTtlDays`, `updatedAt`) is hashed deterministically on the client and synchronized across devices via `store_settings` row `id = 'store_auth_config_v1'`.
  - Default `requireSignIn` is `false` so existing devices are not unexpectedly locked out on deployment until the owner enables mandatory sign-in (default credentials: username `hang` or alias `mexucxich`, password `mexucxich`, editable in Settings).
  - Changing the password updates `passwordHash` and invalidates prior sessions (`passwordHashSnapshot !== config.passwordHash`) across devices once synced.
  - Also includes `normalizeUsernameToEmail()` mapping short POS usernames (`hang` -> `hang@mexucxich.pos`) cleanly for forward compatibility with Supabase Auth `signInWithPassword` + `authenticated` RLS policies.

### C. Smart Import / Export Diff-First Reconciliation Pattern

- **Industry Standard (Preview -> Classify Diffs -> Recommended Safe Action -> Batch Commit)**:
  1. **Dry-Run Pre-Flight Diff (`src/utils/importReconciler.ts`)**: Never mutate live state or append blind stock/debt before computing field-by-field diffs against current state.
  2. **Safe Smart Defaults**:
     - `identical` records (0 differing fields) MUST default to `'skip'`, eliminating accidental stock/debt doubling upon re-import.
     - `info_changed` products (price/cost/unit/category changed, same stock) default to `'update_info'` (keeping existing live stock intact).
     - `enrich_contact` customers (same debt, new `phone2`/`extraAddresses`/accented name) default to `'merge_info'` (preserving debt while appending secondary contacts).
     - `conflict` records show exact `oldValue → newValue` diffs with 1-click choice (`Ghi đè`, `Giữ nguyên`, `Cộng dồn`, `Tạo riêng` for `name_only` collisions).
     - `missingFromFile` catalog items are surfaced in a dedicated tab (`Giữ nguyên` vs selective `Xóa khỏi thực đơn`).
  3. **Atomic Batch Execution**: Single React state transition + single `localStorage` write + single chunked Supabase batch upsert/delete (`updateProductsBatch`, `deleteProductsBatch`, `updateCustomersBatch`, `restoreFromExcelOrders(..., { overwriteOrderIds })`).

---

## 3. Architecture & Changes Implemented

1. **`src/utils/importReconciler.ts`**: Pure reconciliation engine (`analyzeProductImportRows`, `buildProductImportPlan`, `analyzeCustomerImportRows`, `buildCustomerImportPlan`, `analyzeOrderImportRows`).
2. **`src/utils/auth.ts`**: Client-side password hashing, credential verification (`hang` / `mexucxich`), 30-day session lifecycle validation, and username-to-email helper (`normalizeUsernameToEmail`).
3. **`src/services/supabase.ts`**: Exported `STORE_AUTH_CONFIG_ROW_ID`, added `fetchStoreAuthConfig`, `pushStoreAuthConfig`, and debounced WebSocket `subscribeToCloudRealtimeChanges`.
4. **`src/context/StoreContext.tsx`**: Added atomic `updateProductsBatch`, `deleteProductsBatch`, `updateCustomersBatch`, `overwriteOrderIds` support in `restoreFromExcelOrders`, auth state (`authConfig`, `isAuthenticated`, `isScreenLocked`, `loginWithPassword`, `logoutOrLockScreen`, `updateAuthConfig`), Cloud auth config pull reconciliation, and Realtime channel listener.
5. **`src/components/auth/AuthGateModal.tsx`**, **`src/components/layout/Layout.tsx`**, **`src/components/layout/Navbar.tsx`**: Fast `<form>` autofill login overlay, mandatory lock screen support, and Navbar `"Khóa máy"` / `"Đăng nhập"` button.
6. **Import & Security UI**:
   - `src/pages/ProductsPage.tsx`: Smart diff tabs, field-level change badges, `update_info`/`overwrite`/`accumulate`/`skip` actions, `Không có trong File` deletion tab, batch commit.
   - `src/pages/CustomersPage.tsx`: Conflict/enrich/identical diff classification, `name_only` collision alerts, `merge_info`/`overwrite`/`accumulate`/`skip`/`create` actions, batch commit.
   - `src/pages/ReportsPage.tsx`: New Order Excel Preview & Conflict Resolution modal prior to `restoreFromExcelOrders`.
   - `src/pages/SettingsPage.tsx`: Pre-import JSON summary diff confirmation + Username/Password Security Management card.

---

## 4. Verification

- **`scripts/test_adr0024.js`**: Unit & contract suite covering product/customer/order import diffing & execution plans, auth hashing/session/invalidation, and integration contracts across all modified components.
- **Full Regression Suite (`scripts/test_*.js`) & `npm run build` (`tsc --noEmit && vite build`)**: Verified with 0 failures and 0 build errors.
