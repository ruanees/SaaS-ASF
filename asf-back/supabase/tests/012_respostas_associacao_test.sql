-- Respostas da associação (20/10/2026): vacinas de gato, CPF/RG/profissão,
-- bairro na devolução à comunidade, óbito de adotado, prazo de guarda que só
-- conta depois do óbito ou da devolução, acompanhamento pós-adoção e relatório
-- social. Só dados inventados (o CPF é o número de exemplo, válido e fictício).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('f6000000-0000-4000-8000-000000000001', 'coord@exemplo.test', 'authenticated', 'authenticated'),
  ('f6000000-0000-4000-8000-000000000002', 'vol@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('f6000000-0000-4000-8000-000000000001', 'Coordenação Fictícia', 'coordenacao'),
  ('f6000000-0000-4000-8000-000000000002', 'Voluntário Fictício', 'voluntario');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

-- Adotante cadastrada há 3 anos (carimbo desligado só nesta transação); prazo de 24 meses.
update public.configuracoes set retencao_pessoas_meses = 24;
alter table public.pessoas disable trigger pessoas_carimbar;
insert into public.pessoas (id, nome, base_legal, vinculos, criado_em) values
  ('f6100000-0000-4000-8000-000000000001', 'Adotante Antiga Fictícia', 'execucao_contrato', '{adotante}', now() - interval '3 years');
alter table public.pessoas enable trigger pessoas_carimbar;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f6000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- Vacinas de gato ---------------------------------------------------------------------
select is((select count(*)::int from public.vacinas_tipos where especie = 'gato' and nome in ('V4', 'V5', 'Antirrábica')), 3,
  'catálogo de gato: V4, V5 e antirrábica');
select is((select doses_iniciais from public.vacinas_tipos where especie = 'gato' and nome = 'V4'), 3,
  'V4: 3 doses na primeira vez, como as de cão');

-- CPF, RG e profissão -----------------------------------------------------------------
select throws_ok($$select public.cadastrar_pessoa('Pessoa Fictícia', 'acordo_voluntariado',
  array['lar_temporario']::public.vinculo_pessoa[], null, null, null, '123.456.789-00')$$,
  'P0001', 'CPF inválido. Confira os números.', 'CPF com dígito verificador errado é recusado');
insert into ids select 'lar', public.cadastrar_pessoa('Lar Fictício', 'acordo_voluntariado',
  array['lar_temporario']::public.vinculo_pessoa[], '(88) 90000-0003', null, 'Rua Fictícia, 3',
  '529.982.247-25', 'RG 0000000 SSP-CE', 'Professora');
select results_eq(format($$select cpf, rg, profissao from public.ler_contato(%L)$$, pg_temp.id('lar')),
  $$values ('52998224725', 'RG 0000000 SSP-CE', 'Professora')$$, 'CPF guardado só com números; RG e profissão guardados');
select lives_ok(format($$select public.alterar_contato(%L, '(88) 90000-0003', null, 'Rua Fictícia, 3')$$, pg_temp.id('lar')),
  'alterar só telefone, e-mail e endereço continua funcionando');

-- Devolução à comunidade com bairro ----------------------------------------------------
insert into ids select 'comunitario', (public.cadastrar_animal('gato', 'femea', app.hoje() - 20, 'comunitario', 'sede', 'Gata Fictícia')).id;
select public.realizar_castracao(pg_temp.id('comunitario'), app.hoje() - 5);
select throws_ok(format($$select public.mover_animal(%L, 'devolvido_comunidade', null, false, app.hoje())$$, pg_temp.id('comunitario')),
  'P0001', 'Informe o bairro ou a rua onde o animal foi solto.', 'devolução à comunidade sem bairro é recusada');
select lives_ok(format($$select public.mover_animal(%L, 'devolvido_comunidade', null, false, app.hoje(),
  null, 'mudanca', null, null, null, 'Rua Inventada, Centro')$$, pg_temp.id('comunitario')), 'com o bairro ou a rua, registra');

-- Adoção antiga, animal vivo: vínculo ativo; depois o óbito ------------------------------
insert into ids select 'velho', (public.cadastrar_animal('cao', 'macho', app.hoje() - 1100, 'resgate', 'sede', 'Cão Fictício')).id;
insert into ids select 'adocao', public.registrar_adocao(pg_temp.id('velho'), 'f6100000-0000-4000-8000-000000000001', app.hoje() - 1000);
select is((select count(*)::int from public.pessoas_alem_do_prazo() where nome = 'Adotante Antiga Fictícia'), 0,
  'adotante de animal vivo não entra no prazo de guarda (acompanhamento até o fim da vida)');

-- Acompanhamento ------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"f6000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(format($$select public.registrar_acompanhamento(%L, app.hoje() - 950, 'whatsapp', 'Mandou vídeo, animal bem')$$, pg_temp.id('adocao')),
  'voluntário registra acompanhamento');
select throws_ok(format($$select public.registrar_acompanhamento(%L, app.hoje() - 1050, 'visita')$$, pg_temp.id('adocao')),
  'P0001', 'O acompanhamento precisa ser entre a adoção e a devolução.', 'acompanhamento antes da adoção é recusado');
select throws_ok(format($$select public.registrar_acompanhamento(%L, app.hoje(), 'carta')$$, pg_temp.id('adocao')),
  'P0001', 'Escolha como foi o acompanhamento.', 'forma inválida é recusada');

-- Óbito do animal adotado (registrado por quem acompanha) --------------------------------
select throws_ok(format($$select public.mover_animal(%L, 'em_acolhimento', 'sede', false, app.hoje())$$, pg_temp.id('velho')),
  'P0001', 'Animal adotado volta pela devolução, na aba Adoção.', 'adotado continua sem voltar por mudança comum');
select lives_ok(format($$select public.mover_animal(%L, 'obito', null, false, app.hoje() - 900, 'Idade avançada')$$, pg_temp.id('velho')),
  'óbito de animal adotado é registrado');
select is((select situacao::text from public.animais where id = pg_temp.id('velho')), 'obito', 'animal adotado passa para óbito');
select is((select count(*)::int from public.atendimentos where animal_id = pg_temp.id('velho') and tipo = 'obito'), 1,
  'o óbito também entra no prontuário');

set local request.jwt.claims = '{"sub":"f6000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select ultimo_evento from public.pessoas_alem_do_prazo() where nome = 'Adotante Antiga Fictícia'), app.hoje() - 900,
  'depois do óbito, o prazo de 24 meses conta da data do óbito');

select lives_ok($$select public.anonimizar_pessoa('f6100000-0000-4000-8000-000000000001')$$, 'coordenação anonimiza a adotante');
select is((select count(*)::int from public.acompanhamentos where observacoes is not null and adocao_id = pg_temp.id('adocao')), 0,
  'anonimizar apaga as observações dos acompanhamentos');

-- Relatório social ------------------------------------------------------------------------
select is((select count(*)::int from public.relatorio_social(date '2026-01-15', date '2026-03-02')), 4,
  'relatório social: um ponto por mês (3) e o total');
select is(
  (select castracoes from public.relatorio_social(app.hoje() - 30, app.hoje()) where mes is null),
  (select count(*)::int from public.atendimentos where tipo = 'castracao' and data between app.hoje() - 30 and app.hoje()),
  'total de castrações do relatório = castrações registradas no período');

select * from finish();
rollback;
