import assert from 'assert';
import * as XLSX from 'xlsx';
import {
  parseOrderItemsString,
  inferEmojiFromName,
  inferUnitFromName,
  ORDER_HEADER_ALIASES,
  extractMissingProductsFromOrders,
  parseOrdersExcel,
} from '../src/utils/excel.ts';
import {
  stripUpdatedAt,
  isMissingColumnError,
  safeUpsert,
  applyCatalogAntiShrinkGuard,
} from '../src/services/supabase.ts';
import {
  saveVaultSnapshot,
  loadVaultSnapshot,
  listVaultBackups,
  pruneDailyBackups,
  getDailyBackupKey,
  EMERGENCY_VAULT_KEY,
} from '../src/utils/vault.ts';
import {
  auditCustomerData,
  restoreCustomerFromOrderSnapshot,
  splitCustomerByHistoricalOrder,
} from '../src/utils/customerSentinel.ts';

console.log('--- RUNNING ADR-0018 ANTI-SHRINK GUARD, SAFE CLOUD SYNC & EXCEL RECOVERY TESTS ---');

// ============================================================================
// 1. Testing Order Item String & Excel Parsing
// ============================================================================
console.log('1. Testing Order Items String & Excel Parsing Engine...');

const sampleItemStr =
  'Xúc xích Heo Thảo Mộc Phô Mai Mozzarella (x2 - 145.000đ), Lõi vai bò vân tuyết Aukobe (Cân ký lẻ) (x0.59 - 380.000đ), Pate Gan Gà Nấm Truffle Thượng Hạng (x1 - 120.000đ)';

const parsedItems = parseOrderItemsString(sampleItemStr);
assert.strictEqual(parsedItems.length, 3, 'Should parse exactly 3 items');
assert.strictEqual(parsedItems[0].name, 'Xúc xích Heo Thảo Mộc Phô Mai Mozzarella');
assert.strictEqual(parsedItems[0].qty, 2);
assert.strictEqual(parsedItems[0].price, 145000);

// Fractional quantity and name with parentheses
assert.strictEqual(parsedItems[1].name, 'Lõi vai bò vân tuyết Aukobe (Cân ký lẻ)');
assert.strictEqual(parsedItems[1].qty, 0.59);
assert.strictEqual(parsedItems[1].price, 380000);

assert.strictEqual(parsedItems[2].name, 'Pate Gan Gà Nấm Truffle Thượng Hạng');
assert.strictEqual(parsedItems[2].qty, 1);
assert.strictEqual(parsedItems[2].price, 120000);

// Inferred unit & emoji
assert.strictEqual(inferEmojiFromName('Lõi vai bò vân tuyết Aukobe'), '🥩');
assert.strictEqual(inferEmojiFromName('Xúc xích Gà Nấm'), '🌭');
assert.strictEqual(inferEmojiFromName('Pate Gan Gà Nấm Truffle'), '🥣');
assert.strictEqual(inferEmojiFromName('Chả Mực Giã Tay'), '🦑');

assert.strictEqual(inferUnitFromName('Lõi vai bò vân tuyết Aukobe (Cân ký lẻ)'), 'kg');
assert.strictEqual(inferUnitFromName('Xúc xích Gà Nấm 500g'), 'Gói 500g');
assert.strictEqual(inferUnitFromName('Pate Gan Gà Nấm Truffle 250g'), 'Hũ 250g');

// Round-trip Excel generation and parseOrdersExcel
const testOrdersData = [
  {
    'STT': 1,
    'Mã Đơn Hàng': 'HD-20261110-01',
    'Thời Gian': '2026-11-10T10:15:00.000Z',
    'Khách Hàng': 'Chị Mai Hoa',
    'Số Điện Thoại': '0904047976',
    'Hình Thức': 'Giao hàng',
    'Trạng Thái': 'completed',
    'Món Đã Mua': 'Xúc xích Gà Nấm (x2 - 130.000đ), Chả Mực Giã Tay (x1 - 240.000đ)',
    'Tiền Hàng': 500000,
    'Giảm Giá': 20000,
    'Phí Ship': 30000,
    'Khách Phải Trả': 510000,
    'Phương Thức': 'transfer',
    'Tiền Đã Thu': 510000,
    'Ghi Nợ': 0,
  },
  {
    'STT': 2,
    'Mã Đơn Hàng': 'HD-20261110-02',
    'Thời Gian': '2026-11-10T11:45:00.000Z',
    'Khách Hàng': 'Anh Hoàng Bách',
    'Số Điện Thoại': '0912345678',
    'Hình Thức': 'Tại chỗ',
    'Trạng Thái': 'completed',
    'Món Đã Mua': 'Sủi Cảo Tôm Thịt Đặc Biệt (x3 - 95.000đ)',
    'Tiền Hàng': 285000,
    'Giảm Giá': 0,
    'Phí Ship': 0,
    'Khách Phải Trả': 285000,
    'Phương Thức': 'cash',
    'Tiền Đã Thu': 285000,
    'Ghi Nợ': 0,
  },
];

