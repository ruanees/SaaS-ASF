-- 001 — Fundação: schema app, configurações, usuários, papéis e funções de acesso.
-- Plano, seção 03 (Funções de acesso) e Fase 0.

-- As funções security definer abaixo leem `usuarios` como o dono da migração.
-- Com RLS forçada, isso só funciona se o dono ignorar RLS (BYPASSRLS, como o
-- `postgres` do Supabase). Sem isso, a política de `usuarios` chamaria
-- app.papel(), que leria `usuarios` de novo: recursão. Falha cedo e claro.
do $$
begin
  if not (select rolbypassrls or rolsuper from pg_roles where rolname = current_user) then
    raise exception 'O dono das migrações (%) precisa de BYPASSRLS', current_user;
  end if;
end
$$;

create schema app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

-- Configuração da associação (uma linha só) ---------------------------------

-- Fuso inválido quebraria app.hoje() e toda regra com data.
create function app.fuso_valido(p_fuso text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_fuso)
$$;

create table public.configuracoes (
  id boolean primary key default true check (id),   -- impede uma segunda linha
  nome text not null default 'Associação São Francisco',
  fuso text not null default 'America/Fortaleza',
  retencao_pessoas_meses int not null default 60 check (retencao_pessoas_meses between 1 and 240),
  resumo_diario_email boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check (app.fuso_valido(fuso))
);
insert into public.configuracoes default values;

-- Quem entra no sistema e com que papel --------------------------------------

create type public.papel as enum ('admin', 'coordenacao', 'veterinario', 'voluntario');

create table public.usuarios (
  user_id uuid primary key references auth.users(id) on delete restrict,  -- nunca apagar; desativar
  nome text not null check (length(trim(nome)) > 0),
  papel public.papel not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index usuarios_ativos_papel on public.usuarios (papel) where ativo;

-- Funções de acesso ----------------------------------------------------------

-- Papel de quem chamou. Nulo para anônimo, conta sem linha em `usuarios` ou
-- usuário desativado: nesses casos nenhuma política deixa ler nada.
create function app.papel() returns public.papel
language sql stable security definer set search_path = '' as $$
  select u.papel from public.usuarios u
  where u.user_id = (select auth.uid()) and u.ativo
$$;

create function app.tem_papel(p_papeis public.papel[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.papel() = any(p_papeis), false)
$$;

-- "Hoje" no fuso da associação. Nunca usar current_date em regra de negócio.
create function app.hoje() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone c.fuso)::date from public.configuracoes c
$$;

revoke all on function app.fuso_valido(text) from public, anon;
grant execute on function app.fuso_valido(text) to authenticated;  -- o check roda como quem altera
revoke all on function app.papel(), app.tem_papel(public.papel[]), app.hoje() from public, anon;
grant execute on function app.papel(), app.tem_papel(public.papel[]), app.hoje() to authenticated;

-- A associação nunca fica sem admin ativo ------------------------------------

create function app.manter_um_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.papel = 'admin' and old.ativo
     and not (new.papel = 'admin' and new.ativo)
     and not exists (
       select 1 from public.usuarios u
       where u.papel = 'admin' and u.ativo and u.user_id <> old.user_id
     ) then
    raise exception 'A associação precisa de ao menos um admin ativo.';
  end if;
  return new;
end
$$;

create trigger usuarios_manter_um_admin
  before update of papel, ativo on public.usuarios
  for each row execute function app.manter_um_admin();

-- RLS ------------------------------------------------------------------------

alter table public.configuracoes enable row level security;
alter table public.configuracoes force row level security;

create policy configuracoes_ler on public.configuracoes for select to authenticated
  using ((select app.papel()) is not null);

create policy configuracoes_alterar on public.configuracoes for update to authenticated
  using ((select app.tem_papel(array['admin']::public.papel[])))
  with check ((select app.tem_papel(array['admin']::public.papel[])));

-- Sem política de insert e delete: a linha única nasce nesta migração e não sai.

alter table public.usuarios enable row level security;
alter table public.usuarios force row level security;

-- Todo usuário ativo vê nome e papel dos colegas (aparece em "registrado por").
create policy usuarios_ler on public.usuarios for select to authenticated
  using ((select app.papel()) is not null);

create policy usuarios_criar on public.usuarios for insert to authenticated
  with check ((select app.tem_papel(array['admin']::public.papel[])));

create policy usuarios_alterar on public.usuarios for update to authenticated
  using ((select app.tem_papel(array['admin']::public.papel[])))
  with check ((select app.tem_papel(array['admin']::public.papel[])));

-- Sem política de delete: usuário nunca é apagado, é desativado.

-- Permissões de tabela (a exposição automática está desligada no projeto) ----

revoke all on public.configuracoes, public.usuarios from anon, authenticated;
grant select, update (nome, fuso, retencao_pessoas_meses, resumo_diario_email)
  on public.configuracoes to authenticated;
grant select, insert (user_id, nome, papel, ativo), update (nome, papel, ativo)
  on public.usuarios to authenticated;
