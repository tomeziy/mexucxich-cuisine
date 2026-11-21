import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Product, Customer, Order, DebtPayment, ReceiptSettings, CloudConfig } from '../types/index.ts';
import { DEMO_PRODUCT_IDS, DEMO_CUSTOMER_IDS } from '../data/initialData.ts';
import { removeVietnameseTones } from '../utils/vietnamese.ts';
import { normalizeAddressList } from '../utils/addressUtils.ts';
import {
  calculateStockDelta,
  getEntityTimestamp,
  resolveProductConflict,
  resolveCustomerConflict,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
  applyCatalogAntiShrinkGuard,
} from './syncConflict.ts';

import type { StoreAuthConfig } from '../utils/auth.ts';
import { STORE_AUTH_CONFIG_ROW_ID } from '../utils/auth.ts';

export {
  calculateStockDelta,
  getEntityTimestamp,
  resolveProductConflict,
  resolveCustomerConflict,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
  applyCatalogAntiShrinkGuard,
  STORE_AUTH_CONFIG_ROW_ID,
};

const CLOUD_CONFIG_KEY = 'mexucxich_cloud_config';
export const CLOUD_TOMBSTONES_ROW_ID = 'cloud_tombstones_v1';

export const DEFAULT_SUPABASE_URL = 'https://lfbrlicpptedjypryswo.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XmpBtPNysCkaLPnPR1gSkQ_eCfnjNbt';

export const getSupabaseConfig = (): CloudConfig => {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawUrl = typeof parsed?.supabaseUrl === 'string' ? parsed.supabaseUrl.trim() : '';
        const rawKey = typeof parsed?.supabaseAnonKey === 'string' ? parsed.supabaseAnonKey.trim() : '';
        const isValidUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
        const healed: CloudConfig = {
          supabaseUrl: isValidUrl ? rawUrl : envUrl,
          supabaseAnonKey: rawKey || envKey,
          // Always enforce autoSync: true so any opened browser pulls latest Cloud data
          autoSync: true,
          lastSyncedAt: parsed?.lastSyncedAt,
        };
        if (!isValidUrl || !rawKey || parsed?.autoSync !== true) {
          try {
            localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(healed));
          } catch {
            // ignore storage errors
          }
        }
        return healed;
      }
    }
  } catch (e) {
    console.error('Error reading cloud config:', e);
  }

  return {
    supabaseUrl: envUrl,
    supabaseAnonKey: envKey,
    autoSync: !!(envUrl && envKey),
    lastSyncedAt: undefined,
  };
};

export const saveSupabaseConfig = (config: CloudConfig): void => {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  // Reset singleton so next call re-instantiates
  cachedClient = null;
};

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedClient) return cachedClient;

  const config = getSupabaseConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    return cachedClient;
  } catch (e) {
    console.error('Failed to create Supabase client:', e);
    return null;
  }
};

/**
 * Kiểm tra kết nối tới Supabase với URL và Key cụ thể
 */
export const testSupabaseConnection = async (
  url: string,
  key: string
): Promise<{ success: boolean; message: string }> => {
  if (!url || !key) {
    return { success: false, message: 'Vui lòng nhập đầy đủ Supabase URL và Anon Public Key!' };
  }

  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await client.from('products').select('id').limit(1);

    if (error) {
      if (error.message.includes('relation "public.products" does not exist') || error.code === '42P01') {
        return {
          success: false,
          message: 'Kết nối được nhưng chưa chạy file SQL tạo bảng! Vui lòng vào SQL Editor trên Supabase chạy file supabase_schema.sql.',
        };
      }
      return { success: false, message: `Lỗi kết nối: ${error.message}` };
    }

    return { success: true, message: 'Kết nối Supabase thành công 100%! Cơ sở dữ liệu đã sẵn sàng.' };
  } catch (e: any) {
    return { success: false, message: `Không thể kết nối tới máy chủ: ${e.message || e}` };
  }
};

// Data Transformers
export const transformProductToDb = (p: Product) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  unit: p.unit,
  price: p.price,
  cost: p.cost,
  stock: p.stock,
  image: p.image,
  created_at: p.createdAt || new Date().toISOString(),
  updated_at: p.updatedAt || p.createdAt || new Date().toISOString(),
});

export const transformProductFromDb = (row: any): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  unit: row.unit,
  price: Number(row.price) || 0,
  cost: Number(row.cost) || 0,
  stock: Number(row.stock) || 0,
  image: row.image || '🌭',
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
});

export const transformCustomerToDb = (c: Customer) => {
  const normAddr = normalizeAddressList(c.address || '', c.extraAddresses);
  return {
    id: c.id,
    name: c.name,
    phone: c.phone2 ? `${c.phone || ''} / ${c.phone2}` : (c.phone || ''),
    address: normAddr.address,
    extra_addresses: normAddr.extraAddresses || [],
    debt: c.debt || 0,
    total_spent: c.totalSpent || 0,
    order_count: c.orderCount || 0,
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || c.createdAt || new Date().toISOString(),
  };
};

