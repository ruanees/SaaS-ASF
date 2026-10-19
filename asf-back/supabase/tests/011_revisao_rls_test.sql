-- Fase 6: revisão das regras de acesso, tabela por tabela, feita pela CI.
-- Cada prova lista o que está fora da regra (is_empty mostra as linhas).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)
$$, 'toda tabela de public tem RLS ligada e forçada');

select is_empty($$
  select schemaname || '.' || tablename || ' ' || policyname from pg_policies
  where schemaname in ('public', 'storage') and cmd = 'ALL'
$$, 'nenhuma política "for all" (uma por operação)');

select is_empty($$
  select schemaname || '.' || tablename || ' ' || policyname from pg_policies
  where schemaname = 'public' and roles <> '{authenticated}'
$$, 'toda política de public vale só para authenticated');

select is_empty($$
  select tablename || ' ' || policyname from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname ~ '^(fotos_animais|laudos|termos)' and roles <> '{authenticated}'
$$, 'políticas dos baldes do sistema só para authenticated');

select is_empty($$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
$$, 'toda função security definer fixa o search_path');

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce('security_invoker=true' = any (c.reloptions), false)
$$, 'toda view de public roda com a permissão de quem consulta (security_invoker)');

select is_empty($$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
$$, 'anônimo não executa nenhuma função security definer de public');

select * from finish();
rollback;
