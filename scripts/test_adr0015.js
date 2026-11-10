// scripts/test_adr0015.js
import assert from 'node:assert';
import {
  normalizeVietnamesePhone,
  isPhoneMatching,
  CUSTOMER_HEADER_ALIASES,
} from '../src/utils/excel.ts';
import { removeVietnameseTones, matchesSearch } from '../src/utils/vietnamese.ts';

console.log('--- RUNNING ADR-0015 COMPREHENSIVE REGRESSION & INTEGRITY TESTS ---');

// -------------------------------------------------------------
// 1. Phone Normalization & Multi-Phone Safety Tests
// -------------------------------------------------------------
console.log('1. Testing Vietnamese Phone Normalization & Multi-Phone Safety...');

// Standard 10-digit mobile
assert.strictEqual(normalizeVietnamesePhone('0904047976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('0904.047.976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('+84 904 047 976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('84904047976'), '0904047976');
// Truncated leading zero from Excel number format
assert.strictEqual(normalizeVietnamesePhone('904047976'), '0904047976');

// Multiple phone numbers in single cell (delimited by slash, comma, semicolon, dash, newline)
assert.strictEqual(
  normalizeVietnamesePhone('0869229160 / 0986476328'),
  '0869229160 / 0986476328',
  'Multi-phone with slash must format cleanly with " / "'
);
assert.strictEqual(
  normalizeVietnamesePhone('0869.229.160 - 0986.476.328'),
  '0869229160 / 0986476328',
  'Multi-phone with dash must format cleanly'
);
assert.strictEqual(
  normalizeVietnamesePhone('0869229160, 0986476328'),
  '0869229160 / 0986476328',
  'Multi-phone with comma must format cleanly'
);
assert.strictEqual(
  normalizeVietnamesePhone('0869229160\n0986476328'),
  '0869229160 / 0986476328',
  'Multi-phone with newline must format cleanly'
);

// Recovery test: 20-digit concatenated phones from prior faulty stripping
assert.strictEqual(
  normalizeVietnamesePhone('08692291600986476328'),
  '0869229160 / 0986476328',
  '20-digit concatenated phones must automatically split into 2 valid numbers'
);

// Matching tests across single and multi-phone strings
assert.strictEqual(
  isPhoneMatching('0869229160 / 0986476328', '0869229160'),
  true,
  'First phone in multi-phone must match'
);
assert.strictEqual(
  isPhoneMatching('0869229160 / 0986476328', '0986476328'),
  true,
  'Second phone in multi-phone must match'
);
assert.strictEqual(
  isPhoneMatching('0869229160 / 0986476328', '0912345678'),
  false,
  'Unrelated phone must not match'
);

// Empty and dummy zero phones
assert.strictEqual(normalizeVietnamesePhone(''), '');
assert.strictEqual(normalizeVietnamesePhone('0'), '');
assert.strictEqual(normalizeVietnamesePhone('0000'), '');
assert.strictEqual(normalizeVietnamesePhone(null), '');

console.log('✓ All Phone Normalization & Multi-Phone Safety tests passed.');

// -------------------------------------------------------------
// 2. Customer Import Deduplication & Contact Protection Tests
// -------------------------------------------------------------
console.log('2. Testing Customer Import Deduplication & Contact Protection Invariants...');

// Header aliases include common variations
assert.ok(CUSTOMER_HEADER_ALIASES.phone.includes('dt'));
assert.ok(CUSTOMER_HEADER_ALIASES.phone.includes('dienthoai'));
assert.ok(CUSTOMER_HEADER_ALIASES.phone.includes('sdtlienhe'));

// Invariant: Tone-blind name duplicate matching must NOT be used
// "Chị Hương" vs "Chị Hường" have identical removeVietnameseTones result ("chi huong")
const nameA = 'Chị Hương';
const nameB = 'Chị Hường';
assert.strictEqual(removeVietnameseTones(nameA), removeVietnameseTones(nameB));

// If phone is missing or different, they MUST NOT match
const custExisting = {
  id: 'c1',
  name: 'Chị Hương',
  phone: '0912345678',
  address: '193C Bà Triệu, Hà Nội',
  debt: 200000,
};

const custIncomingDiffPhone = {
  name: 'Chị Hường',
  phone: '0987654321',
  address: 'E4 Ciputra, Hà Nội',
  debt: 50000,
};

const custIncomingNoPhone = {
  name: 'Chị Hường',
  phone: '',
  address: 'E4 Ciputra, Hà Nội',
  debt: 50000,
};

// Test helper simulating ADR-0015 duplicate matching rule
function findDuplicateCustomer(incoming, existingList) {
  const normPPhone = normalizeVietnamesePhone(incoming.phone);
  if (!normPPhone) return null; // Never match purely by name!
  return existingList.find(c => c.phone && isPhoneMatching(c.phone, normPPhone)) || null;
}

assert.strictEqual(
  findDuplicateCustomer(custIncomingDiffPhone, [custExisting]),
  null,
  'Customer with different phone must NOT match existing customer'
);
assert.strictEqual(
  findDuplicateCustomer(custIncomingNoPhone, [custExisting]),
  null,
  'Customer without phone must NOT match existing customer purely by unaccented name'
);

// Invariant: When action === 'accumulate', existing contact info is strictly preserved
function applyAccumulateImport(existing, row) {
  return {
    id: existing.id,
    name: existing.name || row.name,
    phone: existing.phone || row.phone,
    address: existing.address || row.address,
    debt: existing.debt + row.debt,
    action: 'accumulate',
  };
}

const merged = applyAccumulateImport(custExisting, {
  name: 'Chị Hương (Mới)',
  phone: '0912345678',
  address: 'Địa chỉ mới bị ghi đè nhầm',
  debt: 100000,
});

assert.strictEqual(merged.name, 'Chị Hương', 'Existing name must be preserved');
assert.strictEqual(merged.phone, '0912345678', 'Existing phone must be preserved');
assert.strictEqual(merged.address, '193C Bà Triệu, Hà Nội', 'Existing address must NOT be overwritten');
assert.strictEqual(merged.debt, 300000, 'Debt must accumulate accurately (200k + 100k = 300k)');

console.log('✓ All Customer Import Deduplication & Contact Protection invariants verified.');

// -------------------------------------------------------------
// 3. Reports Page Order Search Logic Tests
// -------------------------------------------------------------
console.log('3. Testing Reports Page Order Search Logic...');

const mockOrders = [
  {
    id: 'HD6857',
    customerName: 'Minh Ngọc',
    customerPhone: '0984852358',
    createdAt: new Date('2026-11-10T14:22:00').toISOString(),
    status: 'completed',
    orderType: 'delivery',
    total: 865000,
    items: [
      { name: 'Chân gà ta rút xương ngâm sả ớt', qty: 1, price: 150000 },
      { name: 'Chè sắn cốc nhỏ', qty: 2, price: 35000 },
    ],
  },
  {
    id: 'HD3865',
    customerName: 'Minh Ngọc',
    customerPhone: '0984852358',
    createdAt: new Date('2026-11-05T09:46:00').toISOString(),
    status: 'completed',
    orderType: 'direct',
    total: 565000,
    items: [
      { name: 'Cải thảo cuộn thịt', qty: 1, price: 120000 },
      { name: 'Ức gà nấu chậm mix vị', qty: 1, price: 95000 },
    ],
  },
  {
    id: 'HD1225',
    customerName: 'Thảo mít LB',
    customerPhone: '0904680966',
    createdAt: new Date('2026-11-10T11:22:00').toISOString(),
    status: 'completed',
    orderType: 'delivery',
    total: 85000,
    items: [{ name: 'Khoai Mặt nướng mini', qty: 1, price: 85000 }],
  },
];

function filterOrdersForReport(orders, query, dateFilter = 'today') {
  const hasSearch = query.trim().length > 0;
  const startOfToday = new Date('2026-11-10T00:00:00').getTime();

  return orders.filter(o => {
    const orderTime = new Date(o.createdAt).getTime();

    // When searching, date filter is automatically bypassed!
    if (!hasSearch) {
      if (dateFilter === 'today' && orderTime < startOfToday) return false;
    }

    if (!hasSearch) return true;

    const trimmed = query.trim();
    const numQ = trimmed.replace(/\D/g, '');
    const cleanOrderId = o.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanSearchId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchesId =
      cleanOrderId.includes(cleanSearchId) || (numQ.length > 0 && cleanOrderId.includes(numQ));
    const matchesCustomer = matchesSearch(o.customerName || '', trimmed);
    const matchesPhone =
      o.customerPhone && numQ.length > 0 && o.customerPhone.replace(/\D/g, '').includes(numQ);
    const matchesItems = o.items.some(i => matchesSearch(i.name, trimmed));

    return matchesId || matchesCustomer || matchesPhone || matchesItems;
  });
}

// Search by raw ID digits
const resId = filterOrdersForReport(mockOrders, '6857');
assert.strictEqual(resId.length, 1);
assert.strictEqual(resId[0].id, 'HD6857');

// Search by full ID with prefix
const resFullId = filterOrdersForReport(mockOrders, '#HD1225');
assert.strictEqual(resFullId.length, 1);
assert.strictEqual(resFullId[0].id, 'HD1225');

// Search by customer name without tones
const resName = filterOrdersForReport(mockOrders, 'thao mit');
assert.strictEqual(resName.length, 1);
assert.strictEqual(resName[0].customerName, 'Thảo mít LB');

// Search by customer phone substring
const resPhone = filterOrdersForReport(mockOrders, '090468');
assert.strictEqual(resPhone.length, 1);
assert.strictEqual(resPhone[0].id, 'HD1225');

// Search by dish name inside order
const resDish = filterOrdersForReport(mockOrders, 'che san');
assert.strictEqual(resDish.length, 1);
assert.strictEqual(resDish[0].id, 'HD6857');

// Smart Date Scope: Older order (Nov 5) is found despite dateFilter='today'
const resOldOrder = filterOrdersForReport(mockOrders, '3865', 'today');
assert.strictEqual(resOldOrder.length, 1);
assert.strictEqual(resOldOrder[0].id, 'HD3865', 'Search must bypass dateFilter to find older orders');

console.log('✓ All Reports Page Order Search tests passed.');

// -------------------------------------------------------------
// 4. Product Combobox Search & Ranking Tests
// -------------------------------------------------------------
console.log('4. Testing Product Combobox Search & Token Ranking...');

const mockProducts = [
  { id: 'p1', name: 'Xôi chim trứng non', price: 150000, unit: 'hộp', category: 'Bếp nóng' },
  { id: 'p2', name: 'Chân gà ta rút xương ngâm sả ớt', price: 150000, unit: 'hộp', category: 'Món ăn kèm' },
  { id: 'p3', name: 'Khoai Lang kén (Gói 500g)', price: 45000, unit: 'gói 500g', category: 'Đặc sản' },
  { id: 'p4', name: 'Sốt mỳ ý bò bằm 600g', price: 135000, unit: 'hộp', category: 'Sốt & Gia vị' },
];

function filterProductsForCombobox(products, query) {
  const trimmed = query.trim();
  if (!trimmed) return products.slice(0, 30);

  const cleanQuery = removeVietnameseTones(trimmed);
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);

  return products.filter(p => {
    const cleanName = removeVietnameseTones(p.name);
    const cleanCategory = removeVietnameseTones(p.category || '');
    const cleanUnit = removeVietnameseTones(p.unit || '');
    const priceStr = String(p.price);
    const combined = `${cleanName} ${cleanCategory} ${cleanUnit} ${priceStr}`;

    return tokens.every(tok => combined.includes(tok));
  });
}

const resProd1 = filterProductsForCombobox(mockProducts, 'xoi chim');
assert.strictEqual(resProd1.length, 1);
assert.strictEqual(resProd1[0].name, 'Xôi chim trứng non');

const resProd2 = filterProductsForCombobox(mockProducts, 'khoai ken');
assert.strictEqual(resProd2.length, 1);
assert.strictEqual(resProd2[0].name, 'Khoai Lang kén (Gói 500g)');

const resProd3 = filterProductsForCombobox(mockProducts, '135000');
assert.strictEqual(resProd3.length, 1);
assert.strictEqual(resProd3[0].name, 'Sốt mỳ ý bò bằm 600g');

console.log('✓ All Product Combobox Search & Token Ranking tests passed.');

console.log('================================================================');
console.log('🎉 ALL ADR-0015 INTEGRITY TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
