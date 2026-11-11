# ADR-0016: Diacritic-Aware & Phone-First Customer Identity Engine, Order-Level Delivery Isolation, and Duplicate Phone Prevention

**Status:** Accepted  
**Date:** 2026-11-11  
**Context:** Mexucxich Cuisine Customer Search, POS Ordering, and Delivery Operations  

---

## Context & Problem Statement

Direct store operations and real-world feedback from store owner Hằng (Mexucxich Cuisine) uncovered a critical data integrity and identity confusion failure chain:

1. **Tone-Blind Flattening & Diacritic Blindness:**
   - In `CustomerCombobox.tsx` and `CustomersPage.tsx`, search queries were unconditionally flattened using `removeVietnameseTones`. Both "Thanh Hang" and "Thanh Hằng" produced identical normalized tokens (`"thanh hang"`), scoring equal priority points (150 pts).
   - Exact Vietnamese diacritics had zero weighting. Entering "Thanh Hang" ranked "Thanh Hằng" equally at the top, concealing the distinction between two completely different customers.
2. **Phone Number Ranking Inversion:**
   - Phone matches were scored lower (100 pts) than tone-flattened name matches (150 pts). When searching by phone, customer names could outrank exact phone matches, contradicting standard retail/POS industry patterns (such as KiotViet) where phone number is the primary unique customer identifier.
   - Punctuated phone queries (e.g. `0988-333-444` or `0988.333.444`) failed token matching because tokens split purely on whitespace and didn't strip delimiter punctuation.
3. **Combobox Quick-Add Trapping:**
   - In `CustomerCombobox.tsx`, the "+ Thêm nhanh khách" action only rendered when `filteredCustomers.length === 0`. When cashiers typed "Thanh Hang", "Thanh Hằng" matched, completely hiding the quick-add option. Hitting `Enter` accidentally selected "Thanh Hằng", preventing cashiers from registering the new customer.
   - When cashiers entered an unlisted phone number, the combobox passed the phone string into the `name` field, leaving the `phone` field empty.
4. **Delivery Recipient CRM Mutation (Contact Corruption):**
   - In `PosPage.tsx`, delivery orders lacked dedicated order-level recipient contact fields. When delivering to an alternative recipient or address, staff clicked the pencil icon (`Edit2`), invoking `updateCustomer(customer.id, ...)`. This permanently mutated Customer A's master record in CRM with Customer B's delivery phone and address.
5. **Absence of Duplicate Phone Validation:**
   - Neither `QuickAddCustomerModal`, `QuickEditCustomerModal`, nor `CustomersPage` checked whether an entered phone number was already assigned to another customer, allowing silent creation of duplicate or conflicting customer profiles.

---

## Decisions

### 1. Diacritic-Aware & Phone-First Ranking Engine (`customerSearch.ts`)
We established a deterministic 11-tier scoring hierarchy in `src/utils/customerSearch.ts` shared across POS and Customers Page:

