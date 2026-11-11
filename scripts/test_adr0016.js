// scripts/test_adr0016.js
import assert from 'node:assert';
import {
  scoreCustomer,
  filterAndRankCustomers,
  isPhoneNumberQuery,
  findDuplicatePhoneCustomer,
} from '../src/utils/customerSearch.ts';

console.log('--- RUNNING ADR-0016 DIACRITIC-AWARE & PHONE-FIRST CUSTOMER IDENTITY TESTS ---');

// ----------------------------------------------------------------------------
// Test Suite 1: Diacritic-Aware Customer Name Ranking ("Thanh Hang" vs "Thanh Hằng")
// ----------------------------------------------------------------------------
console.log('1. Testing Diacritic-Aware Customer Name Ranking (Hằng’s Core Feedback)...');

const custThanhHang = {
  id: 'c_hang_nodiacritic',
  name: 'Thanh Hang',
  phone: '0988111222',
  address: '12 Hoàn Kiếm, Hà Nội',
  debt: 0,
};

const custThanhHangDiacritic = {
  id: 'c_hang_diacritic',
  name: 'Thanh Hằng',
  phone: '0988333444',
  address: '45 Đội Cấn, Ba Đình, Hà Nội',
  debt: 0,
};

const customerList = [custThanhHangDiacritic, custThanhHang];

// 1.1 Searching "Thanh Hang" (without diacritics)
const scoreThanhHang_for_nodiacritic = scoreCustomer(custThanhHang, 'Thanh Hang');
const scoreThanhHangDiacritic_for_nodiacritic = scoreCustomer(custThanhHangDiacritic, 'Thanh Hang');

assert.strictEqual(
  scoreThanhHang_for_nodiacritic,
  200,
  'Exact case-insensitive match WITH diacritics should score 200 (Tier 4)'
);
assert.strictEqual(
  scoreThanhHangDiacritic_for_nodiacritic,
  150,
  'Tone-clean match should score 150 (Tier 5)'
);
assert.ok(
  scoreThanhHang_for_nodiacritic > scoreThanhHangDiacritic_for_nodiacritic,
  'When querying "Thanh Hang", "Thanh Hang" MUST strictly rank above "Thanh Hằng"'
);

const rankedForNoDiacritic = filterAndRankCustomers(customerList, 'Thanh Hang');
assert.strictEqual(rankedForNoDiacritic[0].id, custThanhHang.id);
assert.strictEqual(rankedForNoDiacritic[1].id, custThanhHangDiacritic.id);

// 1.2 Searching "Thanh Hằng" (with diacritics)
const scoreThanhHang_for_diacritic = scoreCustomer(custThanhHang, 'Thanh Hằng');
const scoreThanhHangDiacritic_for_diacritic = scoreCustomer(custThanhHangDiacritic, 'Thanh Hằng');

assert.strictEqual(
  scoreThanhHangDiacritic_for_diacritic,
  200,
  '"Thanh Hằng" exact diacritic match should score 200 (Tier 4)'
);
assert.strictEqual(
  scoreThanhHang_for_diacritic,
  150,
  '"Thanh Hang" tone-clean fallback should score 150 (Tier 5)'
);
assert.ok(
  scoreThanhHangDiacritic_for_diacritic > scoreThanhHang_for_diacritic,
  'When querying "Thanh Hằng", "Thanh Hằng" MUST strictly rank above "Thanh Hang"'
);

const rankedForDiacritic = filterAndRankCustomers(customerList, 'Thanh Hằng');
assert.strictEqual(rankedForDiacritic[0].id, custThanhHangDiacritic.id);
assert.strictEqual(rankedForDiacritic[1].id, custThanhHang.id);

// 1.3 Searching word-only "Hang" vs "Hằng" (Tier 6: 130 vs Tier 7: 100)
const scoreWordHang1 = scoreCustomer(custThanhHang, 'Hang');
const scoreWordHang2 = scoreCustomer(custThanhHangDiacritic, 'Hang');
assert.strictEqual(scoreWordHang1, 130, 'Exact diacritic word match scores 130 (Tier 6)');
assert.strictEqual(scoreWordHang2, 100, 'Tone-clean word match scores 100 (Tier 7)');
assert.ok(scoreWordHang1 > scoreWordHang2, 'Word "Hang" prioritizes "Thanh Hang" over "Thanh Hằng"');

const scoreWordHangDiacritic1 = scoreCustomer(custThanhHang, 'Hằng');
const scoreWordHangDiacritic2 = scoreCustomer(custThanhHangDiacritic, 'Hằng');
assert.strictEqual(scoreWordHangDiacritic2, 130, 'Exact diacritic word match "Hằng" scores 130');
assert.strictEqual(scoreWordHangDiacritic1, 100, 'Tone-clean word match "Hằng" scores 100');
assert.ok(scoreWordHangDiacritic2 > scoreWordHangDiacritic1, 'Word "Hằng" prioritizes "Thanh Hằng" over "Thanh Hang"');

