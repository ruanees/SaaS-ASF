-- 010 — Fase 4: pessoas, lar temporário, adoções e devoluções.
-- ADR 0006 (contato em tabela separada), 0007 (anonimizar em vez de apagar) e
-- 0010 (padrões provisórios até a associação revisar a LGPD).
--
-- Só se guarda o que o briefing pede: nome, telefone, e-mail e endereço. O
-- contato fica em `pessoas_contato`, que nenhum papel lê direto: a leitura
-- passa por `ler_contato`, que grava a leitura na auditoria.

create type public.vinculo_pessoa as enum ('adotante', 'lar_temporario');

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 120),
  base_legal text not null check (base_legal in (
    'execucao_contrato', 'acordo_voluntariado', 'consentimento', 'legitimo_interesse'
  )),
  vinculos public.vinculo_pessoa[] not null default '{}',
  anonimizado_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index pessoas_nome on public.pessoas (lower(nome));

create table public.pessoas_contato (
  pessoa_id uuid primary key references public.pessoas(id),
  telefone text check (telefone is null or length(telefone) between 8 and 30),
  email text check (email is null or (length(email) <= 160 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  endereco text check (endereco is null or length(endereco) <= 300),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table public.adocoes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais(id),
  pessoa_id uuid not null references public.pessoas(id),
  data_adocao date not null,
  termo_caminho text check (termo_caminho is null or termo_caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  data_devolucao date,
  motivo_devolucao text check (motivo_devolucao is null or length(motivo_devolucao) <= 500),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (data_devolucao is null or data_devolucao >= data_adocao),
  check (data_devolucao is null or nullif(trim(motivo_devolucao), '') is not null)
);
-- Uma adoção ativa por animal.
create unique index adocoes_uma_ativa on public.adocoes (animal_id) where data_devolucao is null;
create index adocoes_pessoa on public.adocoes (pessoa_id);
create index adocoes_data on public.adocoes (data_adocao desc);

-- Movimentações: a pessoa (lar temporário ou adotante) ganha chave estrangeira;
-- o destino da transferência ou o bairro da devolução à comunidade é texto.
-- A devolução de adoção vira um tipo próprio de movimentação.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.movimentacoes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mtipo\M'
  loop
    execute format('alter table public.movimentacoes drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.movimentacoes
  add column destino text check (destino is null or length(destino) <= 200),
  add constraint movimentacoes_pessoa_fk foreign key (pessoa_id) references public.pessoas(id),
  add constraint movimentacoes_tipo check (tipo in ('entrada', 'mudanca', 'reentrada', 'devolucao')),
  add constraint movimentacoes_origem check (tipo in ('mudanca', 'devolucao') or origem is not null),
  add constraint movimentacoes_adotado check (situacao <> 'adotado' or pessoa_id is not null),
  add constraint movimentacoes_transferido check (situacao <> 'transferido' or destino is not null);
create index movimentacoes_pessoa on public.movimentacoes (pessoa_id) where pessoa_id is not null;

-- Responsável atual do lar temporário: gravado só por mover_animal, como
-- situação e local (ADR 0003).
alter table public.animais
  add column pessoa_id uuid constraint animais_pessoa_fk references public.pessoas(id),
  add constraint animais_lar_tem_pessoa check ((local is not distinct from 'lar_temporario') = (pessoa_id is not null));
create index animais_pessoa on public.animais (pessoa_id) where pessoa_id is not null;

create trigger pessoas_carimbar before insert or update on public.pessoas
  for each row execute function app.carimbar();
create trigger pessoas_auditar after insert or update or delete on public.pessoas
  for each row execute function app.auditar();
create trigger pessoas_contato_carimbar before insert or update on public.pessoas_contato
  for each row execute function app.carimbar();
create trigger pessoas_contato_auditar after insert or update or delete on public.pessoas_contato
  for each row execute function app.auditar();
create trigger adocoes_carimbar before insert or update on public.adocoes
  for each row execute function app.carimbar();
create trigger adocoes_auditar after insert or update or delete on public.adocoes
  for each row execute function app.auditar();

-- RLS ---------------------------------------------------------------------------
-- Nome da pessoa e adoções: todos os papéis leem (o voluntário vê que o animal
-- está no lar da Maria). Contato: só administração e coordenação, e mesmo elas
-- só pela função ler_contato. Escrita só pelas funções.
alter table public.pessoas enable row level security;
alter table public.pessoas force row level security;
create policy pessoas_ler on public.pessoas for select to authenticated
  using ((select app.papel()) is not null);

alter table public.pessoas_contato enable row level security;
alter table public.pessoas_contato force row level security;
create policy pessoas_contato_ler on public.pessoas_contato for select to authenticated
  using ((select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));

alter table public.adocoes enable row level security;
alter table public.adocoes force row level security;
create policy adocoes_ler on public.adocoes for select to authenticated
  using ((select app.papel()) is not null);

revoke all on public.pessoas, public.pessoas_contato, public.adocoes from anon, authenticated;
grant select on public.pessoas, public.adocoes to authenticated;
-- pessoas_contato: sem select direto, para toda leitura ficar na auditoria.

-- Quem cuida de pessoas e adoções: administração e coordenação.
create function app.exigir_coordenacao(p_mensagem text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select app.tem_papel(array['admin', 'coordenacao']::public.papel[])) then
    raise exception '%', p_mensagem using errcode = '42501';
  end if;
end
$$;

create function app.pessoa_ativa(p_pessoa uuid) returns public.pessoas
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.pessoas;
begin
  select * into p from public.pessoas where id = p_pessoa;
  if not found then
    raise exception 'Pessoa não encontrada.';
  end if;
  if p.anonimizado_em is not null then
    raise exception 'Esta pessoa foi anonimizada. Para um novo vínculo, faça um cadastro novo.';
  end if;
  return p;
end
$$;

create function app.gravar_contato(p_pessoa uuid, p_vinculos public.vinculo_pessoa[], p_telefone text, p_email text, p_endereco text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_telefone text := nullif(trim(p_telefone), '');
  v_email text := lower(nullif(trim(p_email), ''));
  v_endereco text := nullif(trim(p_endereco), '');
begin
  -- Minimização: endereço só para quem fica com o animal.
  if v_endereco is not null and not (p_vinculos && array['adotante', 'lar_temporario']::public.vinculo_pessoa[]) then
    raise exception 'O endereço só é pedido para adotante e lar temporário.';
  end if;
  if v_telefone is null and v_email is null and v_endereco is null then
    delete from public.pessoas_contato where pessoa_id = p_pessoa;
    return;
  end if;
  insert into public.pessoas_contato (pessoa_id, telefone, email, endereco)
  values (p_pessoa, v_telefone, v_email, v_endereco)
  on conflict (pessoa_id) do update
    set telefone = excluded.telefone, email = excluded.email, endereco = excluded.endereco;
end
$$;

-- Cadastro e correção ------------------------------------------------------------

create function public.cadastrar_pessoa(
  p_nome text,
  p_base_legal text,
  p_vinculos public.vinculo_pessoa[],
  p_telefone text default null,
  p_email text default null,
  p_endereco text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação cadastram pessoas.');
  if nullif(trim(p_nome), '') is null then
    raise exception 'Informe o nome.';
  end if;
  if coalesce(cardinality(p_vinculos), 0) = 0 then
    raise exception 'Escolha o vínculo: adotante ou lar temporário.';
  end if;
  if p_base_legal is null or p_base_legal not in ('execucao_contrato', 'acordo_voluntariado', 'consentimento', 'legitimo_interesse') then
    raise exception 'Escolha a base legal.';
  end if;

  insert into public.pessoas (nome, base_legal, vinculos)
  values (trim(p_nome), p_base_legal, (select array_agg(distinct v) from unnest(p_vinculos) v))
  returning id into v_id;
  perform app.gravar_contato(v_id, p_vinculos, p_telefone, p_email, p_endereco);
  return v_id;
end
$$;

create function public.alterar_pessoa(
  p_pessoa uuid,
  p_nome text,
  p_base_legal text,
  p_vinculos public.vinculo_pessoa[]
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação alteram pessoas.');
  perform app.pessoa_ativa(p_pessoa);
  if nullif(trim(p_nome), '') is null then
    raise exception 'Informe o nome.';
  end if;
  if coalesce(cardinality(p_vinculos), 0) = 0 then
    raise exception 'Escolha o vínculo: adotante ou lar temporário.';
  end if;
  if p_base_legal is null or p_base_legal not in ('execucao_contrato', 'acordo_voluntariado', 'consentimento', 'legitimo_interesse') then
    raise exception 'Escolha a base legal.';
  end if;
  update public.pessoas
     set nome = trim(p_nome), base_legal = p_base_legal,
         vinculos = (select array_agg(distinct v) from unnest(p_vinculos) v)
   where id = p_pessoa;
end
$$;

create function public.alterar_contato(
  p_pessoa uuid,
  p_telefone text,
  p_email text,
  p_endereco text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.pessoas;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação alteram o contato das pessoas.');
  p := app.pessoa_ativa(p_pessoa);
  perform app.gravar_contato(p.id, p.vinculos, p_telefone, p_email, p_endereco);
end
$$;

-- Leitura do contato: sempre registrada na auditoria (sem os valores).
create function public.ler_contato(p_pessoa uuid)
returns table (telefone text, email text, endereco text)
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação veem o contato das pessoas.');
  if not exists (select 1 from public.pessoas where id = p_pessoa) then
    raise exception 'Pessoa não encontrada.';
  end if;
  perform app.registrar_acesso('pessoas_contato', p_pessoa, 'leitura_sensivel');
  return query
    select c.telefone, c.email, c.endereco from public.pessoas_contato c where c.pessoa_id = p_pessoa;
end
$$;

-- Direito de acesso do titular (LGPD, art. 18): tudo o que existe sobre a pessoa.
create function public.exportar_pessoa(p_pessoa uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.pessoas;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação exportam dados de pessoas.');
  select * into p from public.pessoas where id = p_pessoa;
  if not found then
    raise exception 'Pessoa não encontrada.';
  end if;
  perform app.registrar_acesso('pessoas', p_pessoa, 'exportacao');

  return jsonb_build_object(
    'gerado_em', now(),
    'controladora', (select c.nome from public.configuracoes c),
    'pessoa', jsonb_build_object(
      'id', p.id, 'nome', p.nome, 'base_legal', p.base_legal, 'vinculos', to_jsonb(p.vinculos),
      'cadastrada_em', p.criado_em, 'anonimizada_em', p.anonimizado_em
    ),
    'contato', (
      select jsonb_build_object('telefone', c.telefone, 'email', c.email, 'endereco', c.endereco)
      from public.pessoas_contato c where c.pessoa_id = p.id
    ),
    'adocoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'animal', an.numero, 'nome_do_animal', an.nome, 'data_adocao', a.data_adocao,
        'data_devolucao', a.data_devolucao, 'motivo_devolucao', a.motivo_devolucao,
        'termo_anexado', a.termo_caminho is not null
      ) order by a.data_adocao)
      from public.adocoes a join public.animais an on an.id = a.animal_id
      where a.pessoa_id = p.id
    ), '[]'::jsonb),
    'lar_temporario', coalesce((
      select jsonb_agg(jsonb_build_object('animal', an.numero, 'nome_do_animal', an.nome, 'data', m.data) order by m.data)
      from public.movimentacoes m join public.animais an on an.id = m.animal_id
      where m.pessoa_id = p.id and m.local = 'lar_temporario'
    ), '[]'::jsonb)
  );
end
$$;

-- Anonimizar (ADR 0007): apaga o contato, troca o nome, grava anonimizado_em.
-- A adoção continua existindo e contando. Devolve os caminhos dos termos para o
-- servidor apagar os arquivos do Storage.
create function public.anonimizar_pessoa(p_pessoa uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  p public.pessoas;
  v_termos text[];
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação anonimizam pessoas.');
  select * into p from public.pessoas where id = p_pessoa for update;
  if not found then
    raise exception 'Pessoa não encontrada.';
  end if;
  if p.anonimizado_em is not null then
    raise exception 'Esta pessoa já foi anonimizada.';
  end if;
  if exists (select 1 from public.animais where pessoa_id = p.id and excluido_em is null) then
    raise exception 'Esta pessoa está com um animal em lar temporário agora. Registre a saída do animal do lar antes de anonimizar.';
  end if;

  select coalesce(array_agg(termo_caminho), '{}') into v_termos
  from public.adocoes where pessoa_id = p.id and termo_caminho is not null;
  update public.adocoes set termo_caminho = null where pessoa_id = p.id and termo_caminho is not null;
  delete from public.pessoas_contato where pessoa_id = p.id;
  update public.pessoas set nome = 'Pessoa anonimizada', anonimizado_em = now() where id = p.id;
  return v_termos;
end
$$;

-- Movimentação --------------------------------------------------------------------
-- app.mover tem toda a regra e aceita os tipos internos (adoção e devolução);
-- public.mover_animal é a porta de entrada da tela e recusa o que tem fluxo
-- próprio. Só as funções do banco chamam app.mover.

drop function public.mover_animal(uuid, public.situacao, public.local_animal, boolean, date, text, text, public.origem, uuid);

create function app.mover(
  p_animal uuid,
  p_situacao public.situacao,
  p_local public.local_animal,
  p_disponivel boolean,
  p_data date,
  p_motivo text,
  p_tipo text,
  p_origem public.origem,
  p_clinica_id uuid,
  p_pessoa_id uuid,
  p_destino text
) returns public.movimentacoes
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
  v_local public.local_animal := p_local;
  v_disponivel boolean := coalesce(p_disponivel, false);
  v_clinica uuid := p_clinica_id;
  v_pessoa uuid;
  v_destino text;
  m public.movimentacoes;
begin
  if p_tipo not in ('mudanca', 'reentrada', 'devolucao') then
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

  if p_tipo = 'mudanca' then
    if v.situacao = 'obito' then
      raise exception 'Animal em óbito não pode ser movido.';
    end if;
    if v.situacao = 'adotado' then
      raise exception 'Animal adotado volta pela devolução, na aba Adoção.';
    end if;
    if v.situacao <> 'em_acolhimento' then
      raise exception 'Este animal não está em acolhimento. Para trazê-lo de volta, registre uma reentrada.';
    end if;
  elsif p_tipo = 'reentrada' then
    if v.situacao not in ('devolvido_comunidade', 'transferido') then
      raise exception 'Reentrada só vale para animal devolvido à comunidade ou transferido.';
    end if;
    if p_situacao <> 'em_acolhimento' then
      raise exception 'Na reentrada o animal volta para acolhimento.';
    end if;
    if p_origem is null then
      raise exception 'Informe a origem da reentrada.';
    end if;
  else
    if v.situacao <> 'adotado' or p_situacao <> 'em_acolhimento' then
      raise exception 'Devolução só vale para animal adotado, que volta para acolhimento.';
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

  -- Quem está com o animal: o lar temporário ou o adotante.
  if v_local = 'lar_temporario' or p_situacao = 'adotado' then
    if p_pessoa_id is null then
      raise exception '%', case when p_situacao = 'adotado' then 'Informe o adotante.' else 'Escolha a pessoa do lar temporário.' end;
    end if;
    perform app.pessoa_ativa(p_pessoa_id);
    v_pessoa := p_pessoa_id;
  end if;
  if v_local = 'lar_temporario' then
    update public.pessoas
       set vinculos = array_append(vinculos, 'lar_temporario')
     where id = v_pessoa and not ('lar_temporario' = any (vinculos));
  end if;

  if p_situacao in ('transferido', 'devolvido_comunidade') then
    v_destino := nullif(trim(p_destino), '');
  end if;
  if p_situacao = 'transferido' and v_destino is null then
    raise exception 'Informe para qual entidade o animal foi transferido.';
  end if;
  if p_situacao = 'devolvido_comunidade'
     and not exists (select 1 from public.castracoes c where c.animal_id = v.id and c.status = 'realizada') then
    raise exception 'Devolução à comunidade exige castração realizada. Registre a castração na aba Saúde.';
  end if;

  if p_tipo = 'mudanca'
     and v.situacao = p_situacao
     and v.local is not distinct from v_local
     and v.disponivel_adocao = v_disponivel
     and v.clinica_id is not distinct from v_clinica
     and v.pessoa_id is not distinct from (case when v_local = 'lar_temporario' then v_pessoa end) then
    raise exception 'Nada mudou.';
  end if;

  update public.animais
     set situacao = p_situacao, local = v_local, disponivel_adocao = v_disponivel, clinica_id = v_clinica,
         pessoa_id = case when v_local = 'lar_temporario' then v_pessoa end
   where id = v.id;

  insert into public.movimentacoes (animal_id, tipo, origem, situacao, local, disponivel_adocao, clinica_id,
                                    pessoa_id, destino, data, motivo)
  values (v.id, p_tipo, case when p_tipo = 'reentrada' then p_origem end, p_situacao, v_local, v_disponivel,
          v_clinica, v_pessoa, v_destino, p_data, nullif(trim(p_motivo), ''))
  returning * into m;

  -- Óbito é situação E atendimento, na mesma transação (plano, Fase 3).
  if p_situacao = 'obito' then
    insert into public.atendimentos (animal_id, tipo, data, observacoes)
    values (v.id, 'obito', p_data, nullif(trim(p_motivo), ''));
  end if;

  return m;
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
  p_clinica_id uuid default null,
  p_pessoa_id uuid default null,
  p_destino text default null
) returns public.movimentacoes
language plpgsql security definer set search_path = '' as $$
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_situacao = 'adotado' then
    raise exception 'A adoção é registrada pelo fluxo de adoção.';
  end if;
  if p_tipo not in ('mudanca', 'reentrada') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  return app.mover(p_animal, p_situacao, p_local, p_disponivel, p_data, p_motivo, p_tipo, p_origem,
                   p_clinica_id, p_pessoa_id, p_destino);
end
$$;

-- Adoção e devolução -----------------------------------------------------------

create function public.registrar_adocao(p_animal uuid, p_pessoa uuid, p_data date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.animais;
  v_id uuid;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação registram adoções.');
  perform app.pessoa_ativa(p_pessoa);
  select * into v from public.animais where id = p_animal and excluido_em is null for update;
  if not found then
    raise exception 'Animal não encontrado.';
  end if;
  if v.situacao <> 'em_acolhimento' then
    raise exception 'Só animal em acolhimento pode ser adotado.';
  end if;
  if p_data is null then
    raise exception 'Informe a data da adoção.';
  end if;

  insert into public.adocoes (animal_id, pessoa_id, data_adocao)
  values (v.id, p_pessoa, p_data)
  returning id into v_id;
  update public.pessoas
     set vinculos = array_append(vinculos, 'adotante')
   where id = p_pessoa and not ('adotante' = any (vinculos));
  perform app.mover(v.id, 'adotado', null, false, p_data, null, 'mudanca', null, null, p_pessoa, null);
  return v_id;
end
$$;

create function public.registrar_devolucao(p_adocao uuid, p_data date, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.adocoes;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação registram devoluções.');
  select * into a from public.adocoes where id = p_adocao for update;
  if not found then
    raise exception 'Adoção não encontrada.';
  end if;
  if a.data_devolucao is not null then
    raise exception 'Esta adoção já foi encerrada com devolução.';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da devolução.';
  end if;
  if p_data is null then
    raise exception 'Informe a data da devolução.';
  end if;
  if p_data < a.data_adocao then
    raise exception 'A devolução não pode ser antes da adoção.';
  end if;

  update public.adocoes set data_devolucao = p_data, motivo_devolucao = trim(p_motivo) where id = a.id;
  -- Volta para a sede, ainda não disponível: a equipe decide depois.
  perform app.mover(a.animal_id, 'em_acolhimento', 'sede', false, p_data, trim(p_motivo), 'devolucao', null, null, null, null);
end
$$;

create function public.anexar_termo(p_adocao uuid, p_caminho text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.adocoes;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação anexam o termo de adoção.');
  select * into a from public.adocoes where id = p_adocao for update;
  if not found then
    raise exception 'Adoção não encontrada.';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> a.animal_id::text then
    raise exception 'Arquivo do termo inválido.';
  end if;
  update public.adocoes set termo_caminho = p_caminho where id = a.id;
end
$$;

revoke all on function
  app.exigir_coordenacao(text),
  app.pessoa_ativa(uuid),
  app.gravar_contato(uuid, public.vinculo_pessoa[], text, text, text),
  app.mover(uuid, public.situacao, public.local_animal, boolean, date, text, text, public.origem, uuid, uuid, text)
from public, anon, authenticated;

revoke all on function
  public.cadastrar_pessoa(text, text, public.vinculo_pessoa[], text, text, text),
  public.alterar_pessoa(uuid, text, text, public.vinculo_pessoa[]),
  public.alterar_contato(uuid, text, text, text),
  public.ler_contato(uuid),
  public.exportar_pessoa(uuid),
  public.anonimizar_pessoa(uuid),
  public.mover_animal(uuid, public.situacao, public.local_animal, boolean, date, text, text, public.origem, uuid, uuid, text),
  public.registrar_adocao(uuid, uuid, date),
  public.registrar_devolucao(uuid, date, text),
  public.anexar_termo(uuid, text)
from public, anon;
grant execute on function
  public.cadastrar_pessoa(text, text, public.vinculo_pessoa[], text, text, text),
  public.alterar_pessoa(uuid, text, text, public.vinculo_pessoa[]),
  public.alterar_contato(uuid, text, text, text),
  public.ler_contato(uuid),
  public.exportar_pessoa(uuid),
  public.anonimizar_pessoa(uuid),
  public.mover_animal(uuid, public.situacao, public.local_animal, boolean, date, text, text, public.origem, uuid, uuid, text),
  public.registrar_adocao(uuid, uuid, date),
  public.registrar_devolucao(uuid, date, text),
  public.anexar_termo(uuid, text)
to authenticated;

-- Termo de adoção assinado: balde privado, só administração e coordenação.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('termos', 'termos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy termos_ler on storage.objects for select to authenticated
  using (bucket_id = 'termos' and (select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));
create policy termos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'termos' and (select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));
-- Apagar: na anonimização, o termo (que tem dado pessoal) sai do Storage.
create policy termos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'termos' and (select app.tem_papel(array['admin', 'coordenacao']::public.papel[])));