export const transformCustomerFromDb = (row: any): Customer => {
  let phone = row.phone || '';
  let phone2: string | undefined = row.phone2 ? String(row.phone2).trim() : undefined;

  if (!phone2 && phone.includes(' / ')) {
    const parts = phone.split(' / ');
    phone = parts[0].trim();
    phone2 = parts.slice(1).join(' / ').trim() || undefined;
  }

  const rawExtras = Array.isArray(row.extra_addresses)
    ? row.extra_addresses.map((a: any) => String(a || '').trim()).filter(Boolean)
    : undefined;
  const normAddr = normalizeAddressList(row.address || '', rawExtras);

  return {
    id: row.id,
    name: row.name,
    phone,
    phone2,
    address: normAddr.address,
    extraAddresses: normAddr.extraAddresses,
    debt: Number(row.debt) || 0,
    totalSpent: Number(row.total_spent) || 0,
    orderCount: Number(row.order_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
};

export const transformOrderToDb = (o: Order) => ({
  id: o.id,
  created_at: o.createdAt || new Date().toISOString(),
  updated_at: o.updatedAt || o.createdAt || new Date().toISOString(),
  customer_id: o.customerId,
  customer_name: o.customerName,
  customer_phone: o.customerPhone || '',
  customer_address: o.customerAddress || '',
  order_type: o.orderType,
  status: o.status,
  items: o.items || [],
  subtotal: o.subtotal || 0,
  discount_type: o.discountType,
  discount_value: o.discountValue || 0,
  discount_amount: o.discountAmount || 0,
  shipping_fee: o.shippingFee || 0,
  shipping_note: o.shippingNote || '',
  total: o.total || 0,
  payment_method: o.paymentMethod,
  cash_given: o.cashGiven || 0,
  change: o.change || 0,
  paid_amount: o.paidAmount || 0,
  debt_amount: o.debtAmount || 0,
});

export const transformOrderFromDb = (row: any): Order => ({
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
  customerId: row.customer_id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  customerAddress: row.customer_address,
  orderType: row.order_type,
  status: row.status,
  items: row.items || [],
  subtotal: Number(row.subtotal) || 0,
  discountType: row.discount_type || 'cash',
  discountValue: Number(row.discount_value) || 0,
  discountAmount: Number(row.discount_amount) || 0,
  shippingFee: Number(row.shipping_fee) || 0,
  shippingNote: row.shipping_note || '',
  total: Number(row.total) || 0,
  paymentMethod: row.payment_method || 'cash',
  cashGiven: Number(row.cash_given) || 0,
  change: Number(row.change) || 0,
  paidAmount: Number(row.paid_amount) || 0,
  debtAmount: Number(row.debt_amount) || 0,
});

export const transformDebtPaymentToDb = (dp: DebtPayment) => ({
  id: dp.id,
  customer_id: dp.customerId,
  customer_name: dp.customerName,
  amount: dp.amount,
  payment_method: dp.paymentMethod,
  note: dp.note || '',
  created_at: dp.createdAt || new Date().toISOString(),
  updated_at: dp.updatedAt || dp.createdAt || new Date().toISOString(),
});

export const transformDebtPaymentFromDb = (row: any): DebtPayment => ({
  id: row.id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  amount: Number(row.amount) || 0,
  paymentMethod: row.payment_method || 'cash',
  note: row.note || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
});

let cloudExtraAddressesUnsupported = false;
const schemaSupportListeners = new Set<(unsupported: boolean) => void>();

export function isCloudExtraAddressesUnsupported(): boolean {
  return cloudExtraAddressesUnsupported;
}

export function setCloudExtraAddressesUnsupported(unsupported: boolean): void {
  if (cloudExtraAddressesUnsupported !== unsupported) {
    cloudExtraAddressesUnsupported = unsupported;
    for (const listener of schemaSupportListeners) {
      listener(unsupported);
    }
  }
}

export function subscribeCloudExtraAddressesSupport(listener: (unsupported: boolean) => void): () => void {
  schemaSupportListeners.add(listener);
  return () => schemaSupportListeners.delete(listener);
}

/**
 * Strip a specific column from single object or array of objects.
 */
export function stripColumn<T>(data: T, column: string): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => stripColumn(item, column)) as unknown as T;
  }
  if (typeof data === 'object') {
    const copy: any = { ...data };
    delete copy[column];
    return copy as T;
  }
  return data;
}

/**
 * Strip 'updated_at' field recursively or from single/array objects.
 * Used as defensive fallback when production Supabase lacks 'updated_at' column (PGRST204).
 */
export function stripUpdatedAt<T>(data: T): T {
  return stripColumn(data, 'updated_at');
}

/**
 * Extract missing column name from PostgREST PGRST204 or Postgres 42703 error messages.
 */
export function extractMissingColumnName(error: any): string | null {
  if (!error) return null;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  const pgrstMatch = msg.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
  if (pgrstMatch) return pgrstMatch[1];
  const pgMatch = msg.match(/column ['"]([a-zA-Z0-9_]+)['"](?:\s+of relation|\s+does not exist)/i);
  if (pgMatch) return pgMatch[1];
  if (error.code === 'PGRST204' || error.code === '42703') {
    const lower = msg.toLowerCase();
    if (lower.includes('extra_addresses')) return 'extra_addresses';
    if (lower.includes('phone2')) return 'phone2';
    if (lower.includes('updated_at')) return 'updated_at';
  }
  return null;
}

/**
 * Checks if an error returned by Supabase / PostgREST indicates a missing column (e.g. PGRST204)
 */
export function isMissingColumnError(error: any, column = 'updated_at'): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return msg.includes(column.toLowerCase()) || msg.includes('pgrst204') || msg.includes('does not exist');
}

/**
 * Executes a defensive upsert to Supabase.
 * If PostgREST/Postgres rejects with PGRST204 / 42703 for any missing column (e.g. 'extra_addresses',
 * 'phone2', 'updated_at'), it iteratively strips the missing column(s) and retries.
 */
export async function safeUpsert(
  client: SupabaseClient,
  table: string,
  rows: any | any[],
  onConflict = 'id'
): Promise<{ data: any; error: any; stripped?: boolean; strippedColumns?: string[] }> {
  let currentRows = rows;
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await client.from(table).upsert(currentRows, { onConflict });

    if (!res.error) {
      if (table === 'customers' && !strippedColumns.includes('extra_addresses')) {
        const hadExtraAddr = Array.isArray(currentRows)
          ? currentRows.some(r => r && Object.prototype.hasOwnProperty.call(r, 'extra_addresses'))
          : Boolean(currentRows && Object.prototype.hasOwnProperty.call(currentRows, 'extra_addresses'));
        if (hadExtraAddr) {
          setCloudExtraAddressesUnsupported(false);
        }
      }
      return {
        data: res.data,
        error: null,
        stripped: strippedColumns.length > 0,
        strippedColumns,
      };
    }

    let missingCol = extractMissingColumnName(res.error);
    if (!missingCol && isMissingColumnError(res.error, 'updated_at') && !strippedColumns.includes('updated_at')) {
      missingCol = 'updated_at';
    }

    if (missingCol && !strippedColumns.includes(missingCol)) {
      console.warn(
        `[Defensive Supabase] Table '${table}' lacks '${missingCol}' column (${res.error.code || 'PGRST204'}). Retrying without '${missingCol}'...`
      );
      strippedColumns.push(missingCol);
      if (table === 'customers' && missingCol === 'extra_addresses') {
        setCloudExtraAddressesUnsupported(true);
      }
      currentRows = stripColumn(currentRows, missingCol);
      continue;
    }

    console.error(`[Defensive Supabase] Upsert failed for table '${table}':`, res.error);
    return {
      data: res.data,
      error: res.error,
      stripped: strippedColumns.length > 0,
      strippedColumns,
    };
  }

  return {
    data: null,
    error: { message: `Exceeded max column-stripping retries for table '${table}'` },
    stripped: strippedColumns.length > 0,
    strippedColumns,
  };
}

