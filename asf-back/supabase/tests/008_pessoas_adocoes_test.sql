-- Fase 4: pessoas, contato protegido, lar temporário, adoção, devolução,
-- transferência, devolução à comunidade, exportação e anonimização.
-- Só dados inventados.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('c3000000-0000-4000-8000-000000000001', 'admin@exemplo.test', 'authenticated', 'authenticated'),
  ('c3000000-0000-4000-8000-000000000002', 'coord@exemplo.test', 'authenticated', 'authenticated'),
  ('c3000000-0000-4000-8000-000000000003', 'vet@exemplo.test', 'authenticated', 'authenticated'),
  ('c3000000-0000-4000-8000-000000000004', 'vol@exemplo.test', 'authenticated', 'authenticated'),
  ('c3000000-0000-4000-8000-000000000005', 'sem-linha@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('c3000000-0000-4000-8000-000000000001', 'Admin Fictícia', 'admin'),
  ('c3000000-0000-4000-8000-000000000002', 'Coordenação Fictícia', 'coordenacao'),
  ('c3000000-0000-4000-8000-000000000003', 'Veterinária Fictícia', 'veterinario'),
  ('c3000000-0000-4000-8000-000000000004', 'Voluntário Fictício', 'voluntario');

create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(p text) returns uuid language sql as $$ select valor from ids where chave = p $$;
grant execute on function pg_temp.id(text) to authenticated, anon;

set local role authenticated;

-- Cadastro de pessoa: só administração e coordenação ---------------------------------
set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.cadastrar_pessoa('Pessoa Fictícia', 'consentimento', array['adotante']::public.vinculo_pessoa[])$$,
  '42501', null, 'voluntário não cadastra pessoa');
insert into ids select 'nina', (public.cadastrar_animal('cao', 'femea', app.hoje() - 30, 'resgate', 'sede', 'Nina Fictícia')).id;
insert into ids select 'bento', (public.cadastrar_animal('cao', 'macho', app.hoje() - 30, 'resgate', 'sede', 'Bento Fictício')).id;
insert into ids select 'mia', (public.cadastrar_animal('gato', 'femea', app.hoje() - 30, 'comunitario', 'sede', 'Mia Fictícia')).id;

set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.cadastrar_pessoa('Pessoa Fictícia', 'consentimento', '{}')$$,
  'P0001', 'Escolha o vínculo: adotante ou lar temporário.', 'pessoa sem vínculo é recusada');
select throws_ok($$select public.cadastrar_pessoa('Pessoa Fictícia', null, array['adotante']::public.vinculo_pessoa[])$$,
  'P0001', 'Escolha a base legal.', 'pessoa sem base legal é recusada');
insert into ids select 'maria', public.cadastrar_pessoa('Maria Fictícia', 'acordo_voluntariado',
  array['lar_temporario']::public.vinculo_pessoa[], '(88) 90000-0001', 'maria@exemplo.test', 'Rua Fictícia, 1');
insert into ids select 'joao', public.cadastrar_pessoa('João Fictício', 'execucao_contrato',
  array['adotante']::public.vinculo_pessoa[], '(88) 90000-0002', null, 'Rua Inventada, 2');
select is((select count(*)::int from public.pessoas), 2, 'coordenação cadastra pessoas');

select results_eq(format($$select telefone, endereco from public.ler_contato(%L)$$, pg_temp.id('maria')),
  $$values ('(88) 90000-0001', 'Rua Fictícia, 1')$$, 'coordenação lê o contato pela função');
select throws_ok($$select count(*) from public.pessoas_contato$$, '42501', null,
  'nem a coordenação lê pessoas_contato direto (toda leitura vai para a auditoria)');
select lives_ok(format($$select public.alterar_contato(%L, '(88) 90000-0009', 'maria@exemplo.test', 'Rua Fictícia, 1')$$, pg_temp.id('maria')),
  'coordenação corrige o telefone');

-- Voluntário e veterinário veem o nome, nunca o contato -------------------------------
set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select is((select nome from public.pessoas where id = pg_temp.id('maria')), 'Maria Fictícia', 'voluntário vê o nome da pessoa');
select throws_ok($$select count(*) from public.pessoas_contato$$, '42501', null, 'voluntário não lê pessoas_contato');
select throws_ok(format($$select * from public.ler_contato(%L)$$, pg_temp.id('maria')), '42501', null,
  'voluntário não lê o contato pela função');
