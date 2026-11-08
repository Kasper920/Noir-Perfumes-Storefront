-- Move NOIR customer identity to Supabase Auth without deleting Clerk-era
-- profiles, orders, or owner grants. Verified email links the first new login
-- to its existing profile; the stable profile id keeps foreign keys intact.
alter table public.noir_profiles
  add column auth_user_id uuid references auth.users(id) on delete set null;

create unique index noir_profiles_auth_user_id_idx
  on public.noir_profiles(auth_user_id) where auth_user_id is not null;
create unique index noir_profiles_email_lower_idx
  on public.noir_profiles(lower(email));

create or replace function public.noir_link_supabase_profile(
  p_auth_user uuid,
  p_email text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.noir_profiles;
  normalized_email text := lower(trim(p_email));
begin
  if p_auth_user is null or normalized_email = '' then
    raise exception 'INVALID_AUTH_PROFILE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_email, 0)
  );

  select * into profile_row
  from public.noir_profiles
  where auth_user_id = p_auth_user
  for update;

  if found then
    if lower(profile_row.email) <> normalized_email then
      update public.noir_profiles
      set email = normalized_email
      where id = profile_row.id
      returning * into profile_row;
    end if;
    return pg_catalog.to_jsonb(profile_row);
  end if;

  select * into profile_row
  from public.noir_profiles
  where lower(email) = normalized_email
  for update;

  if found then
    if profile_row.auth_user_id is not null and profile_row.auth_user_id <> p_auth_user then
      raise exception 'EMAIL_ALREADY_LINKED';
    end if;

    update public.noir_profiles
    set auth_user_id = p_auth_user,
        email = normalized_email,
        name = case
          when trim(name) = '' and trim(coalesce(p_name, '')) <> '' then trim(p_name)
          else name
        end
    where id = profile_row.id
    returning * into profile_row;
    return pg_catalog.to_jsonb(profile_row);
  end if;

  insert into public.noir_profiles (id, auth_user_id, email, name)
  values (
    p_auth_user::text,
    p_auth_user,
    normalized_email,
    left(trim(coalesce(p_name, '')), 100)
  )
  returning * into profile_row;

  return pg_catalog.to_jsonb(profile_row);
end;
$$;

revoke all on function public.noir_link_supabase_profile(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.noir_link_supabase_profile(uuid, text, text)
  to service_role;

-- An authenticated user can read their own profile and update only editable
-- delivery details. The role and identity columns are never client-writable.
grant select on public.noir_profiles to authenticated;
grant update (name, phone, address) on public.noir_profiles to authenticated;
create policy noir_profiles_select_own
  on public.noir_profiles for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy noir_profiles_update_own
  on public.noir_profiles for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- Keep the existing server-validated checkout path. Authenticated reads are
-- scoped in Postgres itself, even if a new endpoint forgets an app-level filter.
grant select on public.noir_orders to authenticated;
create policy noir_orders_select_own
  on public.noir_orders for select to authenticated
  using (
    exists (
      select 1
      from public.noir_profiles
      where noir_profiles.id = noir_orders.customer_id
        and noir_profiles.auth_user_id = (select auth.uid())
    )
  );

create table public.noir_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.noir_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index noir_favorites_user_created_idx
  on public.noir_favorites(user_id, created_at desc);
alter table public.noir_favorites enable row level security;
revoke all on public.noir_favorites from anon, authenticated;
grant select, insert, delete on public.noir_favorites to authenticated;
create policy noir_favorites_select_own
  on public.noir_favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy noir_favorites_insert_own
  on public.noir_favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy noir_favorites_delete_own
  on public.noir_favorites for delete to authenticated
  using (user_id = (select auth.uid()));
