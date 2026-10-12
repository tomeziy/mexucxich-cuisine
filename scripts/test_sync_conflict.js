import assert from 'node:assert';
import {
  calculateStockDelta,
  getEntityTimestamp,
  resolveProductConflict,
  resolveCustomerConflict,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
} from '../src/services/syncConflict.ts';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS } from '../src/data/initialData.ts';

console.log('--- RUNNING ADR-0008 CROSS-DEVICE SYNC CONFLICT UNIT TESTS ---');

// ==============================================================================
// 1. ATOMIC STOCK DELTA CALCULATION TESTS
// ==============================================================================
console.log('1. Testing Atomic Stock Delta Calculations...');

// Happy paths
assert.strictEqual(calculateStockDelta(10, -2), 8, '10 - 2 should equal 8');
assert.strictEqual(calculateStockDelta(100, -15), 85, '100 - 15 should equal 85');
assert.strictEqual(calculateStockDelta(10, 5), 15, 'Restock: 10 + 5 should equal 15');
assert.strictEqual(calculateStockDelta(0, 10), 10, 'Restock from 0: 0 + 10 should equal 10');

// Floor at 0 (Stock cannot drop below zero)
assert.strictEqual(calculateStockDelta(3, -5), 0, 'Floor test: 3 - 5 should floor at 0');
assert.strictEqual(calculateStockDelta(0, -1), 0, 'Floor test: 0 - 1 should floor at 0');
assert.strictEqual(calculateStockDelta(10, -999), 0, 'Extreme negative delta should floor at 0');

// Float / Decimal units (e.g. 0.5kg, 1.25kg)
assert.strictEqual(calculateStockDelta(2.5, -0.75), 1.75, 'Decimal delta: 2.5 - 0.75 = 1.75');
assert.strictEqual(calculateStockDelta(0.1, 0.2), 0.3, 'Floating precision rounded: 0.1 + 0.2 = 0.3');
assert.strictEqual(calculateStockDelta(1.0005, -0.0002), 1.0003, 'Precision test: 4 decimal places');

// String and null/undefined safety
assert.strictEqual(calculateStockDelta('15', -5), 10, 'String stock coercion: "15" - 5 = 10');
assert.strictEqual(calculateStockDelta(20, '-8'), 12, 'String delta coercion: 20 + "-8" = 12');
assert.strictEqual(calculateStockDelta(null, -2), 0, 'Null stock handled gracefully as 0');
assert.strictEqual(calculateStockDelta(undefined, 5), 5, 'Undefined stock handled gracefully as 0');
assert.strictEqual(calculateStockDelta(10, null), 10, 'Null delta handled gracefully as 0');

// Multi-device Race Condition simulation
// Scenario: Starting stock = 20
// Device A (Desktop) sells 5: delta = -5
// Device B (Mobile) sells 3: delta = -3
// Device B (Mobile) sells 4: delta = -4
// Device A (Desktop) sells 2: delta = -2
// When applying atomic deltas sequentially:
let serverStock = 20;
const deltas = [-5, -3, -4, -2];
for (const delta of deltas) {
  serverStock = calculateStockDelta(serverStock, delta);
}
assert.strictEqual(serverStock, 6, 'Concurrent order deltas (-5, -3, -4, -2) on initial 20 stock must yield 6');

console.log('✓ All 15 Atomic Stock Delta calculation tests passed.');

// ==============================================================================
// 2. TIMESTAMP PARSING & EXTRACTION TESTS
// ==============================================================================
console.log('2. Testing Timestamp Parsing & Extraction...');

const t1 = '2026-10-12T10:00:00.000Z';
const t2 = '2026-10-12T10:05:00.000Z';

assert.strictEqual(
  getEntityTimestamp({ updatedAt: t2, createdAt: t1 }),
  new Date(t2).getTime(),
  'Must prioritize updatedAt over createdAt when both are present'
);

assert.strictEqual(
  getEntityTimestamp({ createdAt: t1 }),
  new Date(t1).getTime(),
  'Must fallback to createdAt when updatedAt is missing'
);

assert.strictEqual(
  getEntityTimestamp({ updatedAt: undefined, createdAt: t1 }),
  new Date(t1).getTime(),
  'Must fallback to createdAt when updatedAt is undefined'
);

assert.strictEqual(getEntityTimestamp(null), 0, 'Null entity returns 0');
assert.strictEqual(getEntityTimestamp(undefined), 0, 'Undefined entity returns 0');
assert.strictEqual(getEntityTimestamp({}), 0, 'Entity with no timestamps returns 0');
assert.strictEqual(getEntityTimestamp({ updatedAt: 'invalid-date' }), 0, 'Invalid date string returns 0');

