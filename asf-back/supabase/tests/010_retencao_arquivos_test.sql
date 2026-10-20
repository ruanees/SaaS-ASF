-- Fase 6: prazo de guarda (lista para a coordenação aprovar) e arquivos soltos.
-- Só dados inventados.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('e5000000-0000-4000-8000-000000000001', 'admin@exemplo.test', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000002', 'coord@exemplo.test', 'authenticated', 'authenticated'),
  ('e5000000-0000-4000-8000-000000000003', 'vol@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('e5000000-0000-4000-8000-000000000001', 'Admin Fictícia', 'admin'),
  ('e5000000-0000-4000-8000-000000000002', 'Coordenação Fictícia', 'coordenacao'),
  ('e5000000-0000-4000-8000-000000000003', 'Voluntário Fictício', 'voluntario');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

-- Pessoas cadastradas há 3 anos (carimbo desligado só nesta transação) e prazo de 24 meses.
update public.configuracoes set retencao_pessoas_meses = 24;
alter table public.pessoas disable trigger pessoas_carimbar;
insert into public.pessoas (id, nome, base_legal, vinculos, criado_em) values
  ('e5100000-0000-4000-8000-000000000001', 'Sem Evento Fictícia', 'consentimento', '{adotante}', now() - interval '3 years'),
  ('e5100000-0000-4000-8000-000000000002', 'Adotou Agora Fictício', 'execucao_contrato', '{adotante}', now() - interval '3 years'),
  ('e5100000-0000-4000-8000-000000000003', 'Adotou Há Tempo Fictícia', 'execucao_contrato', '{adotante}', now() - interval '3 years'),
  ('e5100000-0000-4000-8000-000000000004', 'Lar Agora Fictício', 'acordo_voluntariado', '{lar_temporario}', now() - interval '3 years'),
  ('e5100000-0000-4000-8000-000000000005', 'Anonimizar Fictícia', 'consentimento', '{adotante}', now() - interval '3 years');
alter table public.pessoas enable trigger pessoas_carimbar;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
insert into ids select 'a1', (public.cadastrar_animal('cao', 'macho', app.hoje() - 60, 'resgate', 'sede', 'Animal Um Fictício')).id;
insert into ids select 'a2', (public.cadastrar_animal('cao', 'femea', app.hoje() - 1100, 'resgate', 'sede', 'Animal Dois Fictício')).id;
insert into ids select 'a3', (public.cadastrar_animal('gato', 'femea', app.hoje() - 1100, 'resgate', 'sede', 'Animal Três Fictício')).id;
select public.registrar_adocao(pg_temp.id('a1'), 'e5100000-0000-4000-8000-000000000002', app.hoje() - 30);
select public.registrar_adocao(pg_temp.id('a2'), 'e5100000-0000-4000-8000-000000000003', app.hoje() - 1000);
select public.mover_animal(pg_temp.id('a3'), 'em_acolhimento', 'lar_temporario', false, app.hoje() - 1000,
  null, 'mudanca', null, null, 'e5100000-0000-4000-8000-000000000004');
select public.anonimizar_pessoa('e5100000-0000-4000-8000-000000000005');

-- Prazo de guarda -------------------------------------------------------------------
select results_eq(
  $$select nome from public.pessoas_alem_do_prazo() order by nome$$,
  $values ('Sem Evento Fictícia')$,
  'só quem passou do prazo, sem animal em lar temporário e sem adotado vivo (ADR 0013)');
select is((select count(*)::int from public.pessoas_alem_do_prazo() where nome = 'Adotou Há Tempo Fictícia'), 0,
  'adoção antiga de animal vivo: o vínculo continua (acompanhamento até o fim da vida, ADR 0013)');
select is((select count(*)::int from public.pessoas_alem_do_prazo() where nome = 'Adotou Agora Fictício'), 0,
  'adoção recente renova o prazo');
select is((select count(*)::int from public.pessoas_alem_do_prazo() where nome like 'Lar Agora%'), 0,
  'quem está com animal em lar temporário agora nunca entra');
select is((select count(*)::int from public.pessoas where anonimizado_em is null), 4,
  'a lista não anonimiza ninguém sozinha');

set local request.jwt.claims = '{"sub":"e5000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select throws_ok($$select * from public.pessoas_alem_do_prazo()$$, '42501', null, 'voluntário não vê o prazo de guarda');

-- Arquivos soltos ---------------------------------------------------------------------
reset role;
insert into public.animal_fotos (animal_id, caminho, principal)
values (pg_temp.id('a1'), pg_temp.id('a1') || '/e5200000-0000-4000-8000-000000000001.webp', true);
insert into storage.objects (bucket_id, name, created_at) values
  ('fotos-animais', pg_temp.id('a1') || '/e5200000-0000-4000-8000-000000000001.webp', now() - interval '3 days'),
  ('fotos-animais', pg_temp.id('a1') || '/e5200000-0000-4000-8000-000000000002.webp', now() - interval '3 days'),
  ('laudos', pg_temp.id('a1') || '/e5200000-0000-4000-8000-000000000003.pdf', now() - interval '3 days'),
  ('fotos-animais', pg_temp.id('a1') || '/e5200000-0000-4000-8000-000000000004.webp', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select results_eq(
  $$select balde, split_part(caminho, '/', 2) from public.arquivos_soltos() order by caminho$$,
  $$values ('fotos-animais', 'e5200000-0000-4000-8000-000000000002.webp'), ('laudos', 'e5200000-0000-4000-8000-000000000003.pdf')$$,
  'soltos: a foto e o laudo sem registro; a foto ligada fica fora');
select is((select count(*)::int from public.arquivos_soltos() where caminho like '%0004.webp'), 0,
  'envio de agora não entra (pode estar terminando)');

set local request.jwt.claims = '{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select throws_ok($$select * from public.arquivos_soltos()$$, '42501', null, 'coordenação não vê arquivos soltos');

set local request.jwt.claims = '{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.arquivos_soltos()), 2, 'admin só com senha vê (MFA desligado, ADR 0012)');

select * from finish();
rollback;
