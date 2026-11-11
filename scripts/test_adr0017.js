// scripts/test_adr0017.js
import assert from 'node:assert';
import {
  findToneTwinCustomers,
  extractIndividualPhones,
  extractIndividualAddresses,
  auditCustomerData,
  repairAndMigrateCustomers,
  splitCustomerByPhones,
  splitCustomerByAddresses,
  mergeDuplicateCustomers,
  isGenericCustomerName,
  HISTORICAL_RECOVERIES,
} from '../src/utils/customerSentinel.ts';
import { removeVietnameseTones } from '../src/utils/vietnamese.ts';
import { INITIAL_CUSTOMERS } from '../src/data/initialData.ts';

console.log('--- RUNNING ADR-0017 CUSTOMER DATA SENTINEL & HISTORICAL RECOVERY TESTS ---');

// ============================================================================
// Test Suite 1: Historical Data Recovery & Separation for "Thanh Hang" / "Thanh Hằng"
// ============================================================================
console.log('1. Testing Historical Data Recovery & Separation ("Thanh Hang" vs "Thanh Hằng")...');

// 1.1 Verify INITIAL_CUSTOMERS contains clean distinct records for KH05 & KH06
const initThanhHang = INITIAL_CUSTOMERS.find(c => c.id === 'KH05');
const initThanhHangDiacritic = INITIAL_CUSTOMERS.find(c => c.id === 'KH06');

assert.ok(initThanhHang, 'KH05 (Thanh Hang) must exist in INITIAL_CUSTOMERS');
assert.strictEqual(initThanhHang.name, 'Thanh Hang');
assert.strictEqual(initThanhHang.phone, '0988111222');
assert.strictEqual(initThanhHang.address, '12 Hoàn Kiếm, Hà Nội');

assert.ok(initThanhHangDiacritic, 'KH06 (Thanh Hằng) must exist in INITIAL_CUSTOMERS');
assert.strictEqual(initThanhHangDiacritic.name, 'Thanh Hằng');
assert.strictEqual(initThanhHangDiacritic.phone, '0988333444');
assert.strictEqual(initThanhHangDiacritic.address, '45 Đội Cấn, Ba Đình, Hà Nội');

// 1.2 Test automatic decoupling of a merged/fused customer
const fusedCustomer = {
  id: 'c_fused_hang',
  name: 'Thanh Hang / Thanh Hằng',
  phone: '0988111222 / 0988333444',
  address: '12 Hoàn Kiếm / 45 Đội Cấn, Ba Đình, Hà Nội',
  debt: 150000,
  createdAt: '2026-09-01T08:00:00Z',
};

const mockOrdersWithFused = [
  {
    id: 'HD001',
    customerId: 'c_fused_hang',
    customerName: 'Thanh Hang',
    customerPhone: '0988111222',
    customerAddress: '12 Hoàn Kiếm, Hà Nội',
    total: 200000,
    status: 'completed',
  },
  {
    id: 'HD002',
    customerId: 'c_fused_hang',
    customerName: 'Thanh Hằng',
    customerPhone: '0988333444',
    customerAddress: '45 Đội Cấn, Ba Đình, Hà Nội',
    total: 350000,
    status: 'completed',
  },
  // Order with diacritics but no phone or address (counter order)
  {
    id: 'HD003_DIACRITIC_ONLY',
    customerId: 'c_fused_hang',
    customerName: 'Thanh Hằng',
    customerPhone: '',
    customerAddress: '',
    total: 120000,
    status: 'completed',
  },
];

const migrationResult = repairAndMigrateCustomers([fusedCustomer], mockOrdersWithFused);
assert.ok(migrationResult.changesCount > 0, 'Migration must register changes');
assert.strictEqual(migrationResult.repairedCustomers.length, 2, 'Fused customer must be decoupled into 2 customers');

const repairedNoDiacritic = migrationResult.repairedCustomers.find(c => c.name === 'Thanh Hang');
const repairedDiacritic = migrationResult.repairedCustomers.find(c => c.name === 'Thanh Hằng');

