import assert from 'node:assert';
import fs from 'node:fs';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEMO_PRODUCT_IDS,
  DEMO_CUSTOMER_IDS,
} from '../src/data/initialData.ts';
import { mergeProductsWithConflictResolution, mergeOrders } from '../src/services/syncConflict.ts';
import { reconstructMissingProductsFromOrders } from '../src/services/supabase.ts';
import {
  saveVaultSnapshot,
  loadVaultSnapshot,
  listVaultBackups,
  EMERGENCY_VAULT_KEY,
} from '../src/utils/vault.ts';

console.log('--- RUNNING ADR-0022 NO-DEMO CATALOG, PRODUCT TOMBSTONE & AUTO-PUSH TESTS ---');

// 1. Verify INITIAL_PRODUCTS has 0 demo items & INITIAL_CUSTOMERS has only KH01
assert.strictEqual(INITIAL_PRODUCTS.length, 0, 'INITIAL_PRODUCTS must be completely empty (no demo items)');
assert.strictEqual(INITIAL_CUSTOMERS.length, 1, 'INITIAL_CUSTOMERS must contain only KH01');
assert.strictEqual(INITIAL_CUSTOMERS[0].id, 'KH01');
for (let i = 1; i <= 8; i++) {
  assert.strictEqual(DEMO_PRODUCT_IDS.has(`SP0${i}`), true, `SP0${i} must be tracked in DEMO_PRODUCT_IDS`);
}
assert.strictEqual(DEMO_CUSTOMER_IDS.has('KH02'), true);

// 2. Verify mergeProductsWithConflictResolution preserves unsynced local products for auto-push
const localProducts = [
  { id: 'SP_REAL_1', name: 'Mọc Nấm hương băm tay', price: 140000, cost: 105000, stock: 5, updatedAt: '2026-11-21T10:00:00Z' },
  { id: 'SP_REAL_2', name: 'Bánh bột lọc Huế', price: 50000, cost: 35000, stock: 10, updatedAt: '2026-11-21T10:00:00Z' },
];
const cloudProducts = [
  { id: 'SP_REAL_1', name: 'Mọc Nấm hương băm tay', price: 140000, cost: 105000, stock: 5, updatedAt: '2026-11-20T10:00:00Z' },
];
const mergeRes = mergeProductsWithConflictResolution(localProducts, cloudProducts);
assert.strictEqual(mergeRes.merged.length, 2, 'Local unsynced product must be kept');
assert.strictEqual(mergeRes.localPreserved.length, 2, 'Both newer/unsynced local products must be flagged for auto-push');

// 3. Verify non-destructive merge of Nov 12 backup JSON into a 76-product / 87-order catalog
const backupPath = 'C:\\Users\\Tomeziy Nguyen\\Downloads\\mexucxich_backup_2026-11-12.json';
let backupData;
if (fs.existsSync(backupPath)) {
  backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
} else {
  const real20 = Array.from({ length: 20 }, (_, i) => ({
    id: `SP_OLD_${i + 1}`,
    name: `Món Cũ ${i + 1}`,
    category: 'Đồ tự làm',
    unit: 'Gói',
    price: 100000,
    cost: 70000,
    stock: 10,
    image: '🌭',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }));
  const demo8 = Array.from({ length: 8 }, (_, i) => ({
    id: `SP0${i + 1}`,
    name: `Demo Item ${i + 1}`,
    category: 'Đồ tự làm',
    unit: 'Gói',
    price: 100000,
    cost: 70000,
    stock: 10,
    image: '🌭',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  }));
  backupData = {
    products: [...real20, ...demo8],
    orders: Array.from({ length: 20 }, (_, i) => ({
      id: `HD_OLD_${i + 1}`,
      createdAt: '2026-10-10T00:00:00Z',
      customerId: 'KH01',
      customerName: 'Khách',
      orderType: 'direct',
      status: 'completed',
      items: [],
      subtotal: 100000,
      discountType: 'cash',
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 100000,
      paymentMethod: 'cash',
      paidAmount: 100000,
      debtAmount: 0,
    })),
  };
}

