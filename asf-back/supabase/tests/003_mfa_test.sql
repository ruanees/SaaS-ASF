-- MFA desligado por enquanto (ADR 0012): admin e coordenação entram só com senha.
-- Quando o MFA voltar (nova migração), estas provas voltam a exigir aal2.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

-- Admin só com senha (aal1): lê normalmente
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(app.papel(), 'admin'::public.papel, 'admin só com senha: papel admin');
select is((select count(*) from public.usuarios)::int, 3, 'admin só com senha lê usuarios');
select is((select count(*) from public.configuracoes)::int, 1, 'admin só com senha lê configuracoes');
select results_eq('select papel::text, ativo, exige_mfa, mfa_ok from public.minha_situacao_acesso()',
  $$values ('admin', true, false, false)$$, 'situação diz que o MFA não é exigido');

-- Com o segundo fator (aal2) continua funcionando
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(app.papel(), 'admin'::public.papel, 'admin com aal2: papel admin');

-- Coordenação só com senha e com aal2
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(app.papel(), 'coordenacao'::public.papel, 'coordenação só com senha: papel coordenacao');
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is(app.papel(), 'coordenacao'::public.papel, 'coordenação com aal2: papel coordenacao');

-- Voluntário, como sempre
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