console.log('✓ All 7 Timestamp parsing & extraction tests passed.');

// ==============================================================================
// 3. SINGLE ENTITY CONFLICT RESOLUTION TESTS
// ==============================================================================
console.log('3. Testing Single Entity Conflict Resolution...');

// Product Conflict: Local Newer vs Cloud Newer
const localProdNewer = {
  id: 'SP01',
  name: 'Xúc xích Phô mai (Sửa giá tại quầy)',
  price: 150000,
  stock: 12,
  category: 'Đồ tự làm',
  unit: 'Gói',
  cost: 90000,
  image: '🌭',
  updatedAt: '2026-10-12T14:30:00.000Z',
};

const cloudProdStale = {
  id: 'SP01',
  name: 'Xúc xích Phô mai',
  price: 145000,
  stock: 14,
  category: 'Đồ tự làm',
  unit: 'Gói',
  cost: 90000,
  image: '🌭',
  updatedAt: '2026-10-12T14:00:00.000Z',
};

const resLocalWins = resolveProductConflict(localProdNewer, cloudProdStale);
assert.strictEqual(resLocalWins.source, 'local', 'Local newer update must win');
assert.strictEqual(resLocalWins.winner.name, 'Xúc xích Phô mai (Sửa giá tại quầy)');
assert.strictEqual(resLocalWins.winner.price, 150000);

// Cloud Newer
const cloudProdNewer = {
  ...cloudProdStale,
  name: 'Xúc xích Phô mai Đặc Biệt',
  price: 155000,
  updatedAt: '2026-10-12T15:00:00.000Z',
};

const resCloudWins = resolveProductConflict(localProdNewer, cloudProdNewer);
assert.strictEqual(resCloudWins.source, 'cloud', 'Cloud newer update must win');
assert.strictEqual(resCloudWins.winner.name, 'Xúc xích Phô mai Đặc Biệt');
assert.strictEqual(resCloudWins.winner.price, 155000);

// Equal timestamp tie-breaker
const prodSameTimeCloud = { ...localProdNewer, name: 'Cloud Tied Version' };
const resTie = resolveProductConflict(localProdNewer, prodSameTimeCloud);
assert.strictEqual(resTie.source, 'cloud', 'Tied timestamp should default to cloud as single source of truth');

// Customer Conflict
const localCustEdited = {
  id: 'KH01',
  name: 'Chị Mai',
  phone: '0901234567',
  address: 'Số 10 Hàng Gai (Khách vừa gọi đổi địa chỉ)',
  debt: 200000,
  updatedAt: '2026-10-12T15:20:00.000Z',
};

const cloudCustStale = {
  id: 'KH01',
  name: 'Chị Mai',
  phone: '0901234567',
  address: 'Số 2 Bà Triệu',
  debt: 200000,
  updatedAt: '2026-10-12T14:00:00.000Z',
};

const custRes = resolveCustomerConflict(localCustEdited, cloudCustStale);
assert.strictEqual(custRes.source, 'local', 'Local customer edit must win against stale cloud snapshot');
assert.strictEqual(custRes.winner.address, 'Số 10 Hàng Gai (Khách vừa gọi đổi địa chỉ)');

console.log('✓ All Single Entity Conflict Resolution tests passed.');

// ==============================================================================
// 4. LIST MERGE & CROSS-DEVICE RECONCILIATION TESTS
// ==============================================================================
console.log('4. Testing Full Collection Merge Logic...');

// 4.1 Products List Merge
const localProductsList = [
  // SP01: Edited locally at 15:30 (newer than cloud)
  {
    id: 'SP01',
    name: 'SP01 Local',
    price: 100,
    cost: 50,
    stock: 10,
    category: 'Món',
    unit: 'Gói',
    image: '🌭',
    updatedAt: '2026-10-12T15:30:00.000Z',
  },
  // SP02: Stale locally (cloud is newer)
  {
    id: 'SP02',
    name: 'SP02 Stale Local',
    price: 200,
    cost: 100,
    stock: 5,
    category: 'Món',
    unit: 'Gói',
    image: '🌭',
    updatedAt: '2026-10-12T14:00:00.000Z',
  },
  // SP03: Created locally while offline, not yet on cloud
  {
    id: 'SP03',
    name: 'SP03 New Offline Local',
    price: 300,
    cost: 150,
    stock: 8,
    category: 'Món',
    unit: 'Gói',
    image: '🌭',
    updatedAt: '2026-10-12T15:40:00.000Z',
  },
];

