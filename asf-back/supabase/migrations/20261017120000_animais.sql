-- 005 — Fase 1: animais, numeração, fotos, movimentações e clínicas.
-- Plano, seção 03 (Situação e localização, Reentrada, Número de identificação)
-- e Fase 1. ADR 0003 (situação, local e disponibilidade em três colunas).

create extension if not exists pg_trgm with schema extensions;

-- Listas fechadas ------------------------------------------------------------

create type public.especie as enum ('cao', 'gato');
-- 'nao_identificado': filhote sem sexo identificado (decisão de 17/10/2026).
create type public.sexo as enum ('macho', 'femea', 'nao_identificado');
create type public.porte as enum ('pequeno', 'medio', 'grande');
create type public.origem as enum ('resgate', 'castracao', 'comunitario', 'outra');
create type public.situacao as enum ('em_acolhimento', 'adotado', 'devolvido_comunidade', 'transferido', 'obito');
create type public.local_animal as enum ('sede', 'lar_temporario', 'clinica');

-- Clínicas -------------------------------------------------------------------

create table public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 120),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create unique index clinicas_nome_unico on public.clinicas (lower(trim(nome)));

-- Animais --------------------------------------------------------------------

create table public.animais (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique check (numero ~ '^[0-9]{4}-[0-9]{4,}$'),  -- trigger, imutável
  nome text check (nome is null or length(trim(nome)) between 1 and 80),  -- pode não ter nome
  especie public.especie not null,
  sexo public.sexo not null,
  nascimento_estimado date,                   -- a idade é calculada, nunca gravada
  idade_precisao text check (idade_precisao in ('exata', 'aproximada')),
  porte public.porte,
  data_entrada date not null,                 -- primeira entrada
  origem public.origem not null,              -- origem da primeira entrada
  origem_detalhe text check (origem_detalhe is null or length(trim(origem_detalhe)) between 1 and 200),
  situacao public.situacao not null default 'em_acolhimento',
  local public.local_animal,
  disponivel_adocao boolean not null default false,
  clinica_id uuid references public.clinicas(id),  -- clínica atual, quando local = 'clinica'
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (origem <> 'outra' or origem_detalhe is not null),
  check ((nascimento_estimado is null) = (idade_precisao is null)),
  -- ADR 0003: local e disponibilidade só existem enquanto o animal está em acolhimento.
  check (
    (situacao = 'em_acolhimento' and local is not null)
    or (situacao <> 'em_acolhimento' and local is null and not disponivel_adocao)
  ),
  check (clinica_id is null or local = 'clinica')
);
create index animais_situacao_local on public.animais (situacao, local) where excluido_em is null;
create index animais_especie_sexo on public.animais (especie, sexo) where excluido_em is null;
create index animais_nome_trgm on public.animais using gin (lower(nome) extensions.gin_trgm_ops) where excluido_em is null;

-- Contador do número por ano. Ninguém lê nem grava direto: só o trigger.
create table public.numeracao (
  ano int primary key,
  ultimo int not null default 0
);

create table public.animal_fotos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais(id),
  -- '{animal_id}/{uuid}.webp', decidido pelo servidor
  caminho text not null unique check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  principal boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create unique index animal_fotos_principal on public.animal_fotos (animal_id) where principal;
create index animal_fotos_animal on public.animal_fotos (animal_id);

-- Histórico. A coluna em `animais` é o estado atual; isto é o que aconteceu.
create table public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais(id),
  tipo text not null check (tipo in ('entrada', 'mudanca', 'reentrada')),
  origem public.origem,                       -- na entrada e na reentrada
  situacao public.situacao not null,
  local public.local_animal,
  disponivel_adocao boolean not null,
  pessoa_id uuid,                             -- lar temporário, adotante ou destino (FK na Fase 4)
  clinica_id uuid references public.clinicas(id),
  data date not null,
  motivo text check (motivo is null or length(motivo) <= 500),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (tipo = 'mudanca' or origem is not null),
  -- Lar temporário sempre tem uma pessoa responsável (cadastro de pessoas: Fase 4).
  check (local is distinct from 'lar_temporario' or pessoa_id is not null)
);
create index movimentacoes_animal on public.movimentacoes (animal_id, data desc, criado_em desc);

-- Número AAAA-NNNN -----------------------------------------------------------
-- O upsert trava a linha do ano: dois cadastros ao mesmo tempo esperam um
-- pelo outro e nunca recebem o mesmo número. O ano é o do cadastro, no fuso
-- da associação.
create function app.numerar_animal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ano int := extract(year from app.hoje())::int;
  v_n int;
