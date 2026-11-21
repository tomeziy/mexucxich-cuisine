# 0025. Cloud-First POS Architecture, Zero-Config Devices, Dual-Role Auth & Supabase Auth/RLS

**Status:** Accepted  
**Date:** 2026-11-22  
**Supersedes:** Offline-first & manual-URL UI aspects of ADR-0001 and ADR-0006; Emergency Vault boot/UI recovery in ADR-0018  

---

## Context & Decision

Previous iterations left the application behaving as two competing databases (browser `localStorage` + `Emergency Vault` vs Supabase Cloud) and exposed raw developer Supabase configuration (`Supabase Project URL`, `Anon Public Key`, SQL instructions, manual Push/Pull buttons, and `Đặt lại dữ liệu mẫu`) inside `SettingsPage.tsx`. Any browser opening on a secondary PC or mobile device risked stale cache mismatches, vault resurrections, or confusing configuration prompts.

Following architectural review (`/grill-with-docs`), we decided to transition completely to a **Cloud-First POS** model:

1. **Zero-Config Multi-Device Connection**:
   - The store's Supabase Cloud connection (`DEFAULT_SUPABASE_URL` / `DEFAULT_SUPABASE_ANON_KEY`) is built directly into the application.
   - All raw developer Cloud settings (`Supabase Project URL`, `Anon Key`, `Kiểm tra kết nối`, `Lưu cấu hình`, `Đẩy lên Cloud`, `Tải từ Cloud về`, `Đặt lại dữ liệu mẫu`, `Khôi phục Hầm Cứu Hộ`) are removed from `SettingsPage.tsx`.
2. **Cloud as Single Authoritative Database + Transient Offline Outbox**:
   - Opening the app after sign-in downloads live products, customers, orders, debt payments, and settings directly from Supabase Cloud.
   - `Emergency Vault` boot auto-recovery is removed so stale browser snapshots never overwrite or pollute Cloud state.
   - Browser `localStorage` acts strictly as a read cache + transient **Offline Outbox** (`dirty*Ids`, pending deletes) while offline or awaiting cloud confirmation. Once synced, clean Cloud records replace the local cache 1:1.
3. **Mandatory Sign-In Screen with Persistent Device Session & Dual Roles (`mexucxich` Owner + `admin` Admin)**:
   - Unauthenticated browsers display a clean Username + Password Sign-In screen (`AuthGateModal`). Valid sessions persist across reloads (30 days) on trusted devices such as the shop counter PC and sign out cleanly on request.
   - Two store accounts share the same live store dataset:
     - **Store Owner (`mexucxich` / pass `mexucxich123`, alias `hang`)**: Clean daily POS workspace (Sales, Products, Customers, Reports, Receipt/VietQR Settings, Excel Import/Export, JSON Backup/Restore, and personal password change).
     - **System Admin (`admin` / pass `admin2026`, alias `tung`)**: Full store workspace plus Admin-only Account Management & Database Lock SQL tools.
4. **Supabase Auth (`signInWithPassword`) + Authenticated RLS + `create-store-user` Edge Function**:
   - Sign-in attempts real `supabase.auth.signInWithPassword` (mapping short usernames such as `mexucxich` -> `mexucxich@mexucxich.pos` and `admin` -> `admin@mexucxich.pos`) with seamless fallback to cloud-synced store credentials while one-time SQL setup is pending.
   - Includes a one-time idempotent SQL script (`supabase_schema.sql`) creating the initial auth users and tightening all 5 table RLS policies to `to authenticated`, plus a Deno Edge Function (`supabase/functions/create-store-user/index.ts`) so Admin can add future staff accounts or reset passwords directly from the UI using server-side `service_role` privileges without exposing keys to the browser.

## Consequences

- **Positive**: Any computer or phone opens the URL, signs in with username + password, and immediately works with identical live Cloud data. Hằng's Settings page contains zero Supabase/SQL developer clutter while retaining Excel and JSON backup controls.
- **Migration Note**: Until the Admin runs the one-time SQL in Supabase SQL Editor (`to authenticated` RLS + initial `auth.users`), login continues working seamlessly via fallback verification so shop operations experience zero downtime.
