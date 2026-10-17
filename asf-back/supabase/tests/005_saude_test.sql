-- Fase 2: vacinação, vermifugação, castração, estado calculado e pendências.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

delete from public.usuarios;
delete from public.numeracao;
update public.configuracoes set fuso = 'America/Fortaleza', aviso_vacina_dias = 15;

insert into auth.users (id, email, aud, role) values
  ('f0000000-0000-4000-8000-000000000001', 'coord@exemplo.test', 'authenticated', 'authenticated'),
  ('f0000000-0000-4000-8000-000000000002', 'vol@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('f0000000-0000-4000-8000-000000000001', 'Coordenação Fictícia', 'coordenacao'),
  ('f0000000-0000-4000-8000-000000000002', 'Voluntária Fictícia', 'voluntario');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

-- Virada de dia (não depende de usuário) ---------------------------------------
select is(app.hoje_em('2026-10-17 00:30:00+00'), '2026-10-16'::date,
  '21h30 em Fortaleza (00h30 UTC do dia 17) ainda é dia 16');
select is(app.hoje_em('2026-10-17 01:00:00+00'), '2026-10-16'::date,
  '22h em Fortaleza ainda é dia 16, mesmo com o servidor no dia 17');
select is(app.hoje_em('2026-10-17 03:00:00+00'), '2026-10-17'::date,
  'meia-noite em Fortaleza vira dia 17');

-- Catálogo: coordenação cadastra, voluntária não ---------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into public.vacinas_tipos (nome, especie, reforco_dias) values ('V10', 'cao', 365), ('V4', 'gato', 365), ('Antirrábica', 'cao', 365);
insert into ids select 'v10', id from public.vacinas_tipos where nome = 'V10';
insert into ids select 'v4', id from public.vacinas_tipos where nome = 'V4';
insert into ids select 'raiva', id from public.vacinas_tipos where nome = 'Antirrábica';
select is((select count(*)::int from public.vacinas_tipos), 3, 'coordenação cadastra o catálogo');

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$insert into public.vacinas_tipos (nome, especie) values ('V8', 'cao')$$, '42501', null,
  'voluntária não mexe no catálogo');

-- Animais fictícios (voluntária cadastra) -----------------------------------------
insert into ids select 'rex', (public.cadastrar_animal('cao', 'macho', app.hoje() - 200, 'resgate', 'sede', 'Rex')).id;
insert into ids select 'mia', (public.cadastrar_animal('gato', 'femea', app.hoje() - 100, 'resgate', 'sede', 'Mia')).id;
insert into ids select 'tom', (public.cadastrar_animal('cao', 'macho', app.hoje() - 50, 'comunitario', 'sede', 'Tom')).id;

select results_eq($$select vacinado, vacina_pendente, vacinacao_status from public.animal_saude where animal_id = pg_temp.id('rex')$$,
  $$values (false, true, 'nao_vacinado')$$, 'nunca vacinado: não vacinado e pendente');
select is((select castracao_status from public.animal_saude where animal_id = pg_temp.id('rex')), 'nao_castrado',
  'sem registro: não castrado');

-- Vacinação ----------------------------------------------------------------------
select lives_ok($$select public.registrar_vacina(pg_temp.id('rex'), pg_temp.id('v10'), app.hoje(), app.hoje() + 365, 'L123')$$,
  'voluntária registra a V10 do cão');
select results_eq($$select vacinado, vacina_pendente, vacinacao_status from public.animal_saude where animal_id = pg_temp.id('rex')$$,
  $$values (true, false, 'vacinado')$$, 'depois da V10: vacinado e sem pendência');
select is((select count(*)::int from public.atendimentos where animal_id = pg_temp.id('rex') and tipo = 'vacina'), 1,
  'a vacina entra na linha do tempo como atendimento');
select throws_ok($$select public.registrar_vacina(pg_temp.id('rex'), pg_temp.id('v4'), app.hoje())$$,
  'P0001', 'A vacina V4 é para gatos, e o animal é um cão.', 'vacina de gato em cão é recusada');
select throws_ok($$select public.registrar_vacina(pg_temp.id('rex'), pg_temp.id('raiva'), app.hoje() + 1)$$,
  'P0001', 'A data não pode ser no futuro.', 'vacina com data no futuro é recusada');
select throws_ok($$select public.registrar_vacina(pg_temp.id('rex'), pg_temp.id('raiva'), app.hoje(), app.hoje())$$,
  'P0001', 'A próxima dose precisa ser depois da aplicação.', 'próxima dose no mesmo dia é recusada');
