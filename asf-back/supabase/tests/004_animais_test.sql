-- Fase 1: cadastro, número AAAA-NNNN, situação só por função, exclusão por
-- papel, duplicados, fotos e clínicas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Dados fictícios -------------------------------------------------------------
delete from public.usuarios;
delete from public.numeracao;

insert into auth.users (id, email, aud, role) values
  ('e0000000-0000-4000-8000-000000000001', 'admin@exemplo.test', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000002', 'vol@exemplo.test', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000003', 'vet@exemplo.test', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000004', 'sem-convite@exemplo.test', 'authenticated', 'authenticated');
insert into public.usuarios (user_id, nome, papel) values
  ('e0000000-0000-4000-8000-000000000001', 'Admin Fictício', 'admin'),
  ('e0000000-0000-4000-8000-000000000002', 'Voluntária Fictícia', 'voluntario'),
  ('e0000000-0000-4000-8000-000000000003', 'Veterinário Fictício', 'veterinario');

create function pg_temp.linhas(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

-- Guarda ids entre os passos (a tabela temporária é da sessão; liberada para os papéis)
create temp table ids (chave text primary key, valor uuid);
grant all on ids to authenticated, anon;

-- Anônimo e sem convite -------------------------------------------------------
set local role anon;
select throws_ok('select * from public.animais', '42501', null, 'anônimo não lê animais');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';
select throws_ok(
  $$select public.cadastrar_animal('cao', 'macho', '2026-01-10', 'resgate', 'sede')$$,
  '42501', null, 'sem convite não cadastra');

-- Voluntária cadastra -----------------------------------------------------------
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';

insert into ids select 'bolinha', (public.cadastrar_animal('cao', 'femea', '2026-01-10', 'resgate', 'sede', 'Bolinha', '2024-01-10', 'aproximada', 'medio')).id;
select is(
  (select numero from public.animais where id = (select valor from ids where chave = 'bolinha')),
  extract(year from app.hoje())::int::text || '-0001', 'primeiro cadastro do ano recebe -0001');

insert into ids select 'sem_nome', (public.cadastrar_animal('gato', 'nao_identificado', '2026-02-01', 'comunitario', 'sede')).id;
select is(
  (select numero from public.animais where id = (select valor from ids where chave = 'sem_nome')),
  extract(year from app.hoje())::int::text || '-0002', 'segundo cadastro recebe -0002 (sexo não identificado aceito)');

select is(
  (select count(*)::int from public.movimentacoes where animal_id = (select valor from ids where chave = 'bolinha') and tipo = 'entrada'),
  1, 'cadastro grava a movimentação de entrada junto');

select is(
  (select criado_por from public.animais where id = (select valor from ids where chave = 'bolinha')),
  'e0000000-0000-4000-8000-000000000002'::uuid, 'carimbo registra quem cadastrou');

select throws_ok(
  $$insert into public.animais (especie, sexo, data_entrada, origem, local) values ('cao', 'macho', '2026-01-01', 'resgate', 'sede')$$,
  '42501', null, 'insert direto em animais é recusado');

select throws_ok(
  $$update public.animais set situacao = 'obito', local = null where id = (select valor from ids where chave = 'bolinha')$$,
  '42501', null, 'update direto em situacao é recusado');

select throws_ok(
  $$update public.animais set numero = '2026-9999' where id = (select valor from ids where chave = 'bolinha')$$,
  '42501', null, 'número não pode ser alterado');

select is(
  pg_temp.linhas($$update public.animais set nome = 'Bolinha Mel' where id = (select valor from ids where chave = 'bolinha')$$),
  1, 'voluntária edita o nome');

select throws_ok(
  $$select public.cadastrar_animal('cao', 'macho', (app.hoje() + 1), 'resgate', 'sede')$$,
  'P0001', 'A data de entrada não pode ser no futuro.', 'data de entrada no futuro é recusada');

select throws_ok(
  $$select public.cadastrar_animal('cao', 'macho', '2026-01-10', 'outra', 'sede')$$,
  '23514', null, 'origem "outra" exige detalhe');

select throws_ok(
  $$select public.cadastrar_animal('cao', 'macho', '2026-01-10', 'resgate', 'lar_temporario')$$,
  'P0001', null, 'lar temporário ainda não está disponível no cadastro');

-- Movimentações ------------------------------------------------------------------
select lives_ok(
  $$select public.mover_animal((select valor from ids where chave = 'bolinha'), 'em_acolhimento', 'clinica', false, app.hoje(), 'Consulta')$$,
  'sede para clínica');
select is(
  (select local::text from public.animais where id = (select valor from ids where chave = 'bolinha')),
  'clinica', 'estado atual mudou para clínica');
select lives_ok(
  $$select public.mover_animal((select valor from ids where chave = 'bolinha'), 'em_acolhimento', 'sede', true, app.hoje())$$,
  'clínica de volta para a sede, disponível para adoção');
select is(
  (select count(*)::int from public.movimentacoes where animal_id = (select valor from ids where chave = 'bolinha')),
  3, 'histórico tem entrada e as duas mudanças');
select throws_ok(
  $$select public.mover_animal((select valor from ids where chave = 'bolinha'), 'em_acolhimento', 'sede', true, app.hoje())$$,
  'P0001', 'Nada mudou.', 'movimentação sem mudança é recusada');
select throws_ok(
  $$select public.mover_animal((select valor from ids where chave = 'bolinha'), 'adotado', null, false, app.hoje())$$,
  'P0001', 'A adoção é registrada pelo fluxo de adoção.', 'adoção não passa por mover_animal');
select throws_ok(
  $$select public.mover_animal((select valor from ids where chave = 'bolinha'), 'em_acolhimento', 'lar_temporario', false, app.hoje())$$,
  'P0001', null, 'lar temporário ainda não está disponível');
select throws_ok(
  $$select public.mover_animal((select valor from ids where chave = 'bolinha'), 'em_acolhimento', 'clinica', false, '2025-12-31')$$,
  'P0001', 'A data não pode ser anterior à entrada do animal.', 'movimentação antes da entrada é recusada');

select lives_ok(
  $$select public.mover_animal((select valor from ids where chave = 'sem_nome'), 'obito', 'sede', true, app.hoje(), 'Atropelamento')$$,
  'óbito registrado');
select results_eq(
  $$select situacao::text, local::text, disponivel_adocao from public.animais where id = (select valor from ids where chave = 'sem_nome')$$,
  $$values ('obito', null::text, false)$$, 'óbito zera local e disponibilidade');
select throws_ok(
  $$select public.mover_animal((select valor from ids where chave = 'sem_nome'), 'em_acolhimento', 'sede', false, app.hoje())$$,
  'P0001', 'Animal em óbito não pode ser movido.', 'óbito é final');

-- Duplicados ---------------------------------------------------------------------
select is(
  (select numero from public.possiveis_duplicados('bolinha mel', 'cao', 'femea') limit 1),
  extract(year from app.hoje())::int::text || '-0001', 'duplicado encontrado por nome parecido');
select is(
  (select count(*)::int from public.possiveis_duplicados('bolinha', 'gato', 'femea')),
  0, 'outra espécie não é duplicado');

-- Fotos --------------------------------------------------------------------------
select throws_ok(
  format($$select public.registrar_foto(%L, %L)$$, (select valor from ids where chave = 'bolinha'),
         (select valor from ids where chave = 'bolinha')::text || '/00000000-0000-4000-8000-000000000000.webp'),
  'P0001', 'O envio da foto não terminou. Tente de novo.', 'foto sem arquivo no Storage não é registrada');

-- Exclusão e clínicas --------------------------------------------------------------
select throws_ok(
  $$select public.excluir_animal((select valor from ids where chave = 'bolinha'))$$,
  '42501', null, 'voluntária não exclui animal');
select throws_ok(
  $$insert into public.clinicas (nome) values ('Clínica Fictícia')$$,
  '42501', null, 'voluntária não cadastra clínica');

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.excluir_animal((select valor from ids where chave = 'bolinha'))$$, 'admin exclui animal');
select is(
  (select count(*)::int from public.animais where id = (select valor from ids where chave = 'bolinha')),
  0, 'admin exclui; o animal some da leitura (exclusão lógica)');

select * from finish();
rollback;