begin
  insert into public.numeracao as n (ano, ultimo) values (v_ano, 1)
  on conflict (ano) do update set ultimo = n.ultimo + 1
  returning n.ultimo into v_n;
  new.numero := v_ano::text || '-' || case when v_n < 10000 then lpad(v_n::text, 4, '0') else v_n::text end;
  return new;
end
$$;

create trigger animais_numerar before insert on public.animais
  for each row execute function app.numerar_animal();

-- Regras de data e imutabilidade ---------------------------------------------
create function app.validar_animal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.numero is distinct from old.numero then
    raise exception 'O número do animal não pode ser alterado.';
  end if;
  if new.data_entrada > app.hoje() then
    raise exception 'A data de entrada não pode ser no futuro.';
  end if;
  if new.nascimento_estimado is not null and new.nascimento_estimado > new.data_entrada then
    raise exception 'O nascimento não pode ser depois da entrada.';
  end if;
  return new;
end
$$;

create trigger animais_validar before insert or update on public.animais
  for each row execute function app.validar_animal();

-- Carimbo e auditoria (migração 002) ------------------------------------------
create trigger clinicas_carimbar before insert or update on public.clinicas
  for each row execute function app.carimbar();
create trigger clinicas_auditar after insert or update or delete on public.clinicas
  for each row execute function app.auditar();
create trigger animais_carimbar before insert or update on public.animais
  for each row execute function app.carimbar();
create trigger animais_auditar after insert or update or delete on public.animais
  for each row execute function app.auditar();
create trigger animal_fotos_carimbar before insert or update on public.animal_fotos
  for each row execute function app.carimbar();
create trigger animal_fotos_auditar after insert or update or delete on public.animal_fotos
  for each row execute function app.auditar();
create trigger movimentacoes_carimbar before insert or update on public.movimentacoes
  for each row execute function app.carimbar();
create trigger movimentacoes_auditar after insert or update or delete on public.movimentacoes
  for each row execute function app.auditar();

-- Funções de escrita (uma transação cada) ------------------------------------
-- security definer com checagem de papel explícita: a escrita direta nessas
-- tabelas é revogada, para o histórico nunca ficar sem a linha correspondente.

create function public.cadastrar_animal(
  p_especie public.especie,
  p_sexo public.sexo,
  p_data_entrada date,
  p_origem public.origem,
  p_local public.local_animal,
  p_nome text default null,
  p_nascimento_estimado date default null,
  p_idade_precisao text default null,
  p_porte public.porte default null,
  p_origem_detalhe text default null,
  p_disponivel_adocao boolean default false,
  p_clinica_id uuid default null,
  p_observacoes text default null
) returns public.animais
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_local = 'lar_temporario' then
    raise exception 'Lar temporário ainda não está disponível: depende do cadastro de pessoas.';
  end if;

  insert into public.animais (
    nome, especie, sexo, nascimento_estimado, idade_precisao, porte,
    data_entrada, origem, origem_detalhe, situacao, local, disponivel_adocao,
    clinica_id, observacoes
  ) values (
    nullif(trim(p_nome), ''), p_especie, p_sexo, p_nascimento_estimado,
    case when p_nascimento_estimado is null then null else coalesce(p_idade_precisao, 'aproximada') end,
    p_porte, p_data_entrada, p_origem, nullif(trim(p_origem_detalhe), ''),
    'em_acolhimento', p_local, coalesce(p_disponivel_adocao, false),
    case when p_local = 'clinica' then p_clinica_id end, nullif(trim(p_observacoes), '')
  ) returning * into v;

  insert into public.movimentacoes (animal_id, tipo, origem, situacao, local, disponivel_adocao, clinica_id, data)
  values (v.id, 'entrada', v.origem, v.situacao, v.local, v.disponivel_adocao, v.clinica_id, v.data_entrada);

  return v;
end
$$;

create function public.mover_animal(
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

  return m;
end
$$;

create function public.excluir_animal(p_animal uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select app.tem_papel(array['admin', 'coordenacao']::public.papel[])) then
    raise exception 'Só a administração e a coordenação excluem animais.' using errcode = '42501';
  end if;
  update public.animais set excluido_em = now() where id = p_animal and excluido_em is null;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;
end
$$;

-- Foto: o arquivo já foi enviado ao Storage com URL assinada; aqui só se
-- registra, e só se o arquivo existir de fato no balde. A mais nova vira a principal.
create function public.registrar_foto(p_animal uuid, p_caminho text) returns public.animal_fotos
language plpgsql security definer set search_path = '' as $$
declare
  f public.animal_fotos;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.animais where id = p_animal and excluido_em is null) then
    raise exception 'Animal não encontrado.';
  end if;
  if p_caminho is null or left(p_caminho, 37) <> p_animal::text || '/' then
    raise exception 'Caminho de foto inválido.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'fotos-animais' and o.name = p_caminho) then
    raise exception 'O envio da foto não terminou. Tente de novo.';
  end if;

  update public.animal_fotos set principal = false where animal_id = p_animal and principal;
  insert into public.animal_fotos (animal_id, caminho, principal) values (p_animal, p_caminho, true)
  returning * into f;
  return f;
