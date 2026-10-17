-- 006 — Fase 2: vacinação, castração e vermifugação.
-- Plano, seção 03 (Uma linha do tempo para o prontuário, ADR 0004) e Fase 2.
-- Vacina, vermífugo e castração realizada são `atendimentos` (a mesma linha do
-- tempo que o prontuário da Fase 3 vai ler). O estado de saúde é calculado em
-- views; nada de "vacinado" gravado no animal.

-- "Hoje" num instante qualquer: permite provar a virada de dia em Fortaleza
-- (às 22h o servidor em UTC já está no dia seguinte).
create function app.hoje_em(p_instante timestamptz) returns date
language sql stable security definer set search_path = '' as $$
  select (p_instante at time zone c.fuso)::date from public.configuracoes c
$$;

create or replace function app.hoje() returns date
language sql stable security definer set search_path = '' as $$
  select app.hoje_em(now())
$$;

revoke all on function app.hoje_em(timestamptz) from public, anon;
grant execute on function app.hoje_em(timestamptz) to authenticated;

-- Quantos dias antes do vencimento a vacina aparece em Pendências (pergunta 5
-- do questionário; o plano propõe 15).
alter table public.configuracoes
  add column aviso_vacina_dias int not null default 15 check (aviso_vacina_dias between 1 and 90);
grant update (aviso_vacina_dias) on public.configuracoes to authenticated;

-- Atendimentos: a linha do tempo única ------------------------------------------

create type public.tipo_atendimento as enum (
  'consulta', 'exame', 'teste', 'vacina', 'vermifugacao',
  'castracao', 'tratamento', 'internacao', 'retorno', 'obito'
);

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais(id),
  tipo public.tipo_atendimento not null,
  data date not null,
  clinica_id uuid references public.clinicas(id),
  veterinario text check (veterinario is null or length(veterinario) <= 160),  -- nome e CRMV
  diagnostico text check (diagnostico is null or length(diagnostico) <= 4000),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  criado_em timestamptz not null default now(),
  criado_por uuid references public.usuarios(user_id),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index atendimentos_animal on public.atendimentos (animal_id, data desc, criado_em desc);
create index atendimentos_tipo on public.atendimentos (tipo, data);

-- Catálogo de vacinas da associação (preenchido pela administração/coordenação).
create table public.vacinas_tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),   -- V10, antirrábica, V4...
  especie public.especie not null,
  reforco_dias int check (reforco_dias is null or reforco_dias between 1 and 3650),  -- sugere a próxima dose
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create unique index vacinas_tipos_nome_especie on public.vacinas_tipos (lower(trim(nome)), especie);