select throws_ok(format($$select public.exportar_pessoa(%L)$$, pg_temp.id('maria')), '42501', null,
  'voluntário não exporta dados de pessoa');

set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select throws_ok($$select count(*) from public.pessoas_contato$$, '42501', null, 'veterinário não lê pessoas_contato');
select throws_ok(format($$select * from public.ler_contato(%L)$$, pg_temp.id('maria')), '42501', null,
  'veterinário não lê o contato pela função');

-- Auditoria: a leitura fica registrada; a alteração guarda o nome do campo, não o valor
set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is((select count(*)::int from public.auditoria
            where tabela = 'pessoas_contato' and registro_id = pg_temp.id('maria') and operacao = 'leitura_sensivel'), 1,
  'a leitura do contato foi registrada na auditoria');
select is((select campos_alterados from public.auditoria
            where tabela = 'pessoas_contato' and registro_id = pg_temp.id('maria') and operacao = 'update'),
  array['telefone'], 'a auditoria guarda que o telefone mudou, sem o valor');

-- Lar temporário (o voluntário registra, escolhendo a pessoa pelo nome) ---------------
set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select throws_ok(format($$select public.mover_animal(%L, 'em_acolhimento', 'lar_temporario', false, app.hoje() - 20)$$, pg_temp.id('nina')),
  'P0001', 'Escolha a pessoa do lar temporário.', 'lar temporário sem pessoa é recusado');
select lives_ok(format($$select public.mover_animal(%L, 'em_acolhimento', 'lar_temporario', false, app.hoje() - 20,
  null, 'mudanca', null, null, %L)$$, pg_temp.id('nina'), pg_temp.id('maria')),
  'voluntário coloca a Nina no lar temporário da Maria');
select results_eq(format($$select local::text, pessoa_id from public.animais where id = %L$$, pg_temp.id('nina')),
  format($$values ('lar_temporario', %L::uuid)$$, pg_temp.id('maria')), 'a ficha mostra com quem a Nina está');

set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select throws_ok(format($$select public.anonimizar_pessoa(%L)$$, pg_temp.id('maria')),
  'P0001', 'Esta pessoa está com um animal em lar temporário agora. Registre a saída do animal do lar antes de anonimizar.',
  'não anonimiza quem está com animal em lar temporário');

set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select lives_ok(format($$select public.mover_animal(%L, 'em_acolhimento', 'sede', true, app.hoje() - 15)$$, pg_temp.id('nina')),
  'Nina volta para a sede, disponível');
select is((select pessoa_id from public.animais where id = pg_temp.id('nina')), null, 'fora do lar, a ficha não tem responsável');

-- Adoção --------------------------------------------------------------------------------
select throws_ok(format($$select public.registrar_adocao(%L, %L, app.hoje() - 10)$$, pg_temp.id('nina'), pg_temp.id('joao')),
  '42501', null, 'voluntário não registra adoção');
select throws_ok(format($$select public.mover_animal(%L, 'adotado', null, false, app.hoje())$$, pg_temp.id('nina')),
  'P0001', 'A adoção é registrada pelo fluxo de adoção.', 'adoção não passa por mover_animal');

set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
insert into ids select 'adocao1', public.registrar_adocao(pg_temp.id('nina'), pg_temp.id('joao'), app.hoje() - 10);
select results_eq(format($$select situacao::text, local, disponivel_adocao from public.animais where id = %L$$, pg_temp.id('nina')),
  $$values ('adotado', null::public.local_animal, false)$$, 'adoção move a Nina para adotado na mesma transação');
select throws_ok(format($$select public.registrar_adocao(%L, %L, app.hoje())$$, pg_temp.id('nina'), pg_temp.id('maria')),
  'P0001', 'Só animal em acolhimento pode ser adotado.', 'animal adotado não é adotado de novo');
select throws_ok(format($$select public.mover_animal(%L, 'em_acolhimento', 'sede', false, app.hoje())$$, pg_temp.id('nina')),
  'P0001', 'Animal adotado volta pela devolução, na aba Adoção.', 'animal adotado não volta por mudança comum');

-- Devolução -------------------------------------------------------------------------------
select throws_ok(format($$select public.registrar_devolucao(%L, app.hoje(), '  ')$$, pg_temp.id('adocao1')),
  'P0001', 'Informe o motivo da devolução.', 'devolução sem motivo é recusada');
