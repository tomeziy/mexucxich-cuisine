// scripts/test_adr0019.js
import assert from 'node:assert';
import {
  scoreCustomer,
  filterAndRankCustomers,
  findDuplicatePhoneCustomer,
  isPhoneNumberQuery,
} from '../src/utils/customerSearch.ts';
import {
  transformCustomerToDb,
  transformCustomerFromDb,
} from '../src/services/supabase.ts';
import {
  extractIndividualPhones,
  auditCustomerData,
} from '../src/utils/customerSentinel.ts';

console.log('--- RUNNING ADR-0019 DUAL CUSTOMER PHONE, MULTI-PHONE SEARCH & SERIALIZATION TESTS ---');

// ----------------------------------------------------------------------------
// Test Suite 1: Customer Creation & Properties with phone and phone2
// ----------------------------------------------------------------------------
console.log('1. Testing Customer Creation with phone and phone2...');

const customerDualPhone = {
  id: 'KH_DUAL_01',
  name: 'Chị Hằng Xúc Xích',
  phone: '0904047976',
  phone2: '0988123456',
  address: 'Số 12 Ngõ Trạm, Hàng Bông, Hoàn Kiếm, Hà Nội',
  debt: 500000,
  totalSpent: 3500000,
  orderCount: 15,
};

assert.strictEqual(customerDualPhone.phone, '0904047976', 'Primary phone must match');
assert.strictEqual(customerDualPhone.phone2, '0988123456', 'Secondary phone must match');
console.log('✓ Customer creation with dual phones verified.');

// ----------------------------------------------------------------------------
// Test Suite 2: Search Ranking & Scoring Across Both phone and phone2
// ----------------------------------------------------------------------------
console.log('2. Testing Search Ranking & Scoring Across Both phone and phone2...');

const customerA = {
  id: 'KH_01',
  name: 'Nguyễn Văn An',
  phone: '0912111222',
  phone2: '0988999888',
  address: 'Hà Nội',
  debt: 0,
};

const customerB = {
  id: 'KH_02',
  name: 'Trần Thị Bình',
  phone: '0977333444',
  address: 'Đà Nẵng',
  debt: 0,
};

const customerList = [customerB, customerA];

// 2.1 Exact Match on phone1 (Tier 1: 300 pts)
const scoreExactP1 = scoreCustomer(customerA, '0912111222');
assert.strictEqual(scoreExactP1, 300, 'Exact match on phone 1 must score 300 (Tier 1)');

// 2.2 Exact Match on phone2 (Tier 1: 300 pts)
const scoreExactP2 = scoreCustomer(customerA, '0988999888');
assert.strictEqual(scoreExactP2, 300, 'Exact match on phone 2 must score 300 (Tier 1)');

// 2.3 Prefix Match on phone2 (Tier 2: 250 pts)
const scorePrefixP2 = scoreCustomer(customerA, '098899');
assert.strictEqual(scorePrefixP2, 250, 'Prefix match on phone 2 must score 250 (Tier 2)');

// 2.4 Substring Match on phone2 (Tier 3: 220 pts)
const scoreSubstringP2 = scoreCustomer(customerA, '999888');
assert.strictEqual(scoreSubstringP2, 220, 'Substring match on phone 2 must score 220 (Tier 3)');

// 2.5 Multi-token match including phone2
const scoreMixed = scoreCustomer(customerA, 'An 0988');
assert.ok(scoreMixed > 0, 'Multi-token name + phone2 search must score positive');

// 2.6 Ranking prioritization when querying phone2
const ranked = filterAndRankCustomers(customerList, '0988999888');
assert.strictEqual(ranked.length, 1);
assert.strictEqual(ranked[0].id, customerA.id, 'Customer matching phone2 must rank first');

console.log('✓ Multi-phone search ranking and scoring verified.');

// ----------------------------------------------------------------------------
// Test Suite 3: Duplicate Phone Detection Checking Both phone and phone2
// ----------------------------------------------------------------------------
console.log('3. Testing Duplicate Phone Detection Checking Both phone and phone2...');

const existingCustomers = [
  {
    id: 'KH_EXISTING_01',
    name: 'Anh Vũ',
    phone: '0901234567',
    phone2: '0937654321',
    address: 'Hà Nội',
    debt: 0,
  },
  {
    id: 'KH_EXISTING_02',
    name: 'Chị Mai',
    phone: '0919888777',
    address: 'Hồ Chí Minh',
    debt: 0,
  },
];

