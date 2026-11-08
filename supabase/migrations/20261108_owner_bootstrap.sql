create table public.noir_owner_grants (
  grant_key text primary key,
  user_id text not null references public.noir_profiles(id),
  granted_at timestamptz not null default now()
);
alter table public.noir_owner_grants enable row level security;
revoke all on public.noir_owner_grants from anon,authenticated;
grant all on public.noir_owner_grants to service_role;
-- Only the backend calls this after checking the owner-configured verified Clerk email.
-- A durable grant record prevents a restart from restoring a revoked role.
create function public.noir_bootstrap_owner(p_key text,p_user text)
returns void language plpgsql set search_path='' as $$
begin
  insert into public.noir_owner_grants(grant_key,user_id) values(p_key,p_user) on conflict do nothing;
  if found then
    update public.noir_profiles set role='admin' where id=p_user;
  end if;
end $$;
revoke all on function public.noir_bootstrap_owner(text,text) from public,anon,authenticated;
grant execute on function public.noir_bootstrap_owner(text,text) to service_role;