const current76Prods = [
  ...backupData.products.filter(p => !DEMO_PRODUCT_IDS.has(p.id)),
  ...Array.from({ length: 76 - backupData.products.filter(p => !DEMO_PRODUCT_IDS.has(p.id)).length }, (_, i) => ({
    id: `SP_NEW_${i + 1}`,
    name: `Món Mới ${i + 1}`,
    category: 'Đặc sản tuyển chọn',
    unit: 'Hộp',
    price: 120000,
    cost: 80000,
    stock: 15,
    image: '🥘',
    createdAt: '2026-11-20T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
  })),
];
const current87Orders = [
  ...backupData.orders,
  ...Array.from({ length: 87 - backupData.orders.length }, (_, i) => ({
    id: `HD_NEW_${i + 1}`,
    createdAt: '2026-11-20T00:00:00Z',
    customerId: 'KH01',
    customerName: 'Khách',
    orderType: 'direct',
    status: 'completed',
    items: [],
    subtotal: 200000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 200000,
    paymentMethod: 'cash',
    paidAmount: 200000,
    debtAmount: 0,
  })),
];

const cleanIncomingBackupProds = backupData.products.filter(p => p && p.id && !DEMO_PRODUCT_IDS.has(p.id));
const mergedBackupProds = mergeProductsWithConflictResolution(cleanIncomingBackupProds, current76Prods).merged;
const mergedBackupOrds = mergeOrders(backupData.orders, current87Orders);
assert.strictEqual(mergedBackupProds.length, 76, 'Merging old backup must preserve all 76 real products with 0 demo items');
assert.strictEqual(mergedBackupProds.some(p => DEMO_PRODUCT_IDS.has(p.id)), false, 'Demo SP01-SP08 must never enter merged catalog');
assert.strictEqual(mergedBackupOrds.length, 87, 'Merging old backup must preserve all 87 orders');

// 4. Verify reconstructMissingProductsFromOrders recovers real missing dishes while skipping SP01-SP08 & tombstones
const sampleOrders = [
  {
    id: 'HD_REC_1',
    createdAt: '2026-11-21T05:00:00Z',
    customerId: 'KH01',
    customerName: 'Khách A',
    orderType: 'direct',
    status: 'completed',
    items: [
      { productId: 'SP_MISSING_1', name: 'Mọc Nấm hương băm tay', unit: '500g', price: 140000, cost: 105000, qty: 2, image: '🍄' },
      { productId: 'SP_DUP_NAME', name: 'chả cốm mộc non', unit: 'Gói', price: 110000, cost: 80000, qty: 1, image: '🌭' },
      { productId: 'SP01', name: 'Xúc xích Phô mai Tươi (500g)', unit: 'Gói 500g', price: 145000, cost: 95000, qty: 1, image: '🧀' },
      { productId: 'SP_TOMBSTONED', name: 'Món Đã Xóa Chủ Động', unit: 'Hộp', price: 90000, cost: 60000, qty: 1, image: '🌭' },
    ],
    subtotal: 485000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 485000,
    paymentMethod: 'cash',
    paidAmount: 485000,
    debtAmount: 0,
  },
];
const existingCatalog = [
  { id: 'SP_EXISTING_CC', name: 'Chả cốm mộc non', category: 'Đồ tự làm', unit: 'Gói', price: 110000, cost: 80000, stock: 7, image: '🌭' },
];
const reconstructed = reconstructMissingProductsFromOrders(sampleOrders, existingCatalog, new Set(['SP_TOMBSTONED']));
assert.strictEqual(reconstructed.length, 1, 'Should reconstruct strictly the 1 non-demo, non-tombstoned missing dish');
assert.strictEqual(reconstructed[0].id, 'SP_MISSING_1');
assert.strictEqual(reconstructed[0].name, 'Mọc Nấm hương băm tay');

