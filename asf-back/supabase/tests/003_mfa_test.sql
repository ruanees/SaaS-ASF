-- MFA: admin e coordenação só leem com sessão aal2; os outros papéis, não.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.usuarios;

insert into auth.users (id, email, aud, role) values
  ('d0000000-0000-4000-8000-000000000001', 'admin@exemplo.test', 'authenticated', 'authenticated'),
  ('d0000000-0000-4000-8000-000000000002', 'coord@exemplo.test', 'authenticated', 'authenticated'),
  ('d0000000-0000-4000-8000-000000000003', 'vol@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('d0000000-0000-4000-8000-000000000001', 'Admin Fictício', 'admin'),
  ('d0000000-0000-4000-8000-000000000002', 'Coordenação Fictícia', 'coordenacao'),
  ('d0000000-0000-4000-8000-000000000003', 'Voluntário Fictício', 'voluntario');

set local role authenticated;

-- Admin só com senha (aal1)
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(app.papel(), null, 'admin sem MFA: papel nulo');
select is((select count(*) from public.usuarios)::int, 0, 'admin sem MFA não lê usuarios');
select is((select count(*) from public.configuracoes)::int, 0, 'admin sem MFA não lê configuracoes');
select results_eq('select papel::text, ativo, exige_mfa, mfa_ok from public.minha_situacao_acesso()',
  $$values ('admin', true, true, false)$$, 'situação diz que falta o MFA');

-- Admin com MFA (aal2)
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(app.papel(), 'admin'::public.papel, 'admin com MFA: papel admin');
select is((select count(*) from public.usuarios)::int, 3, 'admin com MFA lê usuarios');

-- Coordenação sem e com MFA
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(app.papel(), null, 'coordenação sem MFA: papel nulo');
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is(app.papel(), 'coordenacao'::public.papel, 'coordenação com MFA: papel coordenacao');

-- Voluntário não precisa de MFA
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select is(app.papel(), 'voluntario'::public.papel, 'voluntário só com senha lê normalmente');
select results_eq('select exige_mfa from public.minha_situacao_acesso()', $$values (false)$$,
  'voluntário: MFA não exigido');

-- Anônimo não chama a função
reset role;
set local role anon;
select throws_ok('select * from public.minha_situacao_acesso()', '42501', null, 'anônimo não consulta situação');

select * from finish();
rollback;
