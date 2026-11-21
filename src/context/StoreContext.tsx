import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Product, Customer, Order, DebtPayment, ReceiptSettings, OrderStatus, CloudConfig } from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEFAULT_RECEIPT_SETTINGS,
  DEMO_PRODUCT_IDS,
  DEMO_CUSTOMER_IDS,
} from '../data/initialData';
import {
  isGenericCustomerName,
  repairAndMigrateCustomers,
  splitCustomerByPhones,
  splitCustomerByAddresses,
  mergeCustomerGroupHelper,
  restoreCustomerFromOrderSnapshot,
  splitCustomerByHistoricalOrder,
  addSecondaryPhoneFromOrderHelper,
  addExtraAddressFromOrderHelper,
  analyzeDiscrepancyOrder,
  deleteCustomersBatchHelper,
  SentinelAcknowledgments,
  loadSentinelAcks,
  saveSentinelAcks,
  resetSentinelAcksStorage,
  loadPendingDeletedCustomerIds,
  addPendingDeletedCustomerIds,
  removePendingDeletedCustomerIds,
  filterOutDeletedCustomers,
  MigrationRepairResult,
} from '../utils/customerSentinel';
import { repairFusedPhonesBatch, repairCustomerFusedPhones } from '../utils/phoneRecovery';
import { convertAddressToExtraAddresses, normalizeAddressList } from '../utils/addressUtils';
import { extractMissingProductsFromOrders } from '../utils/excel';
import { removeVietnameseTones } from '../utils/vietnamese';
import {
  VaultSnapshot,
  BackupMetadata,
  saveVaultSnapshot,
  loadVaultSnapshot,
  listVaultBackups,
  EMERGENCY_VAULT_KEY,
} from '../utils/vault';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  hasActiveSupabaseAuthSession,
  ensureSupabaseJwtSession,
  saveLocalCredentialCache,
  clearLocalCredentialCache,
  cloudSyncProduct,
  cloudDeleteProduct,
  cloudDeleteProductsBatch,
  cloudSyncProductsBatch,
  cloudSyncCustomer,
  cloudDeleteCustomer,
  cloudDeleteCustomersBatch,
  cloudSyncCustomersBatch,
  cloudSyncOrder,
  cloudDeleteOrder,
  cloudDeleteOrdersBatch,
  cloudSyncOrdersBatch,
  cloudSyncDebtPayment,
  cloudSyncDebtPaymentsBatch,
  cloudSyncSettings,
  reconstructMissingProductsFromOrders,
  pushAllDataToCloud,
  pullAllDataFromCloud,
  reconcileCloudAndLocalPullData,
  pushCloudTombstones,
  cloudAdjustProductStock,
  cloudAdjustProductsStockBatch,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
  calculateStockDelta,
  getEntityTimestamp,
  applyCatalogAntiShrinkGuard,
  isCloudExtraAddressesUnsupported,
  subscribeCloudExtraAddressesSupport,
  fetchStoreAuthConfig,
  pushStoreAuthConfig,
  fetchAdminAuthConfig,
  pushAdminAuthConfig,
  signInWithSupabaseUsernamePassword,
  signOutSupabaseAuth,
  updateOwnSupabasePassword,
  adminCreateOrUpdateStoreUser,
  getSupabaseClient,
  subscribeToCloudRealtimeChanges,
} from '../services/supabase';
import {
  StoreRole,
  StoreAuthConfig,
  StoreAuthSession,
  LOCAL_AUTH_CONFIG_KEY,
  LOCAL_ADMIN_AUTH_CONFIG_KEY,
  LOCAL_AUTH_SESSION_KEY,
  createDefaultStoreAuthConfig,
  createDefaultAdminAuthConfig,
  hashStorePassword,
  verifyStoreCredentials,
  createStoreAuthSession,
  isStoreSessionValid,
  inferRoleFromUsernameOrMetadata,
  stripAuthEmailDomain,
} from '../utils/auth';

export { applyCatalogAntiShrinkGuard };

interface StoreContextType {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  receiptSettings: ReceiptSettings;
  cloudConfig: CloudConfig;
  cloudExtraAddressesPendingSync: boolean;
  isCloudSyncing: boolean;
  lastCloudSyncAt: string | null;
  cloudSyncError: string | null;
  pendingOutboxCount: number;
  sentinelAcks: SentinelAcknowledgments;
  authConfig: StoreAuthConfig;
  adminAuthConfig: StoreAuthConfig;
  currentUser: { username: string; role: StoreRole; authSource: 'supabase' | 'store_config' } | null;
  isAuthenticated: boolean;
  isScreenLocked: boolean;
  loginWithPassword: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutOrLockScreen: () => Promise<void>;
  updateAuthConfig: (patch: { requireSignIn?: boolean; newUsername?: string; newPassword?: string }) => Promise<boolean>;
  changeOwnPassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  adminManageStoreUser: (params: {
    username: string;
    password: string;
    role: StoreRole;
    mode?: 'create_or_update' | 'update_password';
  }) => Promise<{ success: boolean; message: string; needsEdgeDeploy?: boolean }>;
  addProduct: (product: Omit<Product, 'id'>) => Product;
  addProductsBatch: (products: Array<Omit<Product, 'id'>>) => Product[];
  updateProduct: (id: string, product: Partial<Product>) => void;
  updateProductsBatch: (updates: Array<{ id: string; data: Partial<Product> }>) => number;
  deleteProduct: (id: string) => void;
  deleteProductsBatch: (ids: string[]) => number;
  addCustomer: (customer: Omit<Customer, 'id' | 'debt' | 'totalSpent' | 'orderCount'>) => Customer;
  addCustomersBatch: (customers: Array<Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>>) => Customer[];
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  updateCustomersBatch: (updates: Array<{ id: string; data: Partial<Customer> }>) => number;
  deleteCustomer: (id: string) => void;
  deleteCustomersBatch: (ids: string[], options?: { onlySafe?: boolean }) => { deletedCount: number; skippedIds: string[] };
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrder: (orderId: string, updatedOrder: Order) => void;
  deleteOrder: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  payDebt: (customerId: string, amount: number, paymentMethod: 'cash' | 'transfer', note?: string) => void;
  updateReceiptSettings: (settings: Partial<ReceiptSettings>) => void;
  updateCloudConfig: (config: CloudConfig) => void;
  syncLocalToCloud: () => Promise<{ success: boolean; message: string }>;
  syncCloudToLocal: () => Promise<{ success: boolean; message: string }>;
  repairCustomerData: () => MigrationRepairResult;
  acceptRecoveredPhoneSplit: (customerId: string) => void;
  acceptAllPhoneSplitsBatch: (customerIds: string[]) => number;
  promoteMultiAddressToExtra: (customerId: string) => void;
  promoteMultiAddressesBatch: (customerIds: string[]) => number;
  splitCustomerRecord: (customerId: string, type: 'phone' | 'address') => void;
  mergeCustomerRecords: (primaryId: string, duplicateId: string) => void;
  mergeCustomerGroup: (primaryId: string, duplicateIds: string[]) => void;
  mergeDuplicateGroupsBatch: (groups: Array<{ primaryId: string; duplicateIds: string[] }>) => number;
  addCustomerSecondaryPhone: (customerId: string, phone: string) => boolean;
  addCustomerExtraAddress: (customerId: string, address: string) => boolean;
  applyDiscrepancyRecommendationsBatch: (items: Array<{ customerId: string; orderId: string }>) => { updatedCount: number; splitCount: number };
  acknowledgeSentinelItems: (type: keyof SentinelAcknowledgments, keys: string[]) => void;
  resetSentinelAcks: () => void;
  restoreCustomerFromOrder: (customerId: string, orderId: string) => { success: boolean; message: string };
  splitCustomerByHistoricalOrderRecord: (customerId: string, targetPhone: string) => void;
  restoreFromExcelOrders: (
    orders: Order[],
    options?: { overwriteOrderIds?: string[] }
  ) => { restoredOrdersCount: number; updatedOrdersCount: number; restoredProductsCount: number };
  restoreFromVault: (key?: string) => { success: boolean; message: string; restoredProducts: number; restoredOrders: number };
  getAvailableBackups: () => BackupMetadata[];
  resetToMockData: () => void;
  importAllData: (jsonData: any) => boolean;
  exportAllData: () => any;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PRODUCTS: 'mxc_products',
  CUSTOMERS: 'mxc_customers',
  ORDERS: 'mxc_orders',
  DEBT_PAYMENTS: 'mxc_debt_payments',
  SETTINGS: 'mxc_receipt_settings',
  ADR0020_PHONE_MIGRATION: 'mxc_adr0020_phone_repair_v1',
  ADR0023_CLOUD_TRUTH: 'mxc_adr0023_cloud_truth_v1',
  DELETED_PRODUCTS: 'mxc_deleted_product_ids_v1',
  PURGED_PRODUCTS: 'mxc_purged_product_ids_v1',
  DELETED_ORDERS: 'mxc_deleted_order_ids_v1',
  PURGED_ORDERS: 'mxc_purged_order_ids_v1',
  PURGED_CUSTOMERS: 'mxc_purged_customer_ids_v1',
  DIRTY_PRODUCTS: 'mxc_dirty_product_ids_v1',
  DIRTY_ORDERS: 'mxc_dirty_order_ids_v1',
  DIRTY_CUSTOMERS: 'mxc_dirty_customer_ids_v1',
};

function loadIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}

function appendIdsToKey(key: string, ids: string[]): void {
  if (!ids || ids.length === 0) return;
  const current = new Set(loadIdList(key));
  for (const id of ids) {
    if (id) current.add(id);
  }
  localStorage.setItem(key, JSON.stringify(Array.from(current)));
}

function removeIdsFromKey(key: string, ids: string[]): void {
  if (!ids || ids.length === 0) return;
  const toRemove = new Set(ids);
  const remaining = loadIdList(key).filter(id => !toRemove.has(id));
  if (remaining.length === 0) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(remaining));
  }
}

function loadPendingDeletedProductIds(): string[] {
  return loadIdList(STORAGE_KEYS.DELETED_PRODUCTS);
}

function loadPurgedProductIds(): string[] {
  return loadIdList(STORAGE_KEYS.PURGED_PRODUCTS);
}

function addPendingDeletedProductIds(ids: string[]): void {
  appendIdsToKey(STORAGE_KEYS.DELETED_PRODUCTS, ids);
  appendIdsToKey(STORAGE_KEYS.PURGED_PRODUCTS, ids);
}

function removePendingDeletedProductIds(ids: string[]): void {
  removeIdsFromKey(STORAGE_KEYS.DELETED_PRODUCTS, ids);
}

function loadPendingDeletedOrderIds(): string[] {
  return loadIdList(STORAGE_KEYS.DELETED_ORDERS);
}

function loadPurgedOrderIds(): string[] {
  return loadIdList(STORAGE_KEYS.PURGED_ORDERS);
}

function addPendingDeletedOrderIds(ids: string[]): void {
  appendIdsToKey(STORAGE_KEYS.DELETED_ORDERS, ids);
  appendIdsToKey(STORAGE_KEYS.PURGED_ORDERS, ids);
}

function removePendingDeletedOrderIds(ids: string[]): void {
  removeIdsFromKey(STORAGE_KEYS.DELETED_ORDERS, ids);
}

function loadPurgedCustomerIds(): string[] {
  return loadIdList(STORAGE_KEYS.PURGED_CUSTOMERS);
}

function addPurgedCustomerIds(ids: string[]): void {
  appendIdsToKey(STORAGE_KEYS.PURGED_CUSTOMERS, ids);
}

function migrateDemoOutboxTombstones(): void {
  const pendingCusts = loadPendingDeletedCustomerIds();
  const demoCusts = pendingCusts.filter(id => DEMO_CUSTOMER_IDS.has(id));
  if (demoCusts.length > 0) {
    addPurgedCustomerIds(demoCusts);
    removePendingDeletedCustomerIds(demoCusts);
  }
  const pendingProds = loadPendingDeletedProductIds();
  const demoProds = pendingProds.filter(id => DEMO_PRODUCT_IDS.has(id));
  if (demoProds.length > 0) {
    appendIdsToKey(STORAGE_KEYS.PURGED_PRODUCTS, demoProds);
    removePendingDeletedProductIds(demoProds);
  }
}

function loadDirtyProductIds(): string[] {
  return loadIdList(STORAGE_KEYS.DIRTY_PRODUCTS);
}

function addDirtyProductIds(ids: string[]): void {
  appendIdsToKey(STORAGE_KEYS.DIRTY_PRODUCTS, ids);
}

function removeDirtyProductIds(ids: string[]): void {
  removeIdsFromKey(STORAGE_KEYS.DIRTY_PRODUCTS, ids);
}

function loadDirtyOrderIds(): string[] {
  return loadIdList(STORAGE_KEYS.DIRTY_ORDERS);
}

function addDirtyOrderIds(ids: string[]): void {
  appendIdsToKey(STORAGE_KEYS.DIRTY_ORDERS, ids);
}

function removeDirtyOrderIds(ids: string[]): void {
  removeIdsFromKey(STORAGE_KEYS.DIRTY_ORDERS, ids);
}

function loadDirtyCustomerIds(): string[] {
  return loadIdList(STORAGE_KEYS.DIRTY_CUSTOMERS);
}

function addDirtyCustomerIds(ids: string[]): void {
  appendIdsToKey(STORAGE_KEYS.DIRTY_CUSTOMERS, ids);
}

function removeDirtyCustomerIds(ids: string[]): void {
  removeIdsFromKey(STORAGE_KEYS.DIRTY_CUSTOMERS, ids);
}

