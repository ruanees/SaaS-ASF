-- Fase 3: prontuário (exames, testes, tratamentos, internações, óbito, saúde na
-- entrada) e o que muda no estado de saúde e nas pendências.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('b2000000-0000-4000-8000-000000000001', 'vet@exemplo.test', 'authenticated', 'authenticated'),
  ('b2000000-0000-4000-8000-000000000002', 'vol@exemplo.test', 'authenticated', 'authenticated'),
  ('b2000000-0000-4000-8000-000000000003', 'coord@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('b2000000-0000-4000-8000-000000000001', 'Veterinária Fictícia', 'veterinario'),
  ('b2000000-0000-4000-8000-000000000002', 'Voluntário Fictício', 'voluntario'),
  ('b2000000-0000-4000-8000-000000000003', 'Coordenação Fictícia', 'coordenacao');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

set local role authenticated;

-- Voluntário cadastra; registra a condição de entrada, mas não exames ---------------
set local request.jwt.claims = '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
insert into ids select 'eva', (public.cadastrar_animal('cao', 'femea', app.hoje() - 5, 'resgate', 'sede', 'Eva Fictícia')).id;
insert into ids select 'tom', (public.cadastrar_animal('cao', 'macho', app.hoje() - 30, 'resgate', 'sede', 'Tom Fictício')).id;
insert into ids select 'lua', (public.cadastrar_animal('gato', 'femea', app.hoje() - 30, 'resgate', 'sede', 'Lua Fictícia')).id;

select lives_ok($$select public.registrar_saude_entrada(pg_temp.id('eva'), 'Sarna generalizada')$$,
  'voluntário registra a condição de saúde na entrada');
select is((select condicao_entrada from public.animais where id = pg_temp.id('eva')), 'Sarna generalizada',
  'condição de entrada gravada no animal');
select throws_ok($$select public.registrar_saude_entrada(pg_temp.id('eva'), null, array['Hemograma'])$$, '42501', null,
  'voluntário não pede exames');
select throws_ok($$select public.registrar_atendimento(pg_temp.id('tom'), 'consulta', app.hoje())$$, '42501', null,
  'voluntário não registra atendimento clínico');

-- Coordenação: exemplo da Eva (fígado alterado, hemograma, calazar, 4DX, medicação) -----
set local request.jwt.claims = '{"sub":"b2000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.registrar_saude_entrada(pg_temp.id('eva'), 'Sarna generalizada, fígado alterado',
  array['Hemograma', 'Leishmaniose (calazar)', '4DX'],
  '{"medicamento": "Ivermectina", "dose": "0,2 mg/kg", "frequencia": "1 vez por semana"}'::jsonb)$$,
  'coordenação registra a saúde na entrada com exames e tratamento');
select results_eq(
  $$select a.tipo::text, e.nome, e.resultado from public.exames e join public.atendimentos a on a.id = e.atendimento_id
    where a.animal_id = pg_temp.id('eva') order by e.nome$$,
  $$values ('teste', '4DX', 'aguardando'), ('exame', 'Hemograma', 'aguardando'), ('teste', 'Leishmaniose (calazar)', 'aguardando')$$,
  'hemograma vira exame; calazar e 4DX viram testes; todos aguardando resultado');
select is((select data from public.atendimentos where animal_id = pg_temp.id('eva') and tipo = 'tratamento'),
  app.hoje() - 5, 'exames e tratamento de entrada ficam na data de entrada');
select results_eq($$select em_tratamento, exames_aguardando from public.animal_saude where animal_id = pg_temp.id('eva')$$,
  $$values (true, 3)$$, 'Eva: em tratamento e com 3 exames aguardando');
select is((select count(*)::int from public.pendencias_saude() where tipo = 'exame' and animal_id = pg_temp.id('eva')), 3,
  'os 3 exames aguardando aparecem em Pendências');

-- Veterinária: consulta, teste pendente, tratamento, internação (Pronto quando) --------
set local request.jwt.claims = '{"sub":"b2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
insert into ids select 'consulta', public.registrar_atendimento(pg_temp.id('tom'), 'consulta', app.hoje() - 3, null, 'Dra. Fictícia CRMV 0000', 'Apatia e perda de peso');
insert into ids select 'leish', public.registrar_atendimento(pg_temp.id('tom'), 'teste', app.hoje() - 3, null, null, null, null,
  '{"nome": "Leishmaniose (calazar)", "metodo": "Teste rápido"}'::jsonb);
insert into ids select 'trat', public.registrar_atendimento(pg_temp.id('tom'), 'tratamento', app.hoje() - 3, null, null, null, null,
  '{"medicamento": "Medicamento Fictício", "dose": "1 comprimido", "frequencia": "12/12 h"}'::jsonb);
insert into ids select 'intern', public.registrar_atendimento(pg_temp.id('tom'), 'internacao', app.hoje() - 2);

