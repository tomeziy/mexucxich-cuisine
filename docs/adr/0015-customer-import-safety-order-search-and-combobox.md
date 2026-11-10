# ADR-0015: Customer Import Deduplication Safety, Order History Search & Searchable Product Combobox

**Status:** Accepted  
**Date:** 2026-11-10  
**Context:** Mexucxich Cuisine Customer Management, Reports & POS Editing  

---

## Context & Problem Statement

Production usage and store owner feedback (Hằng - Mexucxich Cuisine) highlighted four usability and data integrity issues:

1. **Customer Import Contact Corruption / Misassignment:**
   - When importing customer spreadsheets via Excel, when phone numbers were omitted or differed slightly, the system fell back to unaccented name matching (`removeVietnameseTones(name)`). Common Vietnamese names with distinct diacritics (e.g. "Chị Hương" vs "Chị Hường", "Anh Tuấn" vs "Anh Tuân") were falsely evaluated as identical duplicates.
   - When selecting "Cộng dồn nợ" (`accumulate`), the import routine assigned `row.phone || existing.phone` and `row.address || existing.address`, overwriting the existing customer's contact details with the incoming row's data.
   - Excel cells with multiple phone numbers (e.g. `0869229160 / 0986476328`) were previously stripped of all non-digits, creating 20-digit invalid phone numbers (`08692291600986476328`).
2. **Missing Search in Reports & Order History:**
   - Cashiers had to visually scan through dozens or hundreds of orders to locate a specific bill or customer in `ReportsPage.tsx` because only status and date dropdowns existed without a text search filter.
3. **Static Unclickable Orders in Customer Details:**
   - In the Customer Details modal under "Các đơn hàng gần đây", order rows were static `div` elements. Cashiers could not click to inspect the bill, see dish item breakdowns, check notes, or reprint receipts for that customer.
4. **Manual Scrolling to Add Items in Edit Order Modal:**
   - In `EditOrderModal.tsx`, adding items relied on a native HTML `<select>` dropdown. With 50–100+ menu items, cashiers had to scroll through the full list to select an item.

---

## Decisions

1. **Phone-Only Duplicate Matching & Contact Protection:**
   - **Strict Phone Matching:** Customers are matched for duplicates strictly by normalized phone number (`isPhoneMatching`). Name-only matching without phone confirmation is strictly disabled.
   - **Multi-Phone Delimiter Support:** `normalizeVietnamesePhone` intelligently splits cells containing multiple phones (separated by `/`, `,`, `;`, `-`, `\n`) into formatted strings (e.g. `0869229160 / 0986476328`) and recovers legacy 20-digit concatenated entries.
   - **Contact Immutability on Accumulate:** When action is `accumulate`, the system strictly preserves the existing customer's verified name, phone, and address (`existing.field || row.field`), only accumulating outstanding debt (`baseDebt + row.debt`).
   - **Phone-Only Intra-File Grouping:** New customers in the same spreadsheet are grouped strictly by phone, never merely by unaccented name.
2. **Real-Time Order Search in Reports (`ReportsPage.tsx`):**
   - Added a quick search input with real-time filtering and quick clear (`X`) button.
   - Searches across Order ID (with or without `#` or `HD`, e.g. `6857`), Customer Name (diacritic-insensitive), Customer Phone, and ordered dish names.
   - **Smart Date Scope:** When a search query is active, the date filter is automatically bypassed across the entire order history so older orders are not missed.
3. **Interactive Order Receipt Modal in Customer Details (`CustomersPage.tsx`):**
   - Sorted recent customer orders descending by creation timestamp (`createdAt`).
   - Made each order row interactive with hover highlight, "Xem bill" badge, and click action opening `<ReceiptModal>`.
   - Wired full reprint, edit, and delete handlers to the modal, backed by reactive customer state.
4. **Searchable Product Combobox (`ProductCombobox.tsx` & `EditOrderModal.tsx`):**
   - Built reusable `ProductCombobox` component with multi-token diacritic-insensitive search, product code matching, price search, and full keyboard navigation (Up/Down/Enter/Escape).
   - Replaced static `<select>` in `EditOrderModal.tsx` with `ProductCombobox`, enabling instant 1-click or Enter addition of items.

---

## Consequences

- Customer contact information is 100% protected against accidental overwrites or cross-customer contamination during Excel imports.
- Finding past orders by bill code `#HD...`, customer name, or phone number takes under a second.
- Cashiers can view complete bill breakdowns and reprint thermal receipts directly from any customer's CRM profile.
- Editing existing orders is fast and frictionless with autocomplete dish searching.
