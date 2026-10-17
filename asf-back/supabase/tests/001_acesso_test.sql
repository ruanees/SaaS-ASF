-- Provas da Fase 0: quem não tem convite ativo não lê nada; só admin mexe em
-- usuarios e configuracoes; auditoria só acrescenta e não guarda valores.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Dados fictícios -------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@exemplo.test', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000002', 'voluntario@exemplo.test', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000003', 'inativo@exemplo.test', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000004', 'sem-convite@exemplo.test', 'authenticated', 'authenticated');

insert into public.usuarios (user_id, nome, papel, ativo) values
  ('a0000000-0000-4000-8000-000000000001', 'Admin Fictício', 'admin', true),
  ('a0000000-0000-4000-8000-000000000002', 'Voluntária Fictícia', 'voluntario', true),
  ('a0000000-0000-4000-8000-000000000003', 'Coordenação Desativada', 'coordenacao', false);

-- Quantas linhas um comando afetou (update/delete filtrados pela RLS não dão erro).
create function pg_temp.linhas(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

-- Anônimo ---------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.usuarios', '42501', null, 'anônimo não lê usuarios');
select throws_ok('select * from public.configuracoes', '42501', null, 'anônimo não lê configuracoes');
select throws_ok('select * from public.auditoria', '42501', null, 'anônimo não lê auditoria');
reset role;

-- Conta no Auth sem linha em usuarios -----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(app.papel(), null, 'sem convite: papel nulo');
select is((select count(*) from public.usuarios)::int, 0, 'sem convite: não lê usuarios');
select is((select count(*) from public.configuracoes)::int, 0, 'sem convite: não lê configuracoes');

-- Usuário desativado ----------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(app.papel(), null, 'desativado: papel nulo');
select is((select count(*) from public.usuarios)::int, 0, 'desativado: não lê usuarios');
select is((select count(*) from public.configuracoes)::int, 0, 'desativado: não lê configuracoes');

-- Voluntário ativo ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(app.papel(), 'voluntario'::public.papel, 'voluntário: papel certo');
select is((select count(*) from public.configuracoes)::int, 1, 'voluntário lê configuracoes');
select is((select count(*) from public.usuarios)::int, 3, 'voluntário lê usuarios');
select is(pg_temp.linhas('update public.configuracoes set nome = ''Outra'''), 0,
  'voluntário não altera configuracoes');
select throws_ok(
  $$insert into public.usuarios (user_id, nome, papel) values ('a0000000-0000-4000-8000-000000000004', 'Intrusa', 'admin')$$,
  '42501', null, 'voluntário não cria usuario');
select is(pg_temp.linhas($$update public.usuarios set papel = 'admin' where user_id = 'a0000000-0000-4000-8000-000000000002'$$), 0,
  'voluntário não se promove');
select throws_ok($$delete from public.usuarios$$, '42501', null, 'ninguém apaga usuario');
select is((select count(*) from public.auditoria)::int, 0, 'voluntário não lê auditoria');

-- Admin -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.linhas('update public.configuracoes set resumo_diario_email = true'), 1,
  'admin altera configuracoes');
select is((select atualizado_por from public.configuracoes),
  'a0000000-0000-4000-8000-000000000001'::uuid, 'carimbo grava quem alterou');
select is(
  (select campos_alterados from public.auditoria where tabela = 'configuracoes' order by id desc limit 1),
  array['resumo_diario_email'], 'auditoria guarda o nome do campo, não o valor');
select throws_ok(
  $$update public.usuarios set ativo = false where user_id = 'a0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'A associação precisa de ao menos um admin ativo.', 'último admin não se desativa');
select throws_ok($$delete from public.auditoria$$, '42501', null, 'auditoria não aceita delete');
select throws_ok($$update public.auditoria set tabela = 'x'$$, '42501', null, 'auditoria não aceita update');
select is(app.hoje(), (now() at time zone 'America/Fortaleza')::date, 'hoje() usa o fuso da associação');

select * from finish();
rollback;