// 5. Verify Vault strips SP01-SP08 on both saveVaultSnapshot and loadVaultSnapshot
const memMap = new Map();
const mockStorage = {
  get length() { return memMap.size; },
  key(i) { return Array.from(memMap.keys())[i] || null; },
  getItem(k) { return memMap.has(k) ? memMap.get(k) : null; },
  setItem(k, v) { memMap.set(k, String(v)); },
  removeItem(k) { memMap.delete(k); },
  clear() { memMap.clear(); },
};
saveVaultSnapshot(
  {
    timestamp: '2026-11-21T12:00:00Z',
    products: [
      { id: 'SP01', name: 'Demo 1', category: 'c', unit: 'u', price: 1, cost: 1, stock: 1, image: '🧀' },
      { id: 'SP_REAL_V', name: 'Real Dish', category: 'c', unit: 'u', price: 100, cost: 50, stock: 5, image: '🌭' },
    ],
    customers: [],
    orders: [],
    debtPayments: [],
    receiptSettings: { storeName: 'MEXUCXICH' },
  },
  true,
  mockStorage
);
const loadedVault = loadVaultSnapshot(EMERGENCY_VAULT_KEY, mockStorage);
assert.strictEqual(loadedVault.products.length, 1, 'save/loadVaultSnapshot must strip demo products');
assert.strictEqual(loadedVault.products[0].id, 'SP_REAL_V');
// Simulate legacy pre-tainted vault JSON directly in storage
memMap.set(
  EMERGENCY_VAULT_KEY,
  JSON.stringify({
    timestamp: '2026-11-12T12:00:00Z',
    products: [
      { id: 'SP02', name: 'Demo 2', category: 'c', unit: 'u', price: 1, cost: 1, stock: 1, image: '🥩' },
      { id: 'SP_REAL_V2', name: 'Real Dish 2', category: 'c', unit: 'u', price: 100, cost: 50, stock: 5, image: '🌭' },
    ],
    customers: [],
    orders: [],
    debtPayments: [],
    receiptSettings: {},
  })
);
const scrubbedLegacy = loadVaultSnapshot(EMERGENCY_VAULT_KEY, mockStorage);
assert.strictEqual(scrubbedLegacy.products.length, 1);
assert.strictEqual(scrubbedLegacy.products[0].id, 'SP_REAL_V2');
const vaultMeta = listVaultBackups(mockStorage);
assert.strictEqual(vaultMeta[0].productCount, 1, 'listVaultBackups must report scrubbed real product count');

// 6. Verify StoreContext, supabase.ts, and SettingsPage integration contracts
const storeSrc = fs.readFileSync('src/context/StoreContext.tsx', 'utf8');
assert(storeSrc.includes('filterOutDemoAndDeletedProducts'), 'StoreContext must purge demo & deleted products');
assert(storeSrc.includes('mxc_deleted_product_ids_v1'), 'StoreContext must persist deleted product tombstones');
assert(storeSrc.includes('mxc_purged_product_ids_v1'), 'StoreContext must persist permanent purged product tombstones');
assert(storeSrc.includes('mxc_deleted_order_ids_v1'), 'StoreContext must persist deleted order tombstones');
assert(storeSrc.includes('mxc_purged_order_ids_v1'), 'StoreContext must persist permanent purged order tombstones');
assert(storeSrc.includes('cloudDeleteProductsBatch'), 'StoreContext must flush batch product deletes');
assert(storeSrc.includes('cloudDeleteOrdersBatch'), 'StoreContext must flush batch order deletes');
assert(storeSrc.includes('cloudSyncDebtPaymentsBatch'), 'StoreContext must sync merged debtPayments');
assert(storeSrc.includes('reconstructMissingProductsFromOrders'), 'StoreContext must reconstruct missing products during restore/merge');
assert(storeSrc.includes('unsyncedLocalProducts'), 'refreshCloud must auto-push unsynced local products');
assert(storeSrc.includes('unsyncedLocalOrders'), 'refreshCloud must auto-push unsynced local orders');

const supaSrc = fs.readFileSync('src/services/supabase.ts', 'utf8');
assert(supaSrc.includes('executeChunkedTableDelete'), 'supabase.ts must share executeChunkedTableDelete');
assert(supaSrc.includes('cloudDeleteProductsBatch'), 'supabase.ts must export cloudDeleteProductsBatch');
assert(supaSrc.includes('cloudDeleteOrdersBatch'), 'supabase.ts must export cloudDeleteOrdersBatch');
assert(supaSrc.includes('cloudSyncDebtPaymentsBatch'), 'supabase.ts must export cloudSyncDebtPaymentsBatch');
assert(supaSrc.includes('reconstructMissingProductsFromOrders'), 'supabase.ts must export reconstructMissingProductsFromOrders');

const settingsSrc = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');
const restoreStart = settingsSrc.indexOf('const handleRestore =');
const resetStart = settingsSrc.indexOf('const handleResetData =');
const vaultStart = settingsSrc.indexOf('const handleRestoreVault =');
const printStart = settingsSrc.indexOf('const handleTestPrint =');
const restoreBody = settingsSrc.slice(restoreStart, resetStart);
const vaultBody = settingsSrc.slice(vaultStart, printStart);
assert(!restoreBody.includes('window.location.reload()'), 'handleRestore must NOT reload page while async cloud syncs run');
assert(!vaultBody.includes('window.location.reload()'), 'handleRestoreVault must NOT reload page while async cloud syncs run');

console.log('✓ All ADR-0022 no-demo, product/order tombstone, vault scrub, safe backup merge & auto-push tests passed!');
console.log('🎉 ALL ADR-0022 DEMO PURGE, AUTO-HEAL SYNC & SAFE BACKUP RESTORE TESTS PASSED!');