assert.ok(repairedNoDiacritic, 'Repaired list must contain "Thanh Hang"');
assert.strictEqual(repairedNoDiacritic.phone, '0988111222');
assert.strictEqual(repairedNoDiacritic.address, '12 Hoàn Kiếm, Hà Nội');

assert.ok(repairedDiacritic, 'Repaired list must contain "Thanh Hằng"');
assert.strictEqual(repairedDiacritic.phone, '0988333444');
assert.strictEqual(repairedDiacritic.address, '45 Đội Cấn, Ba Đình, Hà Nội');

// Verify orders were cleanly re-linked to their corresponding customer
const order1 = migrationResult.repairedOrders.find(o => o.id === 'HD001');
const order2 = migrationResult.repairedOrders.find(o => o.id === 'HD002');
const order3 = migrationResult.repairedOrders.find(o => o.id === 'HD003_DIACRITIC_ONLY');
assert.strictEqual(order1.customerId, repairedNoDiacritic.id, 'Order 1 with 0988111222 must link to Thanh Hang');
assert.strictEqual(order2.customerId, repairedDiacritic.id, 'Order 2 with 0988333444 must link to Thanh Hằng');
assert.strictEqual(order3.customerId, repairedDiacritic.id, 'Order 3 with diacritic "Thanh Hằng" must link to Thanh Hằng');

// 1.3 Test orphaned order re-linking when customers are already separate on boot
const existingSeparatedCustomers = [
  { id: 'KH05', name: 'Thanh Hang', phone: '0988111222', address: '12 Hoàn Kiếm, Hà Nội' },
  { id: 'KH06', name: 'Thanh Hằng', phone: '0988333444', address: '45 Đội Cấn, Ba Đình, Hà Nội' },
];
const orphanOrders = [
  {
    id: 'HD_ORPHAN_HANG',
    customerId: 'c_lost_hang_profile',
    customerName: 'Thanh Hang',
    customerPhone: '0988111222',
    total: 300000,
    status: 'completed',
  },
  {
    id: 'HD_ORPHAN_HANG_DIACRITIC',
    customerId: 'c_lost_hang_profile',
    customerName: 'Thanh Hằng',
    customerPhone: '0988333444',
    total: 450000,
    status: 'completed',
  },
];
const orphanRepairRes = repairAndMigrateCustomers(existingSeparatedCustomers, orphanOrders);
const orphan1 = orphanRepairRes.repairedOrders.find(o => o.id === 'HD_ORPHAN_HANG');
const orphan2 = orphanRepairRes.repairedOrders.find(o => o.id === 'HD_ORPHAN_HANG_DIACRITIC');
assert.strictEqual(orphan1.customerId, 'KH05', 'Orphaned order for Thanh Hang must be re-linked to KH05');
assert.strictEqual(orphan2.customerId, 'KH06', 'Orphaned order for Thanh Hằng must be re-linked to KH06');

// 1.4 Test Unicode NFC and NFD diacritic invariance
const nfdCustomer = {
  id: 'c_nfd',
  name: 'Thanh Hă\u0300ng', // NFD decomposed
  phone: '0988000000',
  address: 'Hà Nội',
};
const nfdRepairRes = repairAndMigrateCustomers([nfdCustomer]);
assert.strictEqual(
  nfdRepairRes.repairedCustomers[0].name.normalize('NFC'),
  'Thanh Hằng',
  'Customer name with NFD diacritics must match canonical NFC form'
);

console.log('✓ Historical Data Recovery & Separation verified.');

// ============================================================================
// Test Suite 2: Concatenated 20-Digit Phone & Name Cleansing
// ============================================================================
console.log('2. Testing 20-Digit Concatenated Phone & Slashed Name Cleansing...');

