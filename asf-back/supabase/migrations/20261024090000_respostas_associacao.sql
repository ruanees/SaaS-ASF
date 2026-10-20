-- 015 — Respostas da associação ao questionário (20/10/2026). ADR 0013.
--
-- 1. Vacinas de gato: V4 (a de rotina) e V5 (rara); antirrábica já existia.
-- 2. Animal: raça e cor da pelagem, que o termo de adoção pede.
-- 3. Contato da pessoa: CPF, RG (pedido para lar temporário; o termo de adoção
--    pede os dois) e profissão (termo de adoção). Só admin e coordenação leem.
-- 4. Devolução à comunidade exige o bairro ou a rua (pergunta 18).
-- 5. Óbito de animal adotado: o acompanhamento vai até o fim da vida (pergunta 15).
-- 6. Prazo de guarda: o vínculo do adotante dura enquanto o animal adotado viver;
--    os 60 meses contam depois do óbito ou da devolução (pergunta 14).
-- 7. Acompanhamento pós-adoção (visita, WhatsApp, ligação).
-- 8. Relatório social do período (Sua Nota Tem Valor, SEFAZ-CE): o que a
--    associação fez, mês a mês, sem dado pessoal.

-- 1. Vacinas de gato ---------------------------------------------------------------
insert into public.vacinas_tipos (nome, especie, reforco_dias, doses_iniciais, intervalo_inicial_dias) values
  ('V4', 'gato', 365, 3, 21),
  ('V5', 'gato', 365, 3, 21)
on conflict ((lower(trim(nome))), especie) do nothing;

-- 2. Raça e pelagem ------------------------------------------------------------------
alter table public.animais
  add column raca text check (raca is null or length(trim(raca)) between 1 and 60),
  add column pelagem text check (pelagem is null or length(trim(pelagem)) between 1 and 60);
grant update (raca, pelagem) on public.animais to authenticated;

-- 3. CPF, RG e profissão no contato -------------------------------------------------
alter table public.pessoas_contato
  add column cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  add column rg text check (rg is null or length(rg) between 3 and 30),
  add column profissao text check (profissao is null or length(profissao) <= 80);

