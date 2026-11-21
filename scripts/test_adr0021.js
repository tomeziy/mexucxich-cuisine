// scripts/test_adr0021.js
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  isEmptyGhostCustomer,
  rankPrimaryCustomer,
  analyzeToneTwinGroup,
  mergeCustomerGroupHelper,
  analyzeDiscrepancyOrder,
  addSecondaryPhoneFromOrderHelper,
  addExtraAddressFromOrderHelper,
  deleteCustomersBatchHelper,
  auditCustomerData,
  SENTINEL_ACKS_STORAGE_KEY,
  loadSentinelAcks,
  saveSentinelAcks,
  resetSentinelAcksStorage,
  filterAuditResultByAcks,
  getSentinelAcknowledgedCount,
  PENDING_DELETED_CUSTOMERS_KEY,
  loadPendingDeletedCustomerIds,
  addPendingDeletedCustomerIds,
  removePendingDeletedCustomerIds,
  filterOutDeletedCustomers,
} from '../src/utils/customerSentinel.ts';
import { executeChunkedCustomerDelete } from '../src/services/supabase.ts';

console.log('--- RUNNING ADR-0021 SENTINEL RECOMMENDATIONS, SAFE DELETE & BATCH EDIT TESTS ---');

// ============================================================================
// 1. Ghost Detection & Tone Twin Analysis (Ayse Nguyen Exact Screenshot Case)
// ============================================================================
console.log('1. Testing Ghost Detection & analyzeToneTwinGroup...');

const ayseGhost = {
  id: 'KH_1794983481321_4472',
  name: 'Ayse Nguyen',
  phone: '',
  address: '',
  debt: 0,
  totalSpent: 0,
  orderCount: 0,
  createdAt: '2026-11-18T10:00:00Z',
};

const ayseReal = {
  id: 'KH_1791794372131_2305_i8p8',
  name: 'Ayse Nguyen',
  phone: '0904123456',
  address: '15 Lý Thường Kiệt, Hoàn Kiếm',
  debt: 250000,
  totalSpent: 1200000,
  orderCount: 3,
  createdAt: '2026-10-01T08:00:00Z',
};

const ayseOrders = [
  {
    id: 'HD1001',
    createdAt: '2026-10-05T10:00:00Z',
    customerId: ayseReal.id,
    customerName: 'Ayse Nguyen',
    customerPhone: '0904123456',
    customerAddress: '15 Lý Thường Kiệt, Hoàn Kiếm',
    orderType: 'delivery',
    status: 'completed',
    items: [],
    subtotal: 400000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 400000,
    paymentMethod: 'debt',
    paidAmount: 150000,
    debtAmount: 250000,
  },
];

assert.strictEqual(isEmptyGhostCustomer(ayseGhost, ayseOrders), true, 'Ayse ghost must be detected as empty ghost');
assert.strictEqual(isEmptyGhostCustomer(ayseReal, ayseOrders), false, 'Real Ayse must not be ghost');

// Boundary cases for ghost detection
assert.strictEqual(
  isEmptyGhostCustomer({ ...ayseGhost, debt: 50000 }, []),
  false,
  'Customer with debt is never a ghost'
);
assert.strictEqual(
  isEmptyGhostCustomer({ ...ayseGhost, extraAddresses: ['83 Hào Nam'] }, []),
  false,
  'Customer with extraAddresses is never a ghost'
);
assert.strictEqual(
  isEmptyGhostCustomer(ayseGhost, [{ ...ayseOrders[0], customerId: ayseGhost.id }]),
  false,
  'Customer with matching order is never a ghost'
);
assert.strictEqual(
  isEmptyGhostCustomer({ ...ayseGhost, orderCount: 2 }, ayseOrders),
  false,
  'Customer with orderCount > 0 is never a ghost even when store orders array is non-empty'
);
assert.strictEqual(
  isEmptyGhostCustomer({ ...ayseGhost, totalSpent: 150000 }, ayseOrders),
  false,
  'Customer with totalSpent > 0 is never a ghost'
);

