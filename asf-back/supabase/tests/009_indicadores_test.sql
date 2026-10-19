-- Fase 5: os onze indicadores conferidos contra um seed que conhece a resposta,
-- e cada número batendo com a lista (animais_lista) que o painel abre.
-- Só dados inventados.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('d4000000-0000-4000-8000-000000000001', 'coord@exemplo.test', 'authenticated', 'authenticated'),
  ('d4000000-0000-4000-8000-000000000002', 'vol@exemplo.test', 'authenticated', 'authenticated'),
  ('d4000000-0000-4000-8000-000000000003', 'sem-linha@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('d4000000-0000-4000-8000-000000000001', 'Coordenação Fictícia', 'coordenacao'),
  ('d4000000-0000-4000-8000-000000000002', 'Voluntário Fictício', 'voluntario');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

-- Sistema recém-instalado: tudo zero, não erro.
select is((public.indicadores(app.hoje() - 30, app.hoje()) ->> 'total')::int, 0, 'sem animais, os números são zero');

-- Seed ---------------------------------------------------------------------------
-- rex: cão macho, sede, disponível, vacinado, castrado
-- bob: cão macho, sede, castração agendada, em tratamento
-- lia: cadela, lar temporário
-- mel: gata, adotada no período
-- tita: gata, entrou no período, castrada e devolvida à comunidade
-- nino: gato macho, adotado há mais de um ano e devolvido no período (volta à sede)
-- zeca: cão macho adotado no período e depois excluído (some de tudo)
insert into ids select 'rex', (public.cadastrar_animal('cao', 'macho', app.hoje() - 60, 'resgate', 'sede', 'Rex Fictício', p_disponivel_adocao => true)).id;
insert into ids select 'bob', (public.cadastrar_animal('cao', 'macho', app.hoje() - 60, 'resgate', 'sede', 'Bob Fictício')).id;
insert into ids select 'lia', (public.cadastrar_animal('cao', 'femea', app.hoje() - 60, 'resgate', 'sede', 'Lia Fictícia')).id;
insert into ids select 'mel', (public.cadastrar_animal('gato', 'femea', app.hoje() - 60, 'resgate', 'sede', 'Mel Fictícia')).id;
insert into ids select 'tita', (public.cadastrar_animal('gato', 'femea', app.hoje() - 20, 'comunitario', 'sede', 'Tita Fictícia')).id;
insert into ids select 'nino', (public.cadastrar_animal('gato', 'macho', app.hoje() - 500, 'resgate', 'sede', 'Nino Fictício')).id;
insert into ids select 'zeca', (public.cadastrar_animal('cao', 'macho', app.hoje() - 60, 'resgate', 'sede', 'Zeca Fictício')).id;
insert into ids select 'pessoa', public.cadastrar_pessoa('Pessoa Fictícia', 'execucao_contrato',
  array['adotante', 'lar_temporario']::public.vinculo_pessoa[]);

select public.registrar_vacina(pg_temp.id('rex'), (select id from public.vacinas_tipos where nome = 'V8' limit 1),
  app.hoje() - 10, app.hoje() + 300);
select public.realizar_castracao(pg_temp.id('rex'), app.hoje() - 10);
select public.agendar_castracao(pg_temp.id('bob'), app.hoje() + 10);
select public.registrar_atendimento(pg_temp.id('bob'), 'tratamento', app.hoje() - 5, null, null, null, null,
  '{"medicamento": "Medicamento Fictício"}'::jsonb);
select public.mover_animal(pg_temp.id('lia'), 'em_acolhimento', 'lar_temporario', false, app.hoje() - 7,
  null, 'mudanca', null, null, pg_temp.id('pessoa'));
select public.registrar_adocao(pg_temp.id('mel'), pg_temp.id('pessoa'), app.hoje() - 3);
select public.realizar_castracao(pg_temp.id('tita'), app.hoje() - 10);
select public.mover_animal(pg_temp.id('tita'), 'devolvido_comunidade', null, false, app.hoje() - 2,
  null, 'mudanca', null, null, null, 'Bairro Fictício');
insert into ids select 'adocao_nino', public.registrar_adocao(pg_temp.id('nino'), pg_temp.id('pessoa'), app.hoje() - 400);
select public.registrar_devolucao(pg_temp.id('adocao_nino'), app.hoje() - 1, 'Motivo fictício');
select public.registrar_adocao(pg_temp.id('zeca'), pg_temp.id('pessoa'), app.hoje() - 5);
select public.excluir_animal(pg_temp.id('zeca'));

-- Os onze indicadores ---------------------------------------------------------------
select is(
  public.indicadores(app.hoje() - 30, app.hoje()) - 'de' - 'ate',
  '{
    "total": 6, "sob_cuidado": 4,
    "caes": 3, "caes_sob_cuidado": 3, "gatos": 3, "gatos_sob_cuidado": 1,
    "machos": 3, "machos_sob_cuidado": 3, "femeas": 3, "femeas_sob_cuidado": 1,
    "vacinados": 1, "vacinacao_pendente": 3,
    "castrados": 1, "nao_castrados": 2, "castracao_agendada": 1,
    "disponiveis": 1, "na_sede": 3, "em_lar_temporario": 1, "em_tratamento": 1,
    "adocoes": 1, "devolucoes": 1, "devolvidos_comunidade": 1
  }'::jsonb,
  'os onze indicadores batem com o seed (animal excluído não conta em nada)');

