-- Product text and variant prices/stock remain in the existing catalog tables.
-- Store the Storage object path, never image bytes or a service key in Postgres.
alter table public.noir_products
  add column if not exists image_path text
  check (
    image_path is null
    or image_path ~ '^(sprites/noir-product-grid\.webp|[a-z0-9-]{2,60}/[a-f0-9]{32}\.(jpg|png|webp))$'
  );

-- Keep the existing product data/version check and variants in the same
-- transaction when updating all editable product fields, including its image.
create function public.noir_save_product_with_image(
  p_id text,p_content jsonb,p_active boolean,p_version integer,p_variants jsonb,p_image_path text
)
returns void language plpgsql set search_path = '' as $$
declare current_version integer; variant jsonb;
begin
  if p_image_path is not null
     and p_image_path !~ ('^('||p_id||'/[a-f0-9]{32}\.(jpg|png|webp)|sprites/noir-product-grid\.webp)$') then
    raise exception 'INVALID_IMAGE_PATH';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id,1));
  select version into current_version from public.noir_products where id=p_id for update;
  if found then
    if current_version<>p_version then raise exception 'EDIT_CONFLICT'; end if;
    update public.noir_products
      set content=p_content,active=p_active,image_path=p_image_path,version=version+1 where id=p_id;
  else
    if p_version<>0 then raise exception 'EDIT_CONFLICT'; end if;
    insert into public.noir_products(id,content,active,image_path)
      values(p_id,p_content,p_active,p_image_path);
  end if;
  if jsonb_array_length(p_variants)<>2 or
     (select count(distinct x->>'size') from jsonb_array_elements(p_variants) x)<>2 then
    raise exception 'INVALID_VARIANTS';
  end if;
  for variant in select * from jsonb_array_elements(p_variants) order by value->>'size'
  loop
    insert into public.noir_variants(product_id,size,price,stock)
      values(p_id,variant->>'size',(variant->>'price')::numeric,(variant->>'stock')::int)
      on conflict(product_id,size) do update set price=excluded.price,stock=excluded.stock;
  end loop;
end $$;
revoke all on function public.noir_save_product_with_image(text,jsonb,boolean,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.noir_save_product_with_image(text,jsonb,boolean,integer,jsonb,text) to service_role;

-- A new unique object is uploaded before the database reference is changed.
-- The row lock and expected version keep concurrent product edits safe.
create function public.noir_set_product_image(p_id text,p_expected_version integer,p_image_path text)
returns integer language plpgsql set search_path = '' as $$
declare current_version integer;
begin
  if p_image_path !~ ('^'||p_id||'/[a-f0-9]{32}\.(jpg|png|webp)$') then
    raise exception 'INVALID_IMAGE_PATH';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id,1));
  select version into current_version from public.noir_products where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current_version<>p_expected_version then raise exception 'EDIT_CONFLICT'; end if;
  update public.noir_products
    set image_path=p_image_path,version=version+1
    where id=p_id;
  return current_version+1;
end $$;
revoke all on function public.noir_set_product_image(text,integer,text) from public,anon,authenticated;
grant execute on function public.noir_set_product_image(text,integer,text) to service_role;