const ayseAudit = auditCustomerData([ayseGhost, ayseReal], ayseOrders);
assert.strictEqual(ayseAudit.toneTwins.length, 1);
const ayseAnalysis = analyzeToneTwinGroup(ayseAudit.toneTwins[0], ayseOrders);
assert.strictEqual(ayseAnalysis.recommendation, 'delete_ghosts');
assert.strictEqual(ayseAnalysis.recommendedPrimaryId, ayseReal.id);
assert.deepStrictEqual(ayseAnalysis.ghostCustomerIds, [ayseGhost.id]);

// Distinct people (different diacritics & distinct phones) -> keep_independent
const thanhHangGroup = {
  toneCleanName: 'thanh hang',
  customers: [
    { id: 'KH05', name: 'Thanh Hang', phone: '0988111222', address: '12 Hoàn Kiếm', debt: 0, createdAt: '2026-09-01T08:00:00Z' },
    { id: 'KH06', name: 'Thanh Hằng', phone: '0988333444', address: '45 Đội Cấn', debt: 100000, createdAt: '2026-09-02T08:00:00Z' },
  ],
};
const thanhHangAnalysis = analyzeToneTwinGroup(thanhHangGroup, []);
assert.strictEqual(thanhHangAnalysis.recommendation, 'keep_independent');

// Same exact name, one missing phone -> merge_into_primary
const sameNameIncompleteGroup = {
  toneCleanName: 'chi lan',
  customers: [
    { id: 'LAN_1', name: 'Chị Lan', phone: '0912345678', address: '10 Hàng Bài', debt: 0, createdAt: '2026-09-01T08:00:00Z' },
    { id: 'LAN_2', name: 'Chị Lan', phone: '', address: '10 Hàng Bài', debt: 50000, createdAt: '2026-10-01T08:00:00Z' },
  ],
};
const sameNameAnalysis = analyzeToneTwinGroup(sameNameIncompleteGroup, []);
assert.strictEqual(sameNameAnalysis.recommendation, 'merge_into_primary');
assert.strictEqual(sameNameAnalysis.recommendedPrimaryId, 'LAN_2', 'LAN_2 has debt so rankPrimaryCustomer picks LAN_2');

console.log('✓ Ghost detection & Tone Twin recommendations verified.');

// ============================================================================
// 2. rankPrimaryCustomer & mergeCustomerGroupHelper (3+ Customers)
// ============================================================================
console.log('2. Testing rankPrimaryCustomer & mergeCustomerGroupHelper (3+ customers)...');

const cEmptyNew = {
  id: 'C_EMPTY',
  name: 'Khách A',
  phone: '',
  address: '',
  debt: 0,
  createdAt: '2026-08-01T08:00:00Z',
};
const cAddrOnly = {
  id: 'C_ADDR',
  name: 'Khách A',
  phone: '',
  address: '20 Phố Huế',
  debt: 0,
  createdAt: '2026-09-01T08:00:00Z',
};
const cPhoneOnly = {
  id: 'C_PHONE',
  name: 'Khách A',
  phone: '0901111111',
  address: '',
  debt: 0,
  createdAt: '2026-10-01T08:00:00Z',
};
const cWithDebt = {
  id: 'C_DEBT',
  name: 'Khách A',
  phone: '0902222222',
  address: '99 Kim Mã',
  debt: 120000,
  createdAt: '2026-10-15T08:00:00Z',
};
const cWithOrders = {
  id: 'C_ORDERS',
  name: 'Khách A',
  phone: '0903333333',
  address: '50 Nguyễn Chí Thanh',
  debt: 0,
  createdAt: '2026-11-01T08:00:00Z',
};

const rankOrders = [
  { id: 'ORD_1', customerId: 'C_ORDERS', createdAt: '2026-11-01T09:00:00Z', total: 200000, items: [] },
  { id: 'ORD_2', customerId: 'C_ORDERS', createdAt: '2026-11-02T09:00:00Z', total: 300000, items: [] },
];

