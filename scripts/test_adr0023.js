/**
 * ADR-0023: Universal Cloud-First Multi-Device Sync Tests
 * Verifies:
 * 1. Self-healing getSupabaseConfig() behavior with corrupted/disabled localStorage entries.
 * 2. reconcileCloudAndLocalPullData() Cloud-Truth multi-device sync, cloud tombstones, demo scrubbing, and fault isolation.
 * 3. Genuine offline dirty ID preservation & unsynced upload detection.
 * 4. Static contract assertions for index.html, Navbar.tsx, StoreContext.tsx, and supabase.ts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  getSupabaseConfig,
  reconcileCloudAndLocalPullData,
} from '../src/services/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Helper: build an in-memory localStorage mock for Node execution
function createMockLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

// =========================================================================
// Block 1: getSupabaseConfig() self-healing behavior
// =========================================================================
{
  const originalLocalStorage = globalThis.localStorage;
  try {
    // Case 1a: Empty URL + autoSync false -> healed to defaults & autoSync: true
    const mockStorageA = createMockLocalStorage({
      mexucxich_cloud_config: JSON.stringify({
        supabaseUrl: '',
        supabaseAnonKey: 'k',
        autoSync: false,
      }),
    });
    globalThis.localStorage = mockStorageA;

    const healedA = getSupabaseConfig();
    assert.equal(healedA.supabaseUrl, DEFAULT_SUPABASE_URL, 'Empty URL must heal to DEFAULT_SUPABASE_URL');
    assert.equal(healedA.supabaseAnonKey, 'k', 'Non-empty custom anon key is preserved');
    assert.equal(healedA.autoSync, true, 'autoSync must be forced to true');

    const persistedA = JSON.parse(mockStorageA.getItem('mexucxich_cloud_config') || '{}');
    assert.equal(persistedA.supabaseUrl, DEFAULT_SUPABASE_URL, 'Healed URL must be written back to localStorage');
    assert.equal(persistedA.autoSync, true, 'Healed autoSync must be written back to localStorage');

    // Case 1b: Non-http invalid URL + missing key + autoSync false -> healed & persisted
    const mockStorageB = createMockLocalStorage({
      mexucxich_cloud_config: JSON.stringify({
        supabaseUrl: 'bad-url',
        autoSync: false,
      }),
    });
    globalThis.localStorage = mockStorageB;

    const healedB = getSupabaseConfig();
    assert.equal(healedB.supabaseUrl, DEFAULT_SUPABASE_URL, 'Non-http URL must heal to DEFAULT_SUPABASE_URL');
    assert.equal(healedB.supabaseAnonKey, DEFAULT_SUPABASE_ANON_KEY, 'Missing anon key must heal to DEFAULT_SUPABASE_ANON_KEY');
    assert.equal(healedB.autoSync, true, 'autoSync must heal to true');

    const persistedB = JSON.parse(mockStorageB.getItem('mexucxich_cloud_config') || '{}');
    assert.equal(persistedB.supabaseUrl, DEFAULT_SUPABASE_URL);
    assert.equal(persistedB.supabaseAnonKey, DEFAULT_SUPABASE_ANON_KEY);
    assert.equal(persistedB.autoSync, true);
  } finally {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  }
  console.log('PASS Block 1: getSupabaseConfig() self-healing verified.');
}

// =========================================================================
// Block 2: Multi-device Cloud-Truth reconcile, tombstones & fault isolation
// =========================================================================
{
  const cloudProductsRaw = [
    { id: 'SP_CLOUD_1', name: 'Xúc xích Đức', price: 65000, category: 'Xúc xích', inStock: true },
    { id: 'SP_CLOUD_2', name: 'Bánh mì bơ tỏi', price: 35000, category: 'Ăn kèm', inStock: true },
  ];
  const cloudCustomersRaw = [
    { id: 'KH_CLOUD_1', name: 'Chị Lan', phone: '0901111222' },
  ];
  const cloudOrdersRaw = [
    {
      id: 'HD_CLOUD_1',
      customerId: 'KH_CLOUD_1',
      items: [{ product: cloudProductsRaw[0], quantity: 2 }],
      total: 130000,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      createdAt: '2026-11-20T09:00:00.000Z',
    },
  ];
  const cloudDebtPaymentsRaw = [
    {
      id: 'DP_CLOUD_1',
      customerId: 'KH_CLOUD_1',
      amount: 50000,
      method: 'transfer',
      createdAt: '2026-11-20T10:00:00.000Z',
    },
  ];

  // Stale Device B local data containing demo products SP01..SP08,
  // items deleted on Device A (SP_DELETED_ON_A, HD_DELETED_ON_A),
  // and a stale un-dirty extra item SP_STALE_EXTRA.
  const demoProducts = ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06', 'SP07', 'SP08'].map((id) => ({
    id,
    name: `Demo ${id}`,
    price: 10000,
    category: 'Demo',
    inStock: true,
  }));

  const localStaleProducts = [
    ...demoProducts,
    { id: 'SP_DELETED_ON_A', name: 'Deleted on Device A', price: 45000, category: 'Xóa', inStock: true },
    { id: 'SP_STALE_EXTRA', name: 'Stale non-dirty local', price: 55000, category: 'Cũ', inStock: true },
  ];
  const localStaleOrders = [
    {
      id: 'HD_DELETED_ON_A',
      items: [{ product: cloudProductsRaw[0], quantity: 1 }],
      total: 65000,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      createdAt: '2026-11-19T08:00:00.000Z',
    },
  ];
  const localCustomersFallback = [
    { id: 'KH_LOCAL_EXISTING', name: 'Khách cũ local', phone: '0988777666' },
  ];

  const cloudTombstones = {
    deletedProductIds: ['SP_DELETED_ON_A'],
    deletedOrderIds: ['HD_DELETED_ON_A'],
    deletedCustomerIds: [],
    updatedAt: '2026-11-21T08:00:00.000Z',
  };

  const result = reconcileCloudAndLocalPullData({
    cloudProductsRaw,
    cloudCustomersRaw,
    cloudOrdersRaw,
    cloudDebtPaymentsRaw,
    cloudHasExtraAddressesCol: true,
    cloudTombstones,
    cloudCustomersOk: true,
    cloudDebtPaymentsOk: true,
    localData: {
      products: localStaleProducts,
      customers: localCustomersFallback,
      orders: localStaleOrders,
      debtPayments: [],
      excludedProductIds: [],
      excludedOrderIds: [],
      dirtyProductIds: [],
      dirtyOrderIds: [],
    },
  });

  const productIds = result.products.map((p) => p.id);
  assert.deepEqual(
    productIds,
    ['SP_CLOUD_1', 'SP_CLOUD_2'],
    'Device B must receive strictly the Cloud catalog without SP01..SP08, SP_DELETED_ON_A, or SP_STALE_EXTRA',
  );
  for (const demoId of ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06', 'SP07', 'SP08']) {
    assert.ok(!productIds.includes(demoId), `Demo product ${demoId} must not appear`);
  }
  assert.ok(!productIds.includes('SP_DELETED_ON_A'), 'Deleted product on Device A must be absent on Device B');
  assert.ok(!productIds.includes('SP_STALE_EXTRA'), 'Stale non-dirty local product must not pollute Cloud truth');
  assert.equal(result.unsyncedLocalProducts.length, 0, 'No unsynced local products expected');

  const orderIds = result.orders.map((o) => o.id);
  assert.deepEqual(orderIds, ['HD_CLOUD_1'], 'Deleted order HD_DELETED_ON_A must be absent on Device B');
  assert.equal(result.unsyncedLocalOrders.length, 0, 'No unsynced local orders expected');

  // Fault isolation check: cloudCustomersOk: false preserves localData.customers
  const faultIsolated = reconcileCloudAndLocalPullData({
    cloudProductsRaw,
    cloudCustomersRaw: [],
    cloudOrdersRaw,
    cloudDebtPaymentsRaw: [],
    cloudHasExtraAddressesCol: true,
    cloudTombstones,
    cloudCustomersOk: false,
    cloudDebtPaymentsOk: false,
    localData: {
      products: localStaleProducts,
      customers: localCustomersFallback,
      orders: localStaleOrders,
      debtPayments: [
        {
          id: 'DP_LOCAL_EXISTING',
          customerId: 'KH_LOCAL_EXISTING',
          amount: 20000,
          method: 'cash',
          createdAt: '2026-11-20T12:00:00.000Z',
        },
      ],
      dirtyProductIds: [],
      dirtyOrderIds: [],
    },
  });

  assert.ok(
    faultIsolated.customers.some((c) => c.id === 'KH_LOCAL_EXISTING'),
    'When cloudCustomersOk is false, existing local customers must be preserved by fault isolation',
  );
  assert.ok(
    faultIsolated.debtPayments.some((d) => d.id === 'DP_LOCAL_EXISTING'),
    'When cloudDebtPaymentsOk is false, existing local debtPayments must be preserved by fault isolation',
  );
  console.log('PASS Block 2: Multi-device Cloud-Truth sync, tombstones & fault isolation verified.');
}

// =========================================================================
// Block 3: Genuine offline creation on Device B with dirty IDs
// =========================================================================
{
  const offlineProduct = {
    id: 'SP_OFFLINE_NEW',
    name: 'Lạp xưởng gác bếp (offline)',
    price: 120000,
    category: 'Đặc sản',
    inStock: true,
    updatedAt: '2026-11-21T09:30:00.000Z',
  };
  const offlineOrder = {
    id: 'HD_OFFLINE_NEW',
    items: [{ product: offlineProduct, quantity: 1 }],
    total: 120000,
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    createdAt: '2026-11-21T09:35:00.000Z',
  };
  const cloudProduct = {
    id: 'SP_CLOUD_MAIN',
    name: 'Chả cốm Hà Nội',
    price: 90000,
    category: 'Món chính',
    inStock: true,
  };
  const cloudOrder = {
    id: 'HD_CLOUD_MAIN',
    items: [{ product: cloudProduct, quantity: 1 }],
    total: 90000,
    status: 'completed',
    paymentStatus: 'paid',
    paymentMethod: 'transfer',
    createdAt: '2026-11-21T08:00:00.000Z',
  };

  const result = reconcileCloudAndLocalPullData({
    cloudProductsRaw: [cloudProduct],
    cloudCustomersRaw: [],
    cloudOrdersRaw: [cloudOrder],
    cloudDebtPaymentsRaw: [],
    cloudHasExtraAddressesCol: true,
    cloudTombstones: {
      deletedProductIds: [],
      deletedOrderIds: [],
      deletedCustomerIds: [],
      updatedAt: '2026-11-21T08:00:00.000Z',
    },
    cloudCustomersOk: true,
    cloudDebtPaymentsOk: true,
    localData: {
      products: [cloudProduct, offlineProduct],
      customers: [],
      orders: [cloudOrder, offlineOrder],
      debtPayments: [],
      dirtyProductIds: ['SP_OFFLINE_NEW'],
      dirtyOrderIds: ['HD_OFFLINE_NEW'],
    },
  });

  assert.ok(
    result.products.some((p) => p.id === 'SP_OFFLINE_NEW'),
    'Offline dirty product SP_OFFLINE_NEW must be preserved in merged products',
  );
  assert.ok(
    result.orders.some((o) => o.id === 'HD_OFFLINE_NEW'),
    'Offline dirty order HD_OFFLINE_NEW must be preserved in merged orders',
  );
  assert.deepEqual(
    result.unsyncedLocalProducts.map((p) => p.id),
    ['SP_OFFLINE_NEW'],
    'unsyncedLocalProducts must contain SP_OFFLINE_NEW',
  );
  assert.deepEqual(
    result.unsyncedLocalOrders.map((o) => o.id),
    ['HD_OFFLINE_NEW'],
    'unsyncedLocalOrders must contain HD_OFFLINE_NEW',
  );
  console.log('PASS Block 3: Genuine offline dirty product & order preservation verified.');
}

// =========================================================================
// Block 4: Static contract assertions
// =========================================================================
{
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
  for (const token of ['http-equiv="Cache-Control"', 'http-equiv="Pragma"', 'http-equiv="Expires"']) {
    assert.ok(indexHtml.includes(token), `index.html missing ${token}`);
  }

  const navbarTsx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/layout/Navbar.tsx'), 'utf8');
  for (const token of [
    'isCloudSyncing',
    'syncCloudToLocal',
    'lastCloudSyncAt',
    'cloudSyncError',
    'Đang đồng bộ Cloud...',
  ]) {
    assert.ok(navbarTsx.includes(token), `Navbar.tsx missing ${token}`);
  }

  const storeContextTsx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/context/StoreContext.tsx'), 'utf8');
  for (const token of [
    'mxc_dirty_product_ids_v1',
    'mxc_dirty_order_ids_v1',
    'mxc_adr0023_cloud_truth_v1',
    "window.addEventListener('online'",
    'setInterval',
    'pushCloudTombstones',
    'dirtyProductIds',
    'dirtyOrderIds',
    'isCloudSyncing',
  ]) {
    assert.ok(storeContextTsx.includes(token), `StoreContext.tsx missing ${token}`);
  }

  const supabaseTs = fs.readFileSync(path.join(PROJECT_ROOT, 'src/services/supabase.ts'), 'utf8');
  for (const token of [
    'cloud_tombstones_v1',
    'fetchCloudTombstones',
    'pushCloudTombstones',
    'reconcileCloudAndLocalPullData',
  ]) {
    assert.ok(supabaseTs.includes(token), `supabase.ts missing ${token}`);
  }

  console.log('PASS Block 4: All static contract assertions verified.');
}

console.log('ALL ADR-0023 TESTS PASSED.');