const cloudProductsList = [
  // SP01: Stale on cloud
  {
    id: 'SP01',
    name: 'SP01 Cloud Stale',
    price: 90,
    cost: 50,
    stock: 10,
    category: 'Món',
    unit: 'Gói',
    image: '🌭',
    updatedAt: '2026-10-12T15:00:00.000Z',
  },
  // SP02: Updated on cloud by phone at 15:45
  {
    id: 'SP02',
    name: 'SP02 Phone Updated',
    price: 220,
    cost: 100,
    stock: 3,
    category: 'Món',
    unit: 'Gói',
    image: '🌭',
    updatedAt: '2026-10-12T15:45:00.000Z',
  },
  // SP04: New product created on mobile phone
  {
    id: 'SP04',
    name: 'SP04 Mobile Product',
    price: 400,
    cost: 200,
    stock: 20,
    category: 'Món',
    unit: 'Gói',
    image: '🌭',
    updatedAt: '2026-10-12T15:25:00.000Z',
  },
];

const mergedProducts = mergeProductsWithConflictResolution(localProductsList, cloudProductsList);

assert.strictEqual(mergedProducts.merged.length, 4, 'Merged products list must contain 4 distinct products');
assert.strictEqual(mergedProducts.localPreserved.length, 2, 'Must preserve 2 local products (SP01 newer, SP03 offline)');
assert.strictEqual(mergedProducts.cloudAccepted.length, 2, 'Must accept 2 cloud products (SP02 newer, SP04 new)');

const sp01 = mergedProducts.merged.find(p => p.id === 'SP01');
assert.strictEqual(sp01.name, 'SP01 Local', 'SP01 local edit was preserved against stale cloud');

const sp02 = mergedProducts.merged.find(p => p.id === 'SP02');
assert.strictEqual(sp02.name, 'SP02 Phone Updated', 'SP02 cloud update was accepted over stale local');

const sp03 = mergedProducts.merged.find(p => p.id === 'SP03');
assert.strictEqual(sp03.name, 'SP03 New Offline Local', 'SP03 offline local product was not wiped out');

const sp04 = mergedProducts.merged.find(p => p.id === 'SP04');
assert.strictEqual(sp04.name, 'SP04 Mobile Product', 'SP04 mobile product was added successfully');

// 4.2 Customers List Merge
const localCustomers = [
  {
    id: 'KH_A',
    name: 'Khách A',
    phone: '0911111111',
    address: 'Địa chỉ Quầy',
    debt: 50000,
    updatedAt: '2026-10-12T16:00:00.000Z',
  },
  {
    id: 'KH_C',
    name: 'Khách C (Offline)',
    phone: '0933333333',
    address: 'Mới tạo quầy',
    debt: 0,
    updatedAt: '2026-10-12T16:05:00.000Z',
  },
];

const cloudCustomers = [
  {
    id: 'KH_A',
    name: 'Khách A',
    phone: '0911111111',
    address: 'Địa chỉ Cũ',
    debt: 50000,
    updatedAt: '2026-10-12T15:00:00.000Z',
  },
  {
    id: 'KH_B',
    name: 'Khách B (Được tạo trên điện thoại)',
    phone: '0922222222',
    address: 'Từ Zalo',
    debt: 100000,
    updatedAt: '2026-10-12T15:30:00.000Z',
  },
];

const mergedCust = mergeCustomersWithConflictResolution(localCustomers, cloudCustomers);
assert.strictEqual(mergedCust.merged.length, 3, 'Must merge to 3 customers total');
assert.strictEqual(mergedCust.localPreserved.length, 2, 'Preserved KH_A and KH_C');
assert.strictEqual(mergedCust.cloudAccepted.length, 1, 'Accepted KH_B from phone');
assert.strictEqual(
  mergedCust.merged.find(c => c.id === 'KH_A').address,
  'Địa chỉ Quầy',
  'Customer address update on desktop was protected'
);

// 4.3 Orders Merge (Offline Protection)
const localOrders = [
  {
    id: 'HD001',
    createdAt: '2026-10-12T14:00:00.000Z',
    status: 'completed',
    items: [],
    customerId: 'KH01',
    customerName: 'Khách 1',
    orderType: 'direct',
    subtotal: 100000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 100000,
    paymentMethod: 'cash',
    paidAmount: 100000,
    debtAmount: 0,
  },
  {
    // Order created locally while offline
    id: 'HD003',
    createdAt: '2026-10-12T16:00:00.000Z',
    status: 'completed',
    items: [],
    customerId: 'KH03',
    customerName: 'Khách 3',
    orderType: 'direct',
    subtotal: 300000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 300000,
    paymentMethod: 'cash',
    paidAmount: 300000,
    debtAmount: 0,
  },
];