assert.strictEqual(rankPrimaryCustomer([cEmptyNew, cAddrOnly, cPhoneOnly, cWithDebt, cWithOrders], rankOrders).id, 'C_ORDERS');
assert.strictEqual(rankPrimaryCustomer([cEmptyNew, cAddrOnly, cPhoneOnly, cWithDebt], []).id, 'C_DEBT');
assert.strictEqual(rankPrimaryCustomer([cEmptyNew, cAddrOnly, cPhoneOnly], []).id, 'C_PHONE');
assert.strictEqual(rankPrimaryCustomer([cEmptyNew, cAddrOnly], []).id, 'C_ADDR');

// Merge 3 customers into primary
const pMain = {
  id: 'P_MAIN',
  name: 'Chị Mai',
  phone: '0901111111',
  address: '10 Hàng Gai',
  extraAddresses: ['25 Tràng Thi'],
  debt: 100000,
  totalSpent: 500000,
  orderCount: 2,
};
const pDup1 = {
  id: 'P_DUP1',
  name: 'Chi Mai',
  phone: '0902222222',
  address: '25 tràng thi', // case-insensitive duplicate of primary extraAddress
  extraAddresses: ['83 Hào Nam'],
  debt: 50000,
  totalSpent: 200000,
  orderCount: 1,
};
const pDup2 = {
  id: 'P_DUP2',
  name: 'Chị Mai (Cơ quan)',
  phone: '0901.111.111', // same as primary phone with punctuation
  phone2: '0903333333',
  address: '100 Láng Hạ',
  debt: 25000,
  totalSpent: 150000,
  orderCount: 1,
};
const multiDupOrders = [
  { id: 'O1', customerId: 'P_DUP1', customerName: 'Chi Mai', total: 200000 },
  { id: 'O2', customerId: 'P_DUP2', customerName: 'Chị Mai (Cơ quan)', total: 150000 },
  { id: 'O3', customerId: 'OTHER', customerName: 'Khách Khác', total: 90000 },
];

const groupMergeRes = mergeCustomerGroupHelper(pMain, [pDup1, pDup2, pMain], multiDupOrders);
assert.strictEqual(groupMergeRes.mergedCustomer.id, 'P_MAIN');
assert.strictEqual(groupMergeRes.mergedCustomer.phone, '0901111111');
assert.strictEqual(groupMergeRes.mergedCustomer.phone2, '0902222222 / 0903333333');
assert.strictEqual(groupMergeRes.mergedCustomer.address, '10 Hàng Gai');
assert.deepStrictEqual(groupMergeRes.mergedCustomer.extraAddresses, ['25 Tràng Thi', '83 Hào Nam', '100 Láng Hạ']);
assert.strictEqual(groupMergeRes.mergedCustomer.debt, 175000);
assert.strictEqual(groupMergeRes.mergedCustomer.totalSpent, 850000);
assert.strictEqual(groupMergeRes.mergedCustomer.orderCount, 4);
assert.strictEqual(groupMergeRes.ordersToUpdate.length, 2);
assert.ok(groupMergeRes.ordersToUpdate.every(o => o.customerId === 'P_MAIN' && o.customerName === 'Chị Mai'));

console.log('✓ rankPrimaryCustomer & 3+ customer mergeCustomerGroupHelper verified.');

// ============================================================================
// 3. Historical Discrepancy Analysis & Non-Destructive Additions
// ============================================================================
console.log('3. Testing analyzeDiscrepancyOrder & non-destructive phone2/extraAddress helpers...');

const custBase = {
  id: 'KH_DISC_1',
  name: 'Nguyễn Thu Hà',
  phone: '0904047976',
  address: '12 Đội Cấn, Ba Đình',
  extraAddresses: ['83 Hào Nam'],
  debt: 0,
};

const ordNewPhone = {
  id: 'HD_P2',
  createdAt: '2026-11-10T10:00:00Z',
  customerId: custBase.id,
  customerName: 'Nguyễn Thu Hà',
  customerPhone: '0988776655',
  customerAddress: '12 Đội Cấn, Ba Đình',
  total: 100000,
  items: [],
};
const discPhoneAnalysis = analyzeDiscrepancyOrder(custBase, ordNewPhone);
assert.strictEqual(discPhoneAnalysis.recommendedAction, 'add_phone2');
assert.strictEqual(discPhoneAnalysis.canAddPhone2, true);