select is((select count(*)::int from public.atendimentos where animal_id = pg_temp.id('tom') and tipo in ('consulta', 'teste', 'tratamento', 'internacao')), 4,
  'consulta, teste, tratamento e internação na mesma linha do tempo');
select results_eq($$select em_tratamento, internado, leishmaniose_reagente from public.animal_saude where animal_id = pg_temp.id('tom')$$,
  $$values (true, true, false)$$, 'internado e em tratamento; teste ainda aguardando não acusa leishmaniose');

select throws_ok($$select public.registrar_atendimento(pg_temp.id('tom'), 'internacao', app.hoje() - 2, null, null, null, null, '{"alta": "2000-01-01"}'::jsonb)$$,
  'P0001', 'A alta não pode ser antes da entrada.', 'internação com alta antes da entrada é recusada');
select throws_ok(format($$select public.dar_alta(%L, %L)$$, pg_temp.id('intern'), app.hoje() - 10),
  'P0001', 'A alta não pode ser antes da entrada.', 'alta antes da entrada é recusada');
select lives_ok(format($$select public.dar_alta(%L, %L)$$, pg_temp.id('intern'), app.hoje()), 'alta registrada depois');
select throws_ok(format($$select public.dar_alta(%L, %L)$$, pg_temp.id('intern'), app.hoje()),
  'P0001', 'Esta internação já teve alta.', 'segunda alta é recusada');

select lives_ok(format($$select public.registrar_resultado_exame(%L, 'reagente', 'Teste rápido reagente')$$, pg_temp.id('leish')),
  'resultado do teste entra depois');
select is((select leishmaniose_reagente from public.animal_saude where animal_id = pg_temp.id('tom')), true,
  'leishmaniose reagente acende o alerta');
select ok(not exists (select 1 from public.pendencias_saude() where tipo = 'exame' and animal_id = pg_temp.id('tom')),
  'com resultado, o exame sai de Pendências');
select throws_ok(format($$select public.registrar_resultado_exame(%L, 'aguardando')$$, pg_temp.id('leish')),
  'P0001', 'Escolha o resultado.', 'resultado precisa ser um resultado de verdade');

select throws_ok(format($$select public.encerrar_tratamento(%L, %L)$$, pg_temp.id('trat'), app.hoje() - 10),
  'P0001', 'O fim do tratamento não pode ser antes do início.', 'fim antes do início é recusado');
select lives_ok(format($$select public.encerrar_tratamento(%L, %L)$$, pg_temp.id('trat'), app.hoje()), 'tratamento encerrado');
select is((select em_tratamento from public.animal_saude where animal_id = pg_temp.id('tom')), false,
  'sem tratamento em andamento, sem internação e fora da clínica: não está mais em tratamento');

select throws_ok($$select public.registrar_atendimento(pg_temp.id('tom'), 'vacina', app.hoje())$$,
  'P0001', 'Vacina, vermífugo, antipulgas e castração têm registro próprio, na aba Saúde.', 'vacina não entra por aqui');
select throws_ok(format($$select public.anexar_laudo(%L, %L)$$, pg_temp.id('leish'), pg_temp.id('tom')::text || '/00000000-0000-4000-8000-000000000000.pdf'),
  'P0001', 'O envio do laudo não terminou. Tente de novo.', 'laudo sem arquivo no balde não é registrado');

-- Óbito: situação e atendimento juntos, pelos dois caminhos ------------------------------
select lives_ok($$select public.registrar_atendimento(pg_temp.id('tom'), 'obito', app.hoje(), null, null, 'Insuficiência fictícia')$$,
  'óbito pelo prontuário');
select results_eq(
  $$select (select situacao::text from public.animais where id = pg_temp.id('tom')),
           (select count(*)::int from public.atendimentos where animal_id = pg_temp.id('tom') and tipo = 'obito'),
           (select count(*)::int from public.movimentacoes where animal_id = pg_temp.id('tom') and situacao = 'obito')$$,
  $$values ('obito', 1, 1)$$, 'óbito pelo prontuário grava situação, atendimento e movimentação');

set local request.jwt.claims = '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.mover_animal(pg_temp.id('lua'), 'obito', null, false, app.hoje(), 'Fictício')$$,
  'óbito pela aba Situação (voluntário)');
select is((select count(*)::int from public.atendimentos where animal_id = pg_temp.id('lua') and tipo = 'obito'), 1,
  'óbito pela aba Situação também entra no prontuário');

-- Leitura -------------------------------------------------------------------------------
select is((select count(*)::int from public.exames e join public.atendimentos a on a.id = e.atendimento_id where a.animal_id = pg_temp.id('eva')), 3,
  'voluntário lê os exames do prontuário');
select is((select count(*)::int from public.tratamentos t join public.atendimentos a on a.id = t.atendimento_id where a.animal_id = pg_temp.id('eva')), 1,
  'voluntário lê os tratamentos');

reset role;
set local role anon;
select throws_ok('select * from public.exames', '42501', null, 'anônimo não lê exames');

select * from finish();
rollback;