end
$$;

-- Possíveis duplicados (aviso antes de cadastrar). Roda como quem chama: a
-- RLS decide o que aparece.
create function public.possiveis_duplicados(p_nome text, p_especie public.especie, p_sexo public.sexo)
returns table (
  id uuid, numero text, nome text, sexo public.sexo, situacao public.situacao,
  data_entrada date, semelhanca real
)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.numero, a.nome, a.sexo, a.situacao, a.data_entrada,
         extensions.similarity(lower(a.nome), lower(trim(p_nome))) as semelhanca
  from public.animais a
  where a.excluido_em is null
    and a.nome is not null
    and length(trim(coalesce(p_nome, ''))) > 0
    and a.especie = p_especie
    and (p_sexo = 'nao_identificado' or a.sexo = 'nao_identificado' or a.sexo = p_sexo)
    and extensions.similarity(lower(a.nome), lower(trim(p_nome))) >= 0.35
  order by semelhanca desc, a.data_entrada desc
  limit 5
$$;

revoke all on function app.numerar_animal(), app.validar_animal() from public, anon, authenticated;
revoke all on function
  public.cadastrar_animal(public.especie, public.sexo, date, public.origem, public.local_animal, text, date, text, public.porte, text, boolean, uuid, text),
  public.mover_animal(uuid, public.situacao, public.local_animal, boolean, date, text, text, public.origem, uuid),
  public.excluir_animal(uuid),
  public.registrar_foto(uuid, text),
  public.possiveis_duplicados(text, public.especie, public.sexo)
from public, anon;
grant execute on function
  public.cadastrar_animal(public.especie, public.sexo, date, public.origem, public.local_animal, text, date, text, public.porte, text, boolean, uuid, text),
  public.mover_animal(uuid, public.situacao, public.local_animal, boolean, date, text, text, public.origem, uuid),
  public.excluir_animal(uuid),
  public.registrar_foto(uuid, text),
  public.possiveis_duplicados(text, public.especie, public.sexo)
to authenticated;

-- RLS ------------------------------------------------------------------------

alter table public.clinicas enable row level security;
alter table public.clinicas force row level security;
create policy clinicas_ler on public.clinicas for select to authenticated
  using ((select app.papel()) is not null);
create policy clinicas_criar on public.clinicas for insert to authenticated
  with check ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));
create policy clinicas_alterar on public.clinicas for update to authenticated
  using ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])))
  with check ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));

alter table public.animais enable row level security;
alter table public.animais force row level security;
-- Todos os papéis veem e editam os dados do animal (plano, "Quem vê o quê").
create policy animais_ler on public.animais for select to authenticated
  using ((select app.papel()) is not null and excluido_em is null);
create policy animais_alterar on public.animais for update to authenticated
  using ((select app.papel()) is not null and excluido_em is null)
  with check ((select app.papel()) is not null and excluido_em is null);
-- Sem política de insert e delete: cadastro e exclusão só pelas funções.

alter table public.numeracao enable row level security;
alter table public.numeracao force row level security;

alter table public.animal_fotos enable row level security;
alter table public.animal_fotos force row level security;
create policy animal_fotos_ler on public.animal_fotos for select to authenticated
  using ((select app.papel()) is not null);

alter table public.movimentacoes enable row level security;
alter table public.movimentacoes force row level security;
create policy movimentacoes_ler on public.movimentacoes for select to authenticated
  using ((select app.papel()) is not null);

-- Permissões de tabela -------------------------------------------------------
-- situacao, local, disponivel_adocao, clinica_id, numero e excluido_em ficam
-- de fora do update: mudam só pelas funções.
revoke all on public.clinicas, public.animais, public.numeracao, public.animal_fotos, public.movimentacoes
  from anon, authenticated;
grant select, insert (nome), update (nome, ativo) on public.clinicas to authenticated;
grant select, update (nome, especie, sexo, nascimento_estimado, idade_precisao, porte,
  data_entrada, origem, origem_detalhe, observacoes) on public.animais to authenticated;
grant select on public.animal_fotos, public.movimentacoes to authenticated;

-- Storage: balde privado de fotos --------------------------------------------
-- Até 5 MB, só imagem. O front envia WebP já reprocessado (sem EXIF/GPS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-animais', 'fotos-animais', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

create policy fotos_animais_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos-animais' and (select app.papel()) is not null);
create policy fotos_animais_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-animais' and (select app.papel()) is not null);