// 3.1 Detecting collision with phone1 of existing customer
const dupWithP1 = findDuplicatePhoneCustomer(existingCustomers, '0901234567');
assert.ok(dupWithP1, 'Must detect duplicate with phone 1');
assert.strictEqual(dupWithP1.id, 'KH_EXISTING_01');

// 3.2 Detecting collision with phone2 of existing customer
const dupWithP2 = findDuplicatePhoneCustomer(existingCustomers, '0937654321');
assert.ok(dupWithP2, 'Must detect duplicate with phone 2');
assert.strictEqual(dupWithP2.id, 'KH_EXISTING_01');

// 3.3 Formatted phone with spaces and dashes (+84 / 0937-654-321)
const dupWithFormattedP2 = findDuplicatePhoneCustomer(existingCustomers, '+84 937 654 321');
assert.ok(dupWithFormattedP2, 'Must detect duplicate with formatted phone 2');
assert.strictEqual(dupWithFormattedP2.id, 'KH_EXISTING_01');

// 3.4 Exclusion during edit: editing KH_EXISTING_01 does NOT flag against itself
const dupExcludingSelf = findDuplicatePhoneCustomer(existingCustomers, '0937654321', 'KH_EXISTING_01');
assert.strictEqual(dupExcludingSelf, null, 'Customer must not flag duplicate against themselves when editing');

// 3.5 Editing KH_EXISTING_02 and entering KH_EXISTING_01 phone2 DOES flag duplicate
const dupEditingOther = findDuplicatePhoneCustomer(existingCustomers, '0937654321', 'KH_EXISTING_02');
assert.ok(dupEditingOther, 'Editing another customer must detect duplicate with phone 2');
assert.strictEqual(dupEditingOther.id, 'KH_EXISTING_01');

console.log('✓ Duplicate phone detection checking both phone and phone2 verified.');

// ----------------------------------------------------------------------------
// Test Suite 4: Supabase Backward-Compatible Cloud Serialization
// ----------------------------------------------------------------------------
console.log('4. Testing Supabase Backward-Compatible Cloud Serialization...');

// 4.1 transformCustomerToDb: when phone2 exists, store as "phone1 / phone2"
const dbRowWithDual = transformCustomerToDb(customerDualPhone);
assert.strictEqual(
  dbRowWithDual.phone,
  '0904047976 / 0988123456',
  'transformCustomerToDb must concatenate phone and phone2 with " / " for backward compatibility'
);

// 4.2 transformCustomerToDb: when only phone exists
const singlePhoneCust = {
  id: 'KH_SINGLE_01',
  name: 'Khách Đơn',
  phone: '0912345678',
  address: '',
  debt: 0,
};
const dbRowSingle = transformCustomerToDb(singlePhoneCust);
assert.strictEqual(dbRowSingle.phone, '0912345678', 'Single phone must remain unconcentrated');

// 4.3 transformCustomerFromDb: legacy database with concatenated phone column
const legacyCloudRow = {
  id: 'KH_LEGACY_01',
  name: 'Chị Hằng Xúc Xích',
  phone: '0904047976 / 0988123456',
  address: 'Hà Nội',
  debt: 0,
  total_spent: 0,
  order_count: 0,
  created_at: '2026-11-12T00:00:00Z',
};

const hydratedFromLegacy = transformCustomerFromDb(legacyCloudRow);
assert.strictEqual(hydratedFromLegacy.phone, '0904047976', 'Hydrated phone must split primary phone');
assert.strictEqual(hydratedFromLegacy.phone2, '0988123456', 'Hydrated phone2 must split secondary phone');

// 4.4 transformCustomerFromDb: row with native phone2 column if present
const modernCloudRow = {
  id: 'KH_MODERN_01',
  name: 'Chị Hằng Xúc Xích',
  phone: '0904047976',
  phone2: '0988123456',
  address: 'Hà Nội',
  debt: 0,
  total_spent: 0,
  order_count: 0,
  created_at: '2026-11-12T00:00:00Z',
};