/**
 * Chia nhỏ dữ liệu thành các mẩu (chunks) để đẩy lên Supabase an toàn,
 * chống lỗi vượt quá kích thước payload khi có hàng nghìn dòng.
 * Sử dụng safeUpsert để tự động xử lý trường hợp Supabase thiếu updated_at (PGRST204).
 */
async function upsertInChunks(client: SupabaseClient, table: string, rows: any[], chunkSize = 500): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await safeUpsert(client, table, chunk, 'id');
    if (error) {
      throw new Error(`Lỗi đồng bộ ${table} (dòng ${i + 1}-${i + chunk.length}): ${error.message}`);
    }
  }
}

/**
 * Tải toàn bộ dữ liệu bảng từ Supabase bằng cơ chế phân trang (Pagination Loop).
 * Vượt qua giới hạn mặc định 1000 dòng của Supabase/PostgREST, mở rộng lên 20.000+ bản ghi!
 */
async function fetchTableWithPagination(
  client: SupabaseClient,
  table: string,
  maxLimit = 20000
): Promise<any[]> {
  const batchSize = 1000;
  const allRows: any[] = [];
  const seenIds = new Set<string>();
  let from = 0;

  while (from < maxLimit) {
    const to = from + batchSize - 1;
    let data: any[] | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await client
          .from(table)
          .select('*')
          .range(from, to)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });

        if (!res.error) {
          data = res.data;
          lastError = null;
          break;
        }
        lastError = res.error;
      } catch (err) {
        lastError = err;
      }
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    if (lastError) {
      console.error(`Error fetching paginated data from ${table} (range ${from}-${to}):`, lastError);
      throw new Error(`Failed fetching ${table}: ${lastError.message || lastError}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row && row.id) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          allRows.push(row);
        }
      } else {
        allRows.push(row);
      }
    }

    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}

/**
 * Đẩy toàn bộ dữ liệu hiện tại lên Supabase (Upsert all in chunks)
 */
export const pushAllDataToCloud = async (data: {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  settings: ReceiptSettings;
}): Promise<{ success: boolean; message: string }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Chưa cấu hình hoặc kết nối Supabase!' };
  }

  try {
    // 1. Products (chunked)
    if (data.products.length > 0) {
      const pRows = data.products.map(transformProductToDb);
      await upsertInChunks(client, 'products', pRows, 500);
    }

    // 2. Customers (chunked - hỗ trợ > 10.000 khách)
    if (data.customers.length > 0) {
      const cRows = data.customers.map(transformCustomerToDb);
      await upsertInChunks(client, 'customers', cRows, 500);
    }

    // 3. Orders (chunked)
    if (data.orders.length > 0) {
      const oRows = data.orders.map(transformOrderToDb);
      await upsertInChunks(client, 'orders', oRows, 500);
    }

    // 4. Debt Payments (chunked)
    if (data.debtPayments.length > 0) {
      const dpRows = data.debtPayments.map(transformDebtPaymentToDb);
      await upsertInChunks(client, 'debt_payments', dpRows, 500);
    }

    // 5. Store Settings
    const { error: sErr } = await safeUpsert(client, 'store_settings', {
      id: 'default_settings',
      data: data.settings,
      updated_at: new Date().toISOString(),
    }, 'id');
    if (sErr) throw new Error(`Lỗi đồng bộ cài đặt: ${sErr.message}`);

    const now = new Date().toISOString();
    const config = getSupabaseConfig();
    saveSupabaseConfig({ ...config, lastSyncedAt: now });

    return {
      success: true,
      message: `Đồng bộ thành công ${data.products.length} món, ${data.customers.length} khách, ${data.orders.length} đơn hàng lên Cloud!`,
    };
  } catch (e: any) {
    return { success: false, message: e.message || 'Đồng bộ thất bại' };
  }
};

/**
 * Reconstruct any real dishes found inside order item snapshots that are missing from the product catalog.
 * Never resurrects legacy SP01-SP08 demo items or tombstoned product IDs.
 */
export function reconstructMissingProductsFromOrders(
  orders: Order[],
  existingProducts: Product[] = [],
  excludedIds: Set<string> = new Set()
): Product[] {
  const existingIds = new Set<string>();
  const existingNames = new Set<string>();
  for (const p of existingProducts || []) {
    if (!p) continue;
    if (p.id) existingIds.add(p.id);
    const norm = removeVietnameseTones((p.name || '').toLowerCase()).trim();
    if (norm) existingNames.add(norm);
  }

  const reconstructed: Product[] = [];
  const baseTs = Date.now();
  let seq = 0;

  for (const o of orders || []) {
    for (const item of o?.items || []) {
      if (!item || !item.name) continue;
      const pid = String(item.productId || '').trim();
      if (pid && (DEMO_PRODUCT_IDS.has(pid) || /^SP0[1-8]$/.test(pid) || excludedIds.has(pid))) {
        continue;
      }
      const normName = removeVietnameseTones(item.name.toLowerCase()).trim();
      if (!normName) continue;
      if ((pid && existingIds.has(pid)) || existingNames.has(normName)) {
        continue;
      }

      const assignedId =
        pid && !existingIds.has(pid)
          ? pid
          : `SP_${baseTs}_${seq}_${Math.random().toString(36).substring(2, 6)}`;
      seq++;
      const price = Number(item.price) || 0;
      const cost = Number(item.cost) || Math.round(price * 0.65);

      const newProduct: Product = {
        id: assignedId,
        name: item.name.trim(),
        category: 'Đặc sản tuyển chọn',
        unit: item.unit || 'Phần',
        price,
        cost,
        stock: 20,
        image: item.image || '🌭',
        createdAt: o.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      existingIds.add(assignedId);
      existingNames.add(normName);
      reconstructed.push(newProduct);
    }
  }

  return reconstructed;
}

export interface CloudTombstoneLedger {
  deletedProductIds: string[];
  deletedOrderIds: string[];
  deletedCustomerIds: string[];
  updatedAt: string;
}

const DEFAULT_DEMO_CUST_LIST = Array.from(DEMO_CUSTOMER_IDS);
const DEFAULT_DEMO_PROD_LIST = Array.from(DEMO_PRODUCT_IDS);

function sanitizeLedgerIds(list: any, defaults: string[] = []): string[] {
  const arr = Array.isArray(list)
    ? list.map(x => String(x || '').trim()).filter(Boolean)
    : [];
  const merged = Array.from(new Set([...defaults, ...arr]));
  return merged.length > 2000 ? merged.slice(merged.length - 2000) : merged;
}

/**
 * Fetch the shared Cloud Tombstone Ledger stored in `store_settings` (`id = 'cloud_tombstones_v1'`).
 * Ensures cross-device deletions stay deleted regardless of stale localStorage on other PCs/phones.
 */
export const fetchCloudTombstones = async (
  clientArg?: SupabaseClient | null
): Promise<CloudTombstoneLedger> => {
  const fallback: CloudTombstoneLedger = {
    deletedProductIds: DEFAULT_DEMO_PROD_LIST,
    deletedOrderIds: [],
    deletedCustomerIds: DEFAULT_DEMO_CUST_LIST,
    updatedAt: '',
  };
  const client = clientArg === undefined ? getSupabaseClient() : clientArg;
  if (!client) return fallback;

  try {
    const { data, error } = await client
      .from('store_settings')
      .select('data, updated_at')
      .eq('id', CLOUD_TOMBSTONES_ROW_ID)
      .maybeSingle();

    if (error || !data || !data.data || typeof data.data !== 'object') {
      return fallback;
    }

    const rawData: any = data.data;
    return {
      deletedProductIds: sanitizeLedgerIds(rawData.deletedProductIds, DEFAULT_DEMO_PROD_LIST),
      deletedOrderIds: sanitizeLedgerIds(rawData.deletedOrderIds, []),
      deletedCustomerIds: sanitizeLedgerIds(rawData.deletedCustomerIds, DEFAULT_DEMO_CUST_LIST),
      updatedAt: String(rawData.updatedAt || data.updated_at || ''),
    };
  } catch (e) {
    console.warn('fetchCloudTombstones error:', e);
    return fallback;
  }
};

/**
 * Append newly deleted entity IDs into the shared Cloud Tombstone Ledger (`cloud_tombstones_v1`).
 */
export const pushCloudTombstones = async (patch: {
  deletedProductIds?: string[];
  deletedOrderIds?: string[];
  deletedCustomerIds?: string[];
}): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const current = await fetchCloudTombstones(client);
    const nextLedger: CloudTombstoneLedger = {
      deletedProductIds: sanitizeLedgerIds(
        [...current.deletedProductIds, ...(patch.deletedProductIds || [])],
        DEFAULT_DEMO_PROD_LIST
      ),
      deletedOrderIds: sanitizeLedgerIds([...current.deletedOrderIds, ...(patch.deletedOrderIds || [])], []),
      deletedCustomerIds: sanitizeLedgerIds(
        [...current.deletedCustomerIds, ...(patch.deletedCustomerIds || [])],
        DEFAULT_DEMO_CUST_LIST
      ),
      updatedAt: new Date().toISOString(),
    };

    const { error } = await safeUpsert(
      client,
      'store_settings',
      {
        id: CLOUD_TOMBSTONES_ROW_ID,
        data: nextLedger,
        updated_at: nextLedger.updatedAt,
      },
      'id'
    );

    if (error) {
      console.warn('pushCloudTombstones error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('pushCloudTombstones error:', e);
    return false;
  }
};

export interface CloudPullLocalInput {
  products?: Product[];
  customers?: Customer[];
  orders?: Order[];
  debtPayments?: DebtPayment[];
  excludedProductIds?: string[];
  excludedOrderIds?: string[];
  excludedCustomerIds?: string[];
  dirtyProductIds?: string[];
  dirtyOrderIds?: string[];
  dirtyCustomerIds?: string[];
}

export interface CloudPullReconcileResult {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  settings?: ReceiptSettings;
  cloudTombstones: CloudTombstoneLedger;
  localPreservedCount: number;
  unsyncedLocalProducts: Product[];
  unsyncedLocalOrders: Order[];
  unsyncedLocalCustomers?: Customer[];
}

/**
 * Pure reconciliation engine combining authoritative Cloud state, Cloud Tombstone Ledger,
 * and genuine dirty local edits (ADR-0023). Exported for direct deterministic verification.
 */
export function reconcileCloudAndLocalPullData(params: {
  cloudProductsRaw: Product[];
  cloudCustomersRaw: Customer[];
  cloudOrdersRaw: Order[];
  cloudDebtPaymentsRaw: DebtPayment[];
  cloudHasExtraAddressesCol: boolean;
  cloudTombstones: CloudTombstoneLedger;
  cloudCustomersOk?: boolean;
  cloudDebtPaymentsOk?: boolean;
  settings?: ReceiptSettings;
  localData?: CloudPullLocalInput;
}): CloudPullReconcileResult {
  const {
    cloudProductsRaw,
    cloudCustomersRaw,
    cloudOrdersRaw,
    cloudDebtPaymentsRaw,
    cloudHasExtraAddressesCol,
    cloudTombstones,
    cloudCustomersOk = true,
    cloudDebtPaymentsOk = true,
    settings,
    localData,
  } = params;

  const excludedProdSet = new Set([
    ...DEFAULT_DEMO_PROD_LIST,
    ...(localData?.excludedProductIds || []),
    ...(cloudTombstones.deletedProductIds || []),
  ]);
  const excludedOrdSet = new Set([
    ...(localData?.excludedOrderIds || []),
    ...(cloudTombstones.deletedOrderIds || []),
  ]);
  const excludedCustSet = new Set([
    ...DEFAULT_DEMO_CUST_LIST,
    ...(localData?.excludedCustomerIds || []),
    ...(cloudTombstones.deletedCustomerIds || []),
  ]);

  const cloudProducts = (cloudProductsRaw || []).filter(
    p => p && p.id && !DEMO_PRODUCT_IDS.has(p.id) && !excludedProdSet.has(p.id)
  );
  const cloudCustomers = (cloudCustomersRaw || []).filter(
    c => c && c.id && (c.id === 'KH01' || !excludedCustSet.has(c.id))
  );
  const cloudOrders = (cloudOrdersRaw || []).filter(
    o => o && o.id && !excludedOrdSet.has(o.id)
  );
  const cloudDebtPayments = cloudDebtPaymentsRaw || [];

  let finalProducts = cloudProducts;
  let finalCustomers = cloudCustomersOk ? cloudCustomers : (localData?.customers || []);
  let finalOrders = cloudOrders;
  let finalDebtPayments = cloudDebtPaymentsOk ? cloudDebtPayments : (localData?.debtPayments || []);
  let localPreservedCount = 0;
  let unsyncedLocalProducts: Product[] = [];
  let unsyncedLocalOrders: Order[] = [];
  let unsyncedLocalCustomers: Customer[] = [];

  if (localData) {
    if (localData.products && localData.products.length > 0) {
      const cleanLocalProds = localData.products.filter(
        p => p && p.id && !DEMO_PRODUCT_IDS.has(p.id) && !excludedProdSet.has(p.id)
      );
      const useDirtyGating = localData.dirtyProductIds !== undefined && cloudProducts.length > 0;
      const dirtyProdSet = new Set(localData.dirtyProductIds || []);
      const cloudProdIdSet = new Set(cloudProducts.map(p => p.id));

      const eligibleLocalProds = useDirtyGating
        ? cleanLocalProds.filter(p => cloudProdIdSet.has(p.id) || dirtyProdSet.has(p.id))
        : cleanLocalProds;

      const pMerge = mergeProductsWithConflictResolution(eligibleLocalProds, cloudProducts);
      if (useDirtyGating) {
        finalProducts = pMerge.merged;
      } else {
        // Legacy anti-shrink guard when dirty tracking isn't provided
        finalProducts = pMerge.merged.length >= eligibleLocalProds.length ? pMerge.merged : eligibleLocalProds;
      }
      unsyncedLocalProducts = pMerge.localPreserved;
      localPreservedCount += pMerge.localPreserved.length;
    }

    if (localData.customers && localData.customers.length > 0 && cloudCustomersOk) {
      const cleanLocalCustomers = localData.customers.filter(
        c => c && c.id && (c.id === 'KH01' || !excludedCustSet.has(c.id))
      );
      const useDirtyCustGating = localData.dirtyCustomerIds !== undefined && cloudCustomers.length > 0;
      const dirtyCustSet = new Set(localData.dirtyCustomerIds || []);
      const cloudCustIdSet = new Set(cloudCustomers.map(c => c.id));

      const eligibleLocalCustomers = useDirtyCustGating
        ? cleanLocalCustomers.filter(c => cloudCustIdSet.has(c.id) || dirtyCustSet.has(c.id))
        : cleanLocalCustomers;

      const cMerge = mergeCustomersWithConflictResolution(eligibleLocalCustomers, cloudCustomers, {
        preserveLocalExtraAddressesWhenCloudLacksColumn: !cloudHasExtraAddressesCol,
      });
      finalCustomers = cMerge.merged;
      unsyncedLocalCustomers = cMerge.localPreserved;
      localPreservedCount += cMerge.localPreserved.length;
    }

    if (localData.orders && localData.orders.length > 0) {
      const cleanLocalOrders = localData.orders.filter(o => o && o.id && !excludedOrdSet.has(o.id));
      const useDirtyOrderGating = localData.dirtyOrderIds !== undefined && cloudOrders.length > 0;
      const dirtyOrdSet = new Set(localData.dirtyOrderIds || []);
      const cloudOrderMap = new Map(cloudOrders.map(o => [o.id, o]));

      const eligibleLocalOrders = useDirtyOrderGating
        ? cleanLocalOrders.filter(o => cloudOrderMap.has(o.id) || dirtyOrdSet.has(o.id))
        : cleanLocalOrders;

      const unsyncedOrders = eligibleLocalOrders.filter(o => {
        const cloudO = cloudOrderMap.get(o.id);
        if (!cloudO) return true;
        return getEntityTimestamp(o) > getEntityTimestamp(cloudO);
      });
      finalOrders = mergeOrders(eligibleLocalOrders, cloudOrders);
      unsyncedLocalOrders = unsyncedOrders;
      localPreservedCount += unsyncedOrders.length;
    }

    if (localData.debtPayments && localData.debtPayments.length > 0 && cloudDebtPaymentsOk) {
      finalDebtPayments = mergeDebtPayments(localData.debtPayments, cloudDebtPayments);
    }
  }

  const reconstructed = reconstructMissingProductsFromOrders(finalOrders, finalProducts, excludedProdSet);
  if (reconstructed.length > 0) {
    finalProducts = [...finalProducts, ...reconstructed];
    unsyncedLocalProducts = [...unsyncedLocalProducts, ...reconstructed];
  }

  return {
    products: finalProducts,
    customers: finalCustomers,
    orders: finalOrders,
    debtPayments: finalDebtPayments,
    settings,
    cloudTombstones,
    localPreservedCount,
    unsyncedLocalProducts,
    unsyncedLocalOrders,
    unsyncedLocalCustomers,
  };
}

/**
 * Tải toàn bộ dữ liệu từ Supabase về kèm cơ chế giải quyết xung đột (ADR-0008 & ADR-0023)
 * Sử dụng fetchTableWithPagination để vượt qua giới hạn 1000 dòng của Supabase.
 */
export const pullAllDataFromCloud = async (
  localData?: CloudPullLocalInput
): Promise<CloudPullReconcileResult | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    let customersOk = true;
    let debtPaymentsOk = true;

    const [pData, cData, oData, dpData, sRes, cloudTombstones] = await Promise.all([
      fetchTableWithPagination(client, 'products', 20000),
      fetchTableWithPagination(client, 'customers', 20000).catch(err => {
        customersOk = false;
        console.warn('Customers pull fault-isolated:', err);
        return [] as any[];
      }),
      fetchTableWithPagination(client, 'orders', 20000),
      fetchTableWithPagination(client, 'debt_payments', 20000).catch(err => {
        debtPaymentsOk = false;
        console.warn('Debt payments pull fault-isolated:', err);
        return [] as any[];
      }),
      Promise.resolve(client.from('store_settings').select('*').eq('id', 'default_settings').maybeSingle()).catch(() => ({
        data: null,
        error: null,
      })),
      fetchCloudTombstones(client),
    ]);

    const cloudProducts = pData.map(transformProductFromDb);
    const cloudCustomers = cData.map(transformCustomerFromDb);
    const cloudOrders = oData.map(transformOrderFromDb);
    const cloudDebtPayments = dpData.map(transformDebtPaymentFromDb);

    // Detect if Cloud `customers` table already has `extra_addresses` column
    const cloudHasExtraAddressesCol =
      cData.length > 0 && Object.prototype.hasOwnProperty.call(cData[0], 'extra_addresses');
    if (cData.length > 0) {
      setCloudExtraAddressesUnsupported(!cloudHasExtraAddressesCol);
    }

    return reconcileCloudAndLocalPullData({
      cloudProductsRaw: cloudProducts,
      cloudCustomersRaw: cloudCustomers,
      cloudOrdersRaw: cloudOrders,
      cloudDebtPaymentsRaw: cloudDebtPayments,
      cloudHasExtraAddressesCol,
      cloudTombstones,
      cloudCustomersOk: customersOk,
      cloudDebtPaymentsOk: debtPaymentsOk,
      settings: (sRes as any)?.data?.data as ReceiptSettings | undefined,
      localData,
    });
  } catch (e) {
    console.error('Failed to pull data from Supabase:', e);
    return null;
  }
};

export interface ProductStockAdjustmentResult {
  productId: string;
  success: boolean;
  newStock?: number;
  method?: 'rpc' | 'fallback';
}

/**
 * Điều chỉnh tồn kho nguyên tử (Atomic Stock Adjustment - ADR-0008)
 * Gọi hàm SQL RPC 'adjust_product_stock' trên Supabase để ngăn chặn Race Condition
 * khi nhiều thiết bị (PC quầy & ĐT chủ) tạo đơn đồng thời.
 * Tự động kích hoạt cơ chế Fallback (đọc tồn kho Cloud + tính delta + ghi lại) nếu RPC chưa được tạo.
 */
export const cloudAdjustProductStock = async (
  productId: string,
  delta: number
): Promise<{ success: boolean; newStock?: number; method?: 'rpc' | 'fallback' }> => {
  if (!productId) return { success: false };
  const client = getSupabaseClient();
  if (!client) return { success: false };

  try {
    // 1. Thử gọi hàm RPC adjust_product_stock nguyên tử trên Supabase
    const { data, error } = await client.rpc('adjust_product_stock', {
      p_id: productId,
      p_delta: delta,
    });

    if (!error && data !== null && data !== undefined) {
      return { success: true, newStock: Number(data), method: 'rpc' };
    }

    console.warn('RPC adjust_product_stock chưa khả dụng hoặc lỗi, kích hoạt local delta fallback:', error?.message);

    // 2. Fallback: Đọc tồn kho hiện tại trên Cloud, tính delta và ghi lại kèm updated_at
    const { data: currentData, error: fetchErr } = await client
      .from('products')
      .select('stock')
      .eq('id', productId)
      .maybeSingle();

    if (!fetchErr && currentData) {
      const currentStock = Number(currentData.stock) || 0;
      const updatedStock = calculateStockDelta(currentStock, delta);
      const now = new Date().toISOString();

      let { error: updateErr } = await client
        .from('products')
        .update({ stock: updatedStock, updated_at: now })
        .eq('id', productId);

      if (updateErr && isMissingColumnError(updateErr, 'updated_at')) {
        const retryRes = await client
          .from('products')
          .update({ stock: updatedStock })
          .eq('id', productId);
        updateErr = retryRes.error;
      }

      if (!updateErr) {
        return { success: true, newStock: updatedStock, method: 'fallback' };
      }
    }

    return { success: false };
  } catch (e) {
    console.error('cloudAdjustProductStock error:', e);
    return { success: false };
  }
};

/**
 * Điều chỉnh tồn kho hàng loạt nguyên tử cho giỏ hàng nhiều món
 */
export const cloudAdjustProductsStockBatch = async (
  adjustments: Array<{ productId: string; delta: number }>
): Promise<ProductStockAdjustmentResult[]> => {
  const results: ProductStockAdjustmentResult[] = [];
  for (const adj of adjustments) {
    const res = await cloudAdjustProductStock(adj.productId, adj.delta);
    results.push({
      productId: adj.productId,
      success: res.success,
      newStock: res.newStock,
      method: res.method,
    });
  }
  return results;
};

// Single item sync helpers
export const cloudSyncProduct = async (p: Product): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await safeUpsert(client, 'products', transformProductToDb(p));
    if (error) {
      console.error('cloudSyncProduct error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('cloudSyncProduct error:', e);
    return false;
  }
};

export const cloudDeleteProduct = async (id: string): Promise<{ success: boolean }> => {
  const cleanId = String(id || '').trim();
  if (!cleanId) return { success: true };
  const client = getSupabaseClient();
  if (!client) return { success: false };
  try {
    const { error } = await client.from('products').delete().eq('id', cleanId);
    if (error) {
      console.error('cloudDeleteProduct error:', error);
      return { success: false };
    }
    return { success: true };
  } catch (e) {
    console.error('cloudDeleteProduct error:', e);
    return { success: false };
  }
};

export const cloudDeleteProductsBatch = async (
  ids: string[]
): Promise<{ success: boolean; deletedCount: number; chunksCount: number; error?: any }> => {
  const cleanIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if (cleanIds.length === 0) return { success: true, deletedCount: 0, chunksCount: 0 };
  const client = getSupabaseClient();
  if (!client) return { success: false, deletedCount: 0, chunksCount: 0 };
  return executeChunkedTableDelete(client, 'products', cleanIds, 100);
};

export const cloudSyncCustomer = async (c: Customer): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await safeUpsert(client, 'customers', transformCustomerToDb(c));
    if (error) {
      console.error('cloudSyncCustomer error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('cloudSyncCustomer error:', e);
    return false;
  }
};

export const cloudDeleteCustomer = async (id: string): Promise<{ success: boolean }> => {
  const cleanId = String(id || '').trim();
  if (!cleanId) return { success: true };
  const client = getSupabaseClient();
  if (!client) return { success: false };
  try {
    const { error } = await client.from('customers').delete().eq('id', cleanId);
    if (error) {
      console.error('cloudDeleteCustomer error:', error);
      return { success: false };
    }
    return { success: true };
  } catch (e) {
    console.error('cloudDeleteCustomer error:', e);
    return { success: false };
  }
};

export const executeChunkedTableDelete = async (
  client: SupabaseClient,
  table: string,
  ids: string[],
  chunkSize = 100
): Promise<{ success: boolean; deletedCount: number; chunksCount: number; error?: any }> => {
  const uniqueIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { success: true, deletedCount: 0, chunksCount: 0 };
  }
  const safeChunkSize = Math.max(1, Math.floor(chunkSize || 100));
  let deletedCount = 0;
  let chunksCount = 0;
  try {
    for (let i = 0; i < uniqueIds.length; i += safeChunkSize) {
      const chunk = uniqueIds.slice(i, i + safeChunkSize);
      chunksCount++;
      const { error } = await client.from(table).delete().in('id', chunk);
      if (error) {
        console.error(`cloudDeleteBatch(${table}) error (chunk ${i}-${i + chunk.length}):`, error);
        return { success: false, deletedCount, chunksCount, error };
      }
      deletedCount += chunk.length;
    }
    return { success: true, deletedCount, chunksCount };
  } catch (e) {
    console.error(`cloudDeleteBatch(${table}) error:`, e);
    return { success: false, deletedCount, chunksCount, error: e };
  }
};

export const executeChunkedCustomerDelete = async (
  client: SupabaseClient,
  ids: string[],
  chunkSize = 100
): Promise<{ success: boolean; deletedCount: number; chunksCount: number; error?: any }> => {
  return executeChunkedTableDelete(client, 'customers', ids, chunkSize);
};

export const cloudDeleteCustomersBatch = async (
  ids: string[],
  chunkSize = 100
): Promise<{ success: boolean; deletedCount: number; error?: any }> => {
  const uniqueIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { success: true, deletedCount: 0 };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, deletedCount: 0 };
  }
  const res = await executeChunkedCustomerDelete(client, uniqueIds, chunkSize);
  return { success: res.success, deletedCount: res.deletedCount, error: res.error };
};

// Batch items sync helpers
export const cloudSyncProductsBatch = async (products: Product[]): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || products.length === 0) return true;
  try {
    const pRows = products.map(transformProductToDb);
    await upsertInChunks(client, 'products', pRows, 500);
    return true;
  } catch (e) {
    console.error('cloudSyncProductsBatch error:', e);
    return false;
  }
};

export const cloudSyncCustomersBatch = async (customers: Customer[]): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || customers.length === 0) return true;
  try {
    const cRows = customers.map(transformCustomerToDb);
    await upsertInChunks(client, 'customers', cRows, 500);
    return true;
  } catch (e) {
    console.error('cloudSyncCustomersBatch error:', e);
    return false;
  }
};

export const cloudSyncOrdersBatch = async (orders: Order[]): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || orders.length === 0) return true;
  try {
    const oRows = orders.map(transformOrderToDb);
    await upsertInChunks(client, 'orders', oRows, 500);
    return true;
  } catch (e) {
    console.error('cloudSyncOrdersBatch error:', e);
    return false;
  }
};

export const cloudSyncOrder = async (o: Order): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await safeUpsert(client, 'orders', transformOrderToDb(o));
    if (error) {
      console.error('cloudSyncOrder error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('cloudSyncOrder error:', e);
    return false;
  }
};

export const cloudDeleteOrder = async (id: string): Promise<{ success: boolean }> => {
  const cleanId = String(id || '').trim();
  if (!cleanId) return { success: true };
  const client = getSupabaseClient();
  if (!client) return { success: false };
  try {
    const { error } = await client.from('orders').delete().eq('id', cleanId);
    if (error) {
      console.error('cloudDeleteOrder error:', error);
      return { success: false };
    }
    return { success: true };
  } catch (e) {
    console.error('cloudDeleteOrder error:', e);
    return { success: false };
  }
};

export const cloudDeleteOrdersBatch = async (
  ids: string[]
): Promise<{ success: boolean; deletedCount: number; chunksCount: number; error?: any }> => {
  const cleanIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if (cleanIds.length === 0) return { success: true, deletedCount: 0, chunksCount: 0 };
  const client = getSupabaseClient();
  if (!client) return { success: false, deletedCount: 0, chunksCount: 0 };
  return executeChunkedTableDelete(client, 'orders', cleanIds, 100);
};

export const cloudSyncDebtPayment = async (dp: DebtPayment) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await safeUpsert(client, 'debt_payments', transformDebtPaymentToDb(dp));
    if (error) console.error('cloudSyncDebtPayment error:', error);
  } catch (e) {
    console.error('cloudSyncDebtPayment error:', e);
  }
};

export const cloudSyncDebtPaymentsBatch = async (debtPayments: DebtPayment[]) => {
  const client = getSupabaseClient();
  if (!client || debtPayments.length === 0) return;
  try {
    const dpRows = debtPayments.map(transformDebtPaymentToDb);
    await upsertInChunks(client, 'debt_payments', dpRows, 500);
  } catch (e) {
    console.error('cloudSyncDebtPaymentsBatch error:', e);
  }
};

export const cloudSyncSettings = async (s: ReceiptSettings) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await safeUpsert(client, 'store_settings', {
      id: 'default_settings',
      data: s,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('cloudSyncSettings error:', error);
  } catch (e) {
    console.error('cloudSyncSettings error:', e);
  }
};

/**
 * Fetch store-wide authentication config (`store_auth_config_v1`) from Cloud `store_settings`.
 */
export const fetchStoreAuthConfig = async (
  clientArg?: SupabaseClient | null
): Promise<StoreAuthConfig | null> => {
  const client = clientArg === undefined ? getSupabaseClient() : clientArg;
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('store_settings')
      .select('data, updated_at')
      .eq('id', STORE_AUTH_CONFIG_ROW_ID)
      .maybeSingle();

    if (error || !data || !data.data || typeof data.data !== 'object') {
      return null;
    }

    const raw: any = data.data;
    if (typeof raw.username !== 'string' || typeof raw.passwordHash !== 'string') {
      return null;
    }

    return {
      requireSignIn: Boolean(raw.requireSignIn),
      username: raw.username,
      passwordHash: raw.passwordHash,
      salt: String(raw.salt || 'mxc_salt_v1'),
      sessionTtlDays: Number(raw.sessionTtlDays) || 30,
      updatedAt: String(raw.updatedAt || data.updated_at || ''),
    };
  } catch (e) {
    console.warn('fetchStoreAuthConfig error:', e);
    return null;
  }
};

/**
 * Persist updated store authentication config (`store_auth_config_v1`) to Cloud `store_settings`.
 */
export const pushStoreAuthConfig = async (
  config: StoreAuthConfig,
  clientArg?: SupabaseClient | null
): Promise<boolean> => {
  const client = clientArg === undefined ? getSupabaseClient() : clientArg;
  if (!client) return false;

  try {
    const { error } = await safeUpsert(
      client,
      'store_settings',
      {
        id: STORE_AUTH_CONFIG_ROW_ID,
        data: config,
        updated_at: config.updatedAt || new Date().toISOString(),
      },
      'id'
    );
    if (error) {
      console.warn('pushStoreAuthConfig error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('pushStoreAuthConfig error:', e);
    return false;
  }
};

/**
 * Subscribe to Supabase Realtime Postgres Changes across public tables so remote writes
 * trigger near-instant incremental cloud reconciliation without full reload.
 */
export const subscribeToCloudRealtimeChanges = (
  onRemoteChange: (table: string) => void
): (() => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channel = client
      .channel('mxc-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          if (payload?.table) {
            onRemoteChange(String(payload.table));
          }
        }
      )
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch {
        // Ignore cleanup errors
      }
    };
  } catch (e) {
    console.warn('subscribeToCloudRealtimeChanges error:', e);
    return () => {};
  }
};

export const SUPABASE_SCHEMA_SQL = `-- MEXUCXICH CUISINE - SUPABASE SCHEMA (ADR-0006 & ADR-0008)
create table if not exists products (
  id text primary key,
  name text not null,
  category text default 'Đồ tự làm',
  unit text default 'Gói',
  price numeric default 0,
  cost numeric default 0,
  stock numeric default 0,
  image text default '🌭',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text default '',
  phone2 text,
  address text default '',
  extra_addresses jsonb default '[]'::jsonb,
  debt numeric default 0,
  total_spent numeric default 0,
  order_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  customer_id text,
  customer_name text,
  customer_phone text,
  customer_address text,
  order_type text default 'direct',
  status text default 'completed',
  items jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  discount_type text default 'cash',
  discount_value numeric default 0,
  discount_amount numeric default 0,
  shipping_fee numeric default 0,
  shipping_note text default '',
  total numeric default 0,
  payment_method text default 'cash',
  cash_given numeric default 0,
  change numeric default 0,
  paid_amount numeric default 0,
  debt_amount numeric default 0
);

create table if not exists debt_payments (
  id text primary key,
  customer_id text,
  customer_name text,
  amount numeric default 0,
  payment_method text default 'cash',
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists store_settings (
  id text primary key default 'default_settings',
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Đảm bảo tương thích ngược: Bổ sung cột mới nếu bảng đã tồn tại từ trước
alter table customers add column if not exists extra_addresses jsonb default '[]'::jsonb;
alter table customers add column if not exists phone2 text;
alter table products add column if not exists updated_at timestamptz default now();
alter table customers add column if not exists updated_at timestamptz default now();
alter table orders add column if not exists updated_at timestamptz default now();
alter table debt_payments add column if not exists updated_at timestamptz default now();
alter table store_settings add column if not exists updated_at timestamptz default now();
notify pgrst, 'reload schema';

-- Hàm điều chỉnh tồn kho nguyên tử (Atomic Stock Adjustment - ADR-0008)
create or replace function adjust_product_stock(p_id text, p_delta numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_new_stock numeric;
begin
  update products
  set stock = greatest(0, coalesce(stock, 0) + p_delta),
      updated_at = now()
  where id = p_id
  returning stock into v_new_stock;

  return v_new_stock;
end;
$$;

grant execute on function adjust_product_stock(p_id text, p_delta numeric) to anon, authenticated, service_role;

alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table debt_payments enable row level security;
alter table store_settings enable row level security;

drop policy if exists "Anon full access products" on products;
create policy "Anon full access products" on products for all using (true) with check (true);

drop policy if exists "Anon full access customers" on customers;
create policy "Anon full access customers" on customers for all using (true) with check (true);

drop policy if exists "Anon full access orders" on orders;
create policy "Anon full access orders" on orders for all using (true) with check (true);

drop policy if exists "Anon full access debt_payments" on debt_payments;
create policy "Anon full access debt_payments" on debt_payments for all using (true) with check (true);

drop policy if exists "Anon full access store_settings" on store_settings;
create policy "Anon full access store_settings" on store_settings for all using (true) with check (true);
`;