-- Confere os dois dígitos verificadores (evita CPF digitado errado).
create function app.cpf_valido(p_cpf text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  d int[];
  s int;
  r int;
  i int;
begin
  if p_cpf is null or p_cpf !~ '^[0-9]{11}$' or p_cpf ~ '^([0-9])\1{10}$' then
    return false;
  end if;
  select array_agg(substr(p_cpf, g, 1)::int order by g) into d from generate_series(1, 11) g;
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  return r = d[11];
end
$$;

drop function public.cadastrar_pessoa(text, text, public.vinculo_pessoa[], text, text, text);
drop function public.alterar_contato(uuid, text, text, text);
drop function public.ler_contato(uuid);
drop function app.gravar_contato(uuid, public.vinculo_pessoa[], text, text, text);

create function app.gravar_contato(
  p_pessoa uuid, p_vinculos public.vinculo_pessoa[],
  p_telefone text, p_email text, p_endereco text,
  p_cpf text, p_rg text, p_profissao text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_telefone text := nullif(trim(p_telefone), '');
  v_email text := lower(nullif(trim(p_email), ''));
  v_endereco text := nullif(trim(p_endereco), '');
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '');
  v_rg text := nullif(trim(p_rg), '');
  v_profissao text := nullif(trim(p_profissao), '');
begin
  -- Minimização: endereço e documentos só para quem fica com o animal.
  if (v_endereco is not null or v_cpf is not null or v_rg is not null)
     and not (p_vinculos && array['adotante', 'lar_temporario']::public.vinculo_pessoa[]) then
    raise exception 'Endereço e documentos só são pedidos para adotante e lar temporário.';
  end if;
  if v_cpf is not null and not app.cpf_valido(v_cpf) then
    raise exception 'CPF inválido. Confira os números.';
  end if;
  if v_telefone is null and v_email is null and v_endereco is null
     and v_cpf is null and v_rg is null and v_profissao is null then
    delete from public.pessoas_contato where pessoa_id = p_pessoa;
    return;
  end if;
  insert into public.pessoas_contato (pessoa_id, telefone, email, endereco, cpf, rg, profissao)
  values (p_pessoa, v_telefone, v_email, v_endereco, v_cpf, v_rg, v_profissao)
  on conflict (pessoa_id) do update
    set telefone = excluded.telefone, email = excluded.email, endereco = excluded.endereco,
        cpf = excluded.cpf, rg = excluded.rg, profissao = excluded.profissao;
end
$$;

create function public.cadastrar_pessoa(
  p_nome text,
  p_base_legal text,
  p_vinculos public.vinculo_pessoa[],
  p_telefone text default null,
  p_email text default null,
  p_endereco text default null,
  p_cpf text default null,
  p_rg text default null,
  p_profissao text default null
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
  perform app.gravar_contato(v_id, p_vinculos, p_telefone, p_email, p_endereco, p_cpf, p_rg, p_profissao);
  return v_id;
end
$$;

create function public.alterar_contato(
  p_pessoa uuid,
  p_telefone text,
  p_email text,
  p_endereco text,
  p_cpf text default null,
  p_rg text default null,
  p_profissao text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.pessoas;
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação alteram o contato das pessoas.');
  p := app.pessoa_ativa(p_pessoa);
  perform app.gravar_contato(p.id, p.vinculos, p_telefone, p_email, p_endereco, p_cpf, p_rg, p_profissao);
end
$$;

create function public.ler_contato(p_pessoa uuid)
returns table (telefone text, email text, endereco text, cpf text, rg text, profissao text)
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação veem o contato das pessoas.');
  if not exists (select 1 from public.pessoas where id = p_pessoa) then
    raise exception 'Pessoa não encontrada.';
  end if;
  perform app.registrar_acesso('pessoas_contato', p_pessoa, 'leitura_sensivel');
  return query
    select c.telefone, c.email, c.endereco, c.cpf, c.rg, c.profissao
    from public.pessoas_contato c where c.pessoa_id = p_pessoa;
end
$$;

revoke all on function
  app.cpf_valido(text),
  app.gravar_contato(uuid, public.vinculo_pessoa[], text, text, text, text, text, text)
from public, anon, authenticated;
revoke all on function
  public.cadastrar_pessoa(text, text, public.vinculo_pessoa[], text, text, text, text, text, text),
  public.alterar_contato(uuid, text, text, text, text, text, text),
  public.ler_contato(uuid)
from public, anon;
grant execute on function
  public.cadastrar_pessoa(text, text, public.vinculo_pessoa[], text, text, text, text, text, text),
  public.alterar_contato(uuid, text, text, text, text, text, text),
  public.ler_contato(uuid)
to authenticated;

-- 4 e 5. Movimentação: bairro na devolução à comunidade; óbito de adotado -----------
create or replace function app.mover(
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
    -- Animal adotado só muda pela devolução; o óbito dele é registrado aqui
    -- (acompanhamento até o fim da vida, pergunta 15 do questionário).
    if v.situacao = 'adotado' and p_situacao <> 'obito' then
      raise exception 'Animal adotado volta pela devolução, na aba Adoção.';
    end if;
    if v.situacao not in ('em_acolhimento', 'adotado') then
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
  -- Pergunta 18: a associação quer o bairro ou a rua onde o animal foi solto.
  if p_situacao = 'devolvido_comunidade' and v_destino is null then
    raise exception 'Informe o bairro ou a rua onde o animal foi solto.';
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

-- 7. Acompanhamento pós-adoção ------------------------------------------------------
create table public.acompanhamentos (
  id uuid primary key default gen_random_uuid(),
  adocao_id uuid not null references public.adocoes(id),
  data date not null,
  forma text not null check (forma in ('visita', 'whatsapp', 'ligacao', 'outro')),
  observacoes text check (observacoes is null or length(observacoes) <= 1000),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index acompanhamentos_adocao on public.acompanhamentos (adocao_id, data desc);

create trigger acompanhamentos_carimbar before insert or update on public.acompanhamentos
  for each row execute function app.carimbar();
create trigger acompanhamentos_auditar after insert or update or delete on public.acompanhamentos
  for each row execute function app.auditar();

alter table public.acompanhamentos enable row level security;
alter table public.acompanhamentos force row level security;
create policy acompanhamentos_ler on public.acompanhamentos for select to authenticated
  using ((select app.papel()) is not null);
revoke all on public.acompanhamentos from anon, authenticated;
grant select on public.acompanhamentos to authenticated;

-- Qualquer papel registra (visita e WhatsApp costumam ser de quem está na rua).
create function public.registrar_acompanhamento(
  p_adocao uuid, p_data date, p_forma text, p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.adocoes;
  v_id uuid;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  select * into a from public.adocoes where id = p_adocao;
  if not found then
    raise exception 'Adoção não encontrada.';
  end if;
  if p_forma is null or p_forma not in ('visita', 'whatsapp', 'ligacao', 'outro') then
    raise exception 'Escolha como foi o acompanhamento.';
  end if;
  if p_data is null then
    raise exception 'Informe a data.';
  end if;
  if p_data > app.hoje() then
    raise exception 'A data não pode ser no futuro.';
  end if;
  if p_data < a.data_adocao or (a.data_devolucao is not null and p_data > a.data_devolucao) then
    raise exception 'O acompanhamento precisa ser entre a adoção e a devolução.';
  end if;
  insert into public.acompanhamentos (adocao_id, data, forma, observacoes)
  values (a.id, p_data, p_forma, nullif(trim(p_observacoes), ''))
  returning id into v_id;
  return v_id;
end
$$;

-- Anonimizar também limpa as observações dos acompanhamentos (podem citar a pessoa).
create or replace function public.anonimizar_pessoa(p_pessoa uuid) returns text[]
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
  update public.acompanhamentos set observacoes = null
   where observacoes is not null and adocao_id in (select id from public.adocoes where pessoa_id = p.id);
  delete from public.pessoas_contato where pessoa_id = p.id;
  update public.pessoas set nome = 'Pessoa anonimizada', anonimizado_em = now() where id = p.id;
  return v_termos;
end
$$;

-- Exportação do titular com os campos novos e os acompanhamentos.
create or replace function public.exportar_pessoa(p_pessoa uuid) returns jsonb
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
      select jsonb_build_object('telefone', c.telefone, 'email', c.email, 'endereco', c.endereco,
                                'cpf', c.cpf, 'rg', c.rg, 'profissao', c.profissao)
      from public.pessoas_contato c where c.pessoa_id = p.id
    ),
    'adocoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'animal', an.numero, 'nome_do_animal', an.nome, 'data_adocao', a.data_adocao,
        'data_devolucao', a.data_devolucao, 'motivo_devolucao', a.motivo_devolucao,
        'termo_anexado', a.termo_caminho is not null,
        'acompanhamentos', coalesce((
          select jsonb_agg(jsonb_build_object('data', ac.data, 'forma', ac.forma, 'observacoes', ac.observacoes) order by ac.data)
          from public.acompanhamentos ac where ac.adocao_id = a.id
        ), '[]'::jsonb)
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

-- 6. Prazo de guarda: adotante de animal vivo nunca entra; o prazo conta do
-- último evento, que agora inclui o óbito do animal adotado e o último
-- acompanhamento (ADR 0013).
create or replace function public.pessoas_alem_do_prazo()
returns table (id uuid, nome text, vinculos public.vinculo_pessoa[], ultimo_evento date, venceu_em date)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação veem o prazo de guarda.');
  return query
  with conf as (select c.retencao_pessoas_meses as meses from public.configuracoes c),
  ultimo as (
    select p.id, p.nome, p.vinculos,
      greatest(
        app.hoje_em(p.criado_em),
        (select max(greatest(a.data_adocao, coalesce(a.data_devolucao, a.data_adocao)))
           from public.adocoes a where a.pessoa_id = p.id),
        (select max(m.data) from public.movimentacoes m where m.pessoa_id = p.id),
        (select max(m.data) from public.movimentacoes m
           join public.adocoes a on a.animal_id = m.animal_id
          where a.pessoa_id = p.id and a.data_devolucao is null and m.situacao = 'obito'),
        (select max(ac.data) from public.acompanhamentos ac
           join public.adocoes a on a.id = ac.adocao_id where a.pessoa_id = p.id)
      ) as evento
    from public.pessoas p
    where p.anonimizado_em is null
      and not exists (select 1 from public.animais an where an.pessoa_id = p.id and an.excluido_em is null)
      -- Vínculo ativo: adoção sem devolução de animal que ainda vive.
      and not exists (
        select 1 from public.adocoes a join public.animais an on an.id = a.animal_id
        where a.pessoa_id = p.id and a.data_devolucao is null and an.situacao <> 'obito'
      )
  )
  select u.id, u.nome, u.vinculos, u.evento, (u.evento + make_interval(months => conf.meses))::date
  from ultimo u cross join conf
  where (u.evento + make_interval(months => conf.meses))::date <= app.hoje()
  order by u.evento, u.nome;
end
$$;

-- 8. Relatório social do período ------------------------------------------------------
-- Uma linha por mês e uma linha de total (mes nulo). "Animais atendidos" conta
-- cada animal uma vez no mês e uma vez no total. Animal excluído não conta.
create function public.relatorio_social(p_de date, p_ate date)
returns table (
  mes date, animais_atendidos int, entradas int, adocoes int, castracoes int, vacinas int,
  vermifugacoes int, antiparasitarios int, atendimentos_clinicos int, devolvidos_comunidade int, obitos int
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'Período inválido.';
  end if;
  if p_ate > p_de + interval '5 years' then
    raise exception 'O período pode ter no máximo 5 anos.';
  end if;
  return query
  with ev as (
    select m.animal_id as animal, m.data as dia, 'entrada'::text as t
      from public.movimentacoes m where m.tipo in ('entrada', 'reentrada') and m.data between p_de and p_ate
    union all
    select m.animal_id, m.data, 'comunidade'
      from public.movimentacoes m where m.situacao = 'devolvido_comunidade' and m.data between p_de and p_ate
    union all
    select a.animal_id, a.data_adocao, 'adocao'
      from public.adocoes a where a.data_adocao between p_de and p_ate
    union all
    select at.animal_id, at.data,
           case when at.tipo in ('consulta', 'retorno', 'exame', 'teste', 'tratamento', 'internacao')
                then 'clinico' else at.tipo::text end
      from public.atendimentos at where at.data between p_de and p_ate
  ),
  e as (
    select ev.* from ev join public.animais an on an.id = ev.animal where an.excluido_em is null
  ),
  meses as (
    select generate_series(date_trunc('month', p_de), date_trunc('month', p_ate), interval '1 month')::date as m
  ),
  por_mes as (
    select ms.m,
      count(distinct e.animal)::int as atend,
      count(e.animal) filter (where e.t = 'entrada')::int as ent,
      count(e.animal) filter (where e.t = 'adocao')::int as ado,
      count(e.animal) filter (where e.t = 'castracao')::int as cas,
      count(e.animal) filter (where e.t = 'vacina')::int as vac,
      count(e.animal) filter (where e.t = 'vermifugacao')::int as ver,
      count(e.animal) filter (where e.t = 'antiparasitario')::int as ant,
      count(e.animal) filter (where e.t = 'clinico')::int as cli,
      count(e.animal) filter (where e.t = 'comunidade')::int as com,
      count(e.animal) filter (where e.t = 'obito')::int as obi
    from meses ms
    left join e on date_trunc('month', e.dia)::date = ms.m
    group by ms.m
  ),
  total as (
    select null::date as m,
      count(distinct e.animal)::int as atend,
      count(*) filter (where e.t = 'entrada')::int as ent,
      count(*) filter (where e.t = 'adocao')::int as ado,
      count(*) filter (where e.t = 'castracao')::int as cas,
      count(*) filter (where e.t = 'vacina')::int as vac,
      count(*) filter (where e.t = 'vermifugacao')::int as ver,
      count(*) filter (where e.t = 'antiparasitario')::int as ant,
      count(*) filter (where e.t = 'clinico')::int as cli,
      count(*) filter (where e.t = 'comunidade')::int as com,
      count(*) filter (where e.t = 'obito')::int as obi
    from e
  )
  select * from por_mes
  union all
  select * from total
  order by 1 nulls last;
end
$$;

revoke all on function
  public.registrar_acompanhamento(uuid, date, text, text),
  public.relatorio_social(date, date)
from public, anon;
grant execute on function
  public.registrar_acompanhamento(uuid, date, text, text),
  public.relatorio_social(date, date)
to authenticated;