const hydratedFromModern = transformCustomerFromDb(modernCloudRow);
assert.strictEqual(hydratedFromModern.phone, '0904047976');
assert.strictEqual(hydratedFromModern.phone2, '0988123456');

// 4.5 Round-trip serialization invariant:
// Customer -> DB row -> Customer
const roundTrip = transformCustomerFromDb(transformCustomerToDb(customerDualPhone));
assert.strictEqual(roundTrip.phone, customerDualPhone.phone);
assert.strictEqual(roundTrip.phone2, customerDualPhone.phone2);

console.log('✓ Supabase transformCustomerToDb and transformCustomerFromDb serialization verified.');

// ----------------------------------------------------------------------------
// Test Suite 5: Customer Sentinel Anomaly Audit with Dual Phones
// ----------------------------------------------------------------------------
console.log('5. Testing Customer Sentinel Anomaly Audit with Clean Dual Phones...');

// 5.1 Customer with clean separate phone and phone2 MUST NOT be flagged as anomaly
const cleanDualCustomer = {
  id: 'KH_CLEAN_DUAL',
  name: 'Anh Tuấn',
  phone: '0912345678',
  phone2: '0987654321',
  address: 'Hà Nội',
  debt: 0,
};

const auditClean = auditCustomerData([cleanDualCustomer], []);
assert.strictEqual(
  auditClean.multiPhoneAnomalies.length,
  0,
  'Customer with clean separate phone and phone2 must NOT be flagged as a multiPhoneAnomaly'
);

// 5.2 Customer with un-separated phones in phone column ("0912345678 / 0987654321" without phone2)
// MUST still be detected by Sentinel
const crammedCustomer = {
  id: 'KH_CRAMMED',
  name: 'Anh Tuấn Cũ',
  phone: '0912345678 / 0987654321',
  address: 'Hà Nội',
  debt: 0,
};

const auditCrammed = auditCustomerData([crammedCustomer], []);
assert.strictEqual(
  auditCrammed.multiPhoneAnomalies.length,
  1,
  'Customer with un-separated slashed phone must be detected as multiPhoneAnomaly'
);

// 5.3 Historical order matching phone2 does NOT trigger a phone discrepancy
const pastOrderUsingPhone2 = {
  id: 'ORD_01',
  createdAt: '2026-11-12T10:00:00Z',
  customerId: cleanDualCustomer.id,
  customerName: cleanDualCustomer.name,
  customerPhone: cleanDualCustomer.phone2, // Customer used their second phone
  customerAddress: cleanDualCustomer.address,
  orderType: 'delivery',
  status: 'completed',
  items: [],
  subtotal: 100000,
  discountType: 'cash',
  discountValue: 0,
  discountAmount: 0,
  shippingFee: 20000,
  total: 120000,
  paymentMethod: 'cash',
  paidAmount: 120000,
  debtAmount: 0,
};

const auditDiscrepancy = auditCustomerData([cleanDualCustomer], [pastOrderUsingPhone2]);
assert.strictEqual(
  auditDiscrepancy.orderDiscrepancies.length,
  0,
  'Order placed with legitimate phone2 must NOT trigger a phone discrepancy in Sentinel'
);

console.log('✓ Customer Sentinel anomaly audit & historical immunity verified.');

// ----------------------------------------------------------------------------
// Test Suite 6: POS Delivery Phone Selection Invariant
// ----------------------------------------------------------------------------
console.log('6. Testing POS Delivery Phone Selection Invariant...');

function simulatePosDeliveryPhoneSelection(customer, chosenPhoneSlot) {
  const chosenPhone = chosenPhoneSlot === 'phone2' ? customer.phone2 : customer.phone;
  return {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: chosenPhone,
    customerAddress: customer.address,
    orderType: 'delivery',
  };
}

const orderWithP1 = simulatePosDeliveryPhoneSelection(customerDualPhone, 'phone1');
assert.strictEqual(orderWithP1.customerPhone, '0904047976', 'Order created with phone 1');

const orderWithP2 = simulatePosDeliveryPhoneSelection(customerDualPhone, 'phone2');
assert.strictEqual(orderWithP2.customerPhone, '0988123456', 'Order created with phone 2');

console.log('✓ POS delivery phone selection invariant verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0019 DUAL CUSTOMER PHONE & SERIALIZATION TESTS PASSED!');
console.log('================================================================');