const corruptedCustomerList = [
  {
    id: 'c_corrupt_phone',
    name: 'Bác Bình',
    phone: '08692291600986476328', // 20 digits from prior faulty strip
    address: 'Hà Nội',
    debt: 0,
  },
  {
    id: 'c_corrupt_name_space',
    name: 'Chị Lan / Hương Quán',
    phone: '0912345678',
    address: 'Hà Nội',
    debt: 0,
  },
  {
    id: 'c_corrupt_name_no_space',
    name: 'Cô Mai/Tuấn Phố Cổ',
    phone: '0918765432',
    address: 'Hà Nội',
    debt: 0,
  },
];

const cleanedResult = repairAndMigrateCustomers(corruptedCustomerList);
const custPhoneRepaired = cleanedResult.repairedCustomers.find(c => c.id === 'c_corrupt_phone');
const custNameSpaceRepaired = cleanedResult.repairedCustomers.find(c => c.id === 'c_corrupt_name_space');
const custNameNoSpaceRepaired = cleanedResult.repairedCustomers.find(c => c.id === 'c_corrupt_name_no_space');

assert.strictEqual(
  custPhoneRepaired.phone,
  '0869229160 / 0986476328',
  '20-digit phone must be automatically formatted into clean slash delimited string'
);
assert.strictEqual(
  custNameSpaceRepaired.name,
  'Chị Lan',
  'Slashed name with spaces must be cleaned to preserve primary customer name'
);
assert.strictEqual(
  custNameNoSpaceRepaired.name,
  'Cô Mai',
  'Slashed name without spaces must also be cleaned to preserve primary customer name'
);

console.log('✓ 20-digit phone normalization & name cleansing verified.');

// ============================================================================
// Test Suite 3: Near-Duplicate / Tone Twin Name Collision Detection
// ============================================================================
console.log('3. Testing Tone Twin / Name Collision Detection Engine...');

const customerA = { id: 'cA', name: 'Thanh Hang', phone: '0988111222' };
const customerB = { id: 'cB', name: 'Thanh Hằng', phone: '0988333444' };
const customerC = { id: 'cC', name: 'Chị Hương', phone: '0912345678' };
const customerD = { id: 'cD', name: 'Chị Hường', phone: '0987654321' };
const customerE = { id: 'cE', name: 'Anh Tuấn', phone: '0901234567' };
const customerF = { id: 'cF', name: 'Anh Tuân', phone: '0907654321' };
const customerGeneric = { id: 'cGen', name: 'Khách lẻ tại quầy', phone: '' };

const allTestCustomers = [
  customerA,
  customerB,
  customerC,
  customerD,
  customerE,
  customerF,
  customerGeneric,
];

// 3.1 findToneTwinCustomers for Thanh Hang -> must find Thanh Hằng
const twinsHang = findToneTwinCustomers(customerA, allTestCustomers);
assert.strictEqual(twinsHang.length, 1);
assert.strictEqual(twinsHang[0].id, customerB.id);
assert.strictEqual(twinsHang[0].name, 'Thanh Hằng');

// 3.2 findToneTwinCustomers for Thanh Hằng -> must find Thanh Hang
const twinsHangDiacritic = findToneTwinCustomers(customerB, allTestCustomers);
assert.strictEqual(twinsHangDiacritic.length, 1);
assert.strictEqual(twinsHangDiacritic[0].id, customerA.id);

// 3.3 findToneTwinCustomers for Chị Hương -> must find Chị Hường
const twinsHuong = findToneTwinCustomers(customerC, allTestCustomers);
assert.strictEqual(twinsHuong.length, 1);
assert.strictEqual(twinsHuong[0].name, 'Chị Hường');

// 3.4 findToneTwinCustomers for Anh Tuấn -> must find Anh Tuân
const twinsTuan = findToneTwinCustomers(customerE, allTestCustomers);
assert.strictEqual(twinsTuan.length, 1);
assert.strictEqual(twinsTuan[0].name, 'Anh Tuân');

