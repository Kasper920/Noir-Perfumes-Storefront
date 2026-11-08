-- Keep foreign-key cleanup and referential checks indexed for auth-linked rows.
create index if not exists noir_favorites_product_id_idx
  on public.noir_favorites(product_id);
create index if not exists noir_owner_grants_user_id_idx
  on public.noir_owner_grants(user_id);
