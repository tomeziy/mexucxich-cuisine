import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Customer, Order, DebtPayment, ReceiptSettings, CloudConfig } from '../types';

const CLOUD_CONFIG_KEY = 'mexucxich_cloud_config';

export const getSupabaseConfig = (): CloudConfig => {
  try {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading cloud config:', e);
  }

  // Fallback to Vite env variables if set
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

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
});

export const transformOrderToDb = (o: Order) => ({
  id: o.id,
  created_at: o.createdAt || new Date().toISOString(),
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
});

export const transformDebtPaymentFromDb = (row: any): DebtPayment => ({
  id: row.id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  amount: Number(row.amount) || 0,
  paymentMethod: row.payment_method || 'cash',
  note: row.note || '',
  createdAt: row.created_at,
});

/**
 * Đẩy toàn bộ dữ liệu hiện tại lên Supabase (Upsert all)
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
    // 1. Products
    if (data.products.length > 0) {
      const pRows = data.products.map(transformProductToDb);
      const { error: pErr } = await client.from('products').upsert(pRows, { onConflict: 'id' });
      if (pErr) throw new Error(`Lỗi đồng bộ sản phẩm: ${pErr.message}`);
    }

    // 2. Customers
    if (data.customers.length > 0) {
      const cRows = data.customers.map(transformCustomerToDb);
      const { error: cErr } = await client.from('customers').upsert(cRows, { onConflict: 'id' });
      if (cErr) throw new Error(`Lỗi đồng bộ khách hàng: ${cErr.message}`);
    }

    // 3. Orders
    if (data.orders.length > 0) {
      const oRows = data.orders.map(transformOrderToDb);
      const { error: oErr } = await client.from('orders').upsert(oRows, { onConflict: 'id' });
      if (oErr) throw new Error(`Lỗi đồng bộ đơn hàng: ${oErr.message}`);
    }

    // 4. Debt Payments
    if (data.debtPayments.length > 0) {
      const dpRows = data.debtPayments.map(transformDebtPaymentToDb);
      const { error: dpErr } = await client.from('debt_payments').upsert(dpRows, { onConflict: 'id' });
      if (dpErr) throw new Error(`Lỗi đồng bộ phiếu nợ: ${dpErr.message}`);
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
 * Tải toàn bộ dữ liệu từ Supabase về
 */
export const pullAllDataFromCloud = async (): Promise<{
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  settings?: ReceiptSettings;
} | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [pRes, cRes, oRes, dpRes, sRes] = await Promise.all([
      client.from('products').select('*').order('created_at', { ascending: false }),
      client.from('customers').select('*').order('created_at', { ascending: false }),
      client.from('orders').select('*').order('created_at', { ascending: false }),
      client.from('debt_payments').select('*').order('created_at', { ascending: false }),
      client.from('store_settings').select('*').eq('id', 'default_settings').maybeSingle(),
    ]);

    if (pRes.error || cRes.error || oRes.error || dpRes.error) {
      console.error('Error pulling from Supabase:', pRes.error || cRes.error || oRes.error);
      return null;
    }

    return {
      products: (pRes.data || []).map(transformProductFromDb),
      customers: (cRes.data || []).map(transformCustomerFromDb),
      orders: (oRes.data || []).map(transformOrderFromDb),
      debtPayments: (dpRes.data || []).map(transformDebtPaymentFromDb),
      settings: sRes.data?.data as ReceiptSettings | undefined,
    };
  } catch (e) {
    console.error('Failed to pull data from Supabase:', e);
    return null;
  }
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

export const SUPABASE_SCHEMA_SQL = `-- MEXUCXICH CUISINE - SUPABASE SCHEMA (ADR-0006)
create table if not exists products (
  id text primary key,
  name text not null,
  category text default 'Đồ tự làm',
  unit text default 'Gói',
  price numeric default 0,
  cost numeric default 0,
  stock numeric default 0,
  image text default '🌭',
  created_at timestamptz default now()
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text default '',
  address text default '',
  debt numeric default 0,
  total_spent numeric default 0,
  order_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  created_at timestamptz default now(),
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
  created_at timestamptz default now()
);

create table if not exists store_settings (
  id text primary key default 'default_settings',
  data jsonb not null,
  updated_at timestamptz default now()
);

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