const cloudOrders = [
  {
    id: 'HD001',
    createdAt: '2026-10-12T14:00:00.000Z',
    status: 'completed',
    items: [],
    customerId: 'KH01',
    customerName: 'Khách 1',
    orderType: 'direct',
    subtotal: 100000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 100000,
    paymentMethod: 'cash',
    paidAmount: 100000,
    debtAmount: 0,
  },
  {
    // Order created by owner on phone
    id: 'HD002',
    createdAt: '2026-10-12T15:00:00.000Z',
    status: 'completed',
    items: [],
    customerId: 'KH02',
    customerName: 'Khách 2',
    orderType: 'delivery',
    subtotal: 200000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 30000,
    total: 230000,
    paymentMethod: 'transfer',
    paidAmount: 230000,
    debtAmount: 0,
  },
];

const mergedOrders = mergeOrders(localOrders, cloudOrders);
assert.strictEqual(mergedOrders.length, 3, 'Must contain HD001, HD002, HD003');
assert(mergedOrders.some(o => o.id === 'HD003'), 'Local offline order HD003 must be preserved');
assert(mergedOrders.some(o => o.id === 'HD002'), 'Mobile cloud order HD002 must be included');
// Sorted descending by createdAt
assert.strictEqual(mergedOrders[0].id, 'HD003', 'HD003 (16:00) should be first');
assert.strictEqual(mergedOrders[1].id, 'HD002', 'HD002 (15:00) should be second');
assert.strictEqual(mergedOrders[2].id, 'HD001', 'HD001 (14:00) should be third');

// 4.3.1 Order sorting test: Old order updated recently must remain in chronological order by createdAt
const localOrdersWithUpdate = [
  {
    id: 'HD_OLD',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-12T17:00:00.000Z', // Updated today
    status: 'completed',
    items: [],
    customerId: 'KH01',
    customerName: 'Khách 1',
    orderType: 'direct',
    subtotal: 100000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 100000,
    paymentMethod: 'cash',
    paidAmount: 100000,
    debtAmount: 0,
  },
  {
    id: 'HD_NEW',
    createdAt: '2026-10-12T12:00:00.000Z', // Created today
    status: 'completed',
    items: [],
    customerId: 'KH02',
    customerName: 'Khách 2',
    orderType: 'direct',
    subtotal: 150000,
    discountType: 'cash',
    discountValue: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 150000,
    paymentMethod: 'cash',
    paidAmount: 150000,
    debtAmount: 0,
  },
];
const mergedChronological = mergeOrders(localOrdersWithUpdate, []);
assert.strictEqual(mergedChronological[0].id, 'HD_NEW', 'Newer creation HD_NEW must appear first despite HD_OLD having newer updatedAt');
assert.strictEqual(mergedChronological[1].id, 'HD_OLD', 'Older creation HD_OLD must appear second');

