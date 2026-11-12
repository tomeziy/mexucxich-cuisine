# ADR-0019: Dual Customer Phone Support (SĐT chính & SĐT 2 / SĐT phụ), Multi-Phone Search & Ranking, and Backward-Compatible Cloud Serialization

**Status:** Accepted  
**Date:** 2026-11-12  
**Context:** Customer Profile Management, Multi-Phone Search Ranking, Supabase Cloud Synchronization & POS Delivery Operations  

---

## Context & Problem Statement

Store owner Hằng and kitchen operations requested: *"cho thêm chức năng khách hàng có thể có 2 sdt nữa"*.

In daily restaurant and catering operations at Mexucxich Cuisine:
1. **Frequent Multi-Phone Customer Profiles:**
   - Customers frequently maintain 2 active contact numbers (e.g., personal & office mobile, husband & wife, or ordering contact & on-site delivery recipient).
   - In legacy versions, `Customer` had only a single `phone: string` attribute. Cashiers were forced to concatenate multiple numbers into one string (e.g. `0904047976 / 0988123456`) or create duplicate customer entries, which triggered Customer Sentinel anomaly alerts or fragmented customer purchase histories.
2. **Search Ambiguity & Ranking Deficiencies:**
   - When a customer called or placed an order using their secondary phone number, search queries failed to match or gave lower scores unless the second number was explicitly supported in the Phone-First ranking hierarchy.
3. **Database Schema & Cloud Synchronization Risk:**
   - Existing production Supabase tables (`customers`) only have a `phone text default ''` column without a dedicated `phone2` column. A naive schema change requiring `phone2` in Supabase would break sync or trigger `PGRST204` / column-not-found errors across existing store client instances.
4. **POS Speed & Friction during Delivery Dispatch:**
   - When preparing delivery orders for a customer with 2 phone numbers, cashiers needed a quick 1-click mechanism to toggle which phone number to send to the delivery driver / Shipper without manually copying and re-typing numbers.

---

## Decisions

### 1. Customer Type Extension (`src/types/index.ts`)
Extended `Customer` with an optional secondary phone field:
```typescript
export interface Customer {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  debt: number;
  totalSpent?: number;
  orderCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
```

### 2. Backward-Compatible Cloud Serialization (`src/services/supabase.ts`)
Ensured 100% backward compatibility with existing Supabase schema instances where the `customers` table only contains a `phone` column:
- **`transformCustomerToDb`**:
  - When `customer.phone2` exists, format `phone: c.phone2 ? `${c.phone || ''} / ${c.phone2}` : (c.phone || '')`.
  - This preserves both numbers in the cloud without requiring schema alterations or dropping data.
- **`transformCustomerFromDb`**:
  - If `row.phone2` exists (supporting future database column additions), use it directly.
  - If `row.phone` contains ` / `, split into `phone = parts[0].trim()` and `phone2 = parts.slice(1).join(' / ').trim() || undefined`.

### 3. Multi-Phone Search Ranking & Scoring Engine (`src/utils/customerSearch.ts`)
- **`scoreCustomer`**:
  - Searches across BOTH `customer.phone` AND `customer.phone2`.
  - Normalizes both phone numbers with `normalizeVietnamesePhone`.
  - Awards phone match scores equally whether query matches `customer.phone` or `customer.phone2`:
    - Tier 1 (300 pts): Exact Phone Match (matches phone 1 or phone 2).
    - Tier 2 (250 pts): Phone Prefix Match (>= 3 digits).
    - Tier 3 (220 pts): Phone Substring Match (>= 3 digits).
    - Mixed multi-token queries (e.g. name + phone2) match and score appropriately.
- **`findDuplicatePhoneCustomer`**:
  - Checks candidate phone against both `c.phone` and `c.phone2` across all existing customer records.
  - Excludes `excludeCustomerId` during profile edits so a customer with dual phones never flags a duplicate against themselves.

### 4. Customer Data Sentinel Immunity for Clean Dual Phones (`src/utils/customerSentinel.ts`)
- **`extractIndividualPhones`**:
  - Updated to accept `phone2Str` as an optional second parameter: `extractIndividualPhones(phoneStr: string, phone2Str?: string): string[]`.
- **`auditCustomerData`**:
  - Distinguishes legitimate dual phone profiles from malformed entries.
  - When a customer has clean separate `phone` and `phone2` (each being a single valid Vietnamese phone number without concatenated/slashed numbers), Sentinel does NOT flag them as a `multiPhoneAnomaly`.
  - Orders placed using `customer.phone2` are recognized as legitimate customer numbers and do NOT trigger historical order phone discrepancies.

### 5. UI Integration & 1-Click Delivery Phone Toggle
- **`QuickAddCustomerModal.tsx` & `QuickEditCustomerModal.tsx`**:
  - Added dedicated input field for `phone2` ("Số điện thoại 2 (tùy chọn)").
  - Real-time duplicate phone checking for both `phone` and `phone2`.
  - Validates against self-duplicate (entering the same number in both fields).
  - Persists `phone2` into `addCustomer` and `updateCustomer`.
- **`CustomersPage.tsx`**:
  - Added `phone2` input in "Thêm khách hàng mới" and "Chỉnh sửa thông tin khách hàng" modals.
  - In Customer Table: displays primary phone with a prominent `SĐT 2: 098...` badge when `phone2` exists.
  - In Customer Detail Modal (`selectedCustomerForDetail`): dedicated contact cards showing Phone 1 and Phone 2 with 1-click Call (`tel:`) and Copy buttons.
- **`CustomerCombobox.tsx`**:
  - Dropdown search items display `phone • SĐT 2: phone2` when `phone2` exists.
  - Selected customer closed pill displays `(phone, phone2)`.
- **`PosPage.tsx`**:
  - In the delivery information section (`orderType === 'delivery'`), when a customer with 2 phone numbers is selected, dynamic quick-toggle buttons/chips **"SĐT 1"** and **"SĐT 2"** appear above the recipient phone input.
  - Cashier can click either button to instantly switch the order's recipient phone between primary and secondary numbers in 1 click!

---

## Consequences & Verification

- **Backward Compatibility:** Works seamlessly with existing Supabase databases without schema migration errors.
- **Data Integrity:** Fully compatible with Customer Sentinel, Excel import, and historical order reconciliation.
- **Zero Hallucination & Accuracy:** Tested thoroughly with automated test script `scripts/test_adr0019.js` verifying:
  1. Customer creation with dual phones.
  2. Search ranking and tier scoring across both numbers.
  3. Duplicate phone prevention across both numbers and self-exclusion during edit.
  4. Supabase cloud serialization round-trip.
  5. Sentinel anomaly immunity.
  6. POS delivery phone selection invariant.
- All previous test suites (`test_adr0010.js` through `test_adr0018.js`) continue to pass 100% green.
