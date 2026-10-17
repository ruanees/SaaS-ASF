-- 003 — Apoio ao convite: achar a conta do Auth de um e-mail que já existe.
-- Só a Edge Function admin (service_role) executa. Plano, Fase 0, caso de
-- borda "convite aceito por alguém que já tinha conta no Auth".

create function public.admin_id_por_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1
$$;

revoke all on function public.admin_id_por_email(text) from public, anon, authenticated;
grant execute on function public.admin_id_por_email(text) to service_role;