create table public.vacinacoes (
  atendimento_id uuid primary key references public.atendimentos(id),
  vacina_tipo_id uuid not null references public.vacinas_tipos(id),
  lote text check (lote is null or length(lote) <= 60),
  proxima_dose date,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index vacinacoes_proxima on public.vacinacoes (proxima_dose) where proxima_dose is not null;
create index vacinacoes_tipo on public.vacinacoes (vacina_tipo_id);

create table public.vermifugacoes (
  atendimento_id uuid primary key references public.atendimentos(id),
  produto text not null check (length(trim(produto)) between 1 and 80),
  proxima_dose date,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

-- O agendamento existe antes de haver atendimento; quando realizada, aponta para ele.
create table public.castracoes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais(id),
  status text not null check (status in ('agendada', 'realizada', 'cancelada')),
  data_agendada date,
  clinica_id uuid references public.clinicas(id),
  atendimento_id uuid references public.atendimentos(id),  -- preenchido quando realizada
  anterior_a_entrada boolean not null default false,       -- já chegou castrado
  motivo_cancelamento text check (motivo_cancelamento is null or length(motivo_cancelamento) <= 300),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (status <> 'agendada' or data_agendada is not null),
  check (status <> 'realizada' or atendimento_id is not null or anterior_a_entrada)
);
-- Uma castração realizada e um agendamento aberto por animal.
create unique index castracoes_realizada on public.castracoes (animal_id) where status = 'realizada';
create unique index castracoes_agendada on public.castracoes (animal_id) where status = 'agendada';

-- Carimbo e auditoria ---------------------------------------------------------
create trigger atendimentos_carimbar before insert or update on public.atendimentos
  for each row execute function app.carimbar();
create trigger atendimentos_auditar after insert or update or delete on public.atendimentos
  for each row execute function app.auditar();
create trigger vacinas_tipos_carimbar before insert or update on public.vacinas_tipos
  for each row execute function app.carimbar();
create trigger vacinas_tipos_auditar after insert or update or delete on public.vacinas_tipos
  for each row execute function app.auditar();
create trigger vacinacoes_carimbar before insert or update on public.vacinacoes
  for each row execute function app.carimbar();
create trigger vacinacoes_auditar after insert or update or delete on public.vacinacoes
  for each row execute function app.auditar();
create trigger vermifugacoes_carimbar before insert or update on public.vermifugacoes
  for each row execute function app.carimbar();
create trigger vermifugacoes_auditar after insert or update or delete on public.vermifugacoes
  for each row execute function app.auditar();
create trigger castracoes_carimbar before insert or update on public.castracoes
  for each row execute function app.carimbar();
create trigger castracoes_auditar after insert or update or delete on public.castracoes
  for each row execute function app.auditar();

-- Saiu de acolhimento (óbito, adoção, transferência...): o agendamento de
-- castração é cancelado. Gatilho, para valer em qualquer caminho de saída.
create function app.cancelar_castracao_ao_sair() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.situacao = 'em_acolhimento' and new.situacao <> 'em_acolhimento' then
    update public.castracoes
       set status = 'cancelada', motivo_cancelamento = 'O animal saiu de acolhimento.'
     where animal_id = new.id and status = 'agendada';
  end if;
  return new;
end
$$;

create trigger animais_cancelar_castracao after update of situacao on public.animais
  for each row execute function app.cancelar_castracao_ao_sair();

revoke all on function app.cancelar_castracao_ao_sair() from public, anon, authenticated;

-- Funções de escrita ------------------------------------------------------------

-- Confere o que vale para todo atendimento: quem pede, se o animal existe, data.
create function app.conferir_atendimento(p_animal uuid, p_data date) returns public.animais
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.animais;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  select * into v from public.animais where id = p_animal and excluido_em is null;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;
  if p_data is null then
    raise exception 'Informe a data.';
  end if;
  -- Antes da entrada vale: o animal pode ter chegado com carteirinha.
  if p_data > app.hoje() then
    raise exception 'A data não pode ser no futuro.';
  end if;
  return v;
end
$$;

create function public.registrar_vacina(
  p_animal uuid,
  p_vacina_tipo uuid,
  p_data date,
  p_proxima_dose date default null,
  p_lote text default null,
  p_clinica_id uuid default null,
  p_veterinario text default null,
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais := app.conferir_atendimento(p_animal, p_data);
  t public.vacinas_tipos;
  v_atendimento uuid;
begin
  select * into t from public.vacinas_tipos where id = p_vacina_tipo;
  if not found or not t.ativo then
    raise exception 'Vacina não encontrada no catálogo.';
  end if;
  if t.especie <> v.especie then
    raise exception 'A vacina % é para %, e o animal é %.', t.nome,
      case t.especie when 'cao' then 'cães' else 'gatos' end,
      case v.especie when 'cao' then 'um cão' else 'um gato' end;
  end if;
  if p_proxima_dose is not null and p_proxima_dose <= p_data then
    raise exception 'A próxima dose precisa ser depois da aplicação.';
  end if;

  insert into public.atendimentos (animal_id, tipo, data, clinica_id, veterinario, observacoes)
  values (v.id, 'vacina', p_data, p_clinica_id, nullif(trim(p_veterinario), ''), nullif(trim(p_observacoes), ''))
  returning id into v_atendimento;
  insert into public.vacinacoes (atendimento_id, vacina_tipo_id, lote, proxima_dose)
  values (v_atendimento, t.id, nullif(trim(p_lote), ''), p_proxima_dose);
  return v_atendimento;
end
$$;

create function public.registrar_vermifugacao(
  p_animal uuid,
  p_produto text,
  p_data date,
  p_proxima_dose date default null,
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais := app.conferir_atendimento(p_animal, p_data);
  v_atendimento uuid;
begin
  if nullif(trim(p_produto), '') is null then
    raise exception 'Informe o vermífugo usado.';
  end if;
  if p_proxima_dose is not null and p_proxima_dose <= p_data then
    raise exception 'A próxima dose precisa ser depois da aplicação.';
  end if;
  insert into public.atendimentos (animal_id, tipo, data, observacoes)
  values (v.id, 'vermifugacao', p_data, nullif(trim(p_observacoes), ''))
  returning id into v_atendimento;
  insert into public.vermifugacoes (atendimento_id, produto, proxima_dose)
  values (v_atendimento, trim(p_produto), p_proxima_dose);
  return v_atendimento;
end
$$;

create function public.agendar_castracao(p_animal uuid, p_data date, p_clinica_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
  v_id uuid;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  select * into v from public.animais where id = p_animal and excluido_em is null;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;
  if v.situacao <> 'em_acolhimento' then
    raise exception 'Só é possível agendar castração de animal em acolhimento.';
  end if;
  if p_data is null then
    raise exception 'Informe a data da castração.';
  end if;
  if exists (select 1 from public.castracoes where animal_id = v.id and status = 'realizada') then
    raise exception 'Este animal já está castrado.';
  end if;
  if exists (select 1 from public.castracoes where animal_id = v.id and status = 'agendada') then
    raise exception 'Este animal já tem castração agendada.';
  end if;
  insert into public.castracoes (animal_id, status, data_agendada, clinica_id)
  values (v.id, 'agendada', p_data, p_clinica_id)
  returning id into v_id;
  return v_id;
end
$$;

-- Realiza a castração agendada (ou registra uma sem agendamento).
create function public.realizar_castracao(
  p_animal uuid,
  p_data date,
  p_clinica_id uuid default null,
  p_veterinario text default null,
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais := app.conferir_atendimento(p_animal, p_data);
  v_atendimento uuid;
  v_agendada uuid;
begin
  if exists (select 1 from public.castracoes where animal_id = v.id and status = 'realizada') then
    raise exception 'Este animal já está castrado.';
  end if;
  insert into public.atendimentos (animal_id, tipo, data, clinica_id, veterinario, observacoes)
  values (v.id, 'castracao', p_data, p_clinica_id, nullif(trim(p_veterinario), ''), nullif(trim(p_observacoes), ''))
  returning id into v_atendimento;

  select id into v_agendada from public.castracoes where animal_id = v.id and status = 'agendada' for update;
  if v_agendada is not null then
    update public.castracoes
       set status = 'realizada', atendimento_id = v_atendimento,
           clinica_id = coalesce(p_clinica_id, clinica_id)
     where id = v_agendada;
    return v_agendada;
  end if;
  insert into public.castracoes (animal_id, status, atendimento_id, clinica_id)
  values (v.id, 'realizada', v_atendimento, p_clinica_id)
  returning id into v_agendada;
  return v_agendada;
end
$$;

-- "Já chegou castrado": registra sem atendimento e cancela agendamento aberto.
create function public.registrar_castracao_anterior(p_animal uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.animais where id = p_animal and excluido_em is null) then
    raise exception 'Animal não encontrado.';
  end if;
  if exists (select 1 from public.castracoes where animal_id = p_animal and status = 'realizada') then
    raise exception 'Este animal já está castrado.';
  end if;
  update public.castracoes
     set status = 'cancelada', motivo_cancelamento = 'O animal já tinha chegado castrado.'
   where animal_id = p_animal and status = 'agendada';
  insert into public.castracoes (animal_id, status, anterior_a_entrada)
  values (p_animal, 'realizada', true)
  returning id into v_id;
  return v_id;
end
$$;

create function public.cancelar_castracao(p_castracao uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.castracoes
     set status = 'cancelada', motivo_cancelamento = nullif(trim(p_motivo), '')
   where id = p_castracao and status = 'agendada';
  if not found then
    raise exception 'Agendamento não encontrado ou já encerrado.';
  end if;
end
$$;

revoke all on function app.conferir_atendimento(uuid, date) from public, anon, authenticated;
revoke all on function
  public.registrar_vacina(uuid, uuid, date, date, text, uuid, text, text),
  public.registrar_vermifugacao(uuid, text, date, date, text),
  public.agendar_castracao(uuid, date, uuid),
  public.realizar_castracao(uuid, date, uuid, text, text),
  public.registrar_castracao_anterior(uuid),
  public.cancelar_castracao(uuid, text)
from public, anon;
grant execute on function
  public.registrar_vacina(uuid, uuid, date, date, text, uuid, text, text),
  public.registrar_vermifugacao(uuid, text, date, date, text),
  public.agendar_castracao(uuid, date, uuid),
  public.realizar_castracao(uuid, date, uuid, text, text),
  public.registrar_castracao_anterior(uuid),
  public.cancelar_castracao(uuid, text)
to authenticated;

-- Views de estado (security_invoker: a RLS de quem consulta vale) -------------

-- Última aplicação de cada vacina por animal: é ela que diz a próxima dose.
create view public.vacinas_situacao with (security_invoker = true) as
select distinct on (a.animal_id, vc.vacina_tipo_id)
  a.animal_id,
  vc.vacina_tipo_id,
  t.nome as vacina,
  a.data as ultima_aplicacao,
  vc.proxima_dose
from public.vacinacoes vc
join public.atendimentos a on a.id = vc.atendimento_id
join public.vacinas_tipos t on t.id = vc.vacina_tipo_id
order by a.animal_id, vc.vacina_tipo_id, a.data desc, a.criado_em desc;

create view public.animal_saude with (security_invoker = true) as
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
cast_ as (
  select animal_id,
         bool_or(status = 'realizada') as castrado,
         max(data_agendada) filter (where status = 'agendada') as data_agendada
  from public.castracoes
  group by animal_id
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
  coalesce(verm.proxima_dose < (select hoje from conf), false) as vermifugacao_vencida
from public.animais an
left join vac on vac.animal_id = an.id
left join verm on verm.animal_id = an.id
left join cast_ on cast_.animal_id = an.id
where an.excluido_em is null;

-- Pendências: só animais em acolhimento (depois da adoção a carteira é da família).
create function public.pendencias_saude()
returns table (
  tipo text, animal_id uuid, numero text, nome text, especie public.especie,
  descricao text, data date, vencida boolean
)
language sql stable security invoker set search_path = '' as $$
  with conf as (select app.hoje() as hoje, c.aviso_vacina_dias as aviso from public.configuracoes c)
  select 'vacina', an.id, an.numero, an.nome, an.especie, s.vacina, s.proxima_dose, s.proxima_dose < conf.hoje
  from public.vacinas_situacao s
  join public.animais an on an.id = s.animal_id
  cross join conf
  where an.situacao = 'em_acolhimento' and an.excluido_em is null
    and s.proxima_dose is not null and s.proxima_dose <= conf.hoje + conf.aviso
  union all
  select 'vermifugacao', an.id, an.numero, an.nome, an.especie, v.produto, v.proxima_dose, v.proxima_dose < conf.hoje
  from (
    select distinct on (a.animal_id) a.animal_id, vm.produto, vm.proxima_dose
    from public.vermifugacoes vm join public.atendimentos a on a.id = vm.atendimento_id
    order by a.animal_id, a.data desc, a.criado_em desc
  ) v
  join public.animais an on an.id = v.animal_id
  cross join conf
  where an.situacao = 'em_acolhimento' and an.excluido_em is null
    and v.proxima_dose is not null and v.proxima_dose <= conf.hoje + conf.aviso
  union all
  select 'castracao', an.id, an.numero, an.nome, an.especie, 'Castração agendada', c.data_agendada, c.data_agendada < conf.hoje
  from public.castracoes c
  join public.animais an on an.id = c.animal_id
  cross join conf
  where c.status = 'agendada' and an.situacao = 'em_acolhimento' and an.excluido_em is null
  order by 7, 3
$$;

revoke all on function public.pendencias_saude() from public, anon;
grant execute on function public.pendencias_saude() to authenticated;

-- RLS ------------------------------------------------------------------------

alter table public.atendimentos enable row level security;
alter table public.atendimentos force row level security;
create policy atendimentos_ler on public.atendimentos for select to authenticated
  using ((select app.papel()) is not null);

alter table public.vacinas_tipos enable row level security;
alter table public.vacinas_tipos force row level security;
create policy vacinas_tipos_ler on public.vacinas_tipos for select to authenticated
  using ((select app.papel()) is not null);
create policy vacinas_tipos_criar on public.vacinas_tipos for insert to authenticated
  with check ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));
create policy vacinas_tipos_alterar on public.vacinas_tipos for update to authenticated
  using ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])))
  with check ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));

alter table public.vacinacoes enable row level security;
alter table public.vacinacoes force row level security;
create policy vacinacoes_ler on public.vacinacoes for select to authenticated
  using ((select app.papel()) is not null);

alter table public.vermifugacoes enable row level security;
alter table public.vermifugacoes force row level security;
create policy vermifugacoes_ler on public.vermifugacoes for select to authenticated
  using ((select app.papel()) is not null);

alter table public.castracoes enable row level security;
alter table public.castracoes force row level security;
create policy castracoes_ler on public.castracoes for select to authenticated
  using ((select app.papel()) is not null);

-- Permissões: escrita só pelas funções, exceto o catálogo (admin e coordenação).
revoke all on public.atendimentos, public.vacinas_tipos, public.vacinacoes, public.vermifugacoes, public.castracoes
  from anon, authenticated;
grant select on public.atendimentos, public.vacinacoes, public.vermifugacoes, public.castracoes to authenticated;
grant select, insert (nome, especie, reforco_dias), update (nome, reforco_dias, ativo)
  on public.vacinas_tipos to authenticated;

revoke all on public.vacinas_situacao, public.animal_saude from anon, authenticated;
grant select on public.vacinas_situacao, public.animal_saude to authenticated;