// 3.5 Generic customer ("Khách lẻ tại quầy") must never trigger collision
assert.strictEqual(isGenericCustomerName(customerGeneric.name), true);
const twinsGeneric = findToneTwinCustomers(customerGeneric, allTestCustomers);
assert.strictEqual(twinsGeneric.length, 0, 'Generic customer must never produce tone twins');

console.log('✓ Tone Twin & Near-Duplicate collision detection verified.');

// ============================================================================
// Test Suite 4: Multi-Phone and Multi-Address Extraction & Audit Result
// ============================================================================
console.log('4. Testing Multi-Phone & Multi-Address Anomaly Extraction & Audit...');

// Extraction tests
assert.deepStrictEqual(extractIndividualPhones('0988111222'), ['0988111222']);
assert.deepStrictEqual(
  extractIndividualPhones('0869229160 / 0986476328'),
  ['0869229160', '0986476328']
);
assert.deepStrictEqual(
  extractIndividualPhones('08692291600986476328'),
  ['0869229160', '0986476328']
);
assert.deepStrictEqual(
  extractIndividualAddresses('12 Đội Cấn / 45 Hàng Bè'),
  ['12 Đội Cấn', '45 Hàng Bè']
);

// Comprehensive Audit on a dataset with intentional anomalies
const auditDataset = [
  customerA, // Tone twin with B
  customerB, // Tone twin with A
  {
    id: 'c_multi_p',
    name: 'Cô Mai',
    phone: '0903111222 / 0903333444',
    address: 'Hà Nội',
  },
  {
    id: 'c_multi_a',
    name: 'Anh Dũng',
    phone: '0911222333',
    address: '10 Hàng Gai / 25 Tràng Thi, Hà Nội',
  },
  {
    id: 'c_dup_1',
    name: 'Khách X',
    phone: '0977888999',
    address: 'Cầu Giấy',
  },
  {
    id: 'c_dup_2',
    name: 'Khách Y',
    phone: '0977888999', // Duplicate phone with X
    address: 'Đống Đa',
  },
];

const auditRes = auditCustomerData(auditDataset);
assert.ok(auditRes.totalAnomalies > 0, 'Audit must detect anomalies');
assert.strictEqual(auditRes.toneTwins.length, 1, 'Must detect 1 tone twin group (Thanh Hang & Thanh Hằng)');
assert.strictEqual(auditRes.multiPhoneAnomalies.length, 1, 'Must detect 1 multi-phone anomaly (Cô Mai)');
assert.strictEqual(auditRes.multiAddressAnomalies.length, 1, 'Must detect 1 multi-address anomaly (Anh Dũng)');
assert.strictEqual(auditRes.duplicatePhoneGroups.length, 1, 'Must detect 1 duplicate phone group (0977888999)');

console.log('✓ Comprehensive Customer Data Sentinel Audit passed.');

// ============================================================================
// Test Suite 5: 1-Click Split and Merge Operations & Metric Invariants
// ============================================================================
console.log('5. Testing 1-Click Split and Merge Operations & Metric Invariants...');

// 5.1 Split by Phone with Order Metrics Accuracy
const custToSplitPhone = {
  id: 'c_split_p',
  name: 'Bác Ba',
  phone: '0988111333 / 0988222444',
  address: 'Hà Nội',
  orderCount: 3,
  totalSpent: 600000,
};
const mockOrdersForSplit = [
  {
    id: 'HD_SPLIT_1',
    customerId: 'c_split_p',
    customerPhone: '0988111333',
    total: 200000,
    status: 'completed',
  },
  {
    id: 'HD_SPLIT_2',
    customerId: 'c_split_p',
    customerPhone: '0988111333',
    total: 150000,
    status: 'completed',
  },
  {
    id: 'HD_SPLIT_3',
    customerId: 'c_split_p',
    customerPhone: '0988222444',
    total: 250000,
    status: 'completed',
  },
];

