-- Ajustes da Fase 2 pelo questionário: protocolo de 3 doses, vermífugo de filhote,
-- antiparasitário, castração com adotante, microchip e prioridade de fêmeas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('a1000000-0000-4000-8000-000000000001', 'vol@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('a1000000-0000-4000-8000-000000000001', 'Voluntária Fictícia', 'voluntario');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated;

-- Catálogo inicial da migração ---------------------------------------------------
select results_eq(
  $$select nome, reforco_dias, doses_iniciais, intervalo_inicial_dias from public.vacinas_tipos where especie = 'cao' order by nome$$,
  $$values ('Antirrábica', 365, 3, 21), ('V10', 365, 3, 21), ('V8', 365, 3, 21)$$,
  'catálogo de cães: V8, V10 e antirrábica, 3 doses com 21 dias e reforço anual');
select is((select count(*)::int from public.clinicas where nome = 'Clínica Mundo Animal'), 1, 'Clínica Mundo Animal cadastrada');

insert into ids select 'v10', id from public.vacinas_tipos where nome = 'V10' and especie = 'cao';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

insert into ids select 'filhote', (public.cadastrar_animal('cao', 'femea', app.hoje() - 10, 'resgate', 'sede', 'Eva Fictícia', app.hoje() - 60, 'aproximada')).id;
insert into ids select 'adulto', (public.cadastrar_animal('cao', 'macho', app.hoje() - 10, 'resgate', 'sede', 'Rex Fictício', app.hoje() - 1000, 'aproximada')).id;
insert into ids select 'gata', (public.cadastrar_animal('gato', 'femea', app.hoje() - 10, 'castracao', 'sede', 'Mia Fictícia')).id;

-- Protocolo de 3 doses --------------------------------------------------------------
select is(public.sugerir_proxima_dose(pg_temp.id('filhote'), pg_temp.id('v10'), app.hoje() - 42), app.hoje() - 21,
  '1ª dose: sugere a 2ª em 21 dias');
select lives_ok($$select public.registrar_vacina(pg_temp.id('filhote'), pg_temp.id('v10'), app.hoje() - 42, app.hoje() - 21)$$, 'preparação: registrar_vacina');
select is(public.sugerir_proxima_dose(pg_temp.id('filhote'), pg_temp.id('v10'), app.hoje() - 21), app.hoje(),
  '2ª dose: sugere a 3ª em 21 dias');
select lives_ok($$select public.registrar_vacina(pg_temp.id('filhote'), pg_temp.id('v10'), app.hoje() - 21, app.hoje())$$, 'preparação: registrar_vacina');
select is(public.sugerir_proxima_dose(pg_temp.id('filhote'), pg_temp.id('v10'), app.hoje()), app.hoje() + 365,
  '3ª dose: sugere o reforço anual');
select is(public.sugerir_proxima_dose(pg_temp.id('adulto'), pg_temp.id('v10'), app.hoje()), app.hoje() + 21,
  'adulto sem histórico também começa pelo protocolo inicial');

-- Vermífugo ---------------------------------------------------------------------------
select is(public.sugerir_proxima_vermifugacao(pg_temp.id('filhote'), app.hoje()), app.hoje() + 15,
  'filhote na primeira vermifugação: próxima em 15 dias');
select is(public.sugerir_proxima_vermifugacao(pg_temp.id('adulto'), app.hoje()), (app.hoje() + interval '6 months')::date,
  'adulto: próxima em 6 meses');
select lives_ok($$select public.registrar_vermifugacao(pg_temp.id('filhote'), 'Vermífugo Fictício', app.hoje() - 1, app.hoje() + 14)$$, 'preparação: registrar_vermifugacao');
select is(public.sugerir_proxima_vermifugacao(pg_temp.id('filhote'), app.hoje()), (app.hoje() + interval '6 months')::date,
  'filhote que já começou a série: próxima em 6 meses');
select is(public.sugerir_proxima_vermifugacao(pg_temp.id('gata'), app.hoje()), (app.hoje() + interval '6 months')::date,
  'sem idade informada: regra do adulto');

-- Antiparasitário ------------------------------------------------------------------------
select is(public.sugerir_proximo_antiparasitario('Simparic', app.hoje()), (app.hoje() + interval '6 months')::date,
  'Simparic: próxima aplicação em 6 meses');
select is(public.sugerir_proximo_antiparasitario('Bravecto', app.hoje()), null, 'Bravecto: sem próxima dose sugerida');
select lives_ok($$select public.registrar_antiparasitario(pg_temp.id('adulto'), 'Simparic', app.hoje() - 200, app.hoje() - 20)$$,
  'antiparasitário registrado');
select is((select tipo::text from public.atendimentos where animal_id = pg_temp.id('adulto') and tipo::text = 'antiparasitario'), 'antiparasitario',
  'antiparasitário entra na linha do tempo');
select is((select antiparasitario_vencido from public.animal_saude where animal_id = pg_temp.id('adulto')), true,
  'antiparasitário vencido aparece no estado');
select ok(exists (select 1 from public.pendencias_saude() where tipo = 'antiparasitario' and animal_id = pg_temp.id('adulto') and vencida),
  'antiparasitário vencido aparece em Pendências');

-- Prioridade de castração: fêmeas -------------------------------------------------------------
select ok(exists (select 1 from public.pendencias_saude() where tipo = 'castracao_prioridade' and animal_id = pg_temp.id('gata')),
  'gata em acolhimento sem castração aparece como prioridade');
select ok(not exists (select 1 from public.pendencias_saude() where tipo = 'castracao_prioridade' and animal_id = pg_temp.id('adulto')),
  'macho não entra na prioridade');

-- Castração com adotante e microchip ---------------------------------------------------------
select lives_ok($$select public.agendar_castracao(pg_temp.id('gata'), app.hoje() + 5)$$, 'preparação: agendar_castracao');
select ok(not exists (select 1 from public.pendencias_saude() where tipo = 'castracao_prioridade' and animal_id = pg_temp.id('gata')),
  'com castração agendada, sai da prioridade');

reset role;
-- Adoção é da Fase 4: aqui o estado é posto direto, como a função de adoção fará.
update public.animais set situacao = 'adotado', local = null, disponivel_adocao = false where id = (select valor from ids where chave = 'gata');
select is((select status from public.castracoes where animal_id = (select valor from ids where chave = 'gata')), 'agendada',
  'adoção não cancela a castração agendada');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select ok(exists (select 1 from public.pendencias_saude() where tipo = 'castracao' and animal_id = pg_temp.id('gata')
  and descricao = 'Castração agendada (com o adotante)'), 'castração do adotado aparece em Pendências');

select lives_ok($$select public.realizar_castracao(pg_temp.id('gata'), app.hoje(), null, null, null, '985 112 000 123 456')$$,
  'castração do adotado realizada com microchip');
select is((select microchip from public.animais where id = pg_temp.id('gata')), '985112000123456',
  'microchip gravado no animal, sem espaços');
select throws_ok($$select public.realizar_castracao(pg_temp.id('filhote'), app.hoje(), null, null, null, '985112000123456')$$,
  'P0001', 'Este microchip já está registrado em outro animal.', 'microchip repetido é recusado');

-- Transferência cancela -----------------------------------------------------------------------
select lives_ok($$select public.agendar_castracao(pg_temp.id('adulto'), app.hoje() + 3)$$, 'preparação: agendar_castracao');
reset role;
update public.animais set situacao = 'transferido', local = null, disponivel_adocao = false where id = (select valor from ids where chave = 'adulto');
select is((select status from public.castracoes where animal_id = (select valor from ids where chave = 'adulto')), 'cancelada',
  'transferência cancela a castração agendada');

select * from finish();
rollback;
