import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Customer, Order, DebtPayment, ReceiptSettings, CloudConfig } from '../types';
import {
  calculateStockDelta,
  getEntityTimestamp,
  resolveProductConflict,
  resolveCustomerConflict,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
} from './syncConflict';

export {
  calculateStockDelta,
  getEntityTimestamp,
  resolveProductConflict,
  resolveCustomerConflict,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
};

const CLOUD_CONFIG_KEY = 'mexucxich_cloud_config';

export const DEFAULT_SUPABASE_URL = 'https://lfbrlicpptedjypryswo.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XmpBtPNysCkaLPnPR1gSkQ_eCfnjNbt';

export const getSupabaseConfig = (): CloudConfig => {
  try {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading cloud config:', e);
  }

  // Fallback to Vite env variables or project defaults
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

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

export const transformCustomerToDb = (c: Customer) => ({
  id: c.id,
  name: c.name,
  phone: c.phone || '',
  address: c.address || '',
  debt: c.debt || 0,
  total_spent: c.totalSpent || 0,
  order_count: c.orderCount || 0,
  created_at: c.createdAt || new Date().toISOString(),
  updated_at: c.updatedAt || c.createdAt || new Date().toISOString(),
});

export const transformCustomerFromDb = (row: any): Customer => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  address: row.address || '',
  debt: Number(row.debt) || 0,
  totalSpent: Number(row.total_spent) || 0,
  orderCount: Number(row.order_count) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
});

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

/**
 * Chia nhỏ dữ liệu thành các mẩu (chunks) để đẩy lên Supabase an toàn,
 * chống lỗi vượt quá kích thước payload khi có hàng nghìn dòng.
 */
async function upsertInChunks(client: SupabaseClient, table: string, rows: any[], chunkSize = 500): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' });
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
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, to)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      console.error(`Error fetching paginated data from ${table} (range ${from}-${to}):`, error);
      break;
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
    const { error: sErr } = await client.from('store_settings').upsert({
      id: 'default_settings',
      data: data.settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
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
 * Tải toàn bộ dữ liệu từ Supabase về kèm cơ chế giải quyết xung đột (ADR-0008)
 * Sử dụng fetchTableWithPagination để vượt qua giới hạn 1000 dòng của Supabase.
 */
export const pullAllDataFromCloud = async (localData?: {
  products?: Product[];
  customers?: Customer[];
  orders?: Order[];
  debtPayments?: DebtPayment[];
}): Promise<{
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  settings?: ReceiptSettings;
  localPreservedCount?: number;
} | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [pData, cData, oData, dpData, sRes] = await Promise.all([
      fetchTableWithPagination(client, 'products', 20000),
      fetchTableWithPagination(client, 'customers', 20000),
      fetchTableWithPagination(client, 'orders', 20000),
      fetchTableWithPagination(client, 'debt_payments', 20000),
      client.from('store_settings').select('*').eq('id', 'default_settings').maybeSingle(),
    ]);

    const cloudProducts = pData.map(transformProductFromDb);
    const cloudCustomers = cData.map(transformCustomerFromDb);
    const cloudOrders = oData.map(transformOrderFromDb);
    const cloudDebtPayments = dpData.map(transformDebtPaymentFromDb);

    let finalProducts = cloudProducts;
    let finalCustomers = cloudCustomers;
    let finalOrders = cloudOrders;
    let finalDebtPayments = cloudDebtPayments;
    let localPreservedCount = 0;

    if (localData) {
      if (localData.products && localData.products.length > 0) {
        const pMerge = mergeProductsWithConflictResolution(localData.products, cloudProducts);
        finalProducts = pMerge.merged;
        localPreservedCount += pMerge.localPreserved.length;
      }
      if (localData.customers && localData.customers.length > 0) {
        const cMerge = mergeCustomersWithConflictResolution(localData.customers, cloudCustomers);
        finalCustomers = cMerge.merged;
        localPreservedCount += cMerge.localPreserved.length;
      }
      if (localData.orders && localData.orders.length > 0) {
        const cloudOrderIds = new Set(cloudOrders.map(o => o.id));
        const unsyncedOrders = localData.orders.filter(o => !cloudOrderIds.has(o.id));
        finalOrders = mergeOrders(localData.orders, cloudOrders);
        localPreservedCount += unsyncedOrders.length;
      }
      if (localData.debtPayments && localData.debtPayments.length > 0) {
        finalDebtPayments = mergeDebtPayments(localData.debtPayments, cloudDebtPayments);
      }
    }

    return {
      products: finalProducts,
      customers: finalCustomers,
      orders: finalOrders,
      debtPayments: finalDebtPayments,
      settings: sRes.data?.data as ReceiptSettings | undefined,
      localPreservedCount,
    };
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

      const { error: updateErr } = await client
        .from('products')
        .update({ stock: updatedStock, updated_at: now })
        .eq('id', productId);

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
export const cloudSyncProduct = async (p: Product) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('products').upsert(transformProductToDb(p), { onConflict: 'id' });
  } catch (e) {
    console.error('cloudSyncProduct error:', e);
  }
};

export const cloudDeleteProduct = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('products').delete().eq('id', id);
  } catch (e) {
    console.error('cloudDeleteProduct error:', e);
  }
};

export const cloudSyncCustomer = async (c: Customer) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('customers').upsert(transformCustomerToDb(c), { onConflict: 'id' });
  } catch (e) {
    console.error('cloudSyncCustomer error:', e);
  }
};

export const cloudDeleteCustomer = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('customers').delete().eq('id', id);
  } catch (e) {
    console.error('cloudDeleteCustomer error:', e);
  }
};

// Batch items sync helpers
export const cloudSyncProductsBatch = async (products: Product[]) => {
  const client = getSupabaseClient();
  if (!client || products.length === 0) return;
  try {
    const pRows = products.map(transformProductToDb);
    await upsertInChunks(client, 'products', pRows, 500);
  } catch (e) {
    console.error('cloudSyncProductsBatch error:', e);
  }
};

export const cloudSyncCustomersBatch = async (customers: Customer[]) => {
  const client = getSupabaseClient();
  if (!client || customers.length === 0) return;
  try {
    const cRows = customers.map(transformCustomerToDb);
    await upsertInChunks(client, 'customers', cRows, 500);
  } catch (e) {
    console.error('cloudSyncCustomersBatch error:', e);
  }
};

export const cloudSyncOrder = async (o: Order) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('orders').upsert(transformOrderToDb(o), { onConflict: 'id' });
  } catch (e) {
    console.error('cloudSyncOrder error:', e);
  }
};

export const cloudDeleteOrder = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('orders').delete().eq('id', id);
  } catch (e) {
    console.error('cloudDeleteOrder error:', e);
  }
};

export const cloudSyncDebtPayment = async (dp: DebtPayment) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('debt_payments').upsert(transformDebtPaymentToDb(dp), { onConflict: 'id' });
  } catch (e) {
    console.error('cloudSyncDebtPayment error:', e);
  }
};

export const cloudSyncSettings = async (s: ReceiptSettings) => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('store_settings').upsert({
      id: 'default_settings',
      data: s,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (e) {
    console.error('cloudSyncSettings error:', e);
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
  address text default '',
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

-- Đảm bảo tương thích ngược: Bổ sung cột updated_at nếu bảng đã tồn tại từ trước
alter table products add column if not exists updated_at timestamptz default now();
alter table customers add column if not exists updated_at timestamptz default now();
alter table orders add column if not exists updated_at timestamptz default now();
alter table debt_payments add column if not exists updated_at timestamptz default now();

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