const splitPhoneRes = splitCustomerByPhones(custToSplitPhone, mockOrdersForSplit);
assert.strictEqual(splitPhoneRes.customerA.phone, '0988111333');
assert.strictEqual(splitPhoneRes.customerB.phone, '0988222444');
assert.strictEqual(splitPhoneRes.ordersToUpdate.length, 1);
assert.strictEqual(splitPhoneRes.ordersToUpdate[0].customerId, splitPhoneRes.customerB.id);

// Verify metrics were accurately separated and not left inflated or 0
assert.strictEqual(splitPhoneRes.customerA.orderCount, 2, 'Customer A must retain 2 orders');
assert.strictEqual(splitPhoneRes.customerA.totalSpent, 350000, 'Customer A total spent must be 350,000');
assert.strictEqual(splitPhoneRes.customerB.orderCount, 1, 'Customer B must receive 1 order');
assert.strictEqual(splitPhoneRes.customerB.totalSpent, 250000, 'Customer B total spent must be 250,000');

// 5.2 Split by Address with Order Metrics Accuracy
const custToSplitAddr = {
  id: 'c_split_a',
  name: 'Chú Tư',
  phone: '0912999888',
  address: '15 Lý Thường Kiệt / 88 Hai Bà Trưng',
  orderCount: 2,
  totalSpent: 400000,
};
const mockOrdersForSplitAddr = [
  {
    id: 'HD_ADDR_1',
    customerId: 'c_split_a',
    customerAddress: '15 Lý Thường Kiệt, Hoàn Kiếm',
    total: 180000,
    status: 'completed',
  },
  {
    id: 'HD_ADDR_2',
    customerId: 'c_split_a',
    customerAddress: '88 Hai Bà Trưng, Cửa Nam',
    total: 220000,
    status: 'completed',
  },
];
const splitAddrRes = splitCustomerByAddresses(custToSplitAddr, mockOrdersForSplitAddr);
assert.strictEqual(splitAddrRes.customerA.address, '15 Lý Thường Kiệt');
assert.strictEqual(splitAddrRes.customerB.address, '88 Hai Bà Trưng');
assert.strictEqual(splitAddrRes.ordersToUpdate.length, 1);
assert.strictEqual(splitAddrRes.customerA.orderCount, 1);
assert.strictEqual(splitAddrRes.customerA.totalSpent, 180000);
assert.strictEqual(splitAddrRes.customerB.orderCount, 1);
assert.strictEqual(splitAddrRes.customerB.totalSpent, 220000);

// 5.3 Merge Duplicate Customers
const primaryCust = { id: 'c_p', name: 'Nguyễn Văn A', phone: '0988000111', debt: 100000, totalSpent: 500000, orderCount: 2 };
const dupCust = { id: 'c_d', name: 'Nguyen Van A', phone: '0988000111', debt: 50000, totalSpent: 250000, orderCount: 1 };
const mockDupOrders = [{ id: 'HD_DUP_1', customerId: 'c_d', total: 250000 }];

const mergeRes = mergeDuplicateCustomers(primaryCust, dupCust, mockDupOrders);
assert.strictEqual(mergeRes.mergedCustomer.id, 'c_p');
assert.strictEqual(mergeRes.mergedCustomer.debt, 150000, 'Debt must accumulate on merge');
assert.strictEqual(mergeRes.mergedCustomer.totalSpent, 750000, 'Total spent must accumulate on merge');
assert.strictEqual(mergeRes.mergedCustomer.orderCount, 3, 'Order count must accumulate on merge');
assert.strictEqual(mergeRes.ordersToUpdate.length, 1);
assert.strictEqual(mergeRes.ordersToUpdate[0].customerId, 'c_p', 'Duplicate customer order must point to primary customer');

console.log('✓ 1-Click Split and Merge Operations & Metric Invariants verified.');

// ============================================================================
// Test Suite 6: POS Live Collision Alert & Combobox Tone Twin Simulation
// ============================================================================
console.log('6. Testing POS Live Collision Alert & Banner String Formatting...');