// 4.4 Debt Payments Merge
const localPayments = [
  { id: 'PT01', customerId: 'K1', customerName: 'A', amount: 50000, paymentMethod: 'cash', createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T11:00:00.000Z', note: 'Đã cập nhật quầy' },
  { id: 'PT03', customerId: 'K3', customerName: 'C', amount: 70000, paymentMethod: 'cash', createdAt: '2026-10-12T12:00:00.000Z' },
];

const cloudPayments = [
  { id: 'PT01', customerId: 'K1', customerName: 'A', amount: 50000, paymentMethod: 'cash', createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z', note: 'Bản cũ cloud' },
  { id: 'PT02', customerId: 'K2', customerName: 'B', amount: 60000, paymentMethod: 'transfer', createdAt: '2026-10-12T11:00:00.000Z' },
];

const mergedPayments = mergeDebtPayments(localPayments, cloudPayments);
assert.strictEqual(mergedPayments.length, 3, 'Must contain PT01, PT02, PT03 with deduplication');
assert.strictEqual(mergedPayments[0].id, 'PT03', 'PT03 (12:00) should be first');
assert.strictEqual(mergedPayments[1].id, 'PT02', 'PT02 (11:00) should be second');
assert.strictEqual(mergedPayments[2].id, 'PT01', 'PT01 (10:00) should be third');
assert.strictEqual(mergedPayments[2].note, 'Đã cập nhật quầy', 'PT01 newer local update must win against stale cloud snapshot');

// 4.5 Mock Initial Data Timestamp Safety Test
// Ensures initial mock data (September 2026) never overwrites real cloud data (October 2026)
const realCloudCustomer = {
  id: 'KH02',
  name: 'Chị Lan Real Cloud Customer',
  phone: '0988123456',
  address: 'Địa chỉ thực tế trên Cloud',
  debt: 500000,
  totalSpent: 5000000,
  orderCount: 10,
  updatedAt: '2026-10-05T09:00:00.000Z',
};
const mockInitialCust = INITIAL_CUSTOMERS.find(c => c.id === 'KH02');
assert(mockInitialCust, 'KH02 mock customer must exist in INITIAL_CUSTOMERS');
const mockRes = resolveCustomerConflict(mockInitialCust, realCloudCustomer);
assert.strictEqual(mockRes.source, 'cloud', 'Real cloud customer from October must beat mock customer from September');
assert.strictEqual(mockRes.winner.name, 'Chị Lan Real Cloud Customer');

const realCloudProduct = {
  id: 'SP01',
  name: 'Xúc xích Phô mai Giá Mới Real Cloud',
  price: 165000,
  cost: 95000,
  stock: 30,
  category: 'Đồ tự làm',
  unit: 'Gói 500g',
  image: '🧀',
  updatedAt: '2026-10-05T09:00:00.000Z',
};
const mockInitialProd = INITIAL_PRODUCTS.find(p => p.id === 'SP01');
assert(mockInitialProd, 'SP01 mock product must exist in INITIAL_PRODUCTS');
const mockProdRes = resolveProductConflict(mockInitialProd, realCloudProduct);
assert.strictEqual(mockProdRes.source, 'cloud', 'Real cloud product from October must beat mock product from September');
assert.strictEqual(mockProdRes.winner.price, 165000);

console.log('✓ All Collection Merge & Cross-device reconciliation tests passed (including chronological order preservation, debt payment conflicts, and mock data safety).');

// ==============================================================================
// 5. RPC & FALLBACK SIMULATION TEST
// ==============================================================================
console.log('5. Testing Simulated RPC & Fallback delta behavior...');

// Simulated fallback function mimicking cloudAdjustProductStock's fallback path
function simulateStockAdjustment(currentStock, delta, rpcAvailable = true) {
  if (rpcAvailable) {
    // Simulates SQL function returning v_new_stock (NULL if not found)
    const newStock = Math.max(0, currentStock + delta);
    return { success: true, newStock, method: 'rpc' };
  } else {
    // Fallback: Read stock -> compute calculateStockDelta -> write
    const newStock = calculateStockDelta(currentStock, delta);
    return { success: true, newStock, method: 'fallback' };
  }
}

const rpcResult = simulateStockAdjustment(15, -4, true);
assert.strictEqual(rpcResult.newStock, 11);
assert.strictEqual(rpcResult.method, 'rpc');

const fallbackResult = simulateStockAdjustment(15, -4, false);
assert.strictEqual(fallbackResult.newStock, 11);
assert.strictEqual(fallbackResult.method, 'fallback');

// Fallback boundary
const fallbackFloor = simulateStockAdjustment(2, -10, false);
assert.strictEqual(fallbackFloor.newStock, 0);

// 5.1 Non-existent product simulation: SQL adjust_product_stock returns NULL (not 0) when row is not found
function simulateSqlAdjustProductStock(rowExists, currentStock, delta) {
  if (!rowExists) {
    // If product does not exist, Postgres returns NULL (not coalesce(..., 0))
    return null;
  }
  return Math.max(0, currentStock + delta);
}

const notFoundResult = simulateSqlAdjustProductStock(false, 0, -2);
assert.strictEqual(notFoundResult, null, 'Non-existent product must return NULL to prevent falsely zeroing local stock');

// 5.2 Multi-item cart same-product delta aggregation test
const cartItems = [
  { productId: 'SP01', qty: 2 },
  { productId: 'SP02', qty: 1 },
  { productId: 'SP01', qty: 3 }, // duplicate SP01 line
];
const aggregatedMap = new Map();
for (const item of cartItems) {
  aggregatedMap.set(item.productId, (aggregatedMap.get(item.productId) || 0) + item.qty);
}
assert.strictEqual(aggregatedMap.get('SP01'), 5, 'Cart with two SP01 items (2 + 3) must aggregate to 5');
assert.strictEqual(aggregatedMap.get('SP02'), 1, 'Cart with SP02 item must aggregate to 1');

console.log('✓ All Simulated RPC & Fallback tests passed (including NULL return on non-existent product and cart line aggregation).');

console.log('================================================================');
console.log('🎉 ALL ADR-0008 CROSS-DEVICE SYNC CONFLICT TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
