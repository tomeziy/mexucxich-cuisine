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
assert.strictEqual(order1.customerId, repairedNoDiacritic.id, 'Order 1 with 0988111222 must link to Thanh Hang');
assert.strictEqual(order2.customerId, repairedDiacritic.id, 'Order 2 with 0988333444 must link to Thanh Hằng');

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
    id: 'c_corrupt_name',
    name: 'Chị Lan / Hương Quán',
    phone: '0912345678',
    address: 'Hà Nội',
    debt: 0,
  },
];

const cleanedResult = repairAndMigrateCustomers(corruptedCustomerList);
const custPhoneRepaired = cleanedResult.repairedCustomers.find(c => c.id === 'c_corrupt_phone');
const custNameRepaired = cleanedResult.repairedCustomers.find(c => c.id === 'c_corrupt_name');

assert.strictEqual(
  custPhoneRepaired.phone,
  '0869229160 / 0986476328',
  '20-digit phone must be automatically formatted into clean slash delimited string'
);
assert.strictEqual(
  custNameRepaired.name,
  'Chị Lan',
  'Slashed name must be cleaned to preserve primary customer name'
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
// Test Suite 5: 1-Click Split and Merge Operations
// ============================================================================
console.log('5. Testing 1-Click Split and Merge Operations...');

// 5.1 Split by Phone
const custToSplitPhone = {
  id: 'c_split_p',
  name: 'Bác Ba',
  phone: '0988111333 / 0988222444',
  address: 'Hà Nội',
};
const mockOrdersForSplit = [
  {
    id: 'HD_SPLIT_1',
    customerId: 'c_split_p',
    customerPhone: '0988222444',
    total: 100000,
  },
];

const splitPhoneRes = splitCustomerByPhones(custToSplitPhone, mockOrdersForSplit);
assert.strictEqual(splitPhoneRes.customerA.phone, '0988111333');
assert.strictEqual(splitPhoneRes.customerB.phone, '0988222444');
assert.strictEqual(splitPhoneRes.ordersToUpdate.length, 1);
assert.strictEqual(splitPhoneRes.ordersToUpdate[0].customerId, splitPhoneRes.customerB.id);

// 5.2 Split by Address
const custToSplitAddr = {
  id: 'c_split_a',
  name: 'Chú Tư',
  phone: '0912999888',
  address: '15 Lý Thường Kiệt / 88 Hai Bà Trưng',
};
const splitAddrRes = splitCustomerByAddresses(custToSplitAddr);
assert.strictEqual(splitAddrRes.customerA.address, '15 Lý Thường Kiệt');
assert.strictEqual(splitAddrRes.customerB.address, '88 Hai Bà Trưng');

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

console.log('✓ 1-Click Split and Merge Operations verified.');

// ============================================================================
// Test Suite 6: POS Live Collision Alert Simulation
// ============================================================================
console.log('6. Testing POS Live Collision Alert Trigger Simulation...');

function simulatePosCustomerSelection(selectedId, customersList) {
  const selected = customersList.find(c => c.id === selectedId);
  const twins = findToneTwinCustomers(selected, customersList);
  return {
    selectedCustomer: selected,
    shouldShowWarning: twins.length > 0,
    collisionTwins: twins,
  };
}

// Case A: Cashier selects Thanh Hang (KH05)
const sim1 = simulatePosCustomerSelection('KH05', INITIAL_CUSTOMERS);
assert.strictEqual(sim1.shouldShowWarning, true, 'Warning banner must trigger for Thanh Hang');
assert.strictEqual(sim1.collisionTwins.length, 1);
assert.strictEqual(sim1.collisionTwins[0].name, 'Thanh Hằng');
assert.strictEqual(sim1.collisionTwins[0].phone, '0988333444');

// Case B: Cashier switches to Thanh Hằng (KH06)
const sim2 = simulatePosCustomerSelection('KH06', INITIAL_CUSTOMERS);
assert.strictEqual(sim2.shouldShowWarning, true, 'Warning banner must trigger for Thanh Hằng');
assert.strictEqual(sim2.collisionTwins.length, 1);
assert.strictEqual(sim2.collisionTwins[0].name, 'Thanh Hang');
assert.strictEqual(sim2.collisionTwins[0].phone, '0988111222');

// Case C: Cashier selects Chị Lan (KH02) with no tone twins
const sim3 = simulatePosCustomerSelection('KH02', INITIAL_CUSTOMERS);
assert.strictEqual(sim3.shouldShowWarning, false, 'No warning when customer has no tone twins');
assert.strictEqual(sim3.collisionTwins.length, 0);

// Case D: Cashier selects Khách lẻ tại quầy (KH01)
const sim4 = simulatePosCustomerSelection('KH01', INITIAL_CUSTOMERS);
assert.strictEqual(sim4.shouldShowWarning, false, 'Generic counter customer must never trigger warning banner');

console.log('✓ POS Live Collision Alert Trigger Simulation verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0017 SENTINEL & RECOVERY TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