function simulatePosCustomerSelection(selectedId, customersList) {
  const selected = customersList.find(c => c.id === selectedId);
  const twins = findToneTwinCustomers(selected, customersList);
  const bannerText = twins.length > 0
    ? `⚠️ Chú ý: Có khách hàng tên tương tự là ${twins.map(t => `"${t.name}" (SĐT: ${t.phone || 'Chưa có'} - Đ/c: ${t.address || 'Chưa có'})`).join(', ')}. Vui lòng kiểm tra kỹ SĐT trước khi tạo đơn/giao hàng!`
    : '';

  return {
    selectedCustomer: selected,
    shouldShowWarning: twins.length > 0,
    collisionTwins: twins,
    bannerText,
  };
}

// Case A: Cashier selects Thanh Hang (KH05)
const sim1 = simulatePosCustomerSelection('KH05', INITIAL_CUSTOMERS);
assert.strictEqual(sim1.shouldShowWarning, true, 'Warning banner must trigger for Thanh Hang');
assert.strictEqual(sim1.collisionTwins.length, 1);
assert.strictEqual(sim1.collisionTwins[0].name, 'Thanh Hằng');
assert.strictEqual(sim1.collisionTwins[0].phone, '0988333444');
assert.strictEqual(
  sim1.bannerText,
  '⚠️ Chú ý: Có khách hàng tên tương tự là "Thanh Hằng" (SĐT: 0988333444 - Đ/c: 45 Đội Cấn, Ba Đình, Hà Nội). Vui lòng kiểm tra kỹ SĐT trước khi tạo đơn/giao hàng!'
);

// Case B: Cashier switches to Thanh Hằng (KH06)
const sim2 = simulatePosCustomerSelection('KH06', INITIAL_CUSTOMERS);
assert.strictEqual(sim2.shouldShowWarning, true, 'Warning banner must trigger for Thanh Hằng');
assert.strictEqual(sim2.collisionTwins.length, 1);
assert.strictEqual(sim2.collisionTwins[0].name, 'Thanh Hang');
assert.strictEqual(sim2.collisionTwins[0].phone, '0988111222');
assert.strictEqual(
  sim2.bannerText,
  '⚠️ Chú ý: Có khách hàng tên tương tự là "Thanh Hang" (SĐT: 0988111222 - Đ/c: 12 Hoàn Kiếm, Hà Nội). Vui lòng kiểm tra kỹ SĐT trước khi tạo đơn/giao hàng!'
);

// Case C: Cashier selects Chị Lan (KH02) with no tone twins
const sim3 = simulatePosCustomerSelection('KH02', INITIAL_CUSTOMERS);
assert.strictEqual(sim3.shouldShowWarning, false, 'No warning when customer has no tone twins');
assert.strictEqual(sim3.collisionTwins.length, 0);

// Case D: Cashier selects Khách lẻ tại quầy (KH01)
const sim4 = simulatePosCustomerSelection('KH01', INITIAL_CUSTOMERS);
assert.strictEqual(sim4.shouldShowWarning, false, 'Generic counter customer must never trigger warning banner');

// Case E: CustomerCombobox Tone Twin Indicator Recognition
const toneCounts = new Map();
for (const c of INITIAL_CUSTOMERS) {
  if (!isGenericCustomerName(c.name)) {
    const clean = removeVietnameseTones(c.name).trim();
    if (clean) toneCounts.set(clean, (toneCounts.get(clean) || 0) + 1);
  }
}
const toneTwinSet = new Set();
for (const [name, count] of toneCounts.entries()) {
  if (count > 1) toneTwinSet.add(name);
}

assert.ok(toneTwinSet.has('thanh hang'), 'Combobox must flag "thanh hang" as a tone twin group');
assert.ok(!toneTwinSet.has('chi lan (zalo doi can)'), 'Chi Lan is unique and must not be flagged');

console.log('✓ POS Live Collision Alert & Banner String Formatting verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0017 SENTINEL & RECOVERY TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
