-- admin_id_por_email devolve o id de qualquer conta do Auth a partir do
-- e-mail: só a service_role (Edge Function) pode chamar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('c0000000-0000-4000-8000-000000000001', 'Pessoa@Exemplo.test', 'authenticated', 'authenticated');

set local role anon;
select throws_ok($$select public.admin_id_por_email('pessoa@exemplo.test')$$, '42501', null,
  'anônimo não chama admin_id_por_email');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.admin_id_por_email('pessoa@exemplo.test')$$, '42501', null,
  'usuário logado não chama admin_id_por_email');

set local role service_role;
select is(public.admin_id_por_email('  PESSOA@exemplo.test '),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'service_role acha o id, sem diferenciar maiúsculas');
select is(public.admin_id_por_email('ninguem@exemplo.test'), null, 'e-mail sem conta devolve nulo');

select * from finish();
rollback;
