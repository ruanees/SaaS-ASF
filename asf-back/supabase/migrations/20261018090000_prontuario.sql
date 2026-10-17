-- 009 — Fase 3: prontuário.
-- Exames, testes, tratamentos e internações são detalhe de `atendimentos`, a
-- mesma linha do tempo de vacinas, vermífugos e castrações (ADR 0004). Não
-- existe segunda tabela de "histórico".
-- Pedido da associação (17/10/2026): na admissão, registrar a condição do
-- animal (sarna, fígado alterado...), os exames feitos (hemograma, calazar,
-- 4DX) e as medicações iniciadas — "um prontuáriozinho do animal".

-- Condição de saúde na entrada: texto livre, todos os papéis escrevem.
alter table public.animais
  add column condicao_entrada text check (condicao_entrada is null or length(condicao_entrada) <= 2000);
grant update (condicao_entrada) on public.animais to authenticated;

-- Detalhes por tipo -----------------------------------------------------------

create table public.exames (
  atendimento_id uuid primary key references public.atendimentos(id),
  nome text not null check (length(trim(nome)) between 1 and 80),     -- Hemograma, Leishmaniose (calazar), 4DX...
  metodo text check (metodo is null or length(metodo) <= 60),          -- teste rápido, ELISA, RIFI, PCR
  resultado text not null default 'aguardando' check (resultado in (
    'aguardando', 'reagente', 'nao_reagente', 'inconclusivo', 'normal', 'alterado', 'ver_laudo'
  )),
  resultado_detalhe text check (resultado_detalhe is null or length(resultado_detalhe) <= 2000),
  resultado_em date,
  laudo_caminho text check (laudo_caminho is null or laudo_caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index exames_aguardando on public.exames (atendimento_id) where resultado = 'aguardando';

create table public.tratamentos (
  atendimento_id uuid primary key references public.atendimentos(id),
  medicamento text not null check (length(trim(medicamento)) between 1 and 120),
  dose text check (dose is null or length(dose) <= 80),
  frequencia text check (frequencia is null or length(frequencia) <= 80),
  inicio date not null,
  fim date,                                    -- nulo = em andamento
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (fim is null or fim >= inicio)
);
create index tratamentos_em_andamento on public.tratamentos (atendimento_id) where fim is null;

create table public.internacoes (
  atendimento_id uuid primary key references public.atendimentos(id),
  entrada date not null,
  alta date,                                   -- nulo = internado
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (alta is null or alta >= entrada)
);
create index internacoes_internado on public.internacoes (atendimento_id) where alta is null;

create trigger exames_carimbar before insert or update on public.exames
  for each row execute function app.carimbar();
create trigger exames_auditar after insert or update or delete on public.exames
  for each row execute function app.auditar();
create trigger tratamentos_carimbar before insert or update on public.tratamentos
  for each row execute function app.carimbar();
create trigger tratamentos_auditar after insert or update or delete on public.tratamentos
  for each row execute function app.auditar();
create trigger internacoes_carimbar before insert or update on public.internacoes
  for each row execute function app.carimbar();
create trigger internacoes_auditar after insert or update or delete on public.internacoes
  for each row execute function app.auditar();

-- RLS: todos os papéis leem o prontuário; escrita só pelas funções.
alter table public.exames enable row level security;
alter table public.exames force row level security;
create policy exames_ler on public.exames for select to authenticated using ((select app.papel()) is not null);
alter table public.tratamentos enable row level security;
alter table public.tratamentos force row level security;
create policy tratamentos_ler on public.tratamentos for select to authenticated using ((select app.papel()) is not null);
alter table public.internacoes enable row level security;
alter table public.internacoes force row level security;
create policy internacoes_ler on public.internacoes for select to authenticated using ((select app.papel()) is not null);
revoke all on public.exames, public.tratamentos, public.internacoes from anon, authenticated;
grant select on public.exames, public.tratamentos, public.internacoes to authenticated;

-- Quem registra atendimento clínico: administração, coordenação e veterinário.
-- Voluntário lê o prontuário e não grava diagnóstico, exame nem tratamento.
create function app.exigir_clinico() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select app.tem_papel(array['admin', 'coordenacao', 'veterinario']::public.papel[])) then
    raise exception 'Voluntários veem o prontuário, mas não registram atendimentos clínicos.' using errcode = '42501';
  end if;
end
$$;
revoke all on function app.exigir_clinico() from public, anon, authenticated;

-- Testes rápidos/sorológicos (atalhos da tela) viram atendimento do tipo 'teste'.
create function app.eh_teste(p_nome text) returns boolean
language sql immutable set search_path = '' as $$
  select lower(coalesce(p_nome, '')) ~ '(leish|calazar|4dx|fiv|felv|cinomose|parvo)'
$$;

-- Óbito é situação e atendimento juntos: mover_animal grava os dois (abaixo).
create function public.registrar_atendimento(
  p_animal uuid,
  p_tipo public.tipo_atendimento,
  p_data date,
  p_clinica_id uuid default null,
  p_veterinario text default null,
  p_diagnostico text default null,
  p_observacoes text default null,
  p_detalhe jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
  v_id uuid;
  d jsonb := coalesce(p_detalhe, '{}'::jsonb);
  v_resultado text;
  v_inicio date;
  v_fim date;
  v_entrada date;
  v_alta date;
begin
  if p_tipo in ('vacina', 'vermifugacao', 'castracao', 'antiparasitario') then
    raise exception 'Vacina, vermífugo, antipulgas e castração têm registro próprio, na aba Saúde.';
  end if;
  perform app.exigir_clinico();

  if p_tipo = 'obito' then
    perform public.mover_animal(p_animal, 'obito', null, false, p_data, coalesce(p_observacoes, p_diagnostico));
    select id into v_id from public.atendimentos
     where animal_id = p_animal and tipo = 'obito' order by criado_em desc limit 1;
    if p_diagnostico is not null or p_veterinario is not null or p_clinica_id is not null then
      update public.atendimentos
         set diagnostico = nullif(trim(p_diagnostico), ''), veterinario = nullif(trim(p_veterinario), ''),
             clinica_id = p_clinica_id
       where id = v_id;
    end if;
    return v_id;
  end if;

  v := app.conferir_atendimento(p_animal, p_data);

  insert into public.atendimentos (animal_id, tipo, data, clinica_id, veterinario, diagnostico, observacoes)
  values (v.id, p_tipo, p_data, p_clinica_id, nullif(trim(p_veterinario), ''),
          nullif(trim(p_diagnostico), ''), nullif(trim(p_observacoes), ''))
  returning id into v_id;

  if p_tipo in ('exame', 'teste') then
    if nullif(trim(d ->> 'nome'), '') is null then
      raise exception 'Informe qual exame ou teste foi feito.';
    end if;
    v_resultado := coalesce(nullif(d ->> 'resultado', ''), 'aguardando');
    insert into public.exames (atendimento_id, nome, metodo, resultado, resultado_detalhe, resultado_em)
    values (v_id, trim(d ->> 'nome'), nullif(trim(d ->> 'metodo'), ''), v_resultado,
            nullif(trim(d ->> 'resultado_detalhe'), ''),
            case when v_resultado <> 'aguardando' then p_data end);
  elsif p_tipo = 'tratamento' then
    if nullif(trim(d ->> 'medicamento'), '') is null then
      raise exception 'Informe o medicamento.';
    end if;
    v_inicio := coalesce(nullif(d ->> 'inicio', '')::date, p_data);
    v_fim := nullif(d ->> 'fim', '')::date;
    if v_fim is not null and v_fim < v_inicio then
      raise exception 'O fim do tratamento não pode ser antes do início.';
    end if;
    insert into public.tratamentos (atendimento_id, medicamento, dose, frequencia, inicio, fim)
    values (v_id, trim(d ->> 'medicamento'), nullif(trim(d ->> 'dose'), ''), nullif(trim(d ->> 'frequencia'), ''),
            v_inicio, v_fim);
  elsif p_tipo = 'internacao' then
    v_entrada := coalesce(nullif(d ->> 'entrada', '')::date, p_data);
    v_alta := nullif(d ->> 'alta', '')::date;
    if v_alta is not null and v_alta < v_entrada then
      raise exception 'A alta não pode ser antes da entrada.';
    end if;
    insert into public.internacoes (atendimento_id, entrada, alta) values (v_id, v_entrada, v_alta);
  end if;
  return v_id;
end
$$;

create function public.registrar_resultado_exame(
  p_atendimento uuid, p_resultado text, p_detalhe text default null, p_data date default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_clinico();
  if p_resultado is null or p_resultado = 'aguardando'
     or p_resultado not in ('reagente', 'nao_reagente', 'inconclusivo', 'normal', 'alterado', 'ver_laudo') then
    raise exception 'Escolha o resultado.';
  end if;
  if coalesce(p_data, app.hoje()) > app.hoje() then
    raise exception 'A data não pode ser no futuro.';
  end if;
  update public.exames
     set resultado = p_resultado,
         resultado_detalhe = coalesce(nullif(trim(p_detalhe), ''), resultado_detalhe),
         resultado_em = coalesce(p_data, app.hoje())
   where atendimento_id = p_atendimento;
  if not found then
    raise exception 'Exame não encontrado.';
  end if;
end
$$;

create function public.encerrar_tratamento(p_atendimento uuid, p_fim date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tratamentos;
begin
  perform app.exigir_clinico();
  select * into t from public.tratamentos where atendimento_id = p_atendimento for update;
  if not found then
    raise exception 'Tratamento não encontrado.';
  end if;
  if t.fim is not null then
    raise exception 'Este tratamento já foi encerrado.';
  end if;
  if p_fim is null or p_fim > app.hoje() then
    raise exception 'Informe uma data de fim até hoje.';
  end if;
  if p_fim < t.inicio then
    raise exception 'O fim do tratamento não pode ser antes do início.';
  end if;
  update public.tratamentos set fim = p_fim where atendimento_id = p_atendimento;
end
$$;

create function public.dar_alta(p_atendimento uuid, p_alta date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.internacoes;
begin
  perform app.exigir_clinico();
  select * into i from public.internacoes where atendimento_id = p_atendimento for update;
  if not found then
    raise exception 'Internação não encontrada.';
  end if;
  if i.alta is not null then
    raise exception 'Esta internação já teve alta.';
  end if;
  if p_alta is null or p_alta > app.hoje() then
    raise exception 'Informe uma data de alta até hoje.';
  end if;
  if p_alta < i.entrada then
    raise exception 'A alta não pode ser antes da entrada.';
  end if;
  update public.internacoes set alta = p_alta where atendimento_id = p_atendimento;
end
$$;

-- Laudo: o arquivo vai do navegador ao balde privado com URL assinada; aqui só
-- se registra, se o arquivo existir de fato.
create function public.anexar_laudo(p_atendimento uuid, p_caminho text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_animal uuid;
begin
  perform app.exigir_clinico();
  select a.animal_id into v_animal
    from public.exames e join public.atendimentos a on a.id = e.atendimento_id
   where e.atendimento_id = p_atendimento;
  if v_animal is null then
    raise exception 'Exame não encontrado.';
  end if;
  if p_caminho is null or left(p_caminho, 37) <> v_animal::text || '/' then
    raise exception 'Caminho de laudo inválido.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'laudos' and o.name = p_caminho) then
    raise exception 'O envio do laudo não terminou. Tente de novo.';
  end if;
  update public.exames set laudo_caminho = p_caminho where atendimento_id = p_atendimento;
end
$$;

-- Saúde na entrada (pedido da associação): condição observada, exames pedidos
-- e tratamento iniciado, numa transação. A condição todos registram; exames e
-- tratamento, só os papéis clínicos.
create function public.registrar_saude_entrada(
  p_animal uuid,
  p_condicao text default null,
  p_exames text[] default '{}',
  p_tratamento jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
  v_exame text;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  select * into v from public.animais where id = p_animal and excluido_em is null;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;
  if nullif(trim(p_condicao), '') is not null then
    update public.animais set condicao_entrada = trim(p_condicao) where id = v.id;
  end if;

  if coalesce(array_length(p_exames, 1), 0) > 0 or p_tratamento is not null then
    if not (select app.tem_papel(array['admin', 'coordenacao', 'veterinario']::public.papel[])) then
      raise exception 'Só administração, coordenação e veterinários pedem exames e iniciam tratamentos.' using errcode = '42501';
    end if;
  end if;

  foreach v_exame in array coalesce(p_exames, '{}') loop
    continue when nullif(trim(v_exame), '') is null;
    perform public.registrar_atendimento(
      v.id,
      (case when app.eh_teste(v_exame) then 'teste' else 'exame' end)::public.tipo_atendimento,
      v.data_entrada, null, null, null, 'Exame de entrada',
      jsonb_build_object('nome', trim(v_exame), 'resultado', 'aguardando')
    );
  end loop;

  if p_tratamento is not null and nullif(trim(p_tratamento ->> 'medicamento'), '') is not null then
    perform public.registrar_atendimento(
      v.id, 'tratamento', v.data_entrada, null, null, nullif(trim(p_condicao), ''), 'Tratamento iniciado na entrada',
      p_tratamento
    );
  end if;
end
$$;

revoke all on function
  public.registrar_atendimento(uuid, public.tipo_atendimento, date, uuid, text, text, text, jsonb),
  public.registrar_resultado_exame(uuid, text, text, date),
  public.encerrar_tratamento(uuid, date),
  public.dar_alta(uuid, date),
  public.anexar_laudo(uuid, text),
  public.registrar_saude_entrada(uuid, text, text[], jsonb)
from public, anon;
grant execute on function
  public.registrar_atendimento(uuid, public.tipo_atendimento, date, uuid, text, text, text, jsonb),
  public.registrar_resultado_exame(uuid, text, text, date),
  public.encerrar_tratamento(uuid, date),
  public.dar_alta(uuid, date),
  public.anexar_laudo(uuid, text),
  public.registrar_saude_entrada(uuid, text, text[], jsonb)
to authenticated;
revoke all on function app.eh_teste(text) from public, anon;
grant execute on function app.eh_teste(text) to authenticated;

-- Em tratamento: tratamento sem fim, internação sem alta ou animal na clínica.
create view public.animal_em_tratamento with (security_invoker = true) as
select
  an.id as animal_id,
  exists (
    select 1 from public.tratamentos t join public.atendimentos a on a.id = t.atendimento_id
    where a.animal_id = an.id and t.fim is null
  ) as tratamento_em_andamento,
  exists (
    select 1 from public.internacoes i join public.atendimentos a on a.id = i.atendimento_id
    where a.animal_id = an.id and i.alta is null
  ) as internado,
  (an.situacao = 'em_acolhimento' and an.local = 'clinica') as na_clinica
from public.animais an
where an.excluido_em is null;

revoke all on public.animal_em_tratamento from anon, authenticated;
grant select on public.animal_em_tratamento to authenticated;

-- Balde privado de laudos: só os papéis clínicos leem e enviam.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('laudos', 'laudos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy laudos_ler on storage.objects for select to authenticated
  using (bucket_id = 'laudos' and (select app.tem_papel(array['admin', 'coordenacao', 'veterinario']::public.papel[])));
create policy laudos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'laudos' and (select app.tem_papel(array['admin', 'coordenacao', 'veterinario']::public.papel[])));

-- mover_animal: o óbito passa a gravar também o atendimento de óbito.
create or replace function public.mover_animal(
  p_animal uuid,
  p_situacao public.situacao,
  p_local public.local_animal,
  p_disponivel boolean,
  p_data date,
  p_motivo text default null,
  p_tipo text default 'mudanca',
  p_origem public.origem default null,
  p_clinica_id uuid default null
) returns public.movimentacoes
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
  v_local public.local_animal := p_local;
  v_disponivel boolean := coalesce(p_disponivel, false);
  v_clinica uuid := p_clinica_id;
  m public.movimentacoes;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_tipo not in ('mudanca', 'reentrada') then
    raise exception 'Tipo de movimentação inválido.';
  end if;

  select * into v from public.animais where id = p_animal and excluido_em is null for update;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;

  if p_data is null then
    raise exception 'Informe a data da movimentação.';
  end if;
  if p_data > app.hoje() then
    raise exception 'A data não pode ser no futuro.';
  end if;
  if p_data < v.data_entrada then
    raise exception 'A data não pode ser anterior à entrada do animal.';
  end if;

  -- Situações que dependem de pessoa ou destino chegam na Fase 4, com seus
  -- próprios fluxos (adoção, devolução, transferência).
  if p_situacao = 'adotado' then
    raise exception 'A adoção é registrada pelo fluxo de adoção.';
  end if;
  if p_situacao in ('transferido', 'devolvido_comunidade') then
    raise exception 'Esta situação ainda não está disponível: depende do cadastro de pessoas e da castração.';
  end if;
  if v_local = 'lar_temporario' then
    raise exception 'Lar temporário ainda não está disponível: depende do cadastro de pessoas.';
  end if;

  if p_tipo = 'mudanca' then
    if v.situacao = 'obito' then
      raise exception 'Animal em óbito não pode ser movido.';
    end if;
    if v.situacao <> 'em_acolhimento' then
      raise exception 'Este animal não está em acolhimento. Para trazê-lo de volta, registre uma reentrada.';
    end if;
  else
    if v.situacao not in ('devolvido_comunidade', 'transferido') then
      raise exception 'Reentrada só vale para animal devolvido à comunidade ou transferido.';
    end if;
    if p_situacao <> 'em_acolhimento' then
      raise exception 'Na reentrada o animal volta para acolhimento.';
    end if;
    if p_origem is null then
      raise exception 'Informe a origem da reentrada.';
    end if;
  end if;

  -- Fora de acolhimento não há local nem disponibilidade (ADR 0003).
  if p_situacao <> 'em_acolhimento' then
    v_local := null;
    v_disponivel := false;
  elsif v_local is null then
    raise exception 'Informe onde o animal está.';
  end if;
  if v_local is distinct from 'clinica' then
    v_clinica := null;
  end if;

  if p_tipo = 'mudanca'
     and v.situacao = p_situacao
     and v.local is not distinct from v_local
     and v.disponivel_adocao = v_disponivel
     and v.clinica_id is not distinct from v_clinica then
    raise exception 'Nada mudou.';
  end if;

  update public.animais
     set situacao = p_situacao, local = v_local, disponivel_adocao = v_disponivel, clinica_id = v_clinica
   where id = v.id;

  insert into public.movimentacoes (animal_id, tipo, origem, situacao, local, disponivel_adocao, clinica_id, data, motivo)
  values (v.id, p_tipo, case when p_tipo = 'reentrada' then p_origem end, p_situacao, v_local, v_disponivel,
          v_clinica, p_data, nullif(trim(p_motivo), ''))
  returning * into m;

  -- Óbito é situação E atendimento, na mesma transação (plano, Fase 3).
  if p_situacao = 'obito' then
    insert into public.atendimentos (animal_id, tipo, data, observacoes)
    values (v.id, 'obito', p_data, nullif(trim(p_motivo), ''));
  end if;

  return m;
end
$$;

-- Estado de saúde ganha "em tratamento", "internado", leishmaniose reagente e
-- exames aguardando (colunas novas no fim da view).
create or replace view public.animal_saude with (security_invoker = true) as
with conf as (
  select app.hoje() as hoje, c.aviso_vacina_dias as aviso from public.configuracoes c
),
vac as (
  select s.animal_id,
         bool_or(s.proxima_dose < conf.hoje) as vencida,
         bool_or(s.proxima_dose between conf.hoje and conf.hoje + conf.aviso) as vence_em_breve,
         min(s.proxima_dose) filter (where s.proxima_dose >= conf.hoje) as proxima_vacina
  from public.vacinas_situacao s, conf
  group by s.animal_id
),
verm as (
  select distinct on (a.animal_id) a.animal_id, a.data as ultima_vermifugacao, vm.proxima_dose
  from public.vermifugacoes vm
  join public.atendimentos a on a.id = vm.atendimento_id
  order by a.animal_id, a.data desc, a.criado_em desc
),
anti as (
  select distinct on (a.animal_id) a.animal_id, ap.proxima_dose
  from public.antiparasitarios ap
  join public.atendimentos a on a.id = ap.atendimento_id
  order by a.animal_id, a.data desc, a.criado_em desc
),
cast_ as (
  select animal_id,
         bool_or(status = 'realizada') as castrado,
         max(data_agendada) filter (where status = 'agendada') as data_agendada
  from public.castracoes
  group by animal_id
),
-- Último teste de leishmaniose (calazar) de cada animal.
leish as (
  select distinct on (a.animal_id) a.animal_id, e.resultado
  from public.exames e
  join public.atendimentos a on a.id = e.atendimento_id
  where lower(e.nome) ~ '(leish|calazar)' and e.resultado <> 'aguardando'
  order by a.animal_id, coalesce(e.resultado_em, a.data) desc, a.criado_em desc
),
aguardando as (
  select a.animal_id, count(*)::int as n
  from public.exames e join public.atendimentos a on a.id = e.atendimento_id
  where e.resultado = 'aguardando'
  group by a.animal_id
)
select
  an.id as animal_id,
  (vac.animal_id is not null) as vacinado,
  (vac.animal_id is null or coalesce(vac.vencida, false)) as vacina_pendente,
  case
    when vac.animal_id is null then 'nao_vacinado'
    when vac.vencida then 'vencida'
    when vac.vence_em_breve then 'vence_em_breve'
    else 'vacinado'
  end as vacinacao_status,
  vac.proxima_vacina,
  case
    when coalesce(cast_.castrado, false) then 'castrado'
    when cast_.data_agendada is not null then 'agendada'
    else 'nao_castrado'
  end as castracao_status,
  cast_.data_agendada as castracao_agendada_para,
  verm.ultima_vermifugacao,
  verm.proxima_dose as proxima_vermifugacao,
  coalesce(verm.proxima_dose < (select hoje from conf), false) as vermifugacao_vencida,
  anti.proxima_dose as proximo_antiparasitario,
  coalesce(anti.proxima_dose < (select hoje from conf), false) as antiparasitario_vencido,
  (t.tratamento_em_andamento or t.internado or t.na_clinica) as em_tratamento,
  t.internado,
  coalesce(leish.resultado = 'reagente', false) as leishmaniose_reagente,
  coalesce(aguardando.n, 0) as exames_aguardando
from public.animais an
join public.animal_em_tratamento t on t.animal_id = an.id
left join vac on vac.animal_id = an.id
left join verm on verm.animal_id = an.id
left join anti on anti.animal_id = an.id
left join cast_ on cast_.animal_id = an.id
left join leish on leish.animal_id = an.id
left join aguardando on aguardando.animal_id = an.id
where an.excluido_em is null;

-- Pendências ganham os exames aguardando resultado (de animais que não morreram).
create or replace function public.pendencias_saude()
returns table (
  tipo text, animal_id uuid, numero text, nome text, especie public.especie,
  descricao text, data date, vencida boolean
)
language sql stable security invoker set search_path = '' as $$
  with conf as (select app.hoje() as hoje, c.aviso_vacina_dias as aviso from public.configuracoes c),
  ultimos_verm as (
    select distinct on (a.animal_id) a.animal_id, vm.produto, vm.proxima_dose
    from public.vermifugacoes vm join public.atendimentos a on a.id = vm.atendimento_id
    order by a.animal_id, a.data desc, a.criado_em desc
  ),
  ultimos_anti as (
    select distinct on (a.animal_id) a.animal_id, ap.produto, ap.proxima_dose
    from public.antiparasitarios ap join public.atendimentos a on a.id = ap.atendimento_id
    order by a.animal_id, a.data desc, a.criado_em desc
  )
  select 'vacina', an.id, an.numero, an.nome, an.especie, s.vacina, s.proxima_dose, s.proxima_dose < conf.hoje
  from public.vacinas_situacao s
  join public.animais an on an.id = s.animal_id
  cross join conf
  where an.situacao = 'em_acolhimento' and an.excluido_em is null
    and s.proxima_dose is not null and s.proxima_dose <= conf.hoje + conf.aviso
  union all
  select 'vermifugacao', an.id, an.numero, an.nome, an.especie, v.produto, v.proxima_dose, v.proxima_dose < conf.hoje
  from ultimos_verm v
  join public.animais an on an.id = v.animal_id
  cross join conf
  where an.situacao = 'em_acolhimento' and an.excluido_em is null
    and v.proxima_dose is not null and v.proxima_dose <= conf.hoje + conf.aviso
  union all
  select 'antiparasitario', an.id, an.numero, an.nome, an.especie, x.produto, x.proxima_dose, x.proxima_dose < conf.hoje
  from ultimos_anti x
  join public.animais an on an.id = x.animal_id
  cross join conf
  where an.situacao = 'em_acolhimento' and an.excluido_em is null
    and x.proxima_dose is not null and x.proxima_dose <= conf.hoje + conf.aviso
  union all
  select 'castracao', an.id, an.numero, an.nome, an.especie,
         case when an.situacao = 'adotado' then 'Castração agendada (com o adotante)' else 'Castração agendada' end,
         c.data_agendada, c.data_agendada < conf.hoje
  from public.castracoes c
  join public.animais an on an.id = c.animal_id
  cross join conf
  where c.status = 'agendada' and an.situacao in ('em_acolhimento', 'adotado') and an.excluido_em is null
  union all
  select 'castracao_prioridade', an.id, an.numero, an.nome, an.especie,
         case an.especie when 'gato' then 'Gata não castrada' else 'Cadela não castrada' end,
         an.data_entrada, false
  from public.animais an
  where an.situacao = 'em_acolhimento' and an.excluido_em is null and an.sexo = 'femea'
    and not exists (select 1 from public.castracoes c where c.animal_id = an.id and c.status in ('realizada', 'agendada'))
  union all
  select 'exame', an.id, an.numero, an.nome, an.especie, e.nome, a.data, false
  from public.exames e
  join public.atendimentos a on a.id = e.atendimento_id
  join public.animais an on an.id = a.animal_id
  where e.resultado = 'aguardando' and an.situacao <> 'obito' and an.excluido_em is null
  order by 7, 3
$$;
