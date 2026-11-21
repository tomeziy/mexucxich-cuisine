/**
 * ADR-0024: Smart Excel/JSON Import Reconciliation, Auth Gate & Realtime Sync Tests
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeProductImportRows,
  buildProductImportPlan,
  analyzeCustomerImportRows,
  buildCustomerImportPlan,
  analyzeOrderImportRows,
} from '../src/utils/importReconciler.ts';
import {
  PRODUCT_HEADER_ALIASES,
  normalizeHeaderKey,
  parseOrderItemsString,
} from '../src/utils/excel.ts';
import {
  hashStorePassword,
  createDefaultStoreAuthConfig,
  createDefaultAdminAuthConfig,
  verifyStoreCredentials,
  createStoreAuthSession,
  isStoreSessionValid,
  normalizeUsernameToEmail,
} from '../src/utils/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =========================================================================
// Block 1: Product Excel Import Diffing & Batch Execution Plan
// =========================================================================
{
  const existingProducts = [
    {
      id: 'SP_1',
      name: 'Xúc xích Đức',
      category: 'Đồ tự làm',
      unit: 'Gói 500g',
      cost: 80000,
      price: 130000,
      stock: 15,
      image: '🌭',
    },
    {
      id: 'SP_2',
      name: 'Bánh mì bơ tỏi',
      category: 'Ăn vặt & Khô',
      unit: 'Gói',
      cost: 20000,
      price: 35000,
      stock: 10,
      image: '🥖',
    },
    {
      id: 'SP_3',
      name: 'Món sắp ngừng bán',
      category: 'Đồ tự làm',
      unit: 'Hộp',
      cost: 50000,
      price: 90000,
      stock: 4,
      image: '🍢',
    },
  ];

  const parsedExcelRows = [
    // Identical to SP_1 -> must default to 'skip' (NO stock doubling!)
    {
      name: 'Xúc xích Đức',
      category: 'Đồ tự làm',
      unit: 'Gói 500g',
      cost: 80000,
      price: 130000,
      stock: 15,
      image: '🌭',
    },
    // Same stock (10), changed price & unit -> must default to 'update_info'
    {
      name: 'Bánh mì bơ tỏi',
      category: 'Ăn vặt & Khô',
      unit: 'Hộp',
      cost: 22000,
      price: 42000,
      stock: 10,
      image: '🥖',
    },
    // Brand new item -> must default to 'create'
    {
      name: 'Lạp xưởng tươi',
      category: 'Đồ tự làm',
      unit: 'Gói 500g',
      cost: 95000,
      price: 145000,
      stock: 12,
      image: '🌭',
    },
  ];

  const { rows, missingFromFile } = analyzeProductImportRows(parsedExcelRows, existingProducts, 1000);
  assert.equal(rows.length, 3);

  const row1 = rows.find(r => r.name === 'Xúc xích Đức');
  assert.ok(row1);
  assert.equal(row1.diffStatus, 'identical');
  assert.equal(row1.recommendedAction, 'skip');
  assert.equal(row1.action, 'skip');
  assert.equal(row1.diffs.length, 0);

  const row2 = rows.find(r => r.name === 'Bánh mì bơ tỏi');
  assert.ok(row2);
  assert.equal(row2.diffStatus, 'info_changed');
  assert.equal(row2.recommendedAction, 'update_info');
  assert.equal(row2.action, 'update_info');
  assert.ok(row2.diffs.some(d => d.field === 'price' && d.oldValue === 35000 && d.newValue === 42000));
  assert.ok(row2.diffs.some(d => d.field === 'unit' && d.oldValue === 'Gói' && d.newValue === 'Hộp'));

  const row3 = rows.find(r => r.name === 'Lạp xưởng tươi');
  assert.ok(row3);
  assert.equal(row3.diffStatus, 'new');
  assert.equal(row3.recommendedAction, 'create');

  // SP_3 is absent from Excel file -> captured in missingFromFile defaulting to 'keep'
  assert.equal(missingFromFile.length, 1);
  assert.equal(missingFromFile[0].product.id, 'SP_3');
  assert.equal(missingFromFile[0].action, 'keep');

  // Test 'accumulate' preserves existing price/cost/unit while summing stock, and selective deletion
  const adjustedRows = rows.map(r =>
    r.existingProduct?.id === 'SP_2'
      ? { ...r, price: 999000, action: 'accumulate' }
      : r
  );
  const adjustedMissing = missingFromFile.map(m => ({ ...m, action: 'delete' }));
  const plan = buildProductImportPlan(adjustedRows, adjustedMissing);

  assert.equal(plan.counts.skipped, 1, 'Identical row SP_1 skipped');
  assert.equal(plan.counts.created, 1, 'New product created');
  assert.equal(plan.counts.updated, 1, 'SP_2 updated');
  assert.equal(plan.counts.deleted, 1, 'Missing SP_3 marked for delete');
  assert.deepEqual(plan.productIdsToDelete, ['SP_3']);

  const sp2Update = plan.productUpdates.find(u => u.id === 'SP_2');
  assert.ok(sp2Update);
  assert.equal(sp2Update.data.stock, 20, 'accumulate adds 10 + 10 = 20 stock');
  assert.equal(sp2Update.data.price, 35000, 'accumulate MUST preserve existing price 35000');
  assert.equal(sp2Update.data.unit, 'Gói', 'accumulate MUST preserve existing unit');

  // Verify default plan preserves stock without doubling & updates only info_changed
  const defaultPlan = buildProductImportPlan(rows, missingFromFile);
  assert.equal(defaultPlan.counts.skipped, 1);
  assert.equal(defaultPlan.counts.deleted, 0);
  const sp2InfoUpdate = defaultPlan.productUpdates.find(u => u.id === 'SP_2');
  assert.equal(sp2InfoUpdate.data.stock, 10, 'update_info preserves existing stock 10');
  assert.equal(sp2InfoUpdate.data.price, 42000, 'update_info applies new price 42000');

  console.log('PASS Block 1: Product Excel reconciliation, skip-on-identical, accumulate safety & missing detection verified.');
}

// =========================================================================
// Block 2: Customer Excel Import Diffing & Batch Execution Plan
// =========================================================================
{
  const existingCustomers = [
    {
      id: 'KH_1',
      name: 'Chị Lan',
      phone: '0901112222',
      address: '12 Đội Cấn',
      debt: 150000,
    },
    {
      id: 'KH_2',
      name: 'Anh Minh',
      phone: '0988777666',
      address: '50 Kim Mã',
      debt: 50000,
    },
    {
      id: 'KH_3',
      name: 'Ayse Nguyen',
      phone: '0988092918',
      address: '2 Lê Duẩn',
      debt: 130000,
    },
  ];

  const parsedCustomers = [
    // Identical re-import of KH_1 -> must default to 'skip' (no debt doubling!)
    {
      name: 'Chị Lan',
      phone: '0901112222',
      address: '12 Đội Cấn',
      debt: 150000,
    },
    // KH_2 has new phone2 and new extra address, with same debt (50000) -> 'enrich_contact' -> 'merge_info'
    {
      name: 'Anh Minh',
      phone: '0988777666',
      phone2: '0911222333',
      address: '50 Kim Mã',
      extraAddresses: ['99 Xuân Thủy'],
      debt: 50000,
    },
    // Phone match with differing debt -> 'conflict' -> 'overwrite' with diff
    {
      name: 'Chị Lan',
      phone: '0901112222',
      address: '12 Đội Cấn',
      debt: 220000,
    },
    // Same name 'Ayse Nguyen' with DIFFERENT phone -> matchType: 'name_only' & 'skip'
    {
      name: 'Ayse Nguyen',
      phone: '0977555444',
      address: '88 Cầu Giấy',
      debt: 0,
    },
    // Brand new customer
    {
      name: 'Khách Mới Tinh',
      phone: '0966333222',
      address: '1 Phố Huế',
      debt: 0,
    },
  ];

  const analyzed = analyzeCustomerImportRows(parsedCustomers, existingCustomers, 2000);
  assert.equal(analyzed.length, 5);

  // 1. Identical KH_1
  assert.equal(analyzed[0].diffStatus, 'identical');
  assert.equal(analyzed[0].recommendedAction, 'skip');
  assert.equal(analyzed[0].action, 'skip');

  // 2. Contact enrichment on KH_2
  assert.equal(analyzed[1].diffStatus, 'enrich_contact');
  assert.equal(analyzed[1].recommendedAction, 'merge_info');
  assert.ok(analyzed[1].diffs.some(d => d.field === 'phone2'));
  assert.ok(analyzed[1].diffs.some(d => d.field === 'extraAddresses'));

  // 3. Debt conflict
  assert.equal(analyzed[2].diffStatus, 'conflict');
  assert.ok(analyzed[2].diffs.some(d => d.field === 'debt' && d.oldValue === 150000 && d.newValue === 220000));

  // 4. Name-only collision
  assert.equal(analyzed[3].matchType, 'name_only');
  assert.equal(analyzed[3].diffStatus, 'conflict');
  assert.equal(analyzed[3].recommendedAction, 'skip');

  // 5. New customer
  assert.equal(analyzed[4].diffStatus, 'new');
  assert.equal(analyzed[4].recommendedAction, 'create');

  // Check plan execution on [identical, enrich, new] (excluding row 2 conflict overwrite test separately)
  const safePlan = buildCustomerImportPlan([analyzed[0], analyzed[1], analyzed[3], analyzed[4]]);
  assert.equal(safePlan.counts.skipped, 2, 'Identical KH_1 and name_only collision safely skipped');
  assert.equal(safePlan.counts.created, 1);
  assert.equal(safePlan.counts.updated, 1);

  const kh2Update = safePlan.customerUpdates.find(u => u.id === 'KH_2');
  assert.ok(kh2Update);
  assert.equal(kh2Update.data.debt, 50000, 'merge_info MUST preserve existing debt');
  assert.equal(kh2Update.data.phone2, '0911222333', 'merge_info adds secondary phone');
  assert.deepEqual(kh2Update.data.extraAddresses, ['99 Xuân Thủy']);

  console.log('PASS Block 2: Customer Excel reconciliation, enrich_contact, debt conflict & name_only detection verified.');
}

// =========================================================================
// Block 3: Order Excel Import Analysis
// =========================================================================
{
  const existingProducts = [
    { id: 'SP_1', name: 'Xúc xích Đức', category: 'Đồ tự làm', unit: 'Gói', cost: 80000, price: 130000, stock: 10, image: '🌭' },
  ];
  const existingOrders = [
    {
      id: 'HD1001',
      createdAt: '2026-11-20T09:00:00Z',
      customerId: 'KH_1',
      customerName: 'Chị Lan',
      orderType: 'delivery',
      status: 'completed',
      items: [{ productId: 'SP_1', name: 'Xúc xích Đức', unit: 'Gói', price: 130000, cost: 80000, qty: 1, image: '🌭' }],
      subtotal: 130000,
      discountType: 'cash',
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 130000,
      paymentMethod: 'cash',
      paidAmount: 130000,
      debtAmount: 0,
    },
    {
      id: 'HD1002',
      createdAt: '2026-11-20T10:00:00Z',
      customerId: 'KH_2',
      customerName: 'Anh Minh',
      orderType: 'direct',
      status: 'preparing',
      items: [{ productId: 'SP_1', name: 'Xúc xích Đức', unit: 'Gói', price: 130000, cost: 80000, qty: 2, image: '🌭' }],
      subtotal: 260000,
      discountType: 'cash',
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 260000,
      paymentMethod: 'debt',
      paidAmount: 0,
      debtAmount: 260000,
    },
  ];

  const parsedOrders = [
    // Identical HD1001
    { ...existingOrders[0] },
    // Conflict HD1002 (status completed, paid in full)
    { ...existingOrders[1], status: 'completed', paymentMethod: 'cash', paidAmount: 260000, debtAmount: 0 },
    // New HD1003 with missing dish 'Bò bít tết'
    {
      id: 'HD1003',
      createdAt: '2026-11-21T11:00:00Z',
      customerId: 'KH_3',
      customerName: 'Chị Hoa',
      orderType: 'direct',
      status: 'completed',
      items: [{ productId: 'X', name: 'Bò bít tết', unit: 'Phần', price: 180000, cost: 0, qty: 1, image: '🥩' }],
      subtotal: 180000,
      discountType: 'cash',
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 180000,
      paymentMethod: 'cash',
      paidAmount: 180000,
      debtAmount: 0,
    },
  ];

  const { rows, missingProductsCount } = analyzeOrderImportRows(parsedOrders, existingOrders, existingProducts);
  assert.equal(rows.length, 3);
  assert.equal(missingProductsCount, 1);

  assert.equal(rows[0].diffStatus, 'identical');
  assert.equal(rows[0].recommendedAction, 'skip');

  assert.equal(rows[1].diffStatus, 'conflict');
  assert.equal(rows[1].recommendedAction, 'overwrite');
  assert.ok(rows[1].diffs.some(d => d.field === 'status' && d.oldValue === 'preparing' && d.newValue === 'completed'));
  assert.ok(rows[1].diffs.some(d => d.field === 'paidAmount' && d.oldValue === 0 && d.newValue === 260000));

  assert.equal(rows[2].diffStatus, 'new');
  assert.equal(rows[2].recommendedAction, 'create');

  console.log('PASS Block 3: Order Excel conflict analysis verified.');
}

// =========================================================================
// Block 4: Store Auth Gate & Session Persistence
// =========================================================================
{
  const defaultCfg = createDefaultStoreAuthConfig();
  const defaultAdminCfg = createDefaultAdminAuthConfig();
  assert.equal(defaultCfg.requireSignIn, true, 'ADR-0025: requireSignIn defaults to true on unauthenticated devices');
  assert.equal(defaultCfg.username, 'mexucxich');
  assert.equal(defaultAdminCfg.username, 'admin');
  assert.equal(hashStorePassword('mexucxich', 'mexucxich123', 'mxc_salt_v1'), defaultCfg.passwordHash);
  assert.notEqual(hashStorePassword('mexucxich', 'wrongpass', 'mxc_salt_v1'), defaultCfg.passwordHash);

  assert.equal(verifyStoreCredentials('mexucxich', 'mexucxich123', defaultCfg), true);
  assert.equal(verifyStoreCredentials('MEXUCXICH@mexucxich.pos', 'mexucxich123', defaultCfg), true);
  assert.equal(verifyStoreCredentials('hang', 'mexucxich123', defaultCfg), true);
  assert.equal(verifyStoreCredentials('mexucxich', 'wrong', defaultCfg), false);
  assert.equal(verifyStoreCredentials('stranger', 'mexucxich123', defaultCfg), false);
  assert.equal(verifyStoreCredentials('admin', 'admin2026', defaultAdminCfg), true);

  const t0 = new Date('2026-11-21T10:00:00Z').getTime();
  const session = createStoreAuthSession(defaultCfg, t0);
  assert.equal(isStoreSessionValid(session, defaultCfg, defaultAdminCfg, t0 + 1000), true);

  // Expired after 31 days
  const tExpired = t0 + 31 * 24 * 60 * 60 * 1000;
  assert.equal(isStoreSessionValid(session, defaultCfg, defaultAdminCfg, tExpired), false);

  // Password change immediately invalidates prior session
  const rotatedCfg = {
    ...defaultCfg,
    passwordHash: hashStorePassword('mexucxich', 'newsecret2026', defaultCfg.salt),
  };
  assert.equal(isStoreSessionValid(session, rotatedCfg, defaultAdminCfg, t0 + 1000), false);

  assert.equal(normalizeUsernameToEmail('mexucxich'), 'mexucxich@mexucxich.pos');
  assert.equal(normalizeUsernameToEmail('hang'), 'mexucxich@mexucxich.pos');
  assert.equal(normalizeUsernameToEmail('admin'), 'admin@mexucxich.pos');
  assert.equal(normalizeUsernameToEmail('Hang@Gmail.com'), 'hang@gmail.com');

  console.log('PASS Block 4: Store auth password hashing, credential checks & session invalidation verified.');
}

// =========================================================================
// Block 5: Static Contract Assertions across Docs, UI & Cloud Services
// =========================================================================
{
  const mustExistAndContain = [
    [
      'docs/adr/0024-smart-import-reconciliation-auth-and-multidevice-sync.md',
      ['postgres_changes', 'signInWithPassword', 'reconcileCloudAndLocalPullData', 'store_auth_config_v1'],
    ],
    [
      'src/utils/importReconciler.ts',
      ['analyzeProductImportRows', 'buildProductImportPlan', 'analyzeCustomerImportRows', 'buildCustomerImportPlan', 'analyzeOrderImportRows'],
    ],
    [
      'src/utils/auth.ts',
      ['STORE_AUTH_CONFIG_ROW_ID', 'hashStorePassword', 'verifyStoreCredentials', 'createStoreAuthSession', 'isStoreSessionValid', 'normalizeUsernameToEmail'],
    ],
    [
      'src/components/auth/AuthGateModal.tsx',
      ['autoComplete="username"', 'autoComplete="current-password"', 'loginWithPassword'],
    ],
    [
      'src/pages/ProductsPage.tsx',
      ['analyzeProductImportRows', 'buildProductImportPlan', 'updateProductsBatch', 'deleteProductsBatch', 'Không có trong File'],
    ],
    [
      'src/pages/CustomersPage.tsx',
      ['analyzeCustomerImportRows', 'buildCustomerImportPlan', 'updateCustomersBatch', 'Xung đột Nợ / Tên'],
    ],
    [
      'src/pages/ReportsPage.tsx',
      ['analyzeOrderImportRows', 'isOrderImportModalOpen', 'overwriteOrderIds'],
    ],
    [
      'src/pages/SettingsPage.tsx',
      ['Tài khoản & Bảo mật đăng nhập', 'changeOwnPassword', 'logoutOrLockScreen', 'KIỂM TRA ĐỐI SOÁT'],
    ],
    [
      'src/components/layout/Navbar.tsx',
      ['Đăng xuất', 'pendingOutboxCount', 'currentUser'],
    ],
    [
      'src/context/StoreContext.tsx',
      ['subscribeToCloudRealtimeChanges', 'fetchStoreAuthConfig', 'pushStoreAuthConfig', 'updateProductsBatch', 'deleteProductsBatch', 'updateCustomersBatch', 'mutationEpochRef', 'commitCustomers', 'commitOrders', 'commitProducts'],
    ],
    [
      'src/components/pos/EditOrderModal.tsx',
      ['}, [order, isOpen]);'],
    ],
    [
      'src/services/supabase.ts',
      ['STORE_AUTH_CONFIG_ROW_ID', 'fetchStoreAuthConfig', 'pushStoreAuthConfig', 'subscribeToCloudRealtimeChanges'],
    ],
  ];

  for (const [relPath, tokens] of mustExistAndContain) {
    const absPath = path.join(PROJECT_ROOT, relPath);
    assert.ok(fs.existsSync(absPath), `Missing expected file: ${relPath}`);
    const content = fs.readFileSync(absPath, 'utf8');
    for (const token of tokens) {
      assert.ok(content.includes(token), `${relPath} missing contract token "${token}"`);
    }
  }

  console.log('PASS Block 5: All static integration contracts verified.');
}

// =========================================================================
// Block 6: Regression Tests for Export/Import Round-Trip & Indexed Scale
// =========================================================================
{
  // 1. Product export header aliases ('Giá Vốn (VNĐ)' & 'Giá Bán (VNĐ)') must resolve cleanly
  assert.ok(PRODUCT_HEADER_ALIASES.cost.includes(normalizeHeaderKey('Giá Vốn (VNĐ)')));
  assert.ok(PRODUCT_HEADER_ALIASES.price.includes(normalizeHeaderKey('Giá Bán (VNĐ)')));

  // 2. Identical phoneless customers (name_only match with 0 diffs) must classify as identical + skip
  const phonelessDirectory = [
    { id: 'KH_NL1', name: 'Nguyen thuy moj', phone: '', address: '12 Hàng Bông', debt: 0 },
    { id: 'KH_NL2', name: 'Khách lẻ tại quầy', phone: '', address: '', debt: 0 },
  ];
  const phonelessReimport = [
    { name: 'Nguyen thuy moj', phone: '', address: '12 Hàng Bông', debt: 0 },
    { name: 'Khách lẻ tại quầy', phone: '', address: '', debt: 0 },
  ];
  const phonelessAnalyzed = analyzeCustomerImportRows(phonelessReimport, phonelessDirectory, 3000);
  assert.equal(phonelessAnalyzed[0].diffStatus, 'identical');
  assert.equal(phonelessAnalyzed[0].recommendedAction, 'skip');
  assert.equal(phonelessAnalyzed[0].action, 'skip');
  assert.equal(phonelessAnalyzed[1].diffStatus, 'identical');
  assert.equal(phonelessAnalyzed[1].recommendedAction, 'skip');

  // 3. Scale performance benchmark: 3,200 customers vs 3,200 rows must finish well under 500ms
  const largeDir = Array.from({ length: 3200 }, (_, i) => ({
    id: `KH_${i}`,
    name: `Khách hàng ${i}`,
    phone: i % 5 === 0 ? '' : `09${String(10000000 + i).slice(0, 8)}`,
    address: `Số ${i} Phố Huế`,
    debt: i % 10 === 0 ? 50000 : 0,
  }));
  const largeImport = largeDir.map(c => ({
    name: c.name,
    phone: c.phone,
    address: c.address,
    debt: c.debt,
  }));
  const tStart = Date.now();
  const largeAnalyzed = analyzeCustomerImportRows(largeImport, largeDir, 4000);
  const elapsedMs = Date.now() - tStart;
  assert.equal(largeAnalyzed.length, 3200);
  assert.ok(largeAnalyzed.every(r => r.diffStatus === 'identical' && r.action === 'skip'));
  assert.ok(elapsedMs < 500, `Expected indexed 3200x3200 analysis < 500ms, got ${elapsedMs}ms`);

  // 4. Order items with commas or '+' inside dish names must NOT split prematurely
  const trickyItems =
    'Canh măng khô sườn, móng giò (x1 - 250.000đ), BB mix 2 bánh cút + 2 bánh muối (x1 - 80.000đ), Nem rán ăn vã (hộp 10c) (x2 - 100.000đ)';
  const parsedTricky = parseOrderItemsString(trickyItems);
  assert.equal(parsedTricky.length, 3, 'Must preserve commas and plus signs inside dish names');
  assert.equal(parsedTricky[0].name, 'Canh măng khô sườn, móng giò');
  assert.equal(parsedTricky[0].price, 250000);
  assert.equal(parsedTricky[1].name, 'BB mix 2 bánh cút + 2 bánh muối');
  assert.equal(parsedTricky[1].price, 80000);
  assert.equal(parsedTricky[2].name, 'Nem rán ăn vã (hộp 10c)');
  assert.equal(parsedTricky[2].qty, 2);

  console.log(`PASS Block 6: Excel round-trip & 3,200-customer indexed reconciliation (${elapsedMs}ms) verified.`);
}

console.log('ALL ADR-0024 TESTS PASSED.');