- **Tier 1 (300 pts): Exact Phone Match:** Numeric digit match across all registered customer phones (single and multi-phone formatted strings, including international `+84` prefix normalization).
- **Tier 2 (250 pts): Phone Prefix Match:** Numeric digits ($\ge 3$ digits) matching the prefix of any customer phone.
- **Tier 3 (220 pts): Phone Substring Match:** Numeric digits ($\ge 3$ digits) matching any portion of customer phones.
- **Tier 4 (200 pts): Exact Case-Insensitive Full Name Match WITH DIACRITICS:** `c.name.trim().toLowerCase() === rawQuery.trim().toLowerCase()` with Unicode NFC normalization (`.normalize('NFC')`) ensuring parity across decomposed (NFD) and precomposed (NFC) Vietnamese input methods.
- **Tier 5 (150 pts): Tone-Clean Full Name Match:** Fallback when tones differ or are omitted.
- **Tier 6 (130 pts): Exact Diacritic Word/Prefix Match:** Diacritic-preserving word boundary or prefix match.
- **Tier 7 (100 pts): Tone-Clean Word/Prefix Match:** Unaccented word boundary or prefix match.
- **Tier 8a (95 pts): Multi-Word Exact Diacritic Phrase Match in Name.**
- **Tier 8 (90 pts): Multi-Token Match in Name.**
- **Tier 8b (85 pts): Multi-Token Combined Match across Name, Phone, and Address.**
- **Tier 9 (60 pts): Substring Match in Name.**
- **Tier 10 (40 pts): Substring Match in Address.**
- **Tier 11 (30 pts): General Token Match.**
- **Tiebreakers:** Outstanding debt (`+2` pts) and active POS selection (`+1` pt); secondary sort by name length ascending.
- **Punctuation & Conjunction Safety:** Delimiters (`-`, `.`, `()`, `/`) are stripped during phone digit matching. For text and mixed queries, strict multi-token conjunction ensures queries with words and numbers (e.g. "Quán Ăn 123", "Thanh Hằng 0988") require all tokens to match, preventing unrelated customer phone digits from hijacking text searches.

### 2. Combobox UX Overhaul (`CustomerCombobox.tsx`)
- **Pinned Always-Visible Quick Add:** An action bar is pinned at the bottom of the combobox dropdown, visible at all times regardless of match count.
- **Smart Query Classification (`isPhoneNumberQuery`):** If the search query contains 8–12 digits with standard phone separators, it is classified as a phone query. The action dynamically reads `+ Thêm khách với SĐT "0988..."` and pre-fills the `phone` field in `QuickAddCustomerModal`, focusing the cursor on the `name` field. For text queries, it pre-fills `name` and focuses `phone`.
- **Full Keyboard Navigation:** Cashiers can navigate through results down to the pinned button with arrow keys and press `Enter` to trigger quick addition.

### 3. Order-Level Delivery Contact Snapshot (`PosPage.tsx` & `EditOrderModal.tsx`)
- **Isolated Order Delivery Snapshot:** In POS delivery mode (`orderType === 'delivery'`), dedicated inputs are provided for Delivery Recipient Name (`deliveryName`), Recipient Phone (`deliveryPhone`), and Delivery Address (`deliveryAddress`).
- **CRM Immutability:** Changing recipient details for an order affects only that order's snapshot (`Order.customerName`, `Order.customerPhone`, `Order.customerAddress`). Master customer records in CRM remain completely untouched.
- **Order Modification Safety:** When editing existing orders in `EditOrderModal`, order delivery contact snapshots are preserved when the customer ID is unchanged.
- **Reset Utility:** A "Khôi phục hồ sơ gốc" toggle allows restoring recipient fields to master customer defaults in one click.

### 4. Duplicate Phone Prevention Engine (`findDuplicatePhoneCustomer`)
- In `QuickAddCustomerModal.tsx`, `QuickEditCustomerModal.tsx`, and `CustomersPage.tsx`, entered phone numbers are normalized and checked against existing customer records (`isPhoneMatching`).
- Clear visual alerts name the conflicting customer (e.g. `Trùng SĐT với khách: Nguyễn Văn An (0988333444)`), and form submission is disabled to prevent accidental cross-contamination.
- Editing an existing customer allows retaining their current phone number while preventing collision with other registered customers.

---

## Consequences

- "Thanh Hang" and "Thanh Hằng" are strictly separated: searching with diacritics ranks the diacritic match first; searching without diacritics ranks the unaccented name first.
- Phone number queries instantly surface the target customer at Tier 1 (300 pts), matching the expected KiotViet workflow.
- Cashiers can always add new customers via the pinned combobox action, eliminating quick-add entrapment.
- Adjusting delivery recipient details for online orders never mutates master customer contact records.
- Duplicate phone registration is structurally blocked across all addition and modification interfaces.