select lives_ok($$select public.registrar_vacina(pg_temp.id('tom'), pg_temp.id('raiva'), app.hoje() - 400, app.hoje() - 35)$$,
  'vacina anterior à entrada (chegou com carteirinha) é aceita');

-- Vencida, a vencer e reaplicação ------------------------------------------------------
select results_eq($$select vacina_pendente, vacinacao_status from public.animal_saude where animal_id = pg_temp.id('tom')$$,
  $$values (true, 'vencida')$$, 'próxima dose no passado: vencida e pendente');
select lives_ok($$select public.registrar_vacina(pg_temp.id('tom'), pg_temp.id('raiva'), app.hoje() - 2, app.hoje() + 10)$$,
  'reaplicação da mesma vacina');
select results_eq($$select vacina_pendente, vacinacao_status from public.animal_saude where animal_id = pg_temp.id('tom')$$,
  $$values (false, 'vence_em_breve')$$, 'a aplicação nova tira a pendência; próxima dose em 10 dias = vence em breve');
select is((select proxima_vacina from public.animal_saude where animal_id = pg_temp.id('tom')), app.hoje() + 10,
  'próxima vacina é a da aplicação mais recente');

-- Vermifugação -------------------------------------------------------------------------
select lives_ok($$select public.registrar_vermifugacao(pg_temp.id('mia'), 'Vermífugo Fictício', app.hoje() - 100, app.hoje() - 10)$$,
  'vermifugação registrada');
select results_eq($$select proxima_vermifugacao, vermifugacao_vencida from public.animal_saude where animal_id = pg_temp.id('mia')$$,
  $$values (app.hoje() - 10, true)$$, 'vermifugação vencida aparece no estado');

-- Castração ----------------------------------------------------------------------------
select lives_ok($$select public.agendar_castracao(pg_temp.id('rex'), app.hoje() + 3)$$, 'castração agendada');
select results_eq($$select castracao_status, castracao_agendada_para from public.animal_saude where animal_id = pg_temp.id('rex')$$,
  $$values ('agendada', app.hoje() + 3)$$, 'estado: castração agendada com a data');
select throws_ok($$select public.agendar_castracao(pg_temp.id('rex'), app.hoje() + 5)$$,
  'P0001', 'Este animal já tem castração agendada.', 'segundo agendamento aberto é recusado');
select lives_ok($$select public.realizar_castracao(pg_temp.id('rex'), app.hoje())$$, 'castração realizada a partir do agendamento');
select is((select castracao_status from public.animal_saude where animal_id = pg_temp.id('rex')), 'castrado', 'estado: castrado');
select is((select count(*)::int from public.castracoes where animal_id = pg_temp.id('rex')), 1,
  'o agendamento vira a castração realizada (sem linha duplicada)');
select throws_ok($$select public.realizar_castracao(pg_temp.id('rex'), app.hoje())$$,
  'P0001', 'Este animal já está castrado.', 'segunda castração realizada é recusada');

select lives_ok($$select public.registrar_castracao_anterior(pg_temp.id('mia'))$$, 'já chegou castrada');
select is((select castracao_status from public.animal_saude where animal_id = pg_temp.id('mia')), 'castrado',
  'chegou castrada conta como castrada');

-- Saída de acolhimento cancela o agendamento ---------------------------------------------
select lives_ok($$select public.agendar_castracao(pg_temp.id('tom'), app.hoje() + 7)$$, 'castração agendada para o Tom');
select lives_ok($$select public.mover_animal(pg_temp.id('tom'), 'obito', null, false, app.hoje(), 'Fictício')$$, 'óbito registrado');
select is((select status from public.castracoes where animal_id = pg_temp.id('tom')), 'cancelada',
  'óbito cancela a castração agendada automaticamente');

-- Pendências ----------------------------------------------------------------------------
select ok(exists (select 1 from public.pendencias_saude() where tipo = 'vermifugacao' and animal_id = pg_temp.id('mia') and vencida),
  'vermifugação vencida aparece em Pendências');
select ok(not exists (select 1 from public.pendencias_saude() where animal_id = pg_temp.id('tom')),
  'animal fora de acolhimento (óbito) não aparece em Pendências');

-- Anônimo ----------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok('select * from public.animal_saude', '42501', null, 'anônimo não lê o estado de saúde');

select * from finish();
rollback;