const ordNewAddr = {
  id: 'HD_A2',
  createdAt: '2026-11-11T10:00:00Z',
  customerId: custBase.id,
  customerName: 'Nguyễn Thu Hà',
  customerPhone: '0904047976',
  customerAddress: '45 Trần Duy Hưng, Cầu Giấy',
  total: 120000,
  items: [],
};
const discAddrAnalysis = analyzeDiscrepancyOrder(custBase, ordNewAddr);
assert.strictEqual(discAddrAnalysis.recommendedAction, 'add_extra_address');
assert.strictEqual(discAddrAnalysis.canAddExtraAddress, true);

const ordSplitPerson = {
  id: 'HD_SPLIT',
  createdAt: '2026-11-12T10:00:00Z',
  customerId: custBase.id,
  customerName: 'Trần Minh Tuấn',
  customerPhone: '0912999888',
  customerAddress: '99 Láng Hạ',
  total: 150000,
  items: [],
};
const discSplitAnalysis = analyzeDiscrepancyOrder(custBase, ordSplitPerson);
assert.strictEqual(discSplitAnalysis.recommendedAction, 'split_customer');

const ordBlankProfile = {
  id: 'HD_RESTORE',
  createdAt: '2026-11-12T10:00:00Z',
  customerId: 'KH_BLANK',
  customerName: 'Chị Thảo',
  customerPhone: '0933445566',
  customerAddress: '20 Hàng Bông',
  total: 180000,
  items: [],
};
const discRestoreAnalysis = analyzeDiscrepancyOrder(
  { id: 'KH_BLANK', name: 'Chị Thảo', phone: '', address: '', debt: 0 },
  ordBlankProfile
);
assert.strictEqual(discRestoreAnalysis.recommendedAction, 'restore_order');

const discBlankDiffNameAnalysis = analyzeDiscrepancyOrder(
  { id: 'KH_BLANK', name: 'Thảo', phone: '', address: '', debt: 0 },
  { ...ordBlankProfile, customerName: 'Nguyễn Thị Thảo' }
);
assert.strictEqual(
  discBlankDiffNameAnalysis.recommendedAction,
  'restore_order',
  'Phone-less profile must recommend restore_order instead of split_customer'
);

// Non-destructive phone2 helper (with dedup)
const addP2Res1 = addSecondaryPhoneFromOrderHelper(custBase, '0988.776.655');
assert.strictEqual(addP2Res1.changed, true);
assert.strictEqual(addP2Res1.customer.phone, '0904047976', 'Primary phone must not be overwritten');
assert.strictEqual(addP2Res1.customer.phone2, '0988776655');

const addP2DupPrimary = addSecondaryPhoneFromOrderHelper(addP2Res1.customer, '0904047976');
assert.strictEqual(addP2DupPrimary.changed, false, 'Duplicate of primary phone must be ignored');

const addP2DupSecondary = addSecondaryPhoneFromOrderHelper(addP2Res1.customer, '0988 776 655');
assert.strictEqual(addP2DupSecondary.changed, false, 'Duplicate of secondary phone must be ignored');

// Non-destructive extraAddress helper (with dedup)
const addAddrRes1 = addExtraAddressFromOrderHelper(custBase, '45 Trần Duy Hưng, Cầu Giấy');
assert.strictEqual(addAddrRes1.changed, true);
assert.strictEqual(addAddrRes1.customer.address, '12 Đội Cấn, Ba Đình', 'Primary address must not be overwritten');
assert.deepStrictEqual(addAddrRes1.customer.extraAddresses, ['83 Hào Nam', '45 Trần Duy Hưng, Cầu Giấy']);

const addAddrDup = addExtraAddressFromOrderHelper(addAddrRes1.customer, '  83  hào nam ');
assert.strictEqual(addAddrDup.changed, false, 'Duplicate extra address must be ignored');