select throws_ok(format($$select public.registrar_devolucao(%L, app.hoje() - 20, 'Mudança de cidade')$$, pg_temp.id('adocao1')),
  'P0001', 'A devolução não pode ser antes da adoção.', 'devolução antes da adoção é recusada');
select lives_ok(format($$select public.registrar_devolucao(%L, app.hoje() - 5, 'Mudança de cidade')$$, pg_temp.id('adocao1')),
  'devolução registrada');
select results_eq(format($$select situacao::text, local::text, disponivel_adocao from public.animais where id = %L$$, pg_temp.id('nina')),
  $$values ('em_acolhimento', 'sede', false)$$, 'devolvida, a Nina volta para a sede, ainda não disponível');
select results_eq(format($$select tipo, situacao::text from public.movimentacoes where animal_id = %L order by data, criado_em$$, pg_temp.id('nina')),
  $$values ('entrada', 'em_acolhimento'), ('mudanca', 'em_acolhimento'), ('mudanca', 'em_acolhimento'), ('mudanca', 'adotado'), ('devolucao', 'em_acolhimento')$$,
  'lar temporário, sede, adoção e devolução estão no histórico (Pronto quando)');

-- Mesma pessoa, segunda adoção; depois anonimização --------------------------------------
insert into ids select 'adocao2', public.registrar_adocao(pg_temp.id('bento'), pg_temp.id('joao'), app.hoje());
select is((select count(*)::int from public.adocoes where pessoa_id = pg_temp.id('joao')), 2,
  'quem devolve e adota outro é a mesma pessoa, com duas adoções');

select lives_ok(format($$select public.exportar_pessoa(%L)$$, pg_temp.id('joao')), 'coordenação exporta os dados do titular');
select is((select jsonb_array_length(public.exportar_pessoa(pg_temp.id('joao')) -> 'adocoes')), 2,
  'a exportação traz as duas adoções');

select lives_ok(format($$select public.anonimizar_pessoa(%L)$$, pg_temp.id('joao')), 'coordenação anonimiza o adotante');
select results_eq(format($$select nome, anonimizado_em is not null from public.pessoas where id = %L$$, pg_temp.id('joao')),
  $$values ('Pessoa anonimizada', true)$$, 'nome trocado e anonimizado_em gravado');
select is((select count(*)::int from public.ler_contato(pg_temp.id('joao'))), 0, 'o contato deixou de existir');
select is((select count(*)::int from public.adocoes where pessoa_id = pg_temp.id('joao')), 2,
  'anonimizar mantém as adoções contando');
select throws_ok(format($$select public.registrar_adocao(%L, %L, app.hoje())$$, pg_temp.id('mia'), pg_temp.id('joao')),
  'P0001', 'Esta pessoa foi anonimizada. Para um novo vínculo, faça um cadastro novo.', 'pessoa anonimizada não ganha vínculo novo');

-- Transferência e devolução à comunidade ------------------------------------------------
set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select throws_ok(format($$select public.mover_animal(%L, 'transferido', null, false, app.hoje())$$, pg_temp.id('nina')),
  'P0001', 'Informe para qual entidade o animal foi transferido.', 'transferência sem destino é recusada');
select throws_ok(format($$select public.mover_animal(%L, 'devolvido_comunidade', null, false, app.hoje())$$, pg_temp.id('mia')),
  'P0001', 'Devolução à comunidade exige castração realizada. Registre a castração na aba Saúde.',
  'devolução à comunidade sem castração é recusada');
select lives_ok($$select public.realizar_castracao(pg_temp.id('mia'), app.hoje())$$, 'Mia castrada');
select lives_ok(format($$select public.mover_animal(%L, 'devolvido_comunidade', null, false, app.hoje(),
  null, 'mudanca', null, null, null, 'Bairro Fictício')$$, pg_temp.id('mia')), 'Mia devolvida à comunidade, com o bairro');

-- Conta sem linha ativa em usuarios não lê nada -------------------------------------------
set local request.jwt.claims = '{"sub":"c3000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}';
select is((select count(*)::int from public.pessoas) + (select count(*)::int from public.adocoes), 0,
  'conta sem linha em usuarios não lê pessoas nem adoções');

-- Duas adoções ativas para o mesmo animal: o banco impede ------------------------------
reset role;
select throws_ok(format($$insert into public.adocoes (animal_id, pessoa_id, data_adocao) values (%L, %L, current_date)$$,
  pg_temp.id('bento'), pg_temp.id('maria')), '23505', null, 'não existem duas adoções ativas para o mesmo animal');

select * from finish();
rollback;