select results_eq(
  $$select sum(entradas)::int, sum(adocoes)::int, sum(devolvidos_comunidade)::int
    from public.indicadores_mensais(app.hoje() - 30, app.hoje())$$,
  $$values (1, 1, 1)$$,
  'série mensal: uma entrada, uma adoção e uma devolução à comunidade no período');
select is((select count(*)::int from public.indicadores_mensais(date '2026-01-15', date '2026-03-02')), 3,
  'série mensal tem um ponto por mês, mesmo sem nada no mês');

-- Cada número bate com a lista filtrada que ele abre -------------------------------
select is((select count(*)::int from public.animais_lista where situacao = 'em_acolhimento' and vacina_pendente),
  (public.indicadores(app.hoje() - 30, app.hoje()) ->> 'vacinacao_pendente')::int, 'vacinação pendente = lista filtrada');
select is((select count(*)::int from public.animais_lista where situacao = 'em_acolhimento' and castracao_status = 'nao_castrado'),
  (public.indicadores(app.hoje() - 30, app.hoje()) ->> 'nao_castrados')::int, 'não castrados = lista filtrada');
select is((select count(*)::int from public.animais_lista where situacao = 'em_acolhimento' and em_tratamento),
  (public.indicadores(app.hoje() - 30, app.hoje()) ->> 'em_tratamento')::int, 'em tratamento = lista filtrada');
select is((select count(*)::int from public.animais_lista where situacao = 'em_acolhimento' and local = 'lar_temporario'),
  (public.indicadores(app.hoje() - 30, app.hoje()) ->> 'em_lar_temporario')::int, 'em lar temporário = lista filtrada');
select is((select count(*)::int from public.animais_lista where especie = 'gato'),
  (public.indicadores(app.hoje() - 30, app.hoje()) ->> 'gatos')::int, 'gatos = lista filtrada');
select is((select count(*)::int from public.animais_lista where id = pg_temp.id('zeca')), 0,
  'animal excluído não aparece na lista');

-- Período e permissões ----------------------------------------------------------------
select is((public.indicadores(app.hoje() - 2, app.hoje()) ->> 'adocoes')::int, 0,
  'período sem adoção: zero');
select throws_ok($$select public.indicadores(app.hoje(), app.hoje() - 1)$$,
  'P0001', 'O início do período não pode ser depois do fim.', 'período invertido é recusado');

set local request.jwt.claims = '{"sub":"d4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is((public.indicadores(app.hoje() - 30, app.hoje()) ->> 'total')::int, 6, 'voluntário vê os indicadores');

set local request.jwt.claims = '{"sub":"d4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.indicadores()$$, '42501', null, 'conta sem linha em usuarios não vê indicadores');

select * from finish();
rollback;
