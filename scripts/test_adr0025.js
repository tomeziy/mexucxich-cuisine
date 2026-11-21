/**
 * ADR-0025: Cloud-First POS, Zero-Config Devices, Dual-Role Auth & Supabase Auth/RLS Tests
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDefaultStoreAuthConfig,
  createDefaultAdminAuthConfig,
  verifyStoreCredentials,
  createStoreAuthSession,
  isStoreSessionValid,
  inferRoleFromUsernameOrMetadata,
  normalizeUsernameToEmail,
  hashStorePassword,
} from '../src/utils/auth.ts';
import { reconcileCloudAndLocalPullData } from '../src/services/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =========================================================================
// Block 1: Dual-Role Auth (`mexucxich` Owner + `admin` Admin + Staff)
// =========================================================================
{
  const ownerCfg = createDefaultStoreAuthConfig();
  const adminCfg = createDefaultAdminAuthConfig();

  assert.equal(ownerCfg.requireSignIn, true);
  assert.equal(ownerCfg.username, 'mexucxich');
  assert.equal(verifyStoreCredentials('mexucxich', 'mexucxich123', ownerCfg), true);
  assert.equal(verifyStoreCredentials('hang', 'mexucxich123', ownerCfg), true);
  assert.equal(verifyStoreCredentials('admin', 'admin2026', ownerCfg), false);

  assert.equal(adminCfg.username, 'admin');
  assert.equal(verifyStoreCredentials('admin', 'admin2026', adminCfg), true);
  assert.equal(verifyStoreCredentials('tung', 'admin2026', adminCfg), true);
  assert.equal(verifyStoreCredentials('mexucxich', 'mexucxich123', adminCfg), false);

  assert.equal(inferRoleFromUsernameOrMetadata('mexucxich'), 'owner');
  assert.equal(inferRoleFromUsernameOrMetadata('hang'), 'owner');
  assert.equal(inferRoleFromUsernameOrMetadata('admin'), 'admin');
  assert.equal(inferRoleFromUsernameOrMetadata('tung'), 'admin');
  assert.equal(inferRoleFromUsernameOrMetadata('nhanvien1'), 'staff');
  assert.equal(inferRoleFromUsernameOrMetadata('nhanvien1', 'admin'), 'admin');

  assert.equal(normalizeUsernameToEmail('mexucxich'), 'mexucxich@mexucxich.pos');
  assert.equal(normalizeUsernameToEmail('admin'), 'admin@mexucxich.pos');

  const t0 = new Date('2026-11-22T01:00:00Z').getTime();
  const adminSession = createStoreAuthSession(adminCfg, t0);
  assert.equal(adminSession.role, 'admin');
  assert.equal(isStoreSessionValid(adminSession, ownerCfg, adminCfg, t0 + 1000), true);

  // Rotating owner password must invalidate owner sessions without logging out admin
  const rotatedOwner = {
    ...ownerCfg,
    passwordHash: hashStorePassword('mexucxich', 'rotatedPass99', ownerCfg.salt),
  };
  const ownerSession = createStoreAuthSession(ownerCfg, t0);
  assert.equal(isStoreSessionValid(ownerSession, rotatedOwner, adminCfg, t0 + 1000), false);
  assert.equal(isStoreSessionValid(adminSession, rotatedOwner, adminCfg, t0 + 1000), true);

  // Supabase Auth sourced session validates on TTL cleanly
  const supaSession = createStoreAuthSession(
    {
      username: 'mexucxich',
      email: 'mexucxich@mexucxich.pos',
      role: 'owner',
      authSource: 'supabase',
      sessionTtlDays: 30,
    },
    t0
  );
  assert.equal(isStoreSessionValid(supaSession, rotatedOwner, adminCfg, t0 + 1000), true);
  assert.equal(
    isStoreSessionValid(supaSession, rotatedOwner, adminCfg, t0 + 31 * 24 * 60 * 60 * 1000),
    false
  );

  console.log('PASS Block 1: Dual-role auth (`mexucxich` & `admin`) and Supabase Auth sessions verified.');
}

// =========================================================================
// Block 2: Cloud-First Pull Does Not Resurrect Deleted Products from Orders
// =========================================================================
{
  const cloudProducts = [
    { id: 'SP_LIVE_1', name: 'Xúc xích Heo', category: 'Đồ tự làm', unit: 'Gói', cost: 80000, price: 130000, stock: 10, image: '🌭' },
  ];
  const cloudOrders = [
    {
      id: 'HD_HIST_1',
      createdAt: '2026-11-10T10:00:00Z',
      customerId: 'KH01',
      customerName: 'Khách lẻ',
      orderType: 'direct',
      status: 'completed',
      items: [
        {
          productId: 'SP_DISCONTINUED_OLD',
          name: 'Món đã ngừng kinh doanh',
          unit: 'Hộp',
          price: 90000,
          cost: 50000,
          qty: 1,
          image: '🍢',
        },
      ],
      subtotal: 90000,
      discountType: 'cash',
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 90000,
      paymentMethod: 'cash',
      paidAmount: 90000,
      debtAmount: 0,
    },
  ];

  const pulled = reconcileCloudAndLocalPullData({
    cloudProductsRaw: cloudProducts,
    cloudCustomersRaw: [],
    cloudOrdersRaw: cloudOrders,
    cloudDebtPaymentsRaw: [],
    cloudHasExtraAddressesCol: true,
    cloudTombstones: {
      deletedProductIds: [],
      deletedOrderIds: [],
      deletedCustomerIds: [],
      updatedAt: '2026-11-22T00:00:00Z',
    },
    localData: {
      products: [],
      customers: [],
      orders: [],
      debtPayments: [],
      dirtyProductIds: [],
      dirtyOrderIds: [],
      dirtyCustomerIds: [],
    },
  });

  assert.deepEqual(
    pulled.products.map(p => p.id),
    ['SP_LIVE_1'],
    'Cloud-first pull must NOT resurrect discontinued historical order dishes into active catalog when Cloud catalog is populated'
  );
  console.log('PASS Block 2: Cloud-first pull catalog integrity verified.');
}

// =========================================================================
// Block 3: Zero-Config Settings UI, AuthGate, Edge Function, SQL & Docs
// =========================================================================
{
  const settingsSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/pages/SettingsPage.tsx'), 'utf8');
  for (const forbidden of [
    'Supabase Project URL',
    'Anon Public Key',
    'Kiểm tra kết nối',
    'Lưu cấu hình',
    'Đẩy lên Cloud',
    'Tải từ Cloud về',
    'Khôi phục Hầm Cứu Hộ',
    'Đặt lại dữ liệu mẫu',
  ]) {
    assert.ok(!settingsSrc.includes(forbidden), `SettingsPage.tsx must NOT expose "${forbidden}"`);
  }
  for (const required of [
    'Xuất file Sao lưu (JSON)',
    'Nhập file Sao lưu (JSON)',
    'changeOwnPassword',
    'adminManageStoreUser',
    'isAdmin &&',
  ]) {
    assert.ok(settingsSrc.includes(required), `SettingsPage.tsx missing "${required}"`);
  }

  const layoutSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/components/layout/Layout.tsx'), 'utf8');
  assert.ok(layoutSrc.includes('!isMandatoryLock'), 'Layout.tsx must hide POS routes while unauthenticated');

  const storeSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/context/StoreContext.tsx'), 'utf8');
  assert.ok(!storeSrc.includes('loadVaultSnapshot(EMERGENCY_VAULT_KEY)'), 'StoreContext must NOT auto-recover Emergency Vault on boot');
  assert.ok(storeSrc.includes('signInWithSupabaseUsernamePassword'), 'StoreContext must support real Supabase Auth');
  assert.ok(storeSrc.includes('adminManageStoreUser'), 'StoreContext must expose adminManageStoreUser');

  const supaSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/services/supabase.ts'), 'utf8');
  assert.ok(supaSrc.includes('persistSession: hasWindowStorage'), 'supabase.ts must enable browser session persistence');
  assert.ok(supaSrc.includes('adminCreateOrUpdateStoreUser'), 'supabase.ts must call create-store-user Edge Function');

  const edgeFnPath = path.join(PROJECT_ROOT, 'supabase/functions/create-store-user/index.ts');
  assert.ok(fs.existsSync(edgeFnPath), 'Edge Function create-store-user/index.ts must exist');
  const edgeFnSrc = fs.readFileSync(edgeFnPath, 'utf8');
  assert.ok(edgeFnSrc.includes('auth.admin.createUser'), 'Edge Function must use auth.admin.createUser');
  assert.ok(edgeFnSrc.includes('isAdminUser'), 'Edge Function must verify admin caller role');

  const sqlSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase_schema.sql'), 'utf8');
  assert.ok(sqlSrc.includes('to authenticated'), 'supabase_schema.sql must enforce authenticated RLS');
  assert.ok(sqlSrc.includes('mexucxich@mexucxich.pos'), 'supabase_schema.sql must seed mexucxich owner');
  assert.ok(sqlSrc.includes('admin@mexucxich.pos'), 'supabase_schema.sql must seed admin user');
  assert.ok(sqlSrc.includes('supabase_realtime'), 'supabase_schema.sql must add tables to supabase_realtime');

  const glossarySrc = fs.readFileSync(path.join(PROJECT_ROOT, 'GLOSSARY.md'), 'utf8');
  assert.ok(glossarySrc.includes('**Cloud-First POS**'), 'GLOSSARY.md must define Cloud-First POS');
  assert.ok(glossarySrc.includes('**Offline Outbox**'), 'GLOSSARY.md must define Offline Outbox');
  assert.ok(glossarySrc.includes('**Store Account**'), 'GLOSSARY.md must define Store Account');

  const adr25Path = path.join(PROJECT_ROOT, 'docs/adr/0025-cloud-first-pos-zero-config-and-supabase-auth-rls.md');
  assert.ok(fs.existsSync(adr25Path), 'ADR-0025 markdown doc must exist');

  console.log('PASS Block 3: Zero-config Settings UI, Layout auth lock, Edge Function, SQL & Docs verified.');
}

// =========================================================================
// Block 4: Outbox & Cloud Tombstone Ledger Regression Guards
// =========================================================================
{
  const storeSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/context/StoreContext.tsx'), 'utf8');

  // Regression guard: CloudTombstoneLedger customer IDs must NEVER be added to pending-delete outbox
  assert.ok(
    !storeSrc.includes('addPendingDeletedCustomerIds(pullRes.cloudTombstones.deletedCustomerIds)'),
    'StoreContext must NOT put pullRes.cloudTombstones.deletedCustomerIds into pending delete outbox'
  );
  assert.ok(
    storeSrc.includes("PURGED_CUSTOMERS: 'mxc_purged_customer_ids_v1'"),
    'StoreContext must track absorbed Cloud customer tombstones in PURGED_CUSTOMERS separately from pending outbox'
  );
  assert.ok(
    storeSrc.includes('addPurgedCustomerIds(pullRes.cloudTombstones.deletedCustomerIds)'),
    'StoreContext must store absorbed Cloud customer tombstones in PURGED_CUSTOMERS'
  );
  assert.ok(
    storeSrc.includes('migrateDemoOutboxTombstones()'),
    'StoreContext must migrate legacy demo customer IDs (KH02-KH04) out of pending delete outbox on startup'
  );
  assert.ok(
    storeSrc.includes('await Promise.all(pushTasks)'),
    'StoreContext runPull must await all outbox pushTasks before clearing isCloudSyncing and refreshing outbox count'
  );
  assert.ok(
    storeSrc.includes('clearDirtyProductIds(') &&
      storeSrc.includes('clearDirtyOrderIds(') &&
      storeSrc.includes('clearDirtyCustomerIds(') &&
      storeSrc.includes('clearPendingDeletedCustomerIds('),
    'StoreContext must refresh outbox count whenever async Cloud syncs/deletes clear dirty or pending-delete IDs'
  );
  assert.ok(
    storeSrc.includes('removeDirtyCustomerIds(demoDirtyCusts)') &&
      storeSrc.includes('removeDirtyProductIds(demoDirtyProds)'),
    'migrateDemoOutboxTombstones() must also scrub demo IDs from DIRTY_CUSTOMERS and DIRTY_PRODUCTS'
  );
  assert.ok(
    storeSrc.includes("pullRes.cloudRaw?.cloudCustomersOk !== false") &&
      storeSrc.includes('existingProdIds.has(a.productId)') &&
      storeSrc.includes('filterUnmodifiedDirtyIds('),
    'StoreContext must guard tombstone confirmation on cloudCustomersOk, skip unknown products in applyStockAdjustments, and protect newer dirty epochs from stale async clears'
  );

  console.log('PASS Block 4: Outbox & Cloud Tombstone Ledger regression guards verified.');
}

console.log('ALL ADR-0025 TESTS PASSED.');
