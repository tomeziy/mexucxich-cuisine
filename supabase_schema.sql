-- ==============================================================================
-- MEXUCXICH CUISINE - SUPABASE DATABASE INITIALIZATION SCRIPT
-- ==============================================================================
-- Hướng dẫn:
-- 1. Đăng nhập vào https://supabase.com và tạo một Project mới (Miễn phí 100%).
-- 2. Vào mục "SQL Editor" ở menu bên trái.
-- 3. Sao chép toàn bộ nội dung file này, dán vào và nhấn "Run" (hoặc F5).
-- 4. Vào mục "Project Settings" -> "API", sao chép:
--    - Project URL
--    - Project API Keys (anon public)
-- 5. Mở ứng dụng MexucxichCuisine -> vào tab "Cài đặt" -> dán URL và Key -> Bấm "Kiểm tra & Kết nối".
-- ==============================================================================

-- 1. BẢNG SẢN PHẨM & KHO HÀNG (PRODUCTS)
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

-- 2. BẢNG KHÁCH HÀNG & CÔNG NỢ (CUSTOMERS)
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

-- 3. BẢNG ĐƠN HÀNG (ORDERS)
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

-- 4. BẢNG LỊCH SỬ THU NỢ (DEBT_PAYMENTS)
create table if not exists debt_payments (
  id text primary key,
  customer_id text,
  customer_name text,
  amount numeric default 0,
  payment_method text default 'cash',
  note text default '',
  created_at timestamptz default now()
);

-- 5. BẢNG CÀI ĐẶT CỬA HÀNG & MẪU IN (STORE_SETTINGS)
create table if not exists store_settings (
  id text primary key default 'default_settings',
  data jsonb not null,
  updated_at timestamptz default now()
);

-- ==============================================================================
-- PHÂN QUYỀN TRUY CẬP (ROW LEVEL SECURITY & ANON ACCESS)
-- Cho phép ứng dụng đọc/ghi trực tiếp qua Anon Public Key mà không cần đăng nhập
-- ==============================================================================

alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table debt_payments enable row level security;
alter table store_settings enable row level security;

-- Tạo policies cho phép public anon full quyền (SELECT, INSERT, UPDATE, DELETE)
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
