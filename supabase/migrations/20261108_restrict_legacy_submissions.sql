-- Retain legacy data from earlier experiments, but do not leave obsolete,
-- unauthenticated SECURITY DEFINER write paths outside the protected API.
do $$
begin
  if to_regprocedure('public.noir_submit_order(jsonb)') is not null then
    revoke all on function public.noir_submit_order(jsonb) from public,anon,authenticated;
  end if;
  if to_regprocedure('public.noir_submit_contact(jsonb)') is not null then
    revoke all on function public.noir_submit_contact(jsonb) from public,anon,authenticated;
  end if;
end $$;
