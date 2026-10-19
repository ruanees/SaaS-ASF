-- 014 — MFA desligado por enquanto (ADR 0012). Volta em migração futura.
--
-- app.papel() volta a ser a da migração 001: admin e coordenação leem com a
-- sessão de senha (aal1), como os outros papéis. minha_situacao_acesso()
-- continua existindo e passa a dizer que o segundo fator não é exigido; o
-- back só pede o código quando ela diz que é. A tela /mfa e as rotas
-- /sessao/mfa/* ficam no código, sem uso, para quando o MFA voltar.

create or replace function app.papel() returns public.papel
language sql stable security definer set search_path = '' as $$
  select u.papel from public.usuarios u
  where u.user_id = (select auth.uid()) and u.ativo
$$;

create or replace function public.minha_situacao_acesso()
returns table (papel public.papel, ativo boolean, exige_mfa boolean, mfa_ok boolean)
language sql stable security definer set search_path = '' as $$
  select
    u.papel,
    u.ativo,
    false,  -- MFA desligado (ADR 0012); para religar, volta a ser u.papel in ('admin', 'coordenacao')
    coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
  from public.usuarios u
  where u.user_id = (select auth.uid())
$$;