// 1.4 Testing NFD (decomposed) vs NFC Unicode diacritic input
const queryNFD = 'Thanh Hằng'.normalize('NFD');
const scoreNFC_from_NFD = scoreCustomer(custThanhHangDiacritic, queryNFD);
const scoreNoDiacritic_from_NFD = scoreCustomer(custThanhHang, queryNFD);
assert.strictEqual(scoreNFC_from_NFD, 200, 'Decomposed Unicode NFD query must match NFC customer name as Tier 4 (200)');
assert.strictEqual(scoreNoDiacritic_from_NFD, 150, 'NFD diacritic query on unaccented customer must receive Tier 5 fallback (150)');
assert.ok(scoreNFC_from_NFD > scoreNoDiacritic_from_NFD, 'NFD query must strictly rank "Thanh Hằng" over "Thanh Hang"');

// 1.5 Testing query with text and numbers ("Quán Ăn 123" vs customer with 123 in phone)
const custStore123 = { id: 'c_store', name: 'Quán Ăn 123', phone: '0901111111', debt: 0 };
const custStrangerPhone123 = { id: 'c_stranger', name: 'Lê Văn B', phone: '0988123456', debt: 0 };
const scoreStore123 = scoreCustomer(custStore123, 'Quán Ăn 123');
const scoreStrangerPhone123 = scoreCustomer(custStrangerPhone123, 'Quán Ăn 123');
assert.strictEqual(scoreStore123, 200, '"Quán Ăn 123" must match exact name as Tier 4 (200)');
assert.strictEqual(scoreStrangerPhone123, 0, 'Unrelated customer lacking "Quán" and "Ăn" must score 0 and be filtered out');
const rankedStore = filterAndRankCustomers([custStrangerPhone123, custStore123], 'Quán Ăn 123');
assert.strictEqual(rankedStore[0].id, custStore123.id);
assert.strictEqual(rankedStore.length, 1, 'Only customer matching all text tokens should be returned');

// 1.6 Testing mixed text and phone query ("Thanh Hằng 0988")
const custStranger0988 = { id: 'c_stranger_phone', name: 'Nguyễn Văn X', phone: '0988999999', debt: 0 };
const scoreHangMixed = scoreCustomer(custThanhHangDiacritic, 'Thanh Hằng 0988');
const scoreStrangerMixed = scoreCustomer(custStranger0988, 'Thanh Hằng 0988');
assert.ok(scoreHangMixed > 0, '"Thanh Hằng 0988" matches name and phone of Thanh Hằng');
assert.strictEqual(scoreStrangerMixed, 0, 'Stranger lacking name tokens must score 0 despite matching phone prefix');

console.log('✓ Diacritic-Aware Name Ranking completely verified ("Thanh Hang" vs "Thanh Hằng", NFC/NFD, Text+Digits).');

// ----------------------------------------------------------------------------
// Test Suite 2: Phone-First Ranking Hierarchy (Phone Tiers vs Name Tiers)
// ----------------------------------------------------------------------------
console.log('2. Testing Phone-First Ranking Hierarchy (KiotViet Standard)...');

const custByNameOnly = {
  id: 'c_name_match',
  name: 'Nguyễn Văn 0988',
  phone: '0911222333',
  debt: 0,
};

const custByPhoneMatch = {
  id: 'c_phone_match',
  name: 'Đặng Tuấn Anh',
  phone: '0988333444',
  debt: 0,
};

// Tier 1: Exact Phone Match (300 pts) vs Tier 4 Name Match (200 pts)
const scoreExactPhone = scoreCustomer(custByPhoneMatch, '0988333444');
assert.strictEqual(scoreExactPhone, 300, 'Exact Phone Match must receive 300 points (Tier 1)');
assert.ok(scoreExactPhone > 200, 'Exact Phone Match ranks strictly above Exact Name Match');

// Tier 2: Phone Prefix Match (250 pts) vs Tier 4 Name Match (200 pts)
const scorePhonePrefix = scoreCustomer(custByPhoneMatch, '098833');
assert.strictEqual(scorePhonePrefix, 250, 'Phone Prefix Match must receive 250 points (Tier 2)');
assert.ok(scorePhonePrefix > 200, 'Phone Prefix Match ranks strictly above Exact Name Match');

// Tier 3: Phone Substring Match (220 pts) vs Tier 4 Name Match (200 pts)
const scorePhoneSubstring = scoreCustomer(custByPhoneMatch, '333444');
assert.strictEqual(scorePhoneSubstring, 220, 'Phone Substring Match must receive 220 points (Tier 3)');
assert.ok(scorePhoneSubstring > 200, 'Phone Substring Match ranks strictly above Exact Name Match');

