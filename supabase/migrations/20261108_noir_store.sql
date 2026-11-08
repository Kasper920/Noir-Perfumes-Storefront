-- Application tables are reachable only through the server's service-role client.
-- Clerk owns authentication. Never grant public access to customer records.
create table public.noir_profiles (
  id text primary key,
  email text not null,
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);
create table public.noir_products (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  content jsonb not null,
  active boolean not null default true,
  position integer not null default 100,
  version integer not null default 1
);
create table public.noir_variants (
  product_id text not null references public.noir_products(id),
  size text not null check (size in ('50ml','100ml')),
  price numeric(12,3) not null check (price > 0 and price <= 10000),
  stock integer not null check (stock between 0 and 100000),
  primary key(product_id,size)
);
create table public.noir_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  request_hash text not null,
  customer_id text references public.noir_profiles(id),
  name text not null,
  phone text not null,
  address text not null,
  payment text not null check (payment in ('card','knet','cash')),
  status text not null default 'pending' check (status in ('pending','processing','shipped','delivered','cancelled')),
  total numeric(12,3) not null check (total > 0),
  currency text not null default 'KWD',
  items jsonb not null,
  created_at timestamptz not null default now()
);
create index noir_orders_customer_created on public.noir_orders(customer_id,created_at desc);
create index noir_orders_created on public.noir_orders(created_at desc);
create table public.noir_messages (
  id uuid primary key,
  request_hash text not null,
  name text not null,
  email text not null,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index noir_messages_created on public.noir_messages(created_at desc);
alter table public.noir_profiles enable row level security;
alter table public.noir_products enable row level security;
alter table public.noir_variants enable row level security;
alter table public.noir_orders enable row level security;
alter table public.noir_messages enable row level security;
revoke all on public.noir_profiles, public.noir_products, public.noir_variants, public.noir_orders, public.noir_messages from anon, authenticated;
grant all on public.noir_profiles, public.noir_products, public.noir_variants, public.noir_orders, public.noir_messages to service_role;

-- SECURITY INVOKER; only service_role has EXECUTE and table privileges.
create function public.noir_place_order(p_request uuid, p_hash text, p_customer text, p_name text, p_phone text, p_address text, p_payment text, p_items jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare existing public.noir_orders; r record; p public.noir_products; v public.noir_variants;
  snapshots jsonb := '[]'; amount numeric := 0; oid uuid; receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select * into existing from public.noir_orders where request_id=p_request;
  if found then
    if existing.request_hash <> p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',existing.id,'reference','N-'||upper(substr(existing.id::text,1,8)),'total',existing.total,'currency',existing.currency);
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'INVALID_ITEMS'; end if;
  -- Deterministic product/variant lock ordering prevents checkout/edit deadlocks.
  for r in select x->>'productId' as pid,x->>'size' as sz,sum((x->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) x group by 1,2 order by 1,2
  loop
    if r.qty not between 1 and 99 then raise exception 'INVALID_ITEMS'; end if;
    select * into p from public.noir_products where id=r.pid for update;
    if not found or not p.active then raise exception 'UNAVAILABLE'; end if;
    select * into v from public.noir_variants where product_id=r.pid and size=r.sz for update;
    if not found or v.stock < r.qty then raise exception 'OUT_OF_STOCK'; end if;
    update public.noir_variants set stock=stock-r.qty where product_id=r.pid and size=r.sz;
    update public.noir_products set version=version+1 where id=r.pid;
    amount := amount+v.price*r.qty;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object('productId',r.pid,'name',p.content->'name','size',r.sz,'quantity',r.qty,'price',v.price));
  end loop;
  insert into public.noir_orders(request_id,request_hash,customer_id,name,phone,address,payment,total,items)
    values(p_request,p_hash,p_customer,p_name,p_phone,p_address,p_payment,amount,snapshots) returning id into oid;
  return jsonb_build_object('id',oid,'reference','N-'||upper(substr(oid::text,1,8)),'total',amount,'currency','KWD');
end $$;
revoke all on function public.noir_place_order(uuid,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.noir_place_order(uuid,text,text,text,text,text,text,jsonb) to service_role;

create function public.noir_save_product(p_id text,p_content jsonb,p_active boolean,p_version integer,p_variants jsonb)
returns void language plpgsql set search_path = '' as $$
declare current_version integer; variant jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id,1));
  select version into current_version from public.noir_products where id=p_id for update;
  if found then
    if current_version<>p_version then raise exception 'EDIT_CONFLICT'; end if;
    update public.noir_products set content=p_content,active=p_active,version=version+1 where id=p_id;
  else
    if p_version<>0 then raise exception 'EDIT_CONFLICT'; end if;
    insert into public.noir_products(id,content,active) values(p_id,p_content,p_active);
  end if;
  if jsonb_array_length(p_variants)<>2 or
    (select count(distinct x->>'size') from jsonb_array_elements(p_variants) x)<>2 then raise exception 'INVALID_VARIANTS'; end if;
  for variant in select * from jsonb_array_elements(p_variants) order by value->>'size'
  loop
    insert into public.noir_variants(product_id,size,price,stock)
      values(p_id,variant->>'size',(variant->>'price')::numeric,(variant->>'stock')::int)
      on conflict(product_id,size) do update set price=excluded.price,stock=excluded.stock;
  end loop;
end $$;
revoke all on function public.noir_save_product(text,jsonb,boolean,integer,jsonb) from public,anon,authenticated;
grant execute on function public.noir_save_product(text,jsonb,boolean,integer,jsonb) to service_role;

create function public.noir_order_status(p_id uuid,p_status text)
returns void language plpgsql set search_path = '' as $$
declare o public.noir_orders; r record;
begin
  select * into o from public.noir_orders where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status=p_status then return; end if;
  if not ((o.status='pending' and p_status in ('processing','cancelled')) or
    (o.status='processing' and p_status in ('shipped','cancelled')) or
    (o.status='shipped' and p_status='delivered')) then raise exception 'INVALID_STATUS'; end if;
  if p_status='cancelled' then
    for r in select x->>'productId' as pid,x->>'size' as sz,(x->>'quantity')::int as qty from jsonb_array_elements(o.items) x order by 1,2
    loop
      update public.noir_products set version=version+1 where id=r.pid;
      update public.noir_variants set stock=stock+r.qty where product_id=r.pid and size=r.sz;
    end loop;
  end if;
  update public.noir_orders set status=p_status where id=p_id;
end $$;
revoke all on function public.noir_order_status(uuid,text) from public,anon,authenticated;
grant execute on function public.noir_order_status(uuid,text) to service_role;