console.log('✓ Discrepancy analysis & non-destructive phone2/extraAddress helpers verified.');

// ============================================================================
// 4. Safe Batch Deletion & Chunked Supabase Delete
// ============================================================================
console.log('4. Testing deleteCustomersBatchHelper & executeChunkedCustomerDelete...');

const batchTestCustomers = [
  ayseGhost,
  ayseReal,
  { id: 'SAFE_ZERO', name: 'Khách 0 đơn 0 nợ', phone: '0911222333', address: '12 Phố Huế', debt: 0, orderCount: 0 },
  { id: 'RISKY_ORD', name: 'Khách có đơn', phone: '0911444555', address: '15 Phố Huế', debt: 0, orderCount: 2 },
];

const safeOnlyRes = deleteCustomersBatchHelper(
  batchTestCustomers,
  ayseOrders,
  ['KH_1794983481321_4472', 'KH_1791794372131_2305_i8p8', 'SAFE_ZERO', 'RISKY_ORD', 'MISSING_ID'],
  { onlySafe: true }
);
assert.strictEqual(safeOnlyRes.deletedCount, 2, 'Only 0-debt/0-order customers deleted under onlySafe');
assert.deepStrictEqual(safeOnlyRes.deletedIds, ['KH_1794983481321_4472', 'SAFE_ZERO']);
assert.deepStrictEqual(safeOnlyRes.skippedIds, ['KH_1791794372131_2305_i8p8', 'RISKY_ORD', 'MISSING_ID']);
assert.strictEqual(safeOnlyRes.nextCustomers.length, 2);

const fullDeleteRes = deleteCustomersBatchHelper(
  batchTestCustomers,
  ayseOrders,
  ['KH_1794983481321_4472', 'RISKY_ORD'],
  { onlySafe: false }
);
assert.strictEqual(fullDeleteRes.deletedCount, 2);
assert.deepStrictEqual(fullDeleteRes.skippedIds, []);

// Test chunked Supabase delete
const recordedChunks = [];
const mockSupabaseClient = {
  from(table) {
    assert.strictEqual(table, 'customers');
    return {
      delete() {
        return {
          async in(col, chunk) {
            assert.strictEqual(col, 'id');
            recordedChunks.push(chunk);
            return { error: null };
          },
        };
      },
    };
  },
};

const manyIds = Array.from({ length: 250 }, (_, i) => `KH_${i}`);
manyIds.push('KH_0', ''); // include duplicate and empty string
const chunkRes = await executeChunkedCustomerDelete(mockSupabaseClient, manyIds, 100);
assert.strictEqual(chunkRes.success, true);
assert.strictEqual(chunkRes.deletedCount, 250);
assert.strictEqual(chunkRes.chunksCount, 3);
assert.strictEqual(recordedChunks[0].length, 100);
assert.strictEqual(recordedChunks[1].length, 100);
assert.strictEqual(recordedChunks[2].length, 50);

// Test error handling path on Supabase delete failure
const errorSupabaseClient = {
  from() {
    return {
      delete() {
        return {
          async in() {
            return { error: { message: 'Network timeout' } };
          },
        };
      },
    };
  },
};
const errChunkRes = await executeChunkedCustomerDelete(errorSupabaseClient, ['KH_1', 'KH_2'], 100);
assert.strictEqual(errChunkRes.success, false);
assert.strictEqual(errChunkRes.deletedCount, 0);

console.log('✓ Safe batch deletion & chunked Supabase delete verified.');

// ============================================================================
// 5. Persistent Sentinel Acknowledgments
// ============================================================================
console.log('5. Testing Persistent Sentinel Acknowledgments...');

const memoryStore = new Map();
const mockStorage = {
  getItem(k) {
    return memoryStore.has(k) ? memoryStore.get(k) : null;
  },
  setItem(k, v) {
    memoryStore.set(k, v);
  },
  removeItem(k) {
    memoryStore.delete(k);
  },
};

assert.deepStrictEqual(loadSentinelAcks(mockStorage), {
  toneTwins: [],
  multiAddresses: [],
  discrepancies: [],
});