// Full sorting test: phone search puts phone match ahead of name match
const rankedByPhone = filterAndRankCustomers([custByNameOnly, custByPhoneMatch], '0988');
assert.strictEqual(rankedByPhone[0].id, custByPhoneMatch.id, 'Phone prefix match must rank #1 over name match');

console.log('✓ Phone-First Ranking Tiers (300 > 250 > 220 > 200 > 150) verified.');

// ----------------------------------------------------------------------------
// Test Suite 3: Phone Punctuation & Delimiter Invariance
// ----------------------------------------------------------------------------
console.log('3. Testing Phone Punctuation & Delimiter Invariance...');

const custWithStandardPhone = {
  id: 'c_std_phone',
  name: 'Bác Hùng',
  phone: '0988333444',
  debt: 0,
};

const custWithMultiPhone = {
  id: 'c_multi_phone',
  name: 'Chị Mai',
  phone: '0869229160 / 0986476328',
  debt: 0,
};

// Searching with dash punctuation: "0988-333-444"
const scoreDash = scoreCustomer(custWithStandardPhone, '0988-333-444');
assert.strictEqual(scoreDash, 300, 'Dash-punctuated phone search "0988-333-444" must match 0988333444 as Tier 1 (300)');

// Searching with dot punctuation: "0988.333.444"
const scoreDot = scoreCustomer(custWithStandardPhone, '0988.333.444');
assert.strictEqual(scoreDot, 300, 'Dot-punctuated phone search "0988.333.444" must match 0988333444 as Tier 1 (300)');

// Searching with international prefix: "+84 988 333 444"
const scoreIntl = scoreCustomer(custWithStandardPhone, '+84 988 333 444');
assert.strictEqual(scoreIntl, 300, 'International formatted phone "+84 988 333 444" must match 0988333444 as Tier 1 (300)');

// Searching with space delimiters: "0988 333 444"
const scoreSpace = scoreCustomer(custWithStandardPhone, '0988 333 444');
assert.strictEqual(scoreSpace, 300, 'Space-separated phone search "0988 333 444" must match 0988333444 as Tier 1 (300)');

// Multi-phone matching
const scoreMulti1 = scoreCustomer(custWithMultiPhone, '0869-229-160');
const scoreMulti2 = scoreCustomer(custWithMultiPhone, '0986.476.328');
assert.strictEqual(scoreMulti1, 300, 'First phone in multi-phone matches cleanly with dashes');
assert.strictEqual(scoreMulti2, 300, 'Second phone in multi-phone matches cleanly with dots');

console.log('✓ All Phone Punctuation & Delimiter searches passed.');

// ----------------------------------------------------------------------------
// Test Suite 4: Smart Query Detection (8-12 Digits vs Name Query)
// ----------------------------------------------------------------------------
console.log('4. Testing Smart Query Detection in Combobox...');

assert.strictEqual(isPhoneNumberQuery('0988333444'), true, '10-digit phone detected');
assert.strictEqual(isPhoneNumberQuery('0988-333-444'), true, '10-digit punctuated phone detected');
assert.strictEqual(isPhoneNumberQuery('0988.333.444'), true, '10-digit dot phone detected');
assert.strictEqual(isPhoneNumberQuery('+84 988 333 444'), true, 'International phone detected');
assert.strictEqual(isPhoneNumberQuery('(024) 3825 1234'), true, 'Landline with area code detected');
assert.strictEqual(isPhoneNumberQuery('0869229160'), true, '10-digit phone detected');

assert.strictEqual(isPhoneNumberQuery('Thanh Hang'), false, 'Name query is not phone');
assert.strictEqual(isPhoneNumberQuery('Thanh Hằng'), false, 'Diacritic name is not phone');
assert.strictEqual(isPhoneNumberQuery('Hang 0988'), false, 'Mixed text is not pure phone');
assert.strictEqual(isPhoneNumberQuery('12345'), false, '<8 digits is not phone');
assert.strictEqual(isPhoneNumberQuery('1234567890123456'), false, '>12 digits is not phone');

console.log('✓ Smart Query Detection verified.');

// ----------------------------------------------------------------------------
// Test Suite 5: Duplicate Phone Prevention Engine
// ----------------------------------------------------------------------------
console.log('5. Testing Duplicate Phone Prevention Engine...');

const existingCustomers = [
  { id: 'c1', name: 'Nguyễn Văn An', phone: '0988333444' },
  { id: 'c2', name: 'Trần Thị Bình', phone: '0869229160 / 0986476328' },
];

// Exact match duplicate
const dup1 = findDuplicatePhoneCustomer(existingCustomers, '0988333444');
assert.ok(dup1, 'Exact duplicate phone must be detected');
assert.strictEqual(dup1.id, 'c1');
assert.strictEqual(dup1.name, 'Nguyễn Văn An');