const ws = XLSX.utils.json_to_sheet(testOrdersData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Lịch Sử Đơn Hàng');
const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

const parsedOrdersFromExcel = await parseOrdersExcel(new Uint8Array(excelBuffer));
assert.strictEqual(parsedOrdersFromExcel.length, 2, 'Should reconstruct 2 orders');
assert.strictEqual(parsedOrdersFromExcel[0].id, 'HD-20261110-01');
assert.strictEqual(parsedOrdersFromExcel[0].customerName, 'Chị Mai Hoa');
assert.strictEqual(parsedOrdersFromExcel[0].customerPhone, '0904047976');
assert.strictEqual(parsedOrdersFromExcel[0].orderType, 'delivery');
assert.strictEqual(parsedOrdersFromExcel[0].total, 510000);
assert.strictEqual(parsedOrdersFromExcel[0].items.length, 2);
assert.strictEqual(parsedOrdersFromExcel[0].items[0].name, 'Xúc xích Gà Nấm');
assert.strictEqual(parsedOrdersFromExcel[0].items[0].qty, 2);
assert.strictEqual(parsedOrdersFromExcel[0].items[0].price, 130000);

console.log('✓ Order items string & Excel parsing verified.');

// ============================================================================
// 2. Testing Catalog Anti-Shrink Guard
// ============================================================================
console.log('2. Testing Catalog Anti-Shrink Guard (Preventing 83 -> 20/28 Drop)...');

// Generate 83 mock products simulating Hằng's in-memory store
const local83Products = [];
for (let i = 1; i <= 83; i++) {
  local83Products.push({
    id: `SP_${i}`,
    name: `Món ăn đặc sản ${i}`,
    category: 'Đồ tự làm',
    unit: 'Gói',
    price: 100000 + i * 1000,
    cost: 65000,
    stock: 20,
    image: '🌭',
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: '2026-11-10T08:00:00Z',
  });
}

// Simulated stale/frozen Cloud sync payload with only 20 products
const staleCloud20Products = local83Products.slice(0, 20).map(p => ({
  ...p,
  updatedAt: '2026-10-12T08:00:00Z',
}));

// Apply Anti-Shrink Guard
const guardedResult = applyCatalogAntiShrinkGuard(local83Products, staleCloud20Products);
assert.strictEqual(guardedResult.shrinkBlocked, true, 'Anti-shrink guard MUST block drop to 20');
assert.strictEqual(guardedResult.products.length, 83, 'All 83 products must remain fully preserved');

// Normal forward sync (incoming >= local)
const forwardCloudProducts = [
  ...local83Products,
  {
    id: 'SP_84',
    name: 'Món ăn mới thêm từ máy tính khác 84',
    category: 'Đặc sản tuyển chọn',
    unit: 'Hũ',
    price: 150000,
    cost: 95000,
    stock: 10,
    image: '🥣',
    createdAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-12T10:00:00Z',
  },
];

const normalSyncResult = applyCatalogAntiShrinkGuard(local83Products, forwardCloudProducts);
assert.strictEqual(normalSyncResult.shrinkBlocked, false, 'Forward sync should not be blocked');
assert.strictEqual(normalSyncResult.products.length, 84, 'Catalog expands safely to 84 items');

console.log('✓ Catalog Anti-Shrink Guard verified.');

// ============================================================================
// 3. Testing Defensive Supabase Payload Sanitizer (PGRST204 Fallback)
// ============================================================================
console.log('3. Testing Defensive Supabase Payload Sanitizer & PGRST204 Fallback...');

const entityWithUpdatedAt = {
  id: 'SP_TEST',
  name: 'Xúc xích Thảo Mộc',
  price: 145000,
  created_at: '2026-11-10T00:00:00Z',
  updated_at: '2026-11-10T12:00:00Z',
};

const stripped = stripUpdatedAt(entityWithUpdatedAt);
assert.strictEqual(stripped.updated_at, undefined, 'updated_at must be removed');
assert.strictEqual(stripped.id, 'SP_TEST');
assert.strictEqual(stripped.name, 'Xúc xích Thảo Mộc');

const arrayWithUpdatedAt = [entityWithUpdatedAt, { ...entityWithUpdatedAt, id: 'SP_TEST_2' }];
const strippedArray = stripUpdatedAt(arrayWithUpdatedAt);
assert.strictEqual(strippedArray[0].updated_at, undefined);
assert.strictEqual(strippedArray[1].updated_at, undefined);

// Error matching
const pgrst204Error = {
  code: 'PGRST204',
  message: "Could not find the 'updated_at' column of 'products' in the schema cache",
  details: null,
};
assert.strictEqual(isMissingColumnError(pgrst204Error, 'updated_at'), true);

const genericError = { code: '23505', message: 'duplicate key value violates unique constraint' };
assert.strictEqual(isMissingColumnError(genericError, 'updated_at'), false);

// Mock Supabase client simulating live PGRST204 rejection on first try, then success on sanitized retry
let mockCallCount = 0;
let lastPayloadReceived = null;

const mockClient = {
  from: (table) => ({
    upsert: async (rows) => {
      mockCallCount++;
      lastPayloadReceived = rows;
      if (mockCallCount === 1) {
        // Simulate missing updated_at in production schema
        return { data: null, error: pgrst204Error };
      }
      // Retry succeeds
      return { data: rows, error: null };
    },
  }),
};

const safeUpsertResult = await safeUpsert(mockClient, 'products', entityWithUpdatedAt);
assert.strictEqual(mockCallCount, 2, 'safeUpsert must retry once on PGRST204');
assert.strictEqual(safeUpsertResult.stripped, true, 'safeUpsert should report stripped = true');
assert.strictEqual(safeUpsertResult.error, null, 'Retry must succeed with zero error');
assert.strictEqual(lastPayloadReceived.updated_at, undefined, 'Payload sent on retry must have no updated_at');

console.log('✓ Defensive Supabase Payload Sanitizer & PGRST204 Fallback verified.');

// ============================================================================
// 4. Testing Rolling Daily Backup & Emergency Vault
// ============================================================================
console.log('4. Testing Rolling Daily Backup & Emergency Vault...');

// In-memory mock localStorage
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

const mockStorage = new MockLocalStorage();

// Save initial snapshot with 83 items
const vaultSnapshot83 = {
  timestamp: new Date().toISOString(),
  reason: 'initial_full_catalog',
  products: local83Products,
  customers: [],
  orders: parsedOrdersFromExcel,
  debtPayments: [],
  receiptSettings: {},
};

saveVaultSnapshot(vaultSnapshot83, true, mockStorage);

const loadedVault = loadVaultSnapshot(EMERGENCY_VAULT_KEY, mockStorage);
assert.strictEqual(loadedVault?.products.length, 83, 'Emergency vault must contain 83 products');

// Now attempt an accidental overwrite with an empty or 8-mock-item catalog
const shrunkSnapshot = {
  timestamp: new Date().toISOString(),
  reason: 'accidental_mock_wipe',
  products: local83Products.slice(0, 8),
  customers: [],
  orders: [],
  debtPayments: [],
  receiptSettings: {},
};

// With forceEmergency = false (auto-sync mode), it must refuse to overwrite the 83-item vault with 8 items!
const resShrunk = saveVaultSnapshot(shrunkSnapshot, false, mockStorage);
assert.strictEqual(resShrunk.savedEmergency, false, 'Must block overwriting emergency vault with smaller dataset');

const preservedVault = loadVaultSnapshot(EMERGENCY_VAULT_KEY, mockStorage);
assert.strictEqual(preservedVault?.products.length, 83, 'Emergency vault must remain protected with all 83 products');

// Pruning test: simulate a backup from 10 days ago
const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
const oldDailyKey = getDailyBackupKey(tenDaysAgo);
mockStorage.setItem(oldDailyKey, JSON.stringify({ timestamp: tenDaysAgo.toISOString(), products: [] }));

const removed = pruneDailyBackups(mockStorage, 7);
assert.ok(removed.includes(oldDailyKey), 'Backups older than 7 days must be pruned');
assert.strictEqual(mockStorage.getItem(oldDailyKey), null, 'Old key must be removed from storage');

const backupsList = listVaultBackups(mockStorage);
assert.ok(backupsList.some(b => b.key === EMERGENCY_VAULT_KEY));

console.log('✓ Rolling Daily Backup & Emergency Vault verified.');

// ============================================================================
// 5. Testing Missing Product Extraction from Excel Orders
// ============================================================================
console.log('5. Testing Missing Product Extraction & 1-Click Catalog Recovery...');

const existingProductsSubset = local83Products.slice(0, 5); // store only has 5 dishes
const missingExtracted = extractMissingProductsFromOrders(parsedOrdersFromExcel, existingProductsSubset);

// parsedOrdersFromExcel has: "Xúc xích Gà Nấm", "Chả Mực Giã Tay", "Sủi Cảo Tôm Thịt Đặc Biệt"
assert.ok(missingExtracted.length >= 2, 'Should extract the dishes missing from catalog');
const suiCao = missingExtracted.find(m => m.name.includes('Sủi Cảo'));
assert.ok(suiCao, 'Sủi Cảo must be extracted');
assert.strictEqual(suiCao?.price, 95000);
assert.strictEqual(suiCao?.cost, Math.round(95000 * 0.65));
assert.strictEqual(suiCao?.image, '🥟');

console.log('✓ Missing Product Extraction verified.');

// ============================================================================
// 6. Testing Historical Order Discrepancy & 1-Click Customer Snapshot Restoration
// ============================================================================
console.log('6. Testing Historical Order Discrepancy Detection & 1-Click Snapshot Restore...');

const mockCustomers = [
  {
    id: 'KH_CORRUPTED',
    name: 'Thanh Hằng',
    phone: '0988333444',
    address: '45 Đội Cấn, Ba Đình, Hà Nội',
    debt: 0,
    totalSpent: 500000,
    orderCount: 2,
  },
];

// Historical orders where order 1 had original phone '0988111222' and address '12 Hoàn Kiếm' (before overwrite)
const mockHistoricalOrders = [
  {
    id: 'HD_HIST_01',
    createdAt: '2026-09-10T10:00:00Z',
    customerId: 'KH_CORRUPTED',
    customerName: 'Thanh Hang',
    customerPhone: '0988111222',
    customerAddress: '12 Hoàn Kiếm, Hà Nội',
    orderType: 'delivery',
    status: 'completed',
    items: [],
    subtotal: 250000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 250000,
    paymentMethod: 'cash',
    paidAmount: 250000,
    debtAmount: 0,
  },
  {
    id: 'HD_HIST_02',
    createdAt: '2026-10-15T10:00:00Z',
    customerId: 'KH_CORRUPTED',
    customerName: 'Thanh Hằng',
    customerPhone: '0988333444',
    customerAddress: '45 Đội Cấn, Ba Đình, Hà Nội',
    orderType: 'delivery',
    status: 'completed',
    items: [],
    subtotal: 250000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 250000,
    paymentMethod: 'cash',
    paidAmount: 250000,
    debtAmount: 0,
  },
];

const auditWithOrders = auditCustomerData(mockCustomers, mockHistoricalOrders);
assert.strictEqual(auditWithOrders.orderDiscrepancies.length, 1, 'Must detect 1 order discrepancy');
assert.strictEqual(auditWithOrders.orderDiscrepancies[0].customer.id, 'KH_CORRUPTED');
assert.ok(auditWithOrders.orderDiscrepancies[0].differingPhones.includes('0988111222'));
assert.ok(auditWithOrders.orderDiscrepancies[0].differingAddresses.includes('12 Hoàn Kiếm, Hà Nội'));

// Test 1-Click restore from original snapshot
const restoredCustResult = restoreCustomerFromOrderSnapshot(mockCustomers[0], mockHistoricalOrders[0]);
assert.strictEqual(restoredCustResult.updatedCustomer.name, 'Thanh Hang');
assert.strictEqual(restoredCustResult.updatedCustomer.phone, '0988111222');
assert.strictEqual(restoredCustResult.updatedCustomer.address, '12 Hoàn Kiếm, Hà Nội');

// Test 1-Click Separation by historical order
const splitHistResult = splitCustomerByHistoricalOrder(
  mockCustomers[0],
  '0988111222',
  mockHistoricalOrders
);
assert.strictEqual(splitHistResult.customerB.phone, '0988111222');
assert.strictEqual(splitHistResult.customerB.name, 'Thanh Hang');
assert.strictEqual(splitHistResult.ordersToUpdate.length, 1);
assert.strictEqual(splitHistResult.ordersToUpdate[0].id, 'HD_HIST_01');
assert.strictEqual(splitHistResult.ordersToUpdate[0].customerId, splitHistResult.customerB.id);

console.log('✓ Historical Order Discrepancy & 1-Click Restoration verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0018 ANTI-SHRINK, CLOUD SYNC & RECOVERY TESTS PASSED!');
console.log('================================================================');