// Corrupt JSON safety
mockStorage.setItem(SENTINEL_ACKS_STORAGE_KEY, '{corrupt json');
assert.deepStrictEqual(loadSentinelAcks(mockStorage), {
  toneTwins: [],
  multiAddresses: [],
  discrepancies: [],
});

const savedAcks = saveSentinelAcks(
  {
    toneTwins: ['thanh hang', 'thanh hang'],
    multiAddresses: ['KH_MULTI_1'],
    discrepancies: ['KH_DISC_1::HD_P2'],
  },
  mockStorage
);
assert.strictEqual(getSentinelAcknowledgedCount(savedAcks), 3);

const loadedAcks = loadSentinelAcks(mockStorage);
assert.deepStrictEqual(loadedAcks, {
  toneTwins: ['thanh hang'],
  multiAddresses: ['KH_MULTI_1'],
  discrepancies: ['KH_DISC_1::HD_P2'],
});

const rawAudit = auditCustomerData(
  [
    ...thanhHangGroup.customers,
    { id: 'KH_MULTI_1', name: 'Chị Hương', phone: '0909888777', address: '12 Hàng Bạc / 83 Hào Nam', debt: 0 },
    custBase,
  ],
  [ordNewPhone]
);
assert.strictEqual(rawAudit.toneTwins.length, 1);
assert.strictEqual(rawAudit.multiAddressAnomalies.length, 1);
assert.strictEqual(rawAudit.orderDiscrepancies.length, 1);

const filteredAudit = filterAuditResultByAcks(rawAudit, loadedAcks);
assert.strictEqual(filteredAudit.toneTwins.length, 0);
assert.strictEqual(filteredAudit.multiAddressAnomalies.length, 0);
assert.strictEqual(filteredAudit.orderDiscrepancies.length, 0);
assert.strictEqual(filteredAudit.totalAnomalies, 0);

const resetAcks = resetSentinelAcksStorage(mockStorage);
assert.strictEqual(getSentinelAcknowledgedCount(resetAcks), 0);
assert.strictEqual(filterAuditResultByAcks(rawAudit, resetAcks).totalAnomalies, rawAudit.totalAnomalies);

// NFD Vietnamese order name discrepancy ack matching
const nfdCust = { id: 'KH_NFD', name: 'Thanh Hang', phone: '0911000111', address: '10 Hàng Đào', debt: 0 };
const nfdOrd = {
  id: 'HD_NFD',
  createdAt: '2026-11-10T10:00:00Z',
  customerId: 'KH_NFD',
  customerName: 'Thanh Ha\u0306\u0300ng',
  customerPhone: '0911000111',
  customerAddress: '10 Hàng Đào',
  total: 100000,
  items: [],
};
const nfdAudit = auditCustomerData([nfdCust], [nfdOrd]);
assert.strictEqual(nfdAudit.orderDiscrepancies.length, 1);
const nfdFiltered = filterAuditResultByAcks(nfdAudit, {
  toneTwins: [],
  multiAddresses: [],
  discrepancies: ['KH_NFD::HD_NFD'],
});
assert.strictEqual(nfdFiltered.orderDiscrepancies.length, 0, 'NFD order name must be matched & acked properly');

// Pending-delete tombstones prevent resurrection on cloud pull
assert.deepStrictEqual(loadPendingDeletedCustomerIds(mockStorage), []);
addPendingDeletedCustomerIds(['KH_DEL_1', 'KH_DEL_2', 'KH_DEL_1'], mockStorage);
assert.deepStrictEqual(loadPendingDeletedCustomerIds(mockStorage), ['KH_DEL_1', 'KH_DEL_2']);
const cloudPulledSample = [
  { id: 'KH_DEL_1', name: 'Deleted 1', phone: '', address: '', debt: 0 },
  { id: 'KH_KEEP', name: 'Keep', phone: '0901234567', address: '', debt: 0 },
];
const filteredCloud = filterOutDeletedCustomers(cloudPulledSample, loadPendingDeletedCustomerIds(mockStorage));
assert.deepStrictEqual(filteredCloud.map(c => c.id), ['KH_KEEP']);
removePendingDeletedCustomerIds(['KH_DEL_1', 'KH_DEL_2'], mockStorage);
assert.strictEqual(mockStorage.getItem(PENDING_DELETED_CUSTOMERS_KEY), null);

