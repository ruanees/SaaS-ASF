-- 008 — Ajustes da Fase 2 pelas respostas da associação (17/10/2026).
--  1. Protocolo de vacina: na primeira vez, 3 doses com 21 dias; depois reforço anual.
--  2. Castração também de animal adotado (agendada com o adotante); só óbito e
--     transferência cancelam o agendamento.
--  3. Vermífugo: filhote na primeira vez, próxima dose em 15 dias; adulto, 6 meses.
--  4. Antiparasitário externo (Simparic semestral; Bravecto só em cadela parida).
--  5. Microchip no animal, informado também ao registrar a castração.
--  6. Prioridade de castração: fêmeas em acolhimento ainda não castradas.

-- 1. Protocolo de vacina ---------------------------------------------------------

alter table public.vacinas_tipos
  add column doses_iniciais int not null default 1 check (doses_iniciais between 1 and 6),
  add column intervalo_inicial_dias int check (intervalo_inicial_dias is null or intervalo_inicial_dias between 1 and 365),
  add check (doses_iniciais = 1 or intervalo_inicial_dias is not null);
grant insert (doses_iniciais, intervalo_inicial_dias), update (doses_iniciais, intervalo_inicial_dias)
  on public.vacinas_tipos to authenticated;

-- Sugestão da próxima dose: conta as doses que o animal já tomou dessa vacina.
-- Enquanto não completou as doses iniciais, sugere o intervalo inicial; depois,
-- o reforço. É só sugestão: quem registra pode mudar a data.
create function public.sugerir_proxima_dose(p_animal uuid, p_vacina_tipo uuid, p_data date)
returns date
language sql stable security invoker set search_path = '' as $$
  with anteriores as (
    select count(*)::int as n
    from public.vacinacoes vc
    join public.atendimentos a on a.id = vc.atendimento_id
    where a.animal_id = p_animal and vc.vacina_tipo_id = p_vacina_tipo and a.data <= p_data
  )
  select case
    when p_data is null then null
    when t.doses_iniciais > (select n from anteriores) + 1 and t.intervalo_inicial_dias is not null
      then p_data + t.intervalo_inicial_dias
    when t.reforco_dias is not null then p_data + t.reforco_dias
  end
  from public.vacinas_tipos t
  where t.id = p_vacina_tipo
$$;

-- 3. Vermífugo: filhote (menos de 6 meses) sem vermifugação anterior faz a série
-- de 3 dias e repete em 15 dias; nos outros casos, a cada 6 meses.
create function public.sugerir_proxima_vermifugacao(p_animal uuid, p_data date)
returns date
language sql stable security invoker set search_path = '' as $$
  select case
    when p_data is null then null
    when an.nascimento_estimado is not null
         and an.nascimento_estimado > p_data - interval '6 months'
         and not exists (
           select 1 from public.vermifugacoes vm
           join public.atendimentos a on a.id = vm.atendimento_id
           where a.animal_id = p_animal and a.data < p_data
         )
      then p_data + 15
    else (p_data + interval '6 months')::date
  end
  from public.animais an
  where an.id = p_animal
$$;

-- 4. Antiparasitário externo ------------------------------------------------------