function filterOutDemoAndDeletedProducts(list: Product[], extraDeletedIds: string[] = []): Product[] {
  const deletedSet = new Set([
    ...loadPendingDeletedProductIds(),
    ...loadPurgedProductIds(),
    ...extraDeletedIds,
  ]);
  return (list || []).filter(p => p && p.id && !DEMO_PRODUCT_IDS.has(p.id) && !deletedSet.has(p.id));
}

function filterOutDeletedOrders(list: Order[], extraDeletedIds: string[] = []): Order[] {
  const deletedSet = new Set([
    ...loadPendingDeletedOrderIds(),
    ...loadPurgedOrderIds(),
    ...extraDeletedIds,
  ]);
  return (list || []).filter(o => o && o.id && !deletedSet.has(o.id));
}

function deduplicateProductsByName(list: Product[]): Product[] {
  const seenNames = new Set<string>();
  const result: Product[] = [];
  for (const p of list || []) {
    if (!p || !p.id) continue;
    const norm = removeVietnameseTones((p.name || '').toLowerCase()).trim();
    if (norm && seenNames.has(norm)) continue;
    if (norm) seenNames.add(norm);
    result.push(p);
  }
  return result;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cloud Config state
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(getSupabaseConfig);
  const [cloudExtraAddressesUnsupported, setCloudExtraAddressesUnsupported] = useState<boolean>(
    isCloudExtraAddressesUnsupported
  );
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(
    () => getSupabaseConfig().lastSyncedAt || null
  );
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [sentinelAcks, setSentinelAcks] = useState<SentinelAcknowledgments>(() => loadSentinelAcks());

  const computePendingOutboxCount = (): number =>
    loadDirtyProductIds().length +
    loadDirtyOrderIds().length +
    loadDirtyCustomerIds().length +
    loadPendingDeletedProductIds().length +
    loadPendingDeletedOrderIds().length +
    loadPendingDeletedCustomerIds().length;

  const [pendingOutboxCount, setPendingOutboxCount] = useState<number>(() => {
    migrateDemoOutboxTombstones();
    return computePendingOutboxCount();
  });
  const refreshOutboxCount = useCallback(() => {
    setPendingOutboxCount(computePendingOutboxCount());
  }, []);

  const clearDirtyProductIds = (ids: string[]) => {
    if (ids.length === 0) return;
    removeDirtyProductIds(ids);
    refreshOutboxCount();
  };

  const clearDirtyOrderIds = (ids: string[]) => {
    if (ids.length === 0) return;
    removeDirtyOrderIds(ids);
    refreshOutboxCount();
  };

  const clearDirtyCustomerIds = (ids: string[]) => {
    if (ids.length === 0) return;
    removeDirtyCustomerIds(ids);
    refreshOutboxCount();
  };

  const clearPendingDeletedProductIds = (ids: string[]) => {
    if (ids.length === 0) return;
    removePendingDeletedProductIds(ids);
    refreshOutboxCount();
  };

  const clearPendingDeletedOrderIds = (ids: string[]) => {
    if (ids.length === 0) return;
    removePendingDeletedOrderIds(ids);
    refreshOutboxCount();
  };

  const clearPendingDeletedCustomerIds = (ids: string[]) => {
    if (ids.length === 0) return;
    removePendingDeletedCustomerIds(ids);
    refreshOutboxCount();
  };

  // ADR-0024 & ADR-0025: Dual-Role Store Authentication (`mexucxich` Owner + `admin` Admin)
  const [authConfig, setAuthConfig] = useState<StoreAuthConfig>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_AUTH_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.username === 'string' && typeof parsed.passwordHash === 'string') {
          return { ...parsed, requireSignIn: parsed.requireSignIn !== false } as StoreAuthConfig;
        }
      }
    } catch {
      // ignore corrupted auth config
    }
    return createDefaultStoreAuthConfig();
  });
  const [adminAuthConfig, setAdminAuthConfig] = useState<StoreAuthConfig>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_ADMIN_AUTH_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.username === 'string' && typeof parsed.passwordHash === 'string') {
          return parsed as StoreAuthConfig;
        }
      }
    } catch {
      // ignore corrupted admin auth config
    }
    return createDefaultAdminAuthConfig();
  });
  const [authSession, setAuthSession] = useState<StoreAuthSession | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && !parsed.role) {
        parsed.role = inferRoleFromUsernameOrMetadata(parsed.username || '');
        parsed.authSource = parsed.authSource || 'store_config';
      }
      return parsed as StoreAuthSession;
    } catch {
      return null;
    }
  });
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);

  const authConfigRef = useRef<StoreAuthConfig>(authConfig);
  const adminAuthConfigRef = useRef<StoreAuthConfig>(adminAuthConfig);
  const isCloudSyncingRef = useRef<boolean>(isCloudSyncing);
  useEffect(() => {
    authConfigRef.current = authConfig;
  }, [authConfig]);
  useEffect(() => {
    adminAuthConfigRef.current = adminAuthConfig;
  }, [adminAuthConfig]);
  useEffect(() => {
    isCloudSyncingRef.current = isCloudSyncing;
  }, [isCloudSyncing]);

  const isAuthenticated = isStoreSessionValid(authSession, authConfig, adminAuthConfig);
  const currentUser = isAuthenticated && authSession
    ? {
        username: stripAuthEmailDomain(authSession.username),
        role: authSession.role || inferRoleFromUsernameOrMetadata(authSession.username),
        authSource: authSession.authSource || ('store_config' as const),
      }
    : null;

  // Restore real Supabase Auth session if already present in browser storage
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      const supaSession = data?.session;
      if (supaSession?.user) {
        const email = supaSession.user.email || '';
        const role = inferRoleFromUsernameOrMetadata(
          email,
          supaSession.user.app_metadata?.role as string | undefined
        );
        const restored: StoreAuthSession = {
          username: stripAuthEmailDomain(supaSession.user.user_metadata?.username || email),
          email,
          role,
          authSource: 'supabase',
          authenticatedAt: new Date().toISOString(),
          expiresAt: supaSession.expires_at
            ? new Date(supaSession.expires_at * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(restored));
        setAuthSession(restored);
        setIsScreenLocked(false);
      } else {
        // Silently upgrade any existing browser POS session (`mexucxich` or `admin`) to a real Supabase Auth JWT
        ensureSupabaseJwtSession().then(healed => {
          if (healed) {
            try {
              const raw = localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
              if (raw) {
                setAuthSession(JSON.parse(raw));
              }
            } catch {
              // ignore
            }
          }
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return subscribeCloudExtraAddressesSupport(setCloudExtraAddressesUnsupported);
  }, []);

  // Products state (Cloud-First read cache; never resurrects Emergency Vault snapshots)
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    let initial: Product[] | null = null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initial = filterOutDemoAndDeletedProducts(parsed);
        }
      } catch {
        initial = null;
      }
    }
    if (!initial) {
      initial = INITIAL_PRODUCTS;
    }
    return filterOutDemoAndDeletedProducts(initial).map(p => ({
      ...p,
      updatedAt: p.updatedAt || p.createdAt || '2026-09-01T08:00:00Z',
    }));
  });

  // Customers state (Cloud-First read cache; never resurrects Emergency Vault snapshots)
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    let initial: Customer[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) initial = parsed;
      } catch {
        initial = [];
      }
    }
    if (initial.length === 0) {
      initial = INITIAL_CUSTOMERS;
    }
    const hasRealCustomers = initial.some(c => c.id !== 'KH01' && !DEMO_CUSTOMER_IDS.has(c.id));
    if (hasRealCustomers) {
      initial = initial.filter(c => !DEMO_CUSTOMER_IDS.has(c.id));
    }
    initial = filterOutDeletedCustomers(initial, [
      ...loadPendingDeletedCustomerIds(),
      ...loadPurgedCustomerIds(),
    ]);
    // Auto-repair and decouple fused/corrupted records (ADR-0017 Sentinel)
    const { repairedCustomers } = repairAndMigrateCustomers(initial);
    return repairedCustomers.map(c => ({
      ...c,
      updatedAt: c.updatedAt || c.createdAt || '2026-09-01T08:00:00Z',
    }));
  });

  // Orders state (Cloud-First read cache; never resurrects Emergency Vault snapshots)
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    let initial: Order[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) initial = parsed;
      } catch {
        initial = [];
      }
    }
    return filterOutDeletedOrders(initial);
  });

  // Debt payments state
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEBT_PAYMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  // Receipt settings state
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!saved) return DEFAULT_RECEIPT_SETTINGS;
    try {
      const parsed = JSON.parse(saved);
      // Auto-migrate legacy placeholder data to Hang's actual shop info
      if (parsed.bankAccount === '0859136899' || parsed.bankCode === 'MB' || !parsed.bankNote) {
        return {
          ...DEFAULT_RECEIPT_SETTINGS,
          ...parsed,
          bankCode: 'TCB',
          bankAccount: '10520110621010',
          bankAccountName: 'BÙI THỊ TUYẾT MAI',
          storeName: 'MEXUCXICH CUISINE',
          storeSubtitle: 'Đồ ăn homemade và đặc sản vùng miền',
          facebook: 'Hoàng Minh Hằng - 0904047976',
          bankNote: 'Nội dung: ghi rõ tên / Facebook / Sđt và gửi bill cho chủ shop ạ',
          footerMessage: 'Chúc quý khách có một bữa ăn hạnh phúc!',
        };
      }
      const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...parsed };
      // Auto-upgrade legacy default 'arial' to 'plus_jakarta' for clean Vietnamese font rendering
      if (!parsed.fontFamily || parsed.fontFamily === 'arial') {
        merged.fontFamily = 'plus_jakarta';
      }
      return merged;
    } catch {
      return DEFAULT_RECEIPT_SETTINGS;
    }
  });

  // Đồng bộ ref lưu giữ state mới nhất phục vụ pullAllDataFromCloud chống stale closure
  const stateRef = useRef({ products, customers, orders, debtPayments, receiptSettings });
  const mutationEpochRef = useRef(0);
  useEffect(() => {
    stateRef.current = { products, customers, orders, debtPayments, receiptSettings };
  }, [products, customers, orders, debtPayments, receiptSettings]);

  const commitProducts = (nextProducts: Product[], dirtyAddIds: string[] = [], dirtyClearIds: string[] = []) => {
    mutationEpochRef.current += 1;
    if (dirtyClearIds.length > 0) removeDirtyProductIds(dirtyClearIds);
    if (dirtyAddIds.length > 0) addDirtyProductIds(dirtyAddIds);
    stateRef.current.products = nextProducts;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextProducts));
    setProducts(nextProducts);
    refreshOutboxCount();
  };

  const commitCustomers = (nextCustomers: Customer[], dirtyAddIds: string[] = [], dirtyClearIds: string[] = []) => {
    mutationEpochRef.current += 1;
    if (dirtyClearIds.length > 0) removeDirtyCustomerIds(dirtyClearIds);
    if (dirtyAddIds.length > 0) addDirtyCustomerIds(dirtyAddIds);
    stateRef.current.customers = nextCustomers;
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(nextCustomers));
    setCustomers(nextCustomers);
    refreshOutboxCount();
  };

  const commitOrders = (nextOrders: Order[], dirtyAddIds: string[] = [], dirtyClearIds: string[] = []) => {
    mutationEpochRef.current += 1;
    if (dirtyClearIds.length > 0) removeDirtyOrderIds(dirtyClearIds);
    if (dirtyAddIds.length > 0) addDirtyOrderIds(dirtyAddIds);
    stateRef.current.orders = nextOrders;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));
    setOrders(nextOrders);
    refreshOutboxCount();
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(debtPayments));
  }, [debtPayments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(receiptSettings));
  }, [receiptSettings]);

  // One-time Sentinel local data integrity audit & ADR-0020 fused phone repair on boot
  useEffect(() => {
    const result = repairAndMigrateCustomers(stateRef.current.customers, stateRef.current.orders);
    let nextCustomers = result.repairedCustomers;
    let hasChanges = result.changesCount > 0;

    const phoneRepair = repairFusedPhonesBatch(nextCustomers);
    if (phoneRepair.changedCustomers.length > 0) {
      nextCustomers = phoneRepair.customers;
      hasChanges = true;
    }

    if (hasChanges) {
      stateRef.current.customers = nextCustomers;
      stateRef.current.orders = result.repairedOrders;
      setCustomers(nextCustomers);
      setOrders(result.repairedOrders);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(nextCustomers));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(result.repairedOrders));

      if (
        phoneRepair.changedCustomers.length > 0 &&
        cloudConfig.supabaseUrl &&
        cloudConfig.supabaseAnonKey &&
        cloudConfig.autoSync
      ) {
        cloudSyncCustomersBatch(phoneRepair.changedCustomers);
      }
    }

    if (localStorage.getItem(STORAGE_KEYS.ADR0020_PHONE_MIGRATION) !== '1') {
      localStorage.setItem(STORAGE_KEYS.ADR0020_PHONE_MIGRATION, '1');
    }

    // One-time ADR-0023 dirty tracking seed: only recent local records (Nov 12+) not yet confirmed on Cloud
    if (localStorage.getItem(STORAGE_KEYS.ADR0023_CLOUD_TRUTH) !== '1') {
      const nov12Cutoff = new Date('2026-11-12T00:00:00Z').getTime();
      const recentProdIds = (stateRef.current.products || [])
        .filter(p => p && p.id && !DEMO_PRODUCT_IDS.has(p.id) && getEntityTimestamp(p) >= nov12Cutoff)
        .map(p => p.id);
      const recentOrderIds = (stateRef.current.orders || [])
        .filter(o => o && o.id && getEntityTimestamp(o) >= nov12Cutoff)
        .map(o => o.id);
      if (recentProdIds.length > 0) addDirtyProductIds(recentProdIds);
      if (recentOrderIds.length > 0) addDirtyOrderIds(recentOrderIds);
      localStorage.setItem(STORAGE_KEYS.ADR0023_CLOUD_TRUTH, '1');
    }

    // One-time scrub if SP01-SP08 demo products existed in legacy storage
    const savedProdsRaw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const hadDemoInStorage =
      typeof savedProdsRaw === 'string' &&
      Array.from(DEMO_PRODUCT_IDS).some(demoId => savedProdsRaw.includes(`"${demoId}"`));
    if (
      hadDemoInStorage &&
      cloudConfig.supabaseUrl &&
      cloudConfig.supabaseAnonKey &&
      cloudConfig.autoSync
    ) {
      cloudDeleteProductsBatch(Array.from(DEMO_PRODUCT_IDS));
      pushCloudTombstones({ deletedProductIds: Array.from(DEMO_PRODUCT_IDS) });
    }
  }, []);

  // Shared bidirectional cloud sync pull + apply helper (ADR-0023)
  const activePullPromiseRef = useRef<Promise<{ success: boolean; message: string }> | null>(null);
  const executeCloudPullRef = useRef<(() => Promise<{ success: boolean; message: string }>) | null>(null);
  executeCloudPullRef.current = async () => {
    if (activePullPromiseRef.current) {
      return await activePullPromiseRef.current;
    }

    const activeConfig = getSupabaseConfig();
    if (!activeConfig.supabaseUrl || !activeConfig.supabaseAnonKey) {
      return { success: false, message: 'Chưa cấu hình kết nối Supabase!' };
    }

    const runPull = async (): Promise<{ success: boolean; message: string }> => {
      setIsCloudSyncing(true);
      try {
      // Idempotent ADR-0023 first-run dirty seed check
      if (localStorage.getItem(STORAGE_KEYS.ADR0023_CLOUD_TRUTH) !== '1') {
        const nov12Cutoff = new Date('2026-11-12T00:00:00Z').getTime();
        const recentProdIds = (stateRef.current.products || [])
          .filter(p => p && p.id && !DEMO_PRODUCT_IDS.has(p.id) && getEntityTimestamp(p) >= nov12Cutoff)
          .map(p => p.id);
        const recentOrderIds = (stateRef.current.orders || [])
          .filter(o => o && o.id && getEntityTimestamp(o) >= nov12Cutoff)
          .map(o => o.id);
        if (recentProdIds.length > 0) addDirtyProductIds(recentProdIds);
        if (recentOrderIds.length > 0) addDirtyOrderIds(recentOrderIds);
        localStorage.setItem(STORAGE_KEYS.ADR0023_CLOUD_TRUTH, '1');
      }

      const pendingDeletes = loadPendingDeletedCustomerIds();
      if (pendingDeletes.length > 0) {
        const delRes = await cloudDeleteCustomersBatch(pendingDeletes);
        if (delRes.success) {
          removePendingDeletedCustomerIds(pendingDeletes);
          pushCloudTombstones({ deletedCustomerIds: pendingDeletes });
        }
      }

      const pendingProdDeletes = loadPendingDeletedProductIds();
      if (pendingProdDeletes.length > 0) {
        const delProdRes = await cloudDeleteProductsBatch(pendingProdDeletes);
        if (delProdRes.success) {
          removePendingDeletedProductIds(pendingProdDeletes);
          pushCloudTombstones({ deletedProductIds: pendingProdDeletes });
        }
      }

      const pendingOrderDeletes = loadPendingDeletedOrderIds();
      if (pendingOrderDeletes.length > 0) {
        const delOrdRes = await cloudDeleteOrdersBatch(pendingOrderDeletes);
        if (delOrdRes.success) {
          removePendingDeletedOrderIds(pendingOrderDeletes);
          pushCloudTombstones({ deletedOrderIds: pendingOrderDeletes });
        }
      }

      const cleanLocalProducts = filterOutDemoAndDeletedProducts(stateRef.current.products);
      const cleanLocalOrders = filterOutDeletedOrders(stateRef.current.orders);
      const excludedProductIds = Array.from(new Set([...loadPendingDeletedProductIds(), ...loadPurgedProductIds()]));
      const excludedOrderIds = Array.from(new Set([...loadPendingDeletedOrderIds(), ...loadPurgedOrderIds()]));
      const excludedCustomerIds = loadPendingDeletedCustomerIds();
      const dirtyProductIds = loadDirtyProductIds();
      const dirtyOrderIds = loadDirtyOrderIds();
      const dirtyCustomerIds = loadDirtyCustomerIds();

      const localData = {
        products: cleanLocalProducts,
        customers: stateRef.current.customers,
        orders: cleanLocalOrders,
        debtPayments: stateRef.current.debtPayments,
        excludedProductIds,
        excludedOrderIds,
        excludedCustomerIds,
        dirtyProductIds,
        dirtyOrderIds,
        dirtyCustomerIds,
      };

      const startEpoch = mutationEpochRef.current;
      const [pullRes, cloudAuth, cloudAdminAuth] = await Promise.all([
        pullAllDataFromCloud(localData),
        fetchStoreAuthConfig().catch(() => null),
        fetchAdminAuthConfig().catch(() => null),
      ]);

      if (cloudAuth && cloudAuth.updatedAt) {
        const localTs = authConfigRef.current?.updatedAt
          ? new Date(authConfigRef.current.updatedAt).getTime()
          : 0;
        const remoteTs = new Date(cloudAuth.updatedAt).getTime();
        if (!Number.isFinite(localTs) || (Number.isFinite(remoteTs) && remoteTs > localTs)) {
          authConfigRef.current = cloudAuth;
          localStorage.setItem(LOCAL_AUTH_CONFIG_KEY, JSON.stringify(cloudAuth));
          setAuthConfig(cloudAuth);
        }
      }

      if (cloudAdminAuth && cloudAdminAuth.updatedAt) {
        const localAdminTs = adminAuthConfigRef.current?.updatedAt
          ? new Date(adminAuthConfigRef.current.updatedAt).getTime()
          : 0;
        const remoteAdminTs = new Date(cloudAdminAuth.updatedAt).getTime();
        if (!Number.isFinite(localAdminTs) || (Number.isFinite(remoteAdminTs) && remoteAdminTs > localAdminTs)) {
          adminAuthConfigRef.current = cloudAdminAuth;
          localStorage.setItem(LOCAL_ADMIN_AUTH_CONFIG_KEY, JSON.stringify(cloudAdminAuth));
          setAdminAuthConfig(cloudAdminAuth);
        }
      }

      if (!pullRes) {
        // If Supabase RLS is locked (`to authenticated`) and this browser still holds a legacy
        // non-JWT session (`store_config`) from before SQL setup, prompt a clean 1-time re-login.
        const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
        const hasJwtSession = await hasActiveSupabaseAuthSession();
        if (isOnline && !hasJwtSession) {
          localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
          setAuthSession(null);
          setIsScreenLocked(true);
          setCloudSyncError(null);
          return {
            success: false,
            message: 'Phiên đăng nhập cũ cần xác thực lại với Cloud. Vui lòng đăng nhập lại 1 lần.',
          };
        }
        const errMsg = 'Không thể kết nối hoặc tải dữ liệu từ Supabase Cloud!';
        setCloudSyncError(errMsg);
        return { success: false, message: errMsg };
      }

      // Absorb shared Cloud Tombstone Ledger locally and strip deleted dirty flags
      if (pullRes.cloudTombstones) {
        if (pullRes.cloudTombstones.deletedProductIds.length > 0) {
          appendIdsToKey(STORAGE_KEYS.PURGED_PRODUCTS, pullRes.cloudTombstones.deletedProductIds);
          removeDirtyProductIds(pullRes.cloudTombstones.deletedProductIds);
        }
        if (pullRes.cloudTombstones.deletedOrderIds.length > 0) {
          appendIdsToKey(STORAGE_KEYS.PURGED_ORDERS, pullRes.cloudTombstones.deletedOrderIds);
          removeDirtyOrderIds(pullRes.cloudTombstones.deletedOrderIds);
        }
        if (pullRes.cloudTombstones.deletedCustomerIds.length > 0) {
          addPendingDeletedCustomerIds(pullRes.cloudTombstones.deletedCustomerIds);
          removeDirtyCustomerIds(pullRes.cloudTombstones.deletedCustomerIds);
        }
      }

      // If a local mutation occurred while the network pull was in flight, re-reconcile
      // against the latest stateRef & dirty queues so fresh local edits are never clobbered.
      let effectivePullRes = pullRes;
      let effectiveDirtyProductIds = dirtyProductIds;
      let effectiveDirtyOrderIds = dirtyOrderIds;
      let effectiveDirtyCustomerIds = dirtyCustomerIds;
      if (mutationEpochRef.current !== startEpoch && pullRes.cloudRaw) {
        effectiveDirtyProductIds = loadDirtyProductIds();
        effectiveDirtyOrderIds = loadDirtyOrderIds();
        effectiveDirtyCustomerIds = loadDirtyCustomerIds();
        effectivePullRes = reconcileCloudAndLocalPullData({
          cloudProductsRaw: pullRes.cloudRaw.products,
          cloudCustomersRaw: pullRes.cloudRaw.customers,
          cloudOrdersRaw: pullRes.cloudRaw.orders,
          cloudDebtPaymentsRaw: pullRes.cloudRaw.debtPayments,
          cloudHasExtraAddressesCol: pullRes.cloudRaw.cloudHasExtraAddressesCol,
          cloudTombstones: pullRes.cloudTombstones,
          cloudCustomersOk: pullRes.cloudRaw.cloudCustomersOk,
          cloudDebtPaymentsOk: pullRes.cloudRaw.cloudDebtPaymentsOk,
          settings: pullRes.settings,
          localData: {
            products: filterOutDemoAndDeletedProducts(stateRef.current.products),
            customers: stateRef.current.customers,
            orders: filterOutDeletedOrders(stateRef.current.orders),
            debtPayments: stateRef.current.debtPayments,
            excludedProductIds: Array.from(new Set([...loadPendingDeletedProductIds(), ...loadPurgedProductIds()])),
            excludedOrderIds: Array.from(new Set([...loadPendingDeletedOrderIds(), ...loadPurgedOrderIds()])),
            excludedCustomerIds: loadPendingDeletedCustomerIds(),
            dirtyProductIds: effectiveDirtyProductIds,
            dirtyOrderIds: effectiveDirtyOrderIds,
            dirtyCustomerIds: effectiveDirtyCustomerIds,
          },
        });
      }

      const unsyncedCusts = effectivePullRes.unsyncedLocalCustomers || [];
      const unsyncedCustIdSet = new Set(unsyncedCusts.map(c => c.id));
      const confirmedSyncedCustIds = effectiveDirtyCustomerIds.filter(id => !unsyncedCustIdSet.has(id));
      if (confirmedSyncedCustIds.length > 0) {
        removeDirtyCustomerIds(confirmedSyncedCustIds);
      }
      if (unsyncedCusts.length > 0) {
        cloudSyncCustomersBatch(unsyncedCusts).then(ok => {
          if (ok) removeDirtyCustomerIds(unsyncedCusts.map(c => c.id));
        });
      }

      const latestCleanProducts = filterOutDemoAndDeletedProducts(stateRef.current.products);
      const reconciledProducts =
        effectivePullRes.products.length > 0
          ? filterOutDemoAndDeletedProducts(effectivePullRes.products)
          : filterOutDemoAndDeletedProducts(
              applyCatalogAntiShrinkGuard(latestCleanProducts, effectivePullRes.products).products
            );

      const unsyncedProds = filterOutDemoAndDeletedProducts(effectivePullRes.unsyncedLocalProducts || []);
      const unsyncedProdIdSet = new Set(unsyncedProds.map(p => p.id));
      const confirmedSyncedProdIds = effectiveDirtyProductIds.filter(id => !unsyncedProdIdSet.has(id));
      if (confirmedSyncedProdIds.length > 0) {
        removeDirtyProductIds(confirmedSyncedProdIds);
      }
      if (unsyncedProds.length > 0) {
        cloudSyncProductsBatch(unsyncedProds).then(ok => {
          if (ok) removeDirtyProductIds(unsyncedProds.map(p => p.id));
        });
      }

      const cleanUnsyncedOrders = filterOutDeletedOrders(effectivePullRes.unsyncedLocalOrders || []);
      const unsyncedOrdIdSet = new Set(cleanUnsyncedOrders.map(o => o.id));
      const confirmedSyncedOrdIds = effectiveDirtyOrderIds.filter(id => !unsyncedOrdIdSet.has(id));
      if (confirmedSyncedOrdIds.length > 0) {
        removeDirtyOrderIds(confirmedSyncedOrdIds);
      }
      if (cleanUnsyncedOrders.length > 0) {
        cloudSyncOrdersBatch(cleanUnsyncedOrders).then(ok => {
          if (ok) removeDirtyOrderIds(cleanUnsyncedOrders.map(o => o.id));
        });
      }

      const stillPendingDeletes = loadPendingDeletedCustomerIds();
      const ledgerDeletedCusts = effectivePullRes.cloudTombstones?.deletedCustomerIds || [];
      const safePulledCustomers = filterOutDeletedCustomers(effectivePullRes.customers, [
        ...stillPendingDeletes,
        ...ledgerDeletedCusts,
      ]);
      const safePulledOrders = filterOutDeletedOrders(effectivePullRes.orders);

      const { repairedCustomers, repairedOrders } = repairAndMigrateCustomers(
        safePulledCustomers,
        safePulledOrders
      );
      const phoneRepair = repairFusedPhonesBatch(repairedCustomers);
      const finalPulledCustomers = phoneRepair.customers;

      stateRef.current.products = reconciledProducts;
      stateRef.current.customers = finalPulledCustomers;
      stateRef.current.orders = repairedOrders;
      stateRef.current.debtPayments = effectivePullRes.debtPayments;

      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(reconciledProducts));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(finalPulledCustomers));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(repairedOrders));
      localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(effectivePullRes.debtPayments));

      setProducts(reconciledProducts);
      setCustomers(finalPulledCustomers);
      setOrders(repairedOrders);
      setDebtPayments(effectivePullRes.debtPayments);

      if (effectivePullRes.settings) {
        setReceiptSettings(prev => {
          const nextSettings = { ...prev, ...effectivePullRes.settings };
          stateRef.current.receiptSettings = nextSettings;
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(nextSettings));
          return nextSettings;
        });
      }

      if (phoneRepair.changedCustomers.length > 0) {
        const repairedIds = phoneRepair.changedCustomers.map(c => c.id);
        addDirtyCustomerIds(repairedIds);
        cloudSyncCustomersBatch(phoneRepair.changedCustomers).then(ok => {
          if (ok) removeDirtyCustomerIds(repairedIds);
        });
      }

      const syncNow = new Date().toISOString();
      setLastCloudSyncAt(syncNow);
      setCloudSyncError(null);
      saveSupabaseConfig({ ...activeConfig, autoSync: true, lastSyncedAt: syncNow });

      const preservedCount = effectivePullRes.localPreservedCount || 0;
      const note =
        preservedCount > 0 ? ` (Đã bảo toàn ${preservedCount} bản ghi có cập nhật mới hơn trên máy)` : '';

      console.log(`✅ Đã đồng bộ dữ liệu mới nhất từ Supabase Cloud: ${reconciledProducts.length} món, ${finalPulledCustomers.length} khách, ${repairedOrders.length} đơn.`);

      return {
        success: true,
        message: `Đã nạp thành công ${reconciledProducts.length} món, ${finalPulledCustomers.length} khách, ${repairedOrders.length} đơn từ Cloud về máy!${note}`,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Lỗi đồng bộ Cloud';
      console.warn('Không thể tự động đồng bộ từ Cloud:', err);
      setCloudSyncError(errMsg);
      return { success: false, message: errMsg };
    } finally {
      setIsCloudSyncing(false);
      refreshOutboxCount();
    }
    };

    activePullPromiseRef.current = runPull();
    try {
      return await activePullPromiseRef.current;
    } finally {
      activePullPromiseRef.current = null;
    }
  };

  // Cloud-First Pull triggers: only active while authenticated (ADR-0025)
  useEffect(() => {
    if (!isAuthenticated || isScreenLocked) return;

    let lastPassivePullAt = 0;

    const refreshCloud = (passive = false) => {
      if (!(cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey && cloudConfig.autoSync !== false)) {
        return;
      }
      if (passive) {
        const now = Date.now();
        if (now - lastPassivePullAt < 10000) return;
        lastPassivePullAt = now;
      } else {
        lastPassivePullAt = Date.now();
      }
      executeCloudPullRef.current?.();
    };

    refreshCloud(false);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshCloud(true);
      }
    };

    const handleFocus = () => {
      refreshCloud(true);
    };

    const handleOnline = () => {
      refreshCloud(false);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshCloud(false);
      }
    }, 45000);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    // ADR-0024 Layer 1: Debounced WebSocket Realtime push wakeup when another device writes
    let realtimeTimer: number | null = null;
    const unsubscribeRealtime = subscribeToCloudRealtimeChanges(() => {
      if (document.visibilityState !== 'visible' || isCloudSyncingRef.current) return;
      if (realtimeTimer !== null) {
        window.clearTimeout(realtimeTimer);
      }
      realtimeTimer = window.setTimeout(() => {
        realtimeTimer = null;
        if (document.visibilityState === 'visible' && !isCloudSyncingRef.current) {
          refreshCloud(false);
        }
      }, 1500);
    });

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (realtimeTimer !== null) {
        window.clearTimeout(realtimeTimer);
      }
      unsubscribeRealtime();
    };
  }, [isAuthenticated, isScreenLocked, cloudConfig.supabaseUrl, cloudConfig.supabaseAnonKey, cloudConfig.autoSync]);

  const updateCloudConfig = (newConfig: CloudConfig) => {
    saveSupabaseConfig(newConfig);
    setCloudConfig(newConfig);
  };

  const syncLocalToCloud = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    return await pushAllDataToCloud({
      products,
      customers,
      orders,
      debtPayments,
      settings: receiptSettings,
    });
  }, [products, customers, orders, debtPayments, receiptSettings]);

  const syncCloudToLocal = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!executeCloudPullRef.current) {
      return { success: false, message: 'Hệ thống đồng bộ chưa sẵn sàng!' };
    }
    return await executeCloudPullRef.current();
  }, []);

  // ADR-0025: Cloud-First Supabase Auth + Dual Role Sign-In Gate
  const loginWithPassword = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = stripAuthEmailDomain(username);
    if (!cleanUsername || !password) {
      return { success: false, error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!' };
    }

    let nextSession: StoreAuthSession | null = null;

    // 1. Primary path: real Supabase Auth (`signInWithPassword`)
    const supaRes = await signInWithSupabaseUsernamePassword(cleanUsername, password);
    if (supaRes.success) {
      nextSession = createStoreAuthSession({
        username: cleanUsername,
        email: supaRes.email,
        role: supaRes.role || inferRoleFromUsernameOrMetadata(cleanUsername),
        authSource: 'supabase',
        sessionTtlDays: 30,
      });
    } else {
      // 2. Graceful transition fallback (before 1-time SQL creates `auth.users`)
      const [remoteOwner, remoteAdmin] = await Promise.all([
        fetchStoreAuthConfig().catch(() => null),
        fetchAdminAuthConfig().catch(() => null),
      ]);

      if (remoteOwner && remoteOwner.updatedAt) {
        authConfigRef.current = remoteOwner;
        localStorage.setItem(LOCAL_AUTH_CONFIG_KEY, JSON.stringify(remoteOwner));
        setAuthConfig(remoteOwner);
      }
      if (remoteAdmin && remoteAdmin.updatedAt) {
        adminAuthConfigRef.current = remoteAdmin;
        localStorage.setItem(LOCAL_ADMIN_AUTH_CONFIG_KEY, JSON.stringify(remoteAdmin));
        setAdminAuthConfig(remoteAdmin);
      }

      if (verifyStoreCredentials(cleanUsername, password, authConfigRef.current)) {
        nextSession = createStoreAuthSession({
          username: authConfigRef.current.username,
          role: 'owner',
          authSource: 'store_config',
          sessionTtlDays: authConfigRef.current.sessionTtlDays || 30,
          passwordHash: authConfigRef.current.passwordHash,
        });
      } else if (verifyStoreCredentials(cleanUsername, password, adminAuthConfigRef.current)) {
        nextSession = createStoreAuthSession({
          username: adminAuthConfigRef.current.username,
          role: 'admin',
          authSource: 'store_config',
          sessionTtlDays: adminAuthConfigRef.current.sessionTtlDays || 30,
          passwordHash: adminAuthConfigRef.current.passwordHash,
        });
      }
    }

    if (!nextSession) {
      return { success: false, error: 'Tên đăng nhập hoặc mật khẩu chưa đúng!' };
    }

    localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(nextSession));
    saveLocalCredentialCache(cleanUsername, password);
    setAuthSession(nextSession);
    setIsScreenLocked(false);

    // Immediately pull 100% latest Cloud dataset upon login so POS enters synced state
    await executeCloudPullRef.current?.();
    return { success: true };
  };

  const logoutOrLockScreen = async (): Promise<void> => {
    localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    clearLocalCredentialCache();
    setAuthSession(null);
    setIsScreenLocked(true);
    await signOutSupabaseAuth();

    // Clear sensitive local cache when signed out (only if Offline Outbox is clean)
    if (computePendingOutboxCount() === 0) {
      stateRef.current.products = [];
      stateRef.current.customers = [];
      stateRef.current.orders = [];
      stateRef.current.debtPayments = [];
      localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
      localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
      localStorage.removeItem(STORAGE_KEYS.DEBT_PAYMENTS);
      setProducts([]);
      setCustomers([]);
      setOrders([]);
      setDebtPayments([]);
    }
  };

  const updateAuthConfig = async (patch: {
    requireSignIn?: boolean;
    newUsername?: string;
    newPassword?: string;
  }): Promise<boolean> => {
    const current = authConfigRef.current;
    const nextUsername = (patch.newUsername ?? current.username).trim() || current.username;
    const nextRequire = patch.requireSignIn ?? current.requireSignIn;
    const salt = current.salt || 'mxc_salt_v1';
    const nextHash =
      patch.newPassword && patch.newPassword.length > 0
        ? hashStorePassword(nextUsername, patch.newPassword, salt)
        : current.passwordHash;

    const nextConfig: StoreAuthConfig = {
      requireSignIn: nextRequire,
      username: nextUsername,
      passwordHash: nextHash,
      salt,
      sessionTtlDays: current.sessionTtlDays || 30,
      updatedAt: new Date().toISOString(),
    };

    authConfigRef.current = nextConfig;
    localStorage.setItem(LOCAL_AUTH_CONFIG_KEY, JSON.stringify(nextConfig));
    setAuthConfig(nextConfig);

    if (authSession?.role !== 'admin') {
      const nextSession = createStoreAuthSession(nextConfig);
      localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(nextSession));
      setAuthSession(nextSession);
      setIsScreenLocked(false);
    }

    return await pushStoreAuthConfig(nextConfig);
  };

  const changeOwnPassword = async (
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const trimmed = newPassword.trim();
    if (trimmed.length < 6) {
      return { success: false, message: 'Mật khẩu mới cần ít nhất 6 ký tự.' };
    }

    const activeRole = currentUser?.role || 'owner';
    const supaRes = await updateOwnSupabasePassword(trimmed);

    if (activeRole === 'admin') {
      const cur = adminAuthConfigRef.current;
      const nextAdmin: StoreAuthConfig = {
        ...cur,
        passwordHash: hashStorePassword(cur.username, trimmed, cur.salt || 'mxc_salt_v1'),
        updatedAt: new Date().toISOString(),
      };
      adminAuthConfigRef.current = nextAdmin;
      localStorage.setItem(LOCAL_ADMIN_AUTH_CONFIG_KEY, JSON.stringify(nextAdmin));
      setAdminAuthConfig(nextAdmin);

      const nextSession = createStoreAuthSession({
        username: nextAdmin.username,
        role: 'admin',
        authSource: supaRes.success ? 'supabase' : (authSession?.authSource || 'store_config'),
        sessionTtlDays: 30,
        passwordHash: nextAdmin.passwordHash,
      });
      localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(nextSession));
      setAuthSession(nextSession);
      await pushAdminAuthConfig(nextAdmin);
    } else {
      await updateAuthConfig({ requireSignIn: true, newPassword: trimmed });
    }

    return {
      success: true,
      message: supaRes.success
        ? 'Đã đổi mật khẩu trên Cloud Supabase thành công!'
        : 'Đã cập nhật & đồng bộ mật khẩu mới cho các thiết bị!',
    };
  };

  const adminManageStoreUser = async (params: {
    username: string;
    password: string;
    role: StoreRole;
    mode?: 'create_or_update' | 'update_password';
  }): Promise<{ success: boolean; message: string; needsEdgeDeploy?: boolean }> => {
    const cleanUser = stripAuthEmailDomain(params.username);
    if (!cleanUser || !params.password || params.password.length < 6) {
      return { success: false, message: 'Vui lòng nhập Tên đăng nhập và Mật khẩu (>= 6 ký tự).' };
    }

    const edgeRes = await adminCreateOrUpdateStoreUser({
      ...params,
      username: cleanUser,
    });

    // Also keep fallback config in sync if modifying primary owner (`mexucxich`/`hang`) or `admin`
    if (cleanUser === 'mexucxich' || cleanUser === 'hang') {
      const cur = authConfigRef.current;
      const nextOwnerCfg: StoreAuthConfig = {
        ...cur,
        requireSignIn: true,
        username: 'mexucxich',
        passwordHash: hashStorePassword('mexucxich', params.password, cur.salt || 'mxc_salt_v1'),
        updatedAt: new Date().toISOString(),
      };
      authConfigRef.current = nextOwnerCfg;
      localStorage.setItem(LOCAL_AUTH_CONFIG_KEY, JSON.stringify(nextOwnerCfg));
      setAuthConfig(nextOwnerCfg);
      await pushStoreAuthConfig(nextOwnerCfg);
    } else if (cleanUser === 'admin' || cleanUser === 'tung') {
      const cur = adminAuthConfigRef.current;
      const nextAdminCfg: StoreAuthConfig = {
        ...cur,
        requireSignIn: true,
        username: 'admin',
        passwordHash: hashStorePassword('admin', params.password, cur.salt || 'mxc_salt_v1'),
        updatedAt: new Date().toISOString(),
      };
      adminAuthConfigRef.current = nextAdminCfg;
      localStorage.setItem(LOCAL_ADMIN_AUTH_CONFIG_KEY, JSON.stringify(nextAdminCfg));
      setAdminAuthConfig(nextAdminCfg);
      await pushAdminAuthConfig(nextAdminCfg);
    }

    return edgeRes;
  };

  // Product actions
  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newId = `SP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    const nextProducts = [newProduct, ...stateRef.current.products];
    commitProducts(nextProducts, [newId]);
    cloudSyncProduct(newProduct).then(ok => {
      if (ok) removeDirtyProductIds([newId]);
    });
    return newProduct;
  };

  const addProductsBatch = (productsData: Array<Omit<Product, 'id'>>): Product[] => {
    const timestamp = Date.now();
    const now = new Date().toISOString();
    const newProducts: Product[] = productsData.map((p, idx) => ({
      ...p,
      id: `SP_${timestamp}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    }));
    const newIds = newProducts.map(p => p.id);
    const nextProducts = [...newProducts, ...stateRef.current.products];
    commitProducts(nextProducts, newIds);
    cloudSyncProductsBatch(newProducts).then(ok => {
      if (ok) removeDirtyProductIds(newIds);
    });
    return newProducts;
  };

  const updateProduct = (id: string, updatedData: Partial<Product>) => {
    const now = new Date().toISOString();
    let updatedItem: Product | null = null;
    const nextProducts = stateRef.current.products.map(p => {
      if (p.id === id) {
        updatedItem = { ...p, ...updatedData, updatedAt: now };
        return updatedItem;
      }
      return p;
    });
    commitProducts(nextProducts, updatedItem ? [id] : []);
    if (updatedItem) {
      cloudSyncProduct(updatedItem).then(ok => {
        if (ok) removeDirtyProductIds([id]);
      });
    }
  };

  const deleteProduct = (id: string) => {
    addPendingDeletedProductIds([id]);
    const nextProducts = stateRef.current.products.filter(p => p.id !== id);
    commitProducts(nextProducts, [], [id]);
    pushCloudTombstones({ deletedProductIds: [id] });
    cloudDeleteProduct(id).then(res => {
      if (res.success) {
        removePendingDeletedProductIds([id]);
      }
    });
  };

  const updateProductsBatch = (
    updates: Array<{ id: string; data: Partial<Product> }>
  ): number => {
    if (!updates || updates.length === 0) return 0;
    const now = new Date().toISOString();
    const updateMap = new Map<string, Partial<Product>>();
    for (const u of updates) {
      if (u && u.id) updateMap.set(u.id, u.data || {});
    }
    const changedProducts: Product[] = [];
    const nextProducts = stateRef.current.products.map(p => {
      const patch = updateMap.get(p.id);
      if (!patch) return p;
      const updated = { ...p, ...patch, updatedAt: now };
      changedProducts.push(updated);
      return updated;
    });
    if (changedProducts.length === 0) return 0;

    const changedIds = changedProducts.map(p => p.id);
    commitProducts(nextProducts, changedIds);
    cloudSyncProductsBatch(changedProducts).then(ok => {
      if (ok) removeDirtyProductIds(changedIds);
    });
    return changedProducts.length;
  };

  const deleteProductsBatch = (ids: string[]): number => {
    const cleanIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
    if (cleanIds.length === 0) return 0;
    const idSet = new Set(cleanIds);
    const nextProducts = stateRef.current.products.filter(p => !idSet.has(p.id));
    const removedCount = stateRef.current.products.length - nextProducts.length;
    if (removedCount === 0) return 0;

    addPendingDeletedProductIds(cleanIds);
    commitProducts(nextProducts, [], cleanIds);
    pushCloudTombstones({ deletedProductIds: cleanIds });
    cloudDeleteProductsBatch(cleanIds).then(res => {
      if (res.success) {
        removePendingDeletedProductIds(cleanIds);
      }
    });
    return removedCount;
  };

  // Customer actions
  const addCustomer = (customerData: Omit<Customer, 'id' | 'debt' | 'totalSpent' | 'orderCount'>): Customer => {
    const newId = `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const normAddr = normalizeAddressList(customerData.address || '', customerData.extraAddresses);
    const newCustomer: Customer = {
      ...customerData,
      address: normAddr.address,
      extraAddresses: normAddr.extraAddresses,
      id: newId,
      debt: 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const nextCustomers = [newCustomer, ...stateRef.current.customers];
    commitCustomers(nextCustomers, [newId]);
    cloudSyncCustomer(newCustomer).then(ok => {
      if (ok) removeDirtyCustomerIds([newId]);
    });
    return newCustomer;
  };

  const addCustomersBatch = (customersData: Array<Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>>): Customer[] => {
    const timestamp = Date.now();
    const now = new Date().toISOString();
    const newCustomers: Customer[] = customersData.map((c, idx) => {
      const normAddr = normalizeAddressList(c.address || '', c.extraAddresses);
      return {
        ...c,
        address: normAddr.address,
        extraAddresses: normAddr.extraAddresses,
        id: `KH_${timestamp}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        debt: c.debt || 0,
        totalSpent: 0,
        orderCount: 0,
        createdAt: now,
        updatedAt: now,
      };
    });
    const nextCustomers = [...newCustomers, ...stateRef.current.customers];
    const newIds = newCustomers.map(c => c.id);
    commitCustomers(nextCustomers, newIds);
    cloudSyncCustomersBatch(newCustomers).then(ok => {
      if (ok) removeDirtyCustomerIds(newIds);
    });
    return newCustomers;
  };

  const updateCustomer = (id: string, updatedData: Partial<Customer>) => {
    const now = new Date().toISOString();
    let updatedItem: Customer | null = null;
    const nextCustomers = stateRef.current.customers.map(c => {
      if (c.id === id) {
        const merged = { ...c, ...updatedData, updatedAt: now };
        if ('address' in updatedData || 'extraAddresses' in updatedData) {
          const normAddr = normalizeAddressList(merged.address || '', merged.extraAddresses);
          merged.address = normAddr.address;
          merged.extraAddresses = normAddr.extraAddresses;
        }
        updatedItem = merged;
        return merged;
      }
      return c;
    });
    commitCustomers(nextCustomers, updatedItem ? [id] : []);
    if (updatedItem) {
      cloudSyncCustomer(updatedItem).then(ok => {
        if (ok) removeDirtyCustomerIds([id]);
      });
    }
  };

  const updateCustomersBatch = (
    updates: Array<{ id: string; data: Partial<Customer> }>
  ): number => {
    if (!updates || updates.length === 0) return 0;
    const now = new Date().toISOString();
    const updateMap = new Map<string, Partial<Customer>>();
    for (const u of updates) {
      if (u && u.id) updateMap.set(u.id, u.data || {});
    }
    const changedCustomers: Customer[] = [];
    const nextCustomers = stateRef.current.customers.map(c => {
      const patch = updateMap.get(c.id);
      if (!patch) return c;
      const merged = { ...c, ...patch, updatedAt: now };
      if ('address' in patch || 'extraAddresses' in patch) {
        const normAddr = normalizeAddressList(merged.address || '', merged.extraAddresses);
        merged.address = normAddr.address;
        merged.extraAddresses = normAddr.extraAddresses;
      }
      changedCustomers.push(merged);
      return merged;
    });
    if (changedCustomers.length === 0) return 0;

    const changedIds = changedCustomers.map(c => c.id);
    commitCustomers(nextCustomers, changedIds);
    cloudSyncCustomersBatch(changedCustomers).then(ok => {
      if (ok) removeDirtyCustomerIds(changedIds);
    });
    return changedCustomers.length;
  };

  const deleteCustomer = (id: string) => {
    const nextCustomers = stateRef.current.customers.filter(c => c.id !== id);
    addPendingDeletedCustomerIds([id]);
    commitCustomers(nextCustomers, [], [id]);
    pushCloudTombstones({ deletedCustomerIds: [id] });
    cloudDeleteCustomer(id).then(res => {
      if (res?.success) removePendingDeletedCustomerIds([id]);
    });
  };

  const deleteCustomersBatch = (
    ids: string[],
    options?: { onlySafe?: boolean }
  ): { deletedCount: number; skippedIds: string[] } => {
    const res = deleteCustomersBatchHelper(
      stateRef.current.customers,
      stateRef.current.orders,
      ids,
      options
    );
    if (res.deletedCount === 0) {
      return { deletedCount: 0, skippedIds: res.skippedIds };
    }
    addPendingDeletedCustomerIds(res.deletedIds);
    commitCustomers(res.nextCustomers, [], res.deletedIds);
    pushCloudTombstones({ deletedCustomerIds: res.deletedIds });
    cloudDeleteCustomersBatch(res.deletedIds).then(cloudRes => {
      if (cloudRes?.success) removePendingDeletedCustomerIds(res.deletedIds);
    });

    return {
      deletedCount: res.deletedCount,
      skippedIds: res.skippedIds,
    };
  };

  // Sentinel Customer Repair & Decoupling actions (ADR-0017 & ADR-0020)
  const repairCustomerData = (): MigrationRepairResult => {
    const currentCustomers = stateRef.current.customers;
    const currentOrders = stateRef.current.orders;
    const result = repairAndMigrateCustomers(currentCustomers, currentOrders);
    const phoneRepair = repairFusedPhonesBatch(result.repairedCustomers);
    const combinedLog = [...result.log, ...phoneRepair.log];
    const totalChanges = result.changesCount + phoneRepair.changedCustomers.length;

    if (totalChanges > 0) {
      const changedSet = new Map<string, Customer>();
      if (result.changesCount > 0) {
        const origMap = new Map(currentCustomers.map(c => [c.id, c]));
        for (const rc of phoneRepair.customers) {
          const orig = origMap.get(rc.id);
          if (!orig || orig.phone !== rc.phone || orig.phone2 !== rc.phone2 || orig.name !== rc.name || orig.address !== rc.address) {
            changedSet.set(rc.id, rc);
          }
        }
      }
      for (const cc of phoneRepair.changedCustomers) {
        changedSet.set(cc.id, cc);
      }
      const toSync = Array.from(changedSet.values());
      const toSyncIds = toSync.map(c => c.id);

      const origOrderMap = new Map(currentOrders.map(o => [o.id, o]));
      const changedOrders = result.changesCount > 0
        ? result.repairedOrders.filter(ord => {
            const orig = origOrderMap.get(ord.id);
            return !orig || orig.customerId !== ord.customerId || orig.customerName !== ord.customerName;
          })
        : [];
      const changedOrdIds = changedOrders.map(o => o.id);

      commitCustomers(phoneRepair.customers, toSyncIds);
      commitOrders(result.repairedOrders, changedOrdIds);

      if (toSync.length > 0) {
        cloudSyncCustomersBatch(toSync).then(ok => {
          if (ok) removeDirtyCustomerIds(toSyncIds);
        });
      }
      if (changedOrders.length > 0) {
        cloudSyncOrdersBatch(changedOrders).then(ok => {
          if (ok) removeDirtyOrderIds(changedOrdIds);
        });
      }
    }

    return {
      repairedCustomers: phoneRepair.customers,
      repairedOrders: result.repairedOrders,
      changesCount: totalChanges,
      log: combinedLog,
    };
  };

  const acceptRecoveredPhoneSplit = (customerId: string) => {
    const target = stateRef.current.customers.find(c => c.id === customerId);
    if (!target) return;
    const res = repairCustomerFusedPhones(target);
    if (!res.changed) return;
    const nextCustomers = stateRef.current.customers.map(c => (c.id === customerId ? res.customer : c));
    commitCustomers(nextCustomers, [customerId]);
    cloudSyncCustomer(res.customer).then(ok => {
      if (ok) removeDirtyCustomerIds([customerId]);
    });
  };

  const acceptAllPhoneSplitsBatch = (customerIds: string[]): number => {
    if (!customerIds || customerIds.length === 0) return 0;
    const idSet = new Set(customerIds);
    const now = new Date().toISOString();
    const changedCustomers: Customer[] = [];
    const nextCustomers = stateRef.current.customers.map(c => {
      if (!idSet.has(c.id)) return c;
      const res = repairCustomerFusedPhones(c, now);
      if (res.changed) {
        changedCustomers.push(res.customer);
        return res.customer;
      }
      return c;
    });
    if (changedCustomers.length > 0) {
      const changedIds = changedCustomers.map(c => c.id);
      commitCustomers(nextCustomers, changedIds);
      cloudSyncCustomersBatch(changedCustomers).then(ok => {
        if (ok) removeDirtyCustomerIds(changedIds);
      });
    }
    return changedCustomers.length;
  };

  const promoteMultiAddressToExtra = (customerId: string) => {
    const target = stateRef.current.customers.find(c => c.id === customerId);
    if (!target) return;
    const res = convertAddressToExtraAddresses(target);
    if (!res.changed) return;
    const nextCustomers = stateRef.current.customers.map(c => (c.id === customerId ? res.customer : c));
    commitCustomers(nextCustomers, [customerId]);
    cloudSyncCustomer(res.customer).then(ok => {
      if (ok) removeDirtyCustomerIds([customerId]);
    });
  };

  const promoteMultiAddressesBatch = (customerIds: string[]): number => {
    if (!customerIds || customerIds.length === 0) return 0;
    const idSet = new Set(customerIds);
    const now = new Date().toISOString();
    const changedCustomers: Customer[] = [];
    const nextList = stateRef.current.customers.map(c => {
      if (!idSet.has(c.id)) return c;
      const res = convertAddressToExtraAddresses(c, now);
      if (res.changed) {
        changedCustomers.push(res.customer);
        return res.customer;
      }
      return c;
    });
    if (changedCustomers.length > 0) {
      const changedIds = changedCustomers.map(c => c.id);
      commitCustomers(nextList, changedIds);
      cloudSyncCustomersBatch(changedCustomers).then(ok => {
        if (ok) removeDirtyCustomerIds(changedIds);
      });
    }
    return changedCustomers.length;
  };

  const splitCustomerRecord = (customerId: string, type: 'phone' | 'address') => {
    const currentCustomers = stateRef.current.customers;
    const currentOrders = stateRef.current.orders;
    const target = currentCustomers.find(c => c.id === customerId);
    if (!target) return;

    const splitRes =
      type === 'phone'
        ? splitCustomerByPhones(target, currentOrders)
        : splitCustomerByAddresses(target, currentOrders);

    const { customerA, customerB, ordersToUpdate } = splitRes;
    const nextCustomers = currentCustomers
      .map(c => (c.id === customerId ? customerA : c))
      .concat(customerB);

    const changedCustIds = [customerA.id, customerB.id];
    commitCustomers(nextCustomers, changedCustIds);
    cloudSyncCustomersBatch([customerA, customerB]).then(ok => {
      if (ok) removeDirtyCustomerIds(changedCustIds);
    });

    if (ordersToUpdate.length > 0) {
      const updateMap = new Map(ordersToUpdate.map(u => [u.id, u]));
      const nextOrders = currentOrders.map(o => updateMap.get(o.id) || o);
      const changedOrdIds = ordersToUpdate.map(o => o.id);
      commitOrders(nextOrders, changedOrdIds);
      cloudSyncOrdersBatch(ordersToUpdate).then(ok => {
        if (ok) removeDirtyOrderIds(changedOrdIds);
      });
    }
  };

  const mergeCustomerGroup = (primaryId: string, duplicateIds: string[]) => {
    const currentCustomers = stateRef.current.customers;
    const currentOrders = stateRef.current.orders;
    const primary = currentCustomers.find(c => c.id === primaryId);
    if (!primary) return;

    const dupSet = new Set((duplicateIds || []).filter(id => id && id !== primaryId));
    const duplicates = currentCustomers.filter(c => dupSet.has(c.id));
    if (duplicates.length === 0) return;

    const { mergedCustomer, ordersToUpdate } = mergeCustomerGroupHelper(primary, duplicates, currentOrders);
    const nextCustomers = currentCustomers
      .filter(c => !dupSet.has(c.id))
      .map(c => (c.id === primaryId ? mergedCustomer : c));

    const dupIds = duplicates.map(d => d.id);
    addPendingDeletedCustomerIds(dupIds);
    commitCustomers(nextCustomers, [primaryId], dupIds);
    cloudSyncCustomer(mergedCustomer).then(ok => {
      if (ok) removeDirtyCustomerIds([primaryId]);
    });
    pushCloudTombstones({ deletedCustomerIds: dupIds });
    cloudDeleteCustomersBatch(dupIds).then(cloudRes => {
      if (cloudRes?.success) removePendingDeletedCustomerIds(dupIds);
    });

    if (ordersToUpdate.length > 0) {
      const updateMap = new Map(ordersToUpdate.map(u => [u.id, u]));
      const nextOrders = currentOrders.map(o => updateMap.get(o.id) || o);
      const changedOrdIds = ordersToUpdate.map(o => o.id);
      commitOrders(nextOrders, changedOrdIds);
      cloudSyncOrdersBatch(ordersToUpdate).then(ok => {
        if (ok) removeDirtyOrderIds(changedOrdIds);
      });
    }
  };

  const mergeDuplicateGroupsBatch = (
    groups: Array<{ primaryId: string; duplicateIds: string[] }>
  ): number => {
    if (!groups || groups.length === 0) return 0;
    let workingCustomers = [...stateRef.current.customers];
    let workingOrders = [...stateRef.current.orders];
    const updatedPrimaryMap = new Map<string, Customer>();
    const deletedIds = new Set<string>();
    const updatedOrderMap = new Map<string, Order>();
    let mergedGroupsCount = 0;

    for (const grp of groups) {
      const primary = workingCustomers.find(c => c.id === grp.primaryId);
      if (!primary) continue;
      const dupSet = new Set((grp.duplicateIds || []).filter(id => id && id !== grp.primaryId && !deletedIds.has(id)));
      const duplicates = workingCustomers.filter(c => dupSet.has(c.id));
      if (duplicates.length === 0) continue;

      const { mergedCustomer, ordersToUpdate } = mergeCustomerGroupHelper(primary, duplicates, workingOrders);
      workingCustomers = workingCustomers
        .filter(c => !dupSet.has(c.id))
        .map(c => (c.id === grp.primaryId ? mergedCustomer : c));

      updatedPrimaryMap.set(mergedCustomer.id, mergedCustomer);
      for (const d of duplicates) {
        deletedIds.add(d.id);
        updatedPrimaryMap.delete(d.id);
      }

      if (ordersToUpdate.length > 0) {
        const grpOrderMap = new Map(ordersToUpdate.map(u => [u.id, u]));
        workingOrders = workingOrders.map(o => grpOrderMap.get(o.id) || o);
        for (const uo of ordersToUpdate) {
          updatedOrderMap.set(uo.id, uo);
        }
      }
      mergedGroupsCount++;
    }

    if (mergedGroupsCount > 0) {
      const changedPrimaries = Array.from(updatedPrimaryMap.values());
      const changedPrimaryIds = changedPrimaries.map(c => c.id);
      const delArr = Array.from(deletedIds);

      if (delArr.length > 0) {
        addPendingDeletedCustomerIds(delArr);
      }
      commitCustomers(workingCustomers, changedPrimaryIds, delArr);

      if (changedPrimaries.length > 0) {
        cloudSyncCustomersBatch(changedPrimaries).then(ok => {
          if (ok) removeDirtyCustomerIds(changedPrimaryIds);
        });
      }
      if (delArr.length > 0) {
        pushCloudTombstones({ deletedCustomerIds: delArr });
        cloudDeleteCustomersBatch(delArr).then(cloudRes => {
          if (cloudRes?.success) removePendingDeletedCustomerIds(delArr);
        });
      }

      if (updatedOrderMap.size > 0) {
        const changedOrds = Array.from(updatedOrderMap.values());
        const changedOrdIds = changedOrds.map(o => o.id);
        commitOrders(workingOrders, changedOrdIds);
        cloudSyncOrdersBatch(changedOrds).then(ok => {
          if (ok) removeDirtyOrderIds(changedOrdIds);
        });
      }
    }

    return mergedGroupsCount;
  };

  const mergeCustomerRecords = (primaryId: string, duplicateId: string) => {
    mergeCustomerGroup(primaryId, [duplicateId]);
  };

  // Order actions
  const applyStockAdjustments = (adjustments: Array<{ productId: string; delta: number }>, now: string) => {
    if (adjustments.length === 0) return;
    const deltaMap = new Map(adjustments.map(a => [a.productId, a.delta]));
    const touchedIds = adjustments.map(a => a.productId);
    const nextProducts = stateRef.current.products.map(prod => {
      const delta = deltaMap.get(prod.id);
      if (delta !== undefined && delta !== 0) {
        return { ...prod, stock: calculateStockDelta(prod.stock, delta), updatedAt: now };
      }
      return prod;
    });
    commitProducts(nextProducts, touchedIds);

    cloudAdjustProductsStockBatch(adjustments).then(results => {
      if (!results || results.length === 0) return;
      const syncedIds = results.filter(r => r.success).map(r => r.productId);
      const stockPatch = new Map<string, number>();
      for (const r of results) {
        if (r.success && typeof r.newStock === 'number') {
          stockPatch.set(r.productId, Math.round(r.newStock * 10000) / 10000);
        }
      }
      if (stockPatch.size > 0) {
        const reconciled = stateRef.current.products.map(p =>
          stockPatch.has(p.id) ? { ...p, stock: stockPatch.get(p.id)! } : p
        );
        commitProducts(reconciled, [], syncedIds);
      } else if (syncedIds.length > 0) {
        removeDirtyProductIds(syncedIds);
      }
    });
  };

  const createOrder = (orderData: Omit<Order, 'id' | 'createdAt'>): Order => {
    const newId = 'HD' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date().toISOString();
    const newOrder: Order = {
      ...orderData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Trừ tồn kho nguyên tử chống Race Condition (ADR-0003 & ADR-0008)
    const qtyByProduct = new Map<string, number>();
    for (const item of newOrder.items || []) {
      if (item && item.productId) {
        qtyByProduct.set(
          item.productId,
          Math.round(((qtyByProduct.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
        );
      }
    }
    if (qtyByProduct.size > 0) {
      const adjustments = Array.from(qtyByProduct.entries()).map(([productId, qty]) => ({
        productId,
        delta: Math.round(-qty * 10000) / 10000,
      }));
      applyStockAdjustments(adjustments, now);
    }

    // 2. Update customer metrics & debt if applicable (ADR-0002)
    if (newOrder.customerId) {
      let updatedCust: Customer | null = null;
      const nextCustomers = stateRef.current.customers.map(cust => {
        if (cust.id === newOrder.customerId) {
          const updated = {
            ...cust,
            debt: cust.debt + (newOrder.debtAmount || 0),
            totalSpent: (cust.totalSpent || 0) + newOrder.total,
            orderCount: (cust.orderCount || 0) + 1,
            updatedAt: now,
          };
          updatedCust = updated;
          return updated;
        }
        return cust;
      });
      if (updatedCust) {
        const custId = newOrder.customerId;
        commitCustomers(nextCustomers, [custId]);
        cloudSyncCustomer(updatedCust).then(ok => {
          if (ok) removeDirtyCustomerIds([custId]);
        });
      }
    }

    // 3. Save order to list & Cloud
    const nextOrders = [newOrder, ...stateRef.current.orders];
    commitOrders(nextOrders, [newOrder.id]);
    cloudSyncOrder(newOrder).then(ok => {
      if (ok) removeDirtyOrderIds([newOrder.id]);
    });
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;
    const nextOrders = stateRef.current.orders.map(order => {
      if (order.id === orderId) {
        const updated = { ...order, status: newStatus, updatedAt: now };
        updatedOrder = updated;
        return updated;
      }
      return order;
    });
    if (updatedOrder) {
      commitOrders(nextOrders, [orderId]);
      cloudSyncOrder(updatedOrder).then(ok => {
        if (ok) removeDirtyOrderIds([orderId]);
      });
    }
  };

  // SỬA HÓA ĐƠN TOÀN DIỆN (ADR-0006 & ADR-0008)
  const updateOrder = (orderId: string, updatedOrder: Order) => {
    const oldOrder = stateRef.current.orders.find(o => o.id === orderId);
    if (!oldOrder) return;
    const now = new Date().toISOString();

    // 1. TÍNH BÙ TRỪ TỒN KHO NGUYÊN TỬ (ADR-0006 & ADR-0008) nếu đơn không ở trạng thái 'cancelled'
    if (oldOrder.status !== 'cancelled' && updatedOrder.status !== 'cancelled') {
      const oldQtyMap = new Map<string, number>();
      for (const item of oldOrder.items || []) {
        if (item && item.productId) {
          oldQtyMap.set(
            item.productId,
            Math.round(((oldQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
          );
        }
      }

      const newQtyMap = new Map<string, number>();
      for (const item of updatedOrder.items || []) {
        if (item && item.productId) {
          newQtyMap.set(
            item.productId,
            Math.round(((newQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
          );
        }
      }

      const allProdIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      const adjustments: Array<{ productId: string; delta: number }> = [];

      for (const pId of allProdIds) {
        const oldQ = oldQtyMap.get(pId) || 0;
        const newQ = newQtyMap.get(pId) || 0;
        const qtyDiff = Math.round((newQ - oldQ) * 10000) / 10000;
        if (qtyDiff !== 0) {
          adjustments.push({ productId: pId, delta: Math.round(-qtyDiff * 10000) / 10000 });
        }
      }

      if (adjustments.length > 0) {
        applyStockAdjustments(adjustments, now);
      }
    }

    // 2. TÍNH BÙ TRỪ CÔNG NỢ & DOANH THU KHÁCH HÀNG (ADR-0002 & ADR-0006)
    const customersToSync: Customer[] = [];
    let nextCustomers = stateRef.current.customers;
    if (oldOrder.customerId === updatedOrder.customerId && updatedOrder.customerId) {
      const debtDelta = (updatedOrder.debtAmount || 0) - (oldOrder.debtAmount || 0);
      const spentDelta = updatedOrder.total - oldOrder.total;

      nextCustomers = stateRef.current.customers.map(cust => {
        if (cust.id === updatedOrder.customerId) {
          const updated = {
            ...cust,
            debt: Math.max(0, cust.debt + debtDelta),
            totalSpent: Math.max(0, (cust.totalSpent || 0) + spentDelta),
            updatedAt: now,
          };
          customersToSync.push(updated);
          return updated;
        }
        return cust;
      });
    } else if (oldOrder.customerId !== updatedOrder.customerId) {
      nextCustomers = stateRef.current.customers.map(cust => {
        if (oldOrder.customerId && cust.id === oldOrder.customerId) {
          const updated = {
            ...cust,
            debt: Math.max(0, cust.debt - (oldOrder.debtAmount || 0)),
            totalSpent: Math.max(0, (cust.totalSpent || 0) - oldOrder.total),
            orderCount: Math.max(0, (cust.orderCount || 0) - 1),
            updatedAt: now,
          };
          customersToSync.push(updated);
          return updated;
        }
        if (updatedOrder.customerId && cust.id === updatedOrder.customerId) {
          const updated = {
            ...cust,
            debt: cust.debt + (updatedOrder.debtAmount || 0),
            totalSpent: (cust.totalSpent || 0) + updatedOrder.total,
            orderCount: (cust.orderCount || 0) + 1,
            updatedAt: now,
          };
          customersToSync.push(updated);
          return updated;
        }
        return cust;
      });
    }
    if (customersToSync.length > 0) {
      const syncIds = customersToSync.map(c => c.id);
      commitCustomers(nextCustomers, syncIds);
      cloudSyncCustomersBatch(customersToSync).then(ok => {
        if (ok) removeDirtyCustomerIds(syncIds);
      });
    }

    // 3. CẬP NHẬT ĐƠN HÀNG TRONG DANH SÁCH & CLOUD
    const orderToSave: Order = { ...updatedOrder, updatedAt: now };
    const nextOrders = stateRef.current.orders.map(o => (o.id === orderId ? orderToSave : o));
    commitOrders(nextOrders, [orderId]);
    cloudSyncOrder(orderToSave).then(ok => {
      if (ok) removeDirtyOrderIds([orderId]);
    });
  };

  // XÓA VĨNH VIỄN HÓA ĐƠN KÈM HOÀN KHO & TRỪ NỢ (ADR-0006 & ADR-0008)
  const deleteOrder = (orderId: string) => {
    const orderToDelete = stateRef.current.orders.find(o => o.id === orderId);
    if (!orderToDelete) return;
    const now = new Date().toISOString();

    // 1. Tự động hoàn kho các món nguyên tử nếu đơn chưa từng bị hủy
    if (orderToDelete.status !== 'cancelled') {
      const returnQtyMap = new Map<string, number>();
      for (const item of orderToDelete.items || []) {
        if (item && item.productId) {
          returnQtyMap.set(
            item.productId,
            Math.round(((returnQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
          );
        }
      }

      const adjustments = Array.from(returnQtyMap.entries()).map(([productId, qty]) => ({
        productId,
        delta: Math.round(qty * 10000) / 10000,
      }));
      if (adjustments.length > 0) {
        applyStockAdjustments(adjustments, now);
      }

      // 2. Giảm trừ dư nợ & doanh thu lũy kế của khách hàng
      if (orderToDelete.customerId) {
        let updatedCust: Customer | null = null;
        const nextCustomers = stateRef.current.customers.map(cust => {
          if (cust.id === orderToDelete.customerId) {
            const updated = {
              ...cust,
              debt: Math.max(0, cust.debt - (orderToDelete.debtAmount || 0)),
              totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToDelete.total),
              orderCount: Math.max(0, (cust.orderCount || 0) - 1),
              updatedAt: now,
            };
            updatedCust = updated;
            return updated;
          }
          return cust;
        });
        if (updatedCust) {
          const custId = orderToDelete.customerId;
          commitCustomers(nextCustomers, [custId]);
          cloudSyncCustomer(updatedCust).then(ok => {
            if (ok) removeDirtyCustomerIds([custId]);
          });
        }
      }
    }

    // 3. Xóa đơn khỏi danh sách & Cloud (kèm tombstone chống tái sinh đa thiết bị)
    addPendingDeletedOrderIds([orderId]);
    const nextOrders = stateRef.current.orders.filter(o => o.id !== orderId);
    commitOrders(nextOrders, [], [orderId]);
    pushCloudTombstones({ deletedOrderIds: [orderId] });
    cloudDeleteOrder(orderId).then(res => {
      if (res.success) {
        removePendingDeletedOrderIds([orderId]);
      }
    });
  };

  // Hủy đơn hàng (Soft-cancel với auto-restock nguyên tử - ADR-0003 & ADR-0008)
  const cancelOrder = (orderId: string) => {
    const orderToCancel = stateRef.current.orders.find(o => o.id === orderId);
    if (!orderToCancel || orderToCancel.status === 'cancelled') return;
    const now = new Date().toISOString();

    // 1. Auto-restock items nguyên tử
    const returnQtyMap = new Map<string, number>();
    for (const item of orderToCancel.items || []) {
      if (item && item.productId) {
        returnQtyMap.set(
          item.productId,
          Math.round(((returnQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
        );
      }
    }

    const adjustments = Array.from(returnQtyMap.entries()).map(([productId, qty]) => ({
      productId,
      delta: Math.round(qty * 10000) / 10000,
    }));
    if (adjustments.length > 0) {
      applyStockAdjustments(adjustments, now);
    }

    // 2. Reverse customer debt if order had debt
    if (orderToCancel.customerId && orderToCancel.debtAmount > 0) {
      let updatedCust: Customer | null = null;
      const nextCustomers = stateRef.current.customers.map(cust => {
        if (cust.id === orderToCancel.customerId) {
          const updated = {
            ...cust,
            debt: Math.max(0, cust.debt - orderToCancel.debtAmount),
            totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToCancel.total),
            orderCount: Math.max(0, (cust.orderCount || 0) - 1),
            updatedAt: now,
          };
          updatedCust = updated;
          return updated;
        }
        return cust;
      });
      if (updatedCust) {
        const custId = orderToCancel.customerId;
        commitCustomers(nextCustomers, [custId]);
        cloudSyncCustomer(updatedCust).then(ok => {
          if (ok) removeDirtyCustomerIds([custId]);
        });
      }
    }

    // 3. Mark as cancelled & Cloud
    let cancelledOrder: Order | null = null;
    const nextOrders = stateRef.current.orders.map(o => {
      if (o.id === orderId) {
        cancelledOrder = { ...o, status: 'cancelled' as OrderStatus, updatedAt: now };
        return cancelledOrder;
      }
      return o;
    });
    if (cancelledOrder) {
      commitOrders(nextOrders, [orderId]);
      cloudSyncOrder(cancelledOrder).then(ok => {
        if (ok) removeDirtyOrderIds([orderId]);
      });
    }
  };

  // Debt payment action (ADR-0002 - Running Balance)
  const payDebt = (customerId: string, amount: number, paymentMethod: 'cash' | 'transfer', note?: string) => {
    const targetCust = stateRef.current.customers.find(c => c.id === customerId);
    if (!targetCust || amount <= 0) return;
    const now = new Date().toISOString();

    // 1. Record debt payment
    const newPayment: DebtPayment = {
      id: 'PT' + Math.floor(1000 + Math.random() * 9000),
      customerId,
      customerName: targetCust.name,
      amount,
      paymentMethod,
      note,
      createdAt: now,
      updatedAt: now,
    };
    const nextPayments = [newPayment, ...stateRef.current.debtPayments];
    stateRef.current.debtPayments = nextPayments;
    localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(nextPayments));
    setDebtPayments(nextPayments);
    cloudSyncDebtPayment(newPayment);

    // 2. Reduce customer debt running balance
    let updatedCust: Customer | null = null;
    const nextCustomers = stateRef.current.customers.map(c => {
      if (c.id === customerId) {
        const updated = {
          ...c,
          debt: Math.max(0, c.debt - amount),
          updatedAt: now,
        };
        updatedCust = updated;
        return updated;
      }
      return c;
    });
    commitCustomers(nextCustomers, updatedCust ? [customerId] : []);
    if (updatedCust) {
      cloudSyncCustomer(updatedCust).then(ok => {
        if (ok) removeDirtyCustomerIds([customerId]);
      });
    }
  };

  // Receipt settings action
  const updateReceiptSettings = (newSettings: Partial<ReceiptSettings>) => {
    setReceiptSettings(prev => {
      const updated = { ...prev, ...newSettings };
      cloudSyncSettings(updated);
      return updated;
    });
  };

  // Reset data to mock (ADR-0018: Pre-reset emergency vault preservation)
  const resetToMockData = () => {
    saveVaultSnapshot(
      {
        timestamp: new Date().toISOString(),
        reason: 'pre_reset_wipe',
        products,
        customers,
        orders,
        debtPayments,
        receiptSettings,
      },
      true
    );

    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setOrders([]);
    setDebtPayments([]);
    setReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
    setSentinelAcks(resetSentinelAcksStorage());
    localStorage.clear();
  };

  const mergeAndRestoreSnapshot = (
    snapshot: {
      products?: Product[];
      customers?: Customer[];
      orders?: Order[];
      debtPayments?: DebtPayment[];
      receiptSettings?: Partial<ReceiptSettings>;
    },
    reason: string
  ): { restoredProducts: number; restoredOrders: number } => {
    const cleanCurrentOrders = filterOutDeletedOrders(stateRef.current.orders);
    const cleanIncomingOrders = filterOutDeletedOrders(Array.isArray(snapshot.orders) ? snapshot.orders : []);
    const mergedO = Array.isArray(snapshot.orders)
      ? mergeOrders(cleanIncomingOrders, cleanCurrentOrders)
      : cleanCurrentOrders;

    const cleanCurrentProds = filterOutDemoAndDeletedProducts(stateRef.current.products);
    const cleanIncomingProds = filterOutDemoAndDeletedProducts(Array.isArray(snapshot.products) ? snapshot.products : []);
    const mergedProds = Array.isArray(snapshot.products)
      ? mergeProductsWithConflictResolution(cleanIncomingProds, cleanCurrentProds).merged
      : cleanCurrentProds;
    const dedupedProds = deduplicateProductsByName(filterOutDemoAndDeletedProducts(mergedProds));
    const excludedProdIds = new Set([...loadPendingDeletedProductIds(), ...loadPurgedProductIds()]);
    const reconstructed = reconstructMissingProductsFromOrders(mergedO, dedupedProds, excludedProdIds);
    const finalProds = deduplicateProductsByName([...dedupedProds, ...reconstructed]);

    const pendingDeletedCusts = loadPendingDeletedCustomerIds();
    const rawIncomingCusts = Array.isArray(snapshot.customers) ? snapshot.customers : [];
    const safeIncomingCusts = filterOutDeletedCustomers(rawIncomingCusts, pendingDeletedCusts).filter(
      c => c && c.id && (!DEMO_CUSTOMER_IDS.has(c.id) || rawIncomingCusts.every(x => DEMO_CUSTOMER_IDS.has(x.id) || x.id === 'KH01'))
    );
    const mergedCusts =
      rawIncomingCusts.length > 0
        ? mergeCustomersWithConflictResolution(safeIncomingCusts, stateRef.current.customers).merged
        : stateRef.current.customers;
    const cleanCusts = filterOutDeletedCustomers(mergedCusts, pendingDeletedCusts);
    const hasRealCusts = cleanCusts.some(c => c.id !== 'KH01' && !DEMO_CUSTOMER_IDS.has(c.id));
    const noDemoCusts = hasRealCusts ? cleanCusts.filter(c => !DEMO_CUSTOMER_IDS.has(c.id)) : cleanCusts;
    const { repairedCustomers, repairedOrders } = repairAndMigrateCustomers(noDemoCusts, mergedO);
    const phoneRepair = repairFusedPhonesBatch(repairedCustomers);
    const finalCustomers = phoneRepair.customers;

    const mergedD = Array.isArray(snapshot.debtPayments)
      ? mergeDebtPayments(snapshot.debtPayments, stateRef.current.debtPayments)
      : stateRef.current.debtPayments;

    const nextSettings: ReceiptSettings = snapshot.receiptSettings
      ? { ...stateRef.current.receiptSettings, ...snapshot.receiptSettings }
      : stateRef.current.receiptSettings;

    mutationEpochRef.current += 1;
    stateRef.current.products = finalProds;
    stateRef.current.customers = finalCustomers;
    stateRef.current.orders = repairedOrders;
    stateRef.current.debtPayments = mergedD;
    stateRef.current.receiptSettings = nextSettings;

    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(finalProds));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(finalCustomers));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(repairedOrders));
    localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(mergedD));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(nextSettings));

    setProducts(finalProds);
    setCustomers(finalCustomers);
    setOrders(repairedOrders);
    setDebtPayments(mergedD);
    setReceiptSettings(nextSettings);

    saveVaultSnapshot(
      {
        timestamp: new Date().toISOString(),
        reason,
        products: finalProds,
        customers: finalCustomers,
        orders: repairedOrders,
        debtPayments: mergedD,
        receiptSettings: nextSettings,
      },
      true
    );

    if (finalProds.length > 0) {
      const pIds = finalProds.map(p => p.id);
      addDirtyProductIds(pIds);
      cloudSyncProductsBatch(finalProds).then(ok => {
        if (ok) removeDirtyProductIds(pIds);
      });
    }
    if (finalCustomers.length > 0) {
      const cIds = finalCustomers.map(c => c.id);
      addDirtyCustomerIds(cIds);
      cloudSyncCustomersBatch(finalCustomers).then(ok => {
        if (ok) removeDirtyCustomerIds(cIds);
      });
    }
    if (repairedOrders.length > 0) {
      const oIds = repairedOrders.map(o => o.id);
      addDirtyOrderIds(oIds);
      cloudSyncOrdersBatch(repairedOrders).then(ok => {
        if (ok) removeDirtyOrderIds(oIds);
      });
    }
    if (mergedD.length > 0) cloudSyncDebtPaymentsBatch(mergedD);
    if (snapshot.receiptSettings) cloudSyncSettings(nextSettings);

    return { restoredProducts: finalProds.length, restoredOrders: repairedOrders.length };
  };

  // ADR-0018: 1-Click Vault Recovery
  const restoreFromVault = (
    targetKey = 'mxc_emergency_vault'
  ): {
    success: boolean;
    message: string;
    restoredProducts: number;
    restoredOrders: number;
  } => {
    try {
      const snapshot = loadVaultSnapshot(targetKey);
      if (!snapshot) {
        return {
          success: false,
          message: 'Không tìm thấy dữ liệu sao lưu trong Hầm Cứu Hộ!',
          restoredProducts: 0,
          restoredOrders: 0,
        };
      }

      const { restoredProducts, restoredOrders } = mergeAndRestoreSnapshot(snapshot, 'vault_restore');

      return {
        success: true,
        message: `Đã khôi phục và gộp an toàn ${restoredProducts} món ăn và ${restoredOrders} đơn hàng từ Hầm Cứu Hộ (đã lọc bỏ món demo)!`,
        restoredProducts,
        restoredOrders,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Lỗi khôi phục: ${e?.message || e}`,
        restoredProducts: 0,
        restoredOrders: 0,
      };
    }
  };

  const getAvailableBackups = (): BackupMetadata[] => {
    return listVaultBackups();
  };

  // ADR-0018 & ADR-0024: Native Excel Orders & Products Importer (with selective conflict overwrite)
  const restoreFromExcelOrders = (
    importedOrders: Order[],
    options?: { overwriteOrderIds?: string[] }
  ): {
    restoredOrdersCount: number;
    updatedOrdersCount: number;
    restoredProductsCount: number;
  } => {
    if (!importedOrders || importedOrders.length === 0) {
      return { restoredOrdersCount: 0, updatedOrdersCount: 0, restoredProductsCount: 0 };
    }

    const currentProds = stateRef.current.products;
    const missingDefs = extractMissingProductsFromOrders(importedOrders, currentProds);

    // 1. Create missing products
    const timestamp = Date.now();
    const createdProducts: Product[] = missingDefs.map((def, idx) => ({
      ...def,
      id: `SP_${timestamp}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    }));

    const nextProducts = createdProducts.length > 0 ? [...createdProducts, ...currentProds] : currentProds;
    if (createdProducts.length > 0) {
      const createdIds = createdProducts.map(p => p.id);
      commitProducts(nextProducts, createdIds);
      cloudSyncProductsBatch(createdProducts).then(ok => {
        if (ok) removeDirtyProductIds(createdIds);
      });
    }

    // 2. Re-link order items to product IDs where matching
    const prodNameToId = new Map<string, Product>();
    for (const p of nextProducts) {
      prodNameToId.set(removeVietnameseTones(p.name.toLowerCase()).trim(), p);
    }

    const linkedOrders: Order[] = importedOrders.map(ord => ({
      ...ord,
      items: (ord.items || []).map(it => {
        const match = prodNameToId.get(removeVietnameseTones(it.name.toLowerCase()).trim());
        if (match) {
          return {
            ...it,
            productId: match.id,
            cost: match.cost,
            unit: it.unit || match.unit,
            image: match.image,
          };
        }
        return it;
      }),
    }));

    // 3. Merge orders (new orders + explicitly approved overwrites)
    const overwriteSet = new Set(
      (options?.overwriteOrderIds || []).map(id => String(id || '').trim()).filter(Boolean)
    );
    const existingOrderIds = new Set(stateRef.current.orders.map(o => o.id));
    const newOrders: Order[] = [];
    const overwriteMap = new Map<string, Order>();

    for (const ord of linkedOrders) {
      if (!existingOrderIds.has(ord.id)) {
        newOrders.push(ord);
      } else if (overwriteSet.has(ord.id)) {
        overwriteMap.set(ord.id, { ...ord, updatedAt: new Date().toISOString() });
      }
    }

    const updatedExisting = stateRef.current.orders.map(o => overwriteMap.get(o.id) || o);
    const nextOrders = [...newOrders, ...updatedExisting];
    const changedOrders = [...newOrders, ...Array.from(overwriteMap.values())];

    if (changedOrders.length > 0) {
      const changedOrdIds = changedOrders.map(o => o.id);
      commitOrders(nextOrders, changedOrdIds);
      cloudSyncOrdersBatch(changedOrders).then(ok => {
        if (ok) removeDirtyOrderIds(changedOrdIds);
      });
    }

    // 4. Auto-restore customers from order contacts
    const existingCustomerMap = new Map<string, Customer>();
    for (const c of stateRef.current.customers) {
      if (c.phone) existingCustomerMap.set(c.phone.replace(/\D/g, ''), c);
      if (c.phone2) existingCustomerMap.set(c.phone2.replace(/\D/g, ''), c);
      existingCustomerMap.set(removeVietnameseTones(c.name.toLowerCase()).trim(), c);
    }

    const newCustomersToAdd: Customer[] = [];
    for (const ord of importedOrders) {
      const rawName = ord.customerName?.trim();
      const rawPhone = ord.customerPhone?.trim();
      if (!rawName || isGenericCustomerName(rawName)) continue;
      const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';
      const cleanName = removeVietnameseTones(rawName.toLowerCase()).trim();

      if ((!cleanPhone || !existingCustomerMap.has(cleanPhone)) && !existingCustomerMap.has(cleanName)) {
        const newCust: Customer = {
          id: `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
          name: rawName,
          phone: rawPhone || '',
          address: ord.customerAddress || '',
          debt: ord.debtAmount || 0,
          totalSpent: ord.total || 0,
          orderCount: 1,
          createdAt: ord.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newCustomersToAdd.push(newCust);
        if (cleanPhone) existingCustomerMap.set(cleanPhone, newCust);
        existingCustomerMap.set(cleanName, newCust);
      }
    }

    let nextCustomers = stateRef.current.customers;
    if (newCustomersToAdd.length > 0) {
      nextCustomers = [...newCustomersToAdd, ...stateRef.current.customers];
      const newCustIds = newCustomersToAdd.map(c => c.id);
      commitCustomers(nextCustomers, newCustIds);
      cloudSyncCustomersBatch(newCustomersToAdd).then(ok => {
        if (ok) removeDirtyCustomerIds(newCustIds);
      });
    }

    // 5. Update Emergency Vault Snapshot
    saveVaultSnapshot(
      {
        timestamp: new Date().toISOString(),
        reason: 'excel_order_restore',
        products: nextProducts,
        customers: nextCustomers,
        orders: nextOrders,
        debtPayments: stateRef.current.debtPayments,
        receiptSettings: stateRef.current.receiptSettings,
      },
      true
    );

    return {
      restoredOrdersCount: newOrders.length,
      updatedOrdersCount: overwriteMap.size,
      restoredProductsCount: createdProducts.length,
    };
  };

  // ADR-0018 & ADR-0021: Customer Sentinel Snapshot & Discrepancy Tools
  const restoreCustomerFromOrder = (
    customerId: string,
    orderId: string
  ): { success: boolean; message: string } => {
    const cust = stateRef.current.customers.find(c => c.id === customerId);
    const ord = stateRef.current.orders.find(o => o.id === orderId);
    if (!cust || !ord) {
      return { success: false, message: 'Không tìm thấy khách hàng hoặc đơn hàng!' };
    }

    const { updatedCustomer, log } = restoreCustomerFromOrderSnapshot(cust, ord);
    const nextCustomers = stateRef.current.customers.map(c => (c.id === customerId ? updatedCustomer : c));
    commitCustomers(nextCustomers, [customerId]);
    cloudSyncCustomer(updatedCustomer).then(ok => {
      if (ok) removeDirtyCustomerIds([customerId]);
    });
    return { success: true, message: log };
  };

  const splitCustomerByHistoricalOrderRecord = (customerId: string, targetPhone: string) => {
    const cust = stateRef.current.customers.find(c => c.id === customerId);
    if (!cust) return;

    const { customerA, customerB, ordersToUpdate } = splitCustomerByHistoricalOrder(
      cust,
      targetPhone,
      stateRef.current.orders
    );
    const nextCustomers = [...stateRef.current.customers.filter(c => c.id !== customerId), customerA, customerB];
    const changedCustIds = [customerA.id, customerB.id];
    commitCustomers(nextCustomers, changedCustIds);
    cloudSyncCustomersBatch([customerA, customerB]).then(ok => {
      if (ok) removeDirtyCustomerIds(changedCustIds);
    });

    if (ordersToUpdate.length > 0) {
      const updateMap = new Map(ordersToUpdate.map(u => [u.id, u]));
      const nextOrders = stateRef.current.orders.map(o => updateMap.get(o.id) || o);
      const changedOrdIds = ordersToUpdate.map(o => o.id);
      commitOrders(nextOrders, changedOrdIds);
      cloudSyncOrdersBatch(ordersToUpdate).then(ok => {
        if (ok) removeDirtyOrderIds(changedOrdIds);
      });
    }
  };

  const addCustomerSecondaryPhone = (customerId: string, phone: string): boolean => {
    const cust = stateRef.current.customers.find(c => c.id === customerId);
    if (!cust) return false;
    const res = addSecondaryPhoneFromOrderHelper(cust, phone);
    if (!res.changed) return false;
    const nextCustomers = stateRef.current.customers.map(c => (c.id === customerId ? res.customer : c));
    commitCustomers(nextCustomers, [customerId]);
    cloudSyncCustomer(res.customer).then(ok => {
      if (ok) removeDirtyCustomerIds([customerId]);
    });
    return true;
  };

  const addCustomerExtraAddress = (customerId: string, address: string): boolean => {
    const cust = stateRef.current.customers.find(c => c.id === customerId);
    if (!cust) return false;
    const res = addExtraAddressFromOrderHelper(cust, address);
    if (!res.changed) return false;
    const nextCustomers = stateRef.current.customers.map(c => (c.id === customerId ? res.customer : c));
    commitCustomers(nextCustomers, [customerId]);
    cloudSyncCustomer(res.customer).then(ok => {
      if (ok) removeDirtyCustomerIds([customerId]);
    });
    return true;
  };

  const applyDiscrepancyRecommendationsBatch = (
    items: Array<{ customerId: string; orderId: string }>
  ): { updatedCount: number; splitCount: number } => {
    if (!items || items.length === 0) return { updatedCount: 0, splitCount: 0 };
    const now = new Date().toISOString();
    const orderMap = new Map(stateRef.current.orders.map(o => [o.id, o]));
    let workingCustomers = [...stateRef.current.customers];
    const changedCustomerMap = new Map<string, Customer>();

    for (const item of items) {
      const custIdx = workingCustomers.findIndex(c => c.id === item.customerId);
      const ord = orderMap.get(item.orderId);
      if (custIdx === -1 || !ord) continue;

      let cust = workingCustomers[custIdx];
      const analysis = analyzeDiscrepancyOrder(cust, ord);

      // Apply safe non-destructive additions without overwriting primary fields
      let mutated = false;
      if (analysis.recommendedAction === 'add_phone2' || analysis.canAddPhone2) {
        if (analysis.recommendedAction !== 'split_customer' && analysis.recommendedAction !== 'restore_order' && ord.customerPhone) {
          const pRes = addSecondaryPhoneFromOrderHelper(cust, ord.customerPhone, now);
          if (pRes.changed) {
            cust = pRes.customer;
            mutated = true;
          }
        }
      }
      if (analysis.recommendedAction === 'add_extra_address' || analysis.canAddExtraAddress) {
        if (analysis.recommendedAction !== 'split_customer' && analysis.recommendedAction !== 'restore_order' && ord.customerAddress) {
          const aRes = addExtraAddressFromOrderHelper(cust, ord.customerAddress, now);
          if (aRes.changed) {
            cust = aRes.customer;
            mutated = true;
          }
        }
      }

      if (mutated) {
        workingCustomers[custIdx] = cust;
        changedCustomerMap.set(cust.id, cust);
      }
    }

    if (changedCustomerMap.size > 0) {
      const changedArr = Array.from(changedCustomerMap.values());
      const changedIds = changedArr.map(c => c.id);
      commitCustomers(workingCustomers, changedIds);
      cloudSyncCustomersBatch(changedArr).then(ok => {
        if (ok) removeDirtyCustomerIds(changedIds);
      });
    }

    return { updatedCount: changedCustomerMap.size, splitCount: 0 };
  };

  const acknowledgeSentinelItems = (type: keyof SentinelAcknowledgments, keys: string[]) => {
    const cleanKeys = (keys || []).map(k => String(k || '').trim()).filter(Boolean);
    if (cleanKeys.length === 0) return;
    setSentinelAcks(prev => {
      const merged = {
        ...prev,
        [type]: Array.from(new Set([...(prev[type] || []), ...cleanKeys])),
      };
      return saveSentinelAcks(merged);
    });
  };

  const resetSentinelAcks = () => {
    setSentinelAcks(resetSentinelAcksStorage());
  };

  // Import / Export all
  const exportAllData = () => {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      products,
      customers,
      orders,
      debtPayments,
      receiptSettings,
    };
  };

  const importAllData = (jsonData: any): boolean => {
    try {
      if (!jsonData || typeof jsonData !== 'object') return false;
      mergeAndRestoreSnapshot(
        {
          products: Array.isArray(jsonData.products) ? jsonData.products : undefined,
          customers: Array.isArray(jsonData.customers) ? jsonData.customers : undefined,
          orders: Array.isArray(jsonData.orders) ? jsonData.orders : undefined,
          debtPayments: Array.isArray(jsonData.debtPayments) ? jsonData.debtPayments : undefined,
          receiptSettings: jsonData.receiptSettings || undefined,
        },
        'json_backup_merge'
      );
      return true;
    } catch {
      return false;
    }
  };

  const cloudExtraAddressesPendingSync =
    cloudExtraAddressesUnsupported && customers.some(c => (c.extraAddresses?.length || 0) > 0);

  return (
    <StoreContext.Provider
      value={{
        products,
        customers,
        orders,
        debtPayments,
        receiptSettings,
        cloudConfig,
        cloudExtraAddressesPendingSync,
        isCloudSyncing,
        lastCloudSyncAt,
        cloudSyncError,
        pendingOutboxCount,
        sentinelAcks,
        authConfig,
        adminAuthConfig,
        currentUser,
        isAuthenticated,
        isScreenLocked,
        loginWithPassword,
        logoutOrLockScreen,
        updateAuthConfig,
        changeOwnPassword,
        adminManageStoreUser,
        addProduct,
        addProductsBatch,
        updateProduct,
        updateProductsBatch,
        deleteProduct,
        deleteProductsBatch,
        addCustomer,
        addCustomersBatch,
        updateCustomer,
        updateCustomersBatch,
        deleteCustomer,
        deleteCustomersBatch,
        createOrder,
        updateOrderStatus,
        updateOrder,
        deleteOrder,
        cancelOrder,
        payDebt,
        updateReceiptSettings,
        updateCloudConfig,
        syncLocalToCloud,
        syncCloudToLocal,
        repairCustomerData,
        acceptRecoveredPhoneSplit,
        acceptAllPhoneSplitsBatch,
        promoteMultiAddressToExtra,
        promoteMultiAddressesBatch,
        splitCustomerRecord,
        mergeCustomerRecords,
        mergeCustomerGroup,
        mergeDuplicateGroupsBatch,
        addCustomerSecondaryPhone,
        addCustomerExtraAddress,
        applyDiscrepancyRecommendationsBatch,
        acknowledgeSentinelItems,
        resetSentinelAcks,
        restoreCustomerFromOrder,
        splitCustomerByHistoricalOrderRecord,
        restoreFromExcelOrders,
        restoreFromVault,
        getAvailableBackups,
        resetToMockData,
        importAllData,
        exportAllData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
