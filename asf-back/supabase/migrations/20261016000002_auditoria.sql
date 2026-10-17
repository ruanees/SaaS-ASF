-- 002 — Carimbo de autoria e tabela de auditoria.
-- Plano, seção 03 (princípio 7 e tabela auditoria) e Fase 0.
--
-- Toda tabela nova recebe os dois triggers:
--   create trigger <t>_carimbar before insert or update on public.<t>
--     for each row execute function app.carimbar();
--   create trigger <t>_auditar after insert or update or delete on public.<t>
--     for each row execute function app.auditar();

-- Carimbo: criado_em/criado_por/atualizado_em/atualizado_por vêm do banco,
-- nunca do cliente. Em update, criado_* não muda mesmo se o cliente mandar.
create function app.carimbar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := (select auth.uid());
  else
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;
  new.atualizado_em := now();
  new.atualizado_por := (select auth.uid());
  return new;
end
$$;

-- Auditoria: só acrescenta. Guarda quais campos mudaram, nunca os valores:
-- copiar telefone ou endereço para cá criaria uma cópia que a anonimização
-- não alcança.
create table public.auditoria (
  id bigint generated always as identity primary key,
  user_id uuid,
  tabela text not null,
  registro_id uuid,
  operacao text not null
    check (operacao in ('insert', 'update', 'delete', 'leitura_sensivel', 'exportacao')),
  campos_alterados text[],
  em timestamptz not null default now()
);
create index auditoria_em on public.auditoria (em desc);
create index auditoria_registro on public.auditoria (tabela, registro_id);

create function app.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_linha jsonb := coalesce(v_depois, v_antes);
  v_id text := coalesce(v_linha ->> 'id', v_linha ->> 'user_id', v_linha ->> 'atendimento_id', v_linha ->> 'pessoa_id');
  v_campos text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_campos
    from jsonb_object_keys(v_depois) k
    where k not in ('atualizado_em', 'atualizado_por')
      and (v_antes -> k) is distinct from (v_depois -> k);
    if v_campos is null then
      return null;  -- update sem mudança real não gera linha
    end if;
  end if;

  insert into public.auditoria (user_id, tabela, registro_id, operacao, campos_alterados)
  values (
    (select auth.uid()),
    tg_table_name,
    case when v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_id::uuid end,
    lower(tg_op),
    v_campos
  );
  return null;
end
$$;

-- Registro de leitura sensível e exportação (usado a partir da Fase 4).
create function app.registrar_acesso(p_tabela text, p_registro uuid, p_operacao text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_operacao not in ('leitura_sensivel', 'exportacao') then
    raise exception 'Operação de acesso inválida.';
  end if;
  insert into public.auditoria (user_id, tabela, registro_id, operacao)
  values ((select auth.uid()), p_tabela, p_registro, p_operacao);
end
$$;

revoke all on function app.carimbar(), app.auditar() from public, anon, authenticated;
revoke all on function app.registrar_acesso(text, uuid, text) from public, anon;
grant execute on function app.registrar_acesso(text, uuid, text) to authenticated;

alter table public.auditoria enable row level security;
alter table public.auditoria force row level security;

create policy auditoria_ler on public.auditoria for select to authenticated
  using ((select app.tem_papel(array['admin']::public.papel[])));

-- Ninguém grava, altera ou apaga direto: só os triggers e app.registrar_acesso.
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

-- Triggers nas tabelas da migração 001 ---------------------------------------

create trigger configuracoes_carimbar before insert or update on public.configuracoes
  for each row execute function app.carimbar();
create trigger configuracoes_auditar after insert or update or delete on public.configuracoes
  for each row execute function app.auditar();

create trigger usuarios_carimbar before insert or update on public.usuarios
  for each row execute function app.carimbar();
create trigger usuarios_auditar after insert or update or delete on public.usuarios
  for each row execute function app.auditar();