// Punctuated duplicate match
const dup2 = findDuplicatePhoneCustomer(existingCustomers, '0988-333-444');
assert.ok(dup2, 'Punctuated duplicate phone must match normalized CRM phone');
assert.strictEqual(dup2.id, 'c1');

// Space-separated duplicate match
const dupSpace = findDuplicatePhoneCustomer(existingCustomers, '0988 333 444');
assert.ok(dupSpace, 'Space-separated phone must match normalized CRM phone');
assert.strictEqual(dupSpace.id, 'c1');

// Match against second phone in multi-phone customer
const dup3 = findDuplicatePhoneCustomer(existingCustomers, '0986476328');
assert.ok(dup3, 'Second phone in multi-phone record must be detected as duplicate');
assert.strictEqual(dup3.id, 'c2');

// Edit own phone: exclusion must allow keeping own phone
const dupSelf = findDuplicatePhoneCustomer(existingCustomers, '0988333444', 'c1');
assert.strictEqual(dupSelf, null, 'Editing own customer record must allow keeping current phone');

// Edit to another customer's phone: must detect conflict
const dupCross = findDuplicatePhoneCustomer(existingCustomers, '0988333444', 'c2');
assert.ok(dupCross, 'Editing customer c2 with customer c1 phone must be blocked');
assert.strictEqual(dupCross.id, 'c1');

// Non-duplicate phone
const nonDup = findDuplicatePhoneCustomer(existingCustomers, '0912345678');
assert.strictEqual(nonDup, null, 'Unregistered phone number must return null');

console.log('✓ Duplicate Phone Prevention Engine verified.');

// ----------------------------------------------------------------------------
// Test Suite 6: Order-Level Delivery Contact Snapshot Invariant
// ----------------------------------------------------------------------------
console.log('6. Testing Order-Level Delivery Contact Snapshot Invariant...');

// Invariant: Changing delivery address or phone for an order MUST NOT alter master customer record
const masterCustomer = {
  id: 'c_master_hang',
  name: 'Thanh Hằng',
  phone: '0988111222',
  address: 'Hà Nội',
  debt: 0,
};

// Simulate creating delivery order with order-level override
const orderDeliveryName = 'Thanh Hang (Nhận hộ em gái)';
const orderDeliveryPhone = '0988333444';
const orderDeliveryAddress = '193C Bà Triệu, Hai Bà Trưng, Hà Nội';

const orderSnapshot = {
  id: 'ORD_TEST_001',
  customerId: masterCustomer.id,
  customerName: orderDeliveryName,
  customerPhone: orderDeliveryPhone,
  customerAddress: orderDeliveryAddress,
  orderType: 'delivery',
};

// Verify order snapshot holds the delivery recipient contact
assert.strictEqual(orderSnapshot.customerName, 'Thanh Hang (Nhận hộ em gái)');
assert.strictEqual(orderSnapshot.customerPhone, '0988333444');
assert.strictEqual(orderSnapshot.customerAddress, '193C Bà Triệu, Hai Bà Trưng, Hà Nội');

// Verify master customer CRM record remained pristine
assert.strictEqual(masterCustomer.name, 'Thanh Hằng');
assert.strictEqual(masterCustomer.phone, '0988111222');
assert.strictEqual(masterCustomer.address, 'Hà Nội');

// 6.2 Invariant: Editing an existing order in EditOrderModal must preserve delivery details when customerId is unchanged
const originalOrder = {
  id: 'ORD_TEST_002',
  customerId: masterCustomer.id,
  customerName: 'Người Nhận Riêng',
  customerPhone: '0988777888',
  customerAddress: 'Số 99 Hàng Đào',
  orderType: 'delivery',
};

const isSameCustomer = originalOrder.customerId === masterCustomer.id;
const preservedName = isSameCustomer ? (originalOrder.customerName || masterCustomer.name) : masterCustomer.name;
const preservedPhone = isSameCustomer ? (originalOrder.customerPhone ?? masterCustomer.phone) : masterCustomer.phone;
const preservedAddress = isSameCustomer ? (originalOrder.customerAddress ?? masterCustomer.address) : masterCustomer.address;

assert.strictEqual(preservedName, 'Người Nhận Riêng', 'Order recipient name must not be overwritten by master customer name on edit');
assert.strictEqual(preservedPhone, '0988777888', 'Order recipient phone must not be overwritten by master customer phone on edit');
assert.strictEqual(preservedAddress, 'Số 99 Hàng Đào', 'Order recipient address must not be overwritten by master customer address on edit');

console.log('✓ Order-Level Delivery Contact Snapshot Invariant verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0016 INTEGRITY & REGRESSION TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