create table public.antiparasitarios (
  atendimento_id uuid primary key references public.atendimentos(id),
  produto text not null check (length(trim(produto)) between 1 and 80),
  proxima_dose date,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create trigger antiparasitarios_carimbar before insert or update on public.antiparasitarios
  for each row execute function app.carimbar();
create trigger antiparasitarios_auditar after insert or update or delete on public.antiparasitarios
  for each row execute function app.auditar();

alter table public.antiparasitarios enable row level security;
alter table public.antiparasitarios force row level security;
create policy antiparasitarios_ler on public.antiparasitarios for select to authenticated
  using ((select app.papel()) is not null);
revoke all on public.antiparasitarios from anon, authenticated;
grant select on public.antiparasitarios to authenticated;

-- Simparic: a associação aplica a cada 6 meses nos abrigados. Bravecto (cadela
-- parida) e outros: sem próxima dose sugerida.
create function public.sugerir_proximo_antiparasitario(p_produto text, p_data date)
returns date
language sql immutable set search_path = '' as $$
  select case
    when p_data is not null and lower(trim(coalesce(p_produto, ''))) like 'simparic%'
      then (p_data + interval '6 months')::date
  end
$$;

create function public.registrar_antiparasitario(
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
    raise exception 'Informe o produto usado.';
  end if;
  if p_proxima_dose is not null and p_proxima_dose <= p_data then
    raise exception 'A próxima dose precisa ser depois da aplicação.';
  end if;
  insert into public.atendimentos (animal_id, tipo, data, observacoes)
  values (v.id, 'antiparasitario', p_data, nullif(trim(p_observacoes), ''))
  returning id into v_atendimento;
  insert into public.antiparasitarios (atendimento_id, produto, proxima_dose)
  values (v_atendimento, trim(p_produto), p_proxima_dose);
  return v_atendimento;
end
$$;

-- 5. Microchip ----------------------------------------------------------------------

alter table public.animais
  add column microchip text check (microchip is null or microchip ~ '^[0-9A-Za-z]{9,20}$'),
  add column microchip_data date;
create unique index animais_microchip on public.animais (microchip) where microchip is not null;
grant update (microchip, microchip_data) on public.animais to authenticated;

-- 2. Castração: também de animal adotado ---------------------------------------------

create or replace function public.agendar_castracao(p_animal uuid, p_data date, p_clinica_id uuid default null)
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
  -- Adotado também: a associação agenda junto com o adotante.
  if v.situacao not in ('em_acolhimento', 'adotado') then
    raise exception 'Só é possível agendar castração de animal em acolhimento ou adotado.';
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

-- A adoção não cancela mais o agendamento: só óbito e transferência.
create or replace function app.cancelar_castracao_ao_sair() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.situacao <> new.situacao and new.situacao in ('obito', 'transferido') then
    update public.castracoes
       set status = 'cancelada',
           motivo_cancelamento = case new.situacao when 'obito' then 'Óbito do animal.' else 'O animal foi transferido.' end
     where animal_id = new.id and status = 'agendada';
  end if;
  return new;
end
$$;

-- Realizar castração agora aceita o microchip aplicado na mesma cirurgia.
drop function public.realizar_castracao(uuid, date, uuid, text, text);
create function public.realizar_castracao(
  p_animal uuid,
  p_data date,
  p_clinica_id uuid default null,
  p_veterinario text default null,
  p_observacoes text default null,
  p_microchip text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais := app.conferir_atendimento(p_animal, p_data);
  v_atendimento uuid;
  v_agendada uuid;
  v_chip text := nullif(upper(regexp_replace(coalesce(p_microchip, ''), '\s', '', 'g')), '');
begin
  if exists (select 1 from public.castracoes where animal_id = v.id and status = 'realizada') then
    raise exception 'Este animal já está castrado.';
  end if;
  if v_chip is not null then
    if v_chip !~ '^[0-9A-Z]{9,20}$' then
      raise exception 'Número de microchip inválido (9 a 20 letras ou números).';
    end if;
    if exists (select 1 from public.animais where microchip = v_chip and id <> v.id) then
      raise exception 'Este microchip já está registrado em outro animal.';
    end if;
    update public.animais set microchip = v_chip, microchip_data = p_data where id = v.id;
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

revoke all on function
  public.realizar_castracao(uuid, date, uuid, text, text, text),
  public.registrar_antiparasitario(uuid, text, date, date, text),
  public.sugerir_proxima_dose(uuid, uuid, date),
  public.sugerir_proxima_vermifugacao(uuid, date),
  public.sugerir_proximo_antiparasitario(text, date)
from public, anon;
grant execute on function
  public.realizar_castracao(uuid, date, uuid, text, text, text),
  public.registrar_antiparasitario(uuid, text, date, date, text),
  public.sugerir_proxima_dose(uuid, uuid, date),
  public.sugerir_proxima_vermifugacao(uuid, date),
  public.sugerir_proximo_antiparasitario(text, date)
to authenticated;

-- Estado de saúde ganha o antiparasitário (colunas novas no fim da view).
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
  coalesce(anti.proxima_dose < (select hoje from conf), false) as antiparasitario_vencido
from public.animais an
left join vac on vac.animal_id = an.id
left join verm on verm.animal_id = an.id
left join anti on anti.animal_id = an.id
left join cast_ on cast_.animal_id = an.id
where an.excluido_em is null;

-- Pendências: entram antiparasitário, castração de adotados e a prioridade de
-- castração (fêmeas em acolhimento ainda sem castração realizada nem agendada).
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
  order by 7, 3
$$;

-- Dados iniciais informados pela associação (questionário de 17/10/2026) ---------
-- Catálogo de cães: V8, V10 e antirrábica, 3 doses com 21 dias na primeira vez e
-- reforço anual. Gatos: antirrábica (as outras vacinas de gato ainda serão informadas).
insert into public.vacinas_tipos (nome, especie, reforco_dias, doses_iniciais, intervalo_inicial_dias) values
  ('V8', 'cao', 365, 3, 21),
  ('V10', 'cao', 365, 3, 21),
  ('Antirrábica', 'cao', 365, 3, 21),
  ('Antirrábica', 'gato', 365, 3, 21)
on conflict ((lower(trim(nome))), especie) do update
  set reforco_dias = excluded.reforco_dias,
      doses_iniciais = excluded.doses_iniciais,
      intervalo_inicial_dias = excluded.intervalo_inicial_dias;

insert into public.clinicas (nome) values ('Clínica Mundo Animal')
on conflict ((lower(trim(nome)))) do nothing;
