-- 004 — MFA obrigatório para admin e coordenação (plano, seção 05 e Fase 0).
--
-- A regra mora no banco: app.papel() só devolve 'admin' ou 'coordenacao'
-- quando a sessão foi confirmada com o segundo fator (aal2 no JWT). Sem
-- isso, a pessoa não lê nada, como uma conta sem convite. Voluntário e
-- veterinário seguem com senha só (aal1).

create or replace function app.papel() returns public.papel
language sql stable security definer set search_path = '' as $$
  select u.papel from public.usuarios u
  where u.user_id = (select auth.uid())
    and u.ativo
    and (
      u.papel not in ('admin', 'coordenacao')
      or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    )
$$;

-- Situação de acesso de quem chamou, para o back dizer ao front o que falta
-- (convite, reativação ou MFA). Só devolve a própria linha; não expõe outros.
create function public.minha_situacao_acesso()
returns table (papel public.papel, ativo boolean, exige_mfa boolean, mfa_ok boolean)
language sql stable security definer set search_path = '' as $$
  select
    u.papel,
    u.ativo,
    u.papel in ('admin', 'coordenacao'),
    coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
  from public.usuarios u
  where u.user_id = (select auth.uid())
$$;

revoke all on function public.minha_situacao_acesso() from public, anon;
grant execute on function public.minha_situacao_acesso() to authenticated;