// ChunkSize <= 0 safety
const zeroChunkRes = await executeChunkedCustomerDelete(mockSupabaseClient, ['KH_Z1'], 0);
assert.strictEqual(zeroChunkRes.success, true);
assert.strictEqual(zeroChunkRes.deletedCount, 1);

console.log('✓ Persistent Sentinel acknowledgments & filtering verified.');

// ============================================================================
// 6. UI & Context Integration Contracts
// ============================================================================
console.log('6. Checking UI & Context integration contracts...');

const sentinelModalSrc = fs.readFileSync(path.resolve('src/components/customers/CustomerSentinelModal.tsx'), 'utf8');
const customersPageSrc = fs.readFileSync(path.resolve('src/pages/CustomersPage.tsx'), 'utf8');
const storeContextSrc = fs.readFileSync(path.resolve('src/context/StoreContext.tsx'), 'utf8');

const requiredSentinelStrings = [
  'Phương án Đề xuất',
  'Hồ sơ trống',
  'Xóa tất cả hồ sơ trống',
  'Xác nhận độc lập hàng loạt',
  'Chấp nhận tách tất cả SĐT hợp lệ',
  'Chuyển sang Đ/C phụ',
  'Chuyển thành địa chỉ phụ',
  'Giữ nguyên / Ẩn cảnh báo',
  'max-h-96',
  'Đề xuất Chính',
  'Đặt làm Chính',
  'Gộp cả',
  'Gộp toàn bộ nhóm theo đề xuất',
  '+ Lưu thành SĐT 2',
  '+ Thêm làm Đ/C phụ',
  'Áp dụng đề xuất hàng loạt',
  'Bỏ qua (Đã đúng)',
  'Đặt lại',
];
for (const token of requiredSentinelStrings) {
  assert.ok(sentinelModalSrc.includes(token), `CustomerSentinelModal.tsx must contain "${token}"`);
}

const requiredCustomersPageStrings = [
  'Đã chọn',
  'Gộp thành 1 khách',
  'Xóa đã chọn',
  'Chuyển Đ/C phụ hàng loạt',
  'Xóa khách hàng',
  'filterAuditResultByAcks',
  'mergeCustomerGroup',
  'deleteCustomersBatch',
];
for (const token of requiredCustomersPageStrings) {
  assert.ok(customersPageSrc.includes(token), `CustomersPage.tsx must contain "${token}"`);
}

const requiredStoreStrings = [
  'deleteCustomersBatch',
  'mergeCustomerGroup',
  'mergeDuplicateGroupsBatch',
  'addCustomerSecondaryPhone',
  'addCustomerExtraAddress',
  'applyDiscrepancyRecommendationsBatch',
  'acceptAllPhoneSplitsBatch',
  'sentinelAcks',
  'acknowledgeSentinelItems',
  'resetSentinelAcks',
];
for (const token of requiredStoreStrings) {
  assert.ok(storeContextSrc.includes(token), `StoreContext.tsx must expose "${token}"`);
}

const earlyReturnIdx = sentinelModalSrc.indexOf('if (!isOpen) return null;');
assert.ok(earlyReturnIdx !== -1, 'CustomerSentinelModal.tsx must guard on !isOpen');
const codeAfterEarlyReturn = sentinelModalSrc.slice(earlyReturnIdx);
assert.ok(
  !/\buse(Memo|Effect|State|Callback|Ref|Context)\s*\(/.test(codeAfterEarlyReturn),
  'CustomerSentinelModal.tsx must NOT call React hooks after early return (prevents React Error #310)'
);

console.log('✓ UI & StoreContext integration contracts verified.');
console.log('================================================================');
console.log('🎉 ALL ADR-0021 SENTINEL & BATCH-EDIT TESTS PASSED!');
console.log('================================================================');
