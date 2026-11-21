-- ==============================================================================
-- MEXUCXICH CUISINE - SUPABASE SCHEMA, AUTH USERS & RLS (ADR-0025)
-- Cài đặt 1 lần duy nhất trong Supabase -> SQL Editor -> Run
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. BẢNG KHÁCH HÀNG & CÔNG NỢ (CUSTOMERS)
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

-- 3. BẢNG ĐƠN HÀNG (ORDERS)
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

-- 4. BẢNG LỊCH SỬ THU NỢ (DEBT_PAYMENTS)
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

-- 5. BẢNG CÀI ĐẶT CỬA HÀNG & MẪU IN (STORE_SETTINGS)
create table if not exists store_settings (
  id text primary key default 'default_settings',
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Tương thích ngược cột mới
alter table customers add column if not exists extra_addresses jsonb default '[]'::jsonb;
alter table customers add column if not exists phone2 text;
alter table products add column if not exists updated_at timestamptz default now();
alter table customers add column if not exists updated_at timestamptz default now();
alter table orders add column if not exists updated_at timestamptz default now();
alter table debt_payments add column if not exists updated_at timestamptz default now();
alter table store_settings add column if not exists updated_at timestamptz default now();
notify pgrst, 'reload schema';

-- 6. HÀM ĐIỀU CHỈNH TỒN KHO NGUYÊN TỬ (ATOMIC STOCK ADJUSTMENT - ADR-0008)
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

grant execute on function adjust_product_stock(p_id text, p_delta numeric) to authenticated, service_role;

-- 7. TẠO SẴN 2 TÀI KHOẢN SUPABASE AUTH (ĐÃ XÁC NHẬN SẴN EMAIL, KHÔNG CẦN MAIL XÁC NHẬN)
--    - Hằng (Chủ quán): username `mexucxich` / pass `mexucxich123`
--    - Quản trị (Admin): username `admin` / pass `admin2026`
create extension if not exists pgcrypto;

do $$
declare
  v_owner_id uuid;
  v_admin_id uuid;
begin
  select id into v_owner_id from auth.users where email = 'mexucxich@mexucxich.pos' limit 1;
  if v_owner_id is null then
    v_owner_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_owner_id, 'authenticated', 'authenticated',
      'mexucxich@mexucxich.pos', crypt('mexucxich123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"],"role":"owner"}'::jsonb,
      '{"username":"mexucxich","displayName":"Hoàng Minh Hằng"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_owner_id,
      jsonb_build_object('sub', v_owner_id::text, 'email', 'mexucxich@mexucxich.pos'),
      'email', v_owner_id::text, now(), now(), now()
    );
  end if;

  select id into v_admin_id from auth.users where email = 'admin@mexucxich.pos' limit 1;
  if v_admin_id is null then
    v_admin_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
      'admin@mexucxich.pos', crypt('admin2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
      '{"username":"admin","displayName":"Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@mexucxich.pos'),
      'email', v_admin_id::text, now(), now(), now()
    );
  end if;
end $$;

-- 8. KHÓA BẢO MẬT DATABASE (CHỈ CHO PHÉP TÀI KHOẢN ĐÃ ĐĂNG NHẬP TRUY CẬP - CHẶN ANON)
revoke all on public.products from anon;
revoke all on public.customers from anon;
revoke all on public.orders from anon;
revoke all on public.debt_payments from anon;
revoke all on public.store_settings from anon;

grant select, insert, update, delete on public.products to authenticated, service_role;
grant select, insert, update, delete on public.customers to authenticated, service_role;
grant select, insert, update, delete on public.orders to authenticated, service_role;
grant select, insert, update, delete on public.debt_payments to authenticated, service_role;
grant select, insert, update, delete on public.store_settings to authenticated, service_role;

alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table debt_payments enable row level security;
alter table store_settings enable row level security;

drop policy if exists "Anon full access products" on products;
drop policy if exists "Authenticated full access products" on products;
create policy "Authenticated full access products" on products for all to authenticated using (true) with check (true);

drop policy if exists "Anon full access customers" on customers;
drop policy if exists "Authenticated full access customers" on customers;
create policy "Authenticated full access customers" on customers for all to authenticated using (true) with check (true);

drop policy if exists "Anon full access orders" on orders;
drop policy if exists "Authenticated full access orders" on orders;
create policy "Authenticated full access orders" on orders for all to authenticated using (true) with check (true);

drop policy if exists "Anon full access debt_payments" on debt_payments;
drop policy if exists "Authenticated full access debt_payments" on debt_payments;
create policy "Authenticated full access debt_payments" on debt_payments for all to authenticated using (true) with check (true);

drop policy if exists "Anon full access store_settings" on store_settings;
drop policy if exists "Authenticated full access store_settings" on store_settings;
create policy "Authenticated full access store_settings" on store_settings for all to authenticated using (true) with check (true);

-- 9. BẬT ĐỒNG BỘ REALTIME TỨC THÌ GIỮA NHIỀU THIẾT BỊ
do $$
begin
  begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.customers; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.debt_payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.store_settings; exception when duplicate_object then null; end;
end $$;
