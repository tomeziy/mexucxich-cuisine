import assert from 'node:assert';
import fs from 'node:fs';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEMO_PRODUCT_IDS,
  DEMO_CUSTOMER_IDS,
} from '../src/data/initialData.ts';
import { mergeProductsWithConflictResolution } from '../src/services/syncConflict.ts';

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

// 3. Verify StoreContext and supabase.ts integration contracts
const storeSrc = fs.readFileSync('src/context/StoreContext.tsx', 'utf8');
assert(storeSrc.includes('filterOutDemoAndDeletedProducts'), 'StoreContext must purge demo & deleted products');
assert(storeSrc.includes('mxc_deleted_product_ids_v1'), 'StoreContext must persist deleted product tombstones');
assert(storeSrc.includes('cloudDeleteProductsBatch'), 'StoreContext must flush batch product deletes');
assert(storeSrc.includes('unsyncedLocalProducts'), 'refreshCloud must auto-push unsynced local products');
assert(storeSrc.includes('unsyncedLocalOrders'), 'refreshCloud must auto-push unsynced local orders');

const supaSrc = fs.readFileSync('src/services/supabase.ts', 'utf8');
assert(supaSrc.includes('executeChunkedTableDelete'), 'supabase.ts must share executeChunkedTableDelete');
assert(supaSrc.includes('cloudDeleteProductsBatch'), 'supabase.ts must export cloudDeleteProductsBatch');

console.log('✓ All ADR-0022 no-demo, product tombstone & auto-push tests passed!');
