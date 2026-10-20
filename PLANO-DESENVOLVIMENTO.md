# Plano de desenvolvimento — Sistema da Associação São Francisco

> Plano vivo. É a referência do projeto para quem escreve código, humano ou agente.
> Cada fase tem uma lista do que precisa estar pronto, os casos de borda e as armadilhas conhecidas. Uma fase só começa quando a anterior estiver fechada.
> As decisões de arquitetura têm registro próprio em `docs/adr/` (ver seção 10).
> Repositórios: `asf-front` e `asf-back` (ASF = Associação São Francisco). Por enquanto, as duas são pastas independentes dentro de um repositório só, `SaaS-ASF`, separáveis depois (ADR 0009).

O sistema cadastra, organiza e acompanha os animais atendidos pela **Associação São Francisco**. Ele guarda o histórico de cada animal, controla vacinação, castração e atendimento veterinário, registra adoções e devoluções e gera indicadores para a gestão.

É um **sistema interno**: uma associação só, e só as pessoas que ela convida entram. Não há cadastro aberto, página pública nem outras associações. Isso simplifica o banco (não existe separação por organização) e não diminui o cuidado com segurança: o sistema guarda contato e endereço de adotantes.

---

## 00 — Mapa do briefing: onde cada item entra

| Item do briefing | Fase |
|---|---|
| Número de identificação, nome, espécie, sexo, idade aproximada, porte | 1 |
| Foto do animal | 1 |
| Data de entrada e origem (resgate, castração, comunitário, outra) | 1 |
| Situação e localização: sede, clínica ou internado, disponível para adoção, óbito | 1 |
| Controle de vacinação: vacinado ou não, tipo, data, próxima dose | 2 |
| Controle de castração: castrado ou não, agendada, data | 2 |
| Vermifugação | 2 |
| Consultas, exames e resultados, diagnósticos | 3 |
| Testes de leishmaniose (calazar) e outros testes | 3 |
| Medicamentos e tratamentos, internações e retornos | 3 |
| Datas e observações de cada atendimento | 3 |
| Situação: lar temporário, adotado, transferido, castrado e devolvido à comunidade | 4 |
| Cadastro de adoções e devoluções: adotante, contato, endereço, data | 4 |
| Os onze indicadores (total, cães e gatos, machos e fêmeas, vacinação, castração, disponíveis, na sede, em lar temporário, em tratamento, adoções, devolvidos à comunidade) | 5 |
| Relatórios e exportação | 5 |
| LGPD: direitos do titular, retenção, anonimização | 0 (base), 4 (pessoas), 6 (operação) |
| Segurança | 0 (base), em todas as fases, 6 (revisão final) |

**Por que a situação está dividida entre as Fases 1 e 4.** Quatro das oito situações dependem de uma pessoa: lar temporário, adotado, transferido e devolvido à comunidade (quem devolve e onde). Cadastro de pessoa é o dado mais sensível do sistema, e ele só entra com a LGPD aplicada a ele (Fase 4). Na Fase 1 essas quatro opções aparecem apagadas, com o selo "em breve", e não ficam clicáveis. Uma opção que existe na tela e falha ao salvar parece sistema quebrado.

**Por que vacina e castração estão separadas do histórico veterinário.** O cliente pediu as duas como controles próprios, com situação (vacinado, pendente, agendada). Elas são as que mais geram trabalho no dia a dia. Por isso vêm antes. Mas as duas são gravadas na **mesma linha do tempo** do histórico veterinário (ver seção 03). Não existem duas fontes para "este animal foi vacinado".

---

## 01 — Requisitos não funcionais

Os números abaixo são estimativas de direção, não medições. Eles existem para justificar o que **não** vai ser construído.

| Requisito | Estimativa ou meta | O que isso decide |
|---|---|---|
| Volume | de centenas a poucos milhares de animais; até 50 usuários | Postgres simples dá conta; sem fila, sem Redis, sem réplica de leitura |
| Quem usa | só a Associação São Francisco, por convite | sem multi-organização, sem cadastro aberto, sem cobrança |
| Uso | celular na sede e na clínica, conexão ruim | telas leves, envio de foto reduzido no aparelho, formulário que não perde o que foi digitado |
| Disponibilidade | horário comercial e plantões; queda curta é tolerável | sem multi-região; backup diário e restauração testada |
| Tempo de resposta | lista e ficha abaixo de 1 s no celular em 4G | paginação e índices; sem consulta que percorre a tabela inteira |
| Custo | o menor possível; associação voluntária | Cloudflare no plano gratuito; Supabase pago em produção por causa do backup (ver Riscos) |
| Conectividade | o sistema é **online** | uso sem internet fica fora; reavaliar depois da Fase 6 |

---

## 02 — Arquitetura

### Pilha

| Camada | Tecnologia | Onde roda |
|---|---|---|
| Front | Next.js (App Router), TypeScript | Cloudflare Workers, pelo adaptador `@opennextjs/cloudflare` |
| Back (BFF) | NestJS, TypeScript | Cloudflare Workers, com `nodejs_compat` |
| Rotinas agendadas | Cron Triggers do Worker do back | Cloudflare Workers |
| Banco | Postgres do Supabase, com RLS | Supabase, região São Paulo (`sa-east-1`) |
| Autenticação | Supabase Auth, cadastro público desligado | Supabase |
| Arquivos | Supabase Storage, baldes privados | Supabase |
| E-mail transacional | SMTP próprio no Supabase Auth (Resend ou Cloudflare Email Sending) | externo |
| Monitoramento de erros | Sentry (`@sentry/nextjs` e `@sentry/cloudflare`), com dado pessoal filtrado | externo |
| Proteção de borda | WAF, limite de requisições, Turnstile; Cloudflare Access opcional (ver seção 05) | Cloudflare |

As conexões com Supabase e Cloudflare ficam para quando os repositórios existirem. Este plano define a estrutura. A configuração vem depois.

### Decisão: quem manda na regra de acesso é o banco (ADR 0002)

```
                     ┌──────────────────────────── Cloudflare ─────────────────────────────┐
Navegador ──HTTPS──> │ asf-front (Next.js) ──REST + JWT──> asf-back (NestJS, BFF)          │
    │                │                                      │  DTO, validação, cache         │
    │                │                                      │  Cron: lembretes, retenção     │
    │                └──────────────────────────────────────┼────────────────────────────────┘
    │                                                       │ supabase-js com o JWT de quem pediu
    │                ┌──────────────────────────── Supabase ▼────────────────────────────────┐
    └─ só bytes de ─>│ Storage (baldes privados)    Postgres: RLS + funções security definer │
       arquivo, com  │                              Auth (convite, MFA, e-mail via SMTP)     │
       URL assinada  │                              Edge Function admin (única service_role) │
                     └───────────────────────────────────────────────────────────────────────┘
```

- **O Nest não usa `service_role`.** Ele recebe o JWT da sessão do usuário e repassa para o Supabase com a chave anônima. Quem decide o que cada pessoa vê é a RLS no Postgres.
- **Uma regra de acesso existe em um lugar só.** Se ela estiver no banco e também no Nest, as duas se desencontram sem erro nenhum. O Nest valida formato (DTO). O banco valida permissão.
- **Escrita que mexe em mais de uma tabela é uma função no banco** (por exemplo `registrar_adocao`), chamada por RPC. O Nest não abre transação em várias chamadas: uma falha no meio deixaria a adoção gravada e o animal ainda "em acolhimento".
- **O front nunca fala com o Supabase para ler ou gravar dado.** A única exceção é o envio de arquivo: o servidor confere e devolve uma URL assinada, e os bytes vão do navegador direto ao Storage.
- **A `service_role` só existe dentro de uma Edge Function do Supabase**, para convidar e desativar usuários. Nunca no Nest, nunca no front, nunca no repositório.

**O custo dessa escolha, escrito para não ser esquecido:** o BFF é um salto a mais em cada requisição e um segundo serviço para publicar. Para um sistema interno deste tamanho, o front poderia falar direto com o Supabase. O Nest fica porque ele dá o contrato tipado (OpenAPI), tira toda credencial do navegador, concentra as rotinas agendadas e o envio de e-mail, e segue o desenho que o projeto DIME já testou em produção. Se um dia ele virar só repasse sem valor, a decisão se reabre no ADR 0002.

### Módulos do back e o que cada um possui

| Módulo | Possui | Fala com |
|---|---|---|
| `auth` | sessão (entrar, renovar, recuperar senha) | Supabase Auth |
| `usuarios` | `usuarios` (papel e situação de cada pessoa que entra), convites | Edge Function admin |
| `configuracoes` | `configuracoes` (fuso, prazo de retenção, catálogo de vacinas, clínicas) | — |
| `animais` | `animais`, `animal_fotos`, `movimentacoes`, `clinicas` | Storage |
| `saude` | `vacinas_tipos`, `vacinacoes`, `vermifugacoes`, `castracoes` | `prontuario` (mesma linha do tempo) |
| `prontuario` | `atendimentos`, `exames`, `tratamentos`, `internacoes` | Storage (laudos) |
| `pessoas` | `pessoas`, `pessoas_contato` | `auditoria` |
| `adocoes` | `adocoes` | `animais` (pela função `mover_animal`) |
| `indicadores` | nada; só lê views | todas as views |
| `lgpd` | exportação do titular, anonimização, retenção | `pessoas`, `auditoria` |
| `rotinas` | nada; agenda chamadas | `saude`, `lgpd` |

### Rotinas agendadas (Cron Triggers)

| Rotina | Quando | O que faz | Se falhar |
|---|---|---|---|
| Pendências de saúde | diária, 6h | envia por e-mail à coordenação o resumo do que a view já calcula, se a associação ligar | e-mail não sai; a tela de Pendências continua certa, porque não depende da rotina |
| Retenção LGPD | semanal | lista pessoas além do prazo e cria aviso para a coordenação aprovar | aviso atrasa uma semana; nada é anonimizado sem aprovação |
| Arquivos órfãos | semanal | apaga do Storage arquivos sem linha no banco há mais de 24 h (envio interrompido) | sobra arquivo no balde; sem efeito para o usuário |
| Conferência de backup | semanal | confere que o último backup existe e avisa se não | alerta no Sentry |

Toda rotina é **repetível**: rodar duas vezes não duplica nada.

### Contrato entre front e back

O DTO do Nest é a fonte da verdade. `@nestjs/swagger` gera o `/openapi.json`. O front roda `openapi-typescript` contra ele no build. Se o DTO mudar e o front não acompanhar, o build quebra. O erro aparece antes do deploy, não em produção.

---

## 03 — Banco de dados

### Princípios

1. **Uma associação só, sem `org_id`** (ADR 0005). Separar por organização num sistema que nunca vai ter outra é uma coluna a mais em toda tabela, em toda política e em toda consulta, que só serve para errar.
2. **RLS ligada e forçada em toda tabela**, mesmo sem organizações. Ela é quem separa os papéis (o voluntário não lê contato de adotante) e quem impede que alguém sem convite leia qualquer coisa.
3. **Tabelas relacionais, não documento `jsonb`.** Os indicadores precisam de contagem por espécie, sexo, situação e vacina. Isso é consulta SQL simples sobre colunas.
4. **Estado que pode ser calculado não é gravado.** "Vacinado", "vacinação pendente", "castrado" e "idade" saem de consulta. Se forem gravados num campo, esse campo vai discordar do histórico um dia, e ninguém vai perceber.
5. **Enums no banco para listas fechadas** (espécie, sexo, porte, origem, situação). Texto livre vira "Cão", "cachorro" e "cao" na mesma coluna.
6. **Nada se apaga de verdade, exceto dado pessoal.** Animal sai com `excluido_em` (exclusão lógica). Pessoa é anonimizada quando a LGPD exige (seção 04).
7. **Toda tabela tem `criado_em`, `criado_por`, `atualizado_em`, `atualizado_por`**, preenchidos por trigger, não pelo cliente.
8. **IDs são `uuid`.** O número que a associação usa (`2026-0042`) é outro campo, gerado pelo banco.
9. **"Hoje" é o dia em Fortaleza, não o do servidor.** O servidor roda em UTC: às 22h em Fortaleza já é o dia seguinte. Toda regra com data (vacina vencida, castração da semana) usa `app.hoje()`, que converte `now()` pelo fuso gravado em `configuracoes`.
10. **View que expõe dado de tabela com RLS é criada com `security_invoker = true`.** Sem isso a view roda com a permissão de quem a criou e ignora a RLS de quem consulta.
11. **Toda coluna usada em filtro de lista ou em junção frequente tem índice.**

### Situação e localização são duas coisas (ADR 0003)

O briefing lista oito opções numa lista só. Mas um animal pode estar **disponível para adoção e em lar temporário** ao mesmo tempo. Se as oito forem um campo só, os indicadores "disponíveis para adoção" e "em lares temporários" passam a contar errado: cada animal só entra em um dos dois.

Por isso o banco guarda três colunas, e a tela mostra as opções do jeito que o cliente pediu:

| Coluna | Valores | Quando se aplica |
|---|---|---|
| `situacao` | `em_acolhimento`, `adotado`, `devolvido_comunidade`, `transferido`, `obito` | sempre |
| `local` | `sede`, `lar_temporario`, `clinica` | só quando `em_acolhimento` |
| `disponivel_adocao` | `true` / `false` | só quando `em_acolhimento` |

Uma `check constraint` garante a combinação: animal adotado não tem `local`, animal em óbito não está disponível.

Toda mudança gera uma linha em `movimentacoes`. A coluna no `animais` é o estado atual. A tabela `movimentacoes` é o histórico. As duas são escritas **pela mesma função no banco** (`mover_animal`), nunca separadamente. O `update` direto nessas três colunas é revogado do papel da aplicação.

**Situações finais são controladas pelo módulo dono delas.** `adotado` só existe criando uma adoção (Fase 4). `obito` exige data. A devolução de uma adoção volta o animal para `em_acolhimento`. A tela não grava `situacao = 'adotado'` direto.

### Reentrada

Um animal comunitário castrado e devolvido pode voltar meses depois para outro atendimento. Um adotado pode ser devolvido. **Ele continua sendo o mesmo cadastro, com o mesmo número.** A volta é uma movimentação do tipo `reentrada`, com sua própria origem. `animais.data_entrada` e `animais.origem` guardam a primeira entrada; as seguintes ficam em `movimentacoes`. Cadastrar de novo criaria dois prontuários para o mesmo animal, e a vacina de um não apareceria no outro.

Para evitar o cadastro duplicado, o formulário de novo animal busca por nome, espécie e sexo parecidos e mostra os candidatos antes de salvar.

### Uma linha do tempo para o prontuário (ADR 0004)

Vacina, vermifugação, castração, consulta, exame, teste, tratamento, internação, retorno e óbito são todos `atendimentos`. Cada tipo que tem dados próprios ganha uma tabela de detalhe ligada 1:1 ao atendimento. A aba Saúde (Fase 2) e a aba Prontuário (Fase 3) leem a mesma tabela. A castração é a exceção parcial: o **agendamento** existe antes de haver atendimento, então ela tem tabela própria que aponta para o atendimento quando é realizada.

### Contato da pessoa mora numa tabela separada (ADR 0006)

A RLS do Postgres decide **linhas**, não colunas. O voluntário precisa ver o nome de quem está com o animal em lar temporário, mas não o telefone nem o endereço. Por isso:

- `pessoas` guarda o nome e o vínculo; todos os papéis leem.
- `pessoas_contato` (1:1) guarda telefone, e-mail e endereço; só admin e coordenação leem.

Uma view com `security definer` escondendo colunas também resolveria, mas é um furo esperando acontecer: basta um `select` direto na tabela original com uma política mal escrita.

### Esquema (esboço para as migrações)

```sql
create schema app;

-- Configuração da associação (uma linha só)
create table configuracoes (
  id boolean primary key default true check (id),   -- impede uma segunda linha
  nome text not null default 'Associação São Francisco',
  fuso text not null default 'America/Fortaleza',
  retencao_pessoas_meses int not null default 60,
  resumo_diario_email boolean not null default false
);
insert into configuracoes default values;

-- Quem entra no sistema e com que papel
create type papel as enum ('admin', 'coordenacao', 'veterinario', 'voluntario');

create table usuarios (
  user_id uuid primary key references auth.users(id),
  nome text not null,
  papel papel not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Animais
create type especie as enum ('cao', 'gato');
create type sexo as enum ('macho', 'femea');
create type porte as enum ('pequeno', 'medio', 'grande');
create type origem as enum ('resgate', 'castracao', 'comunitario', 'outra');
create type situacao as enum ('em_acolhimento', 'adotado', 'devolvido_comunidade', 'transferido', 'obito');
create type local_animal as enum ('sede', 'lar_temporario', 'clinica');

create table animais (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,                -- '2026-0042', gerado por trigger, imutável
  nome text,                                  -- pode não ter nome na entrada
  especie especie not null,
  sexo sexo not null,
  nascimento_estimado date,                   -- a idade é calculada, nunca gravada
  idade_precisao text check (idade_precisao in ('exata', 'aproximada')),
  porte porte,
  data_entrada date not null,                 -- primeira entrada
  origem origem not null,                     -- origem da primeira entrada
  origem_detalhe text,
  situacao situacao not null default 'em_acolhimento',
  local local_animal,
  disponivel_adocao boolean not null default false,
  observacoes text,
  excluido_em timestamptz,
  check (origem <> 'outra' or origem_detalhe is not null),
  check (
    (situacao = 'em_acolhimento' and local is not null)
    or (situacao <> 'em_acolhimento' and local is null and not disponivel_adocao)
  )
);
create index on animais (situacao, local) where excluido_em is null;
create index on animais (especie, sexo) where excluido_em is null;

create table numeracao (                      -- contador do número por ano
  ano int primary key,
  ultimo int not null default 0
);

create table animal_fotos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animais(id),
  caminho text not null,                      -- '{animal_id}/{uuid}.webp'
  principal boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index on animal_fotos (animal_id) where principal;

create table clinicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true
);

create table movimentacoes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animais(id),
  tipo text not null check (tipo in ('mudanca', 'reentrada')),
  origem origem,                              -- só na reentrada
  situacao situacao not null,
  local local_animal,
  disponivel_adocao boolean not null,
  pessoa_id uuid,                             -- lar temporário, adotante ou destino (Fase 4)
  clinica_id uuid references clinicas(id),
  data date not null,
  motivo text,
  criado_em timestamptz not null default now()
);
create index on movimentacoes (animal_id, data desc, criado_em desc);

-- Prontuário: uma linha do tempo, detalhes por tipo
create type tipo_atendimento as enum (
  'consulta', 'exame', 'teste', 'vacina', 'vermifugacao',
  'castracao', 'tratamento', 'internacao', 'retorno', 'obito'
);

create table atendimentos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animais(id),
  tipo tipo_atendimento not null,
  data date not null,
  clinica_id uuid references clinicas(id),
  veterinario text,                           -- nome e CRMV do profissional
  diagnostico text,
  observacoes text,
  criado_em timestamptz not null default now()
);
create index on atendimentos (animal_id, data desc, criado_em desc);
create index on atendimentos (tipo, data);

create table vacinas_tipos (                  -- catálogo da associação, com sugestão inicial
  id uuid primary key default gen_random_uuid(),
  nome text not null,                         -- V10, antirrábica, V4, V5...
  especie especie not null,
  reforco_dias int,                           -- sugere a próxima dose; a pessoa pode alterar
  ativo boolean not null default true
);

create table vacinacoes (
  atendimento_id uuid primary key references atendimentos(id),
  vacina_tipo_id uuid not null references vacinas_tipos(id),
  lote text,
  proxima_dose date
);
create index on vacinacoes (proxima_dose) where proxima_dose is not null;

create table vermifugacoes (
  atendimento_id uuid primary key references atendimentos(id),
  produto text not null,
  proxima_dose date
);

create table castracoes (                     -- o agendamento existe antes do atendimento
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animais(id),
  status text not null check (status in ('agendada', 'realizada', 'cancelada')),
  data_agendada date,
  atendimento_id uuid references atendimentos(id),  -- preenchido quando realizada
  anterior_a_entrada boolean not null default false, -- já chegou castrado
  check (status <> 'realizada' or atendimento_id is not null or anterior_a_entrada)
);
create unique index on castracoes (animal_id) where status = 'realizada';

create table exames (                         -- também os testes (leishmaniose, FIV/FeLV...)
  atendimento_id uuid primary key references atendimentos(id),
  nome text not null,
  metodo text,                                -- 'teste rápido', 'ELISA', 'RIFI', 'PCR'...
  resultado text not null default 'aguardando'
    check (resultado in ('reagente', 'nao_reagente', 'inconclusivo', 'aguardando', 'ver_laudo')),
  resultado_detalhe text,
  laudo_caminho text
);

create table tratamentos (
  atendimento_id uuid primary key references atendimentos(id),
  medicamento text not null,
  dose text,
  frequencia text,
  inicio date not null,
  fim date                                    -- nulo = em andamento
);

create table internacoes (
  atendimento_id uuid primary key references atendimentos(id),
  entrada date not null,
  alta date,                                  -- nulo = internado
  check (alta is null or alta >= entrada)
);

-- Pessoas e adoções (Fase 4): ler a seção 04 antes de criar
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  base_legal text not null,
  anonimizado_em timestamptz
);

create table pessoas_contato (                -- só admin e coordenação leem
  pessoa_id uuid primary key references pessoas(id),
  telefone text,
  email text,
  endereco text                               -- só quando necessário
);

create table adocoes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animais(id),
  pessoa_id uuid not null references pessoas(id),
  data_adocao date not null,
  termo_caminho text,
  data_devolucao date,
  motivo_devolucao text,
  check (data_devolucao is null or data_devolucao >= data_adocao)
);
create unique index on adocoes (animal_id) where data_devolucao is null;  -- uma adoção ativa por animal

-- Auditoria: só acrescenta
create table auditoria (
  id bigint generated always as identity primary key,
  user_id uuid,
  tabela text not null,
  registro_id uuid,
  operacao text not null,                     -- insert, update, delete, leitura_sensivel, exportacao
  campos_alterados text[],                    -- nomes dos campos, não os valores
  em timestamptz not null default now()
);
revoke update, delete on auditoria from authenticated, anon;
```

**A auditoria guarda quais campos mudaram, não os valores.** Copiar o telefone do adotante para o log seria criar uma segunda cópia do dado pessoal, que a anonimização não alcança.

### Número de identificação

Gerado por trigger no `insert`, a partir da tabela `numeracao`, com `select ... for update` na linha do ano, no formato `AAAA-NNNN`. Ele não é editável. Se o front calculasse o número, dois voluntários cadastrando ao mesmo tempo receberiam o mesmo.

### Funções de acesso (RLS)

```sql
create function app.papel() returns papel
language sql stable security definer set search_path = '' as $$
  select papel from public.usuarios
  where user_id = (select auth.uid()) and ativo
$$;

create function app.tem_papel(p_papeis papel[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.papel() = any(p_papeis), false)
$$;

create function app.hoje() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone c.fuso)::date from public.configuracoes c
$$;

-- exemplo
alter table animais enable row level security;
alter table animais force row level security;

create policy animais_ler on animais for select to authenticated
  using ((select app.papel()) is not null and excluido_em is null);

create policy animais_criar on animais for insert to authenticated
  with check ((select app.tem_papel(array['admin','coordenacao','voluntario']::papel[])));
```

- **Uma política por operação, nunca `for all`.** Uma política `for all` com `using` de leitura deixa gravar quem só deveria ler.
- **`auth.uid()` e as funções de papel entram dentro de `(select ...)`.** Assim o Postgres calcula uma vez por consulta, não uma vez por linha.
- **Política com `to authenticated`.** Sem isso, ela também vale para o papel anônimo.
- **Ter conta no Supabase Auth não basta.** Quem não tem linha ativa em `usuarios` não lê nada, porque `app.papel()` volta nulo. Se alguém conseguir criar uma conta por fora, ela entra vazia.

### Quem vê o quê

| | admin | coordenação | veterinário | voluntário |
|---|---|---|---|---|
| Animais: ver e cadastrar | sim | sim | sim | sim |
| Animais: excluir | sim | sim | não | não |
| Vacina, castração, vermífugo: registrar | sim | sim | sim | sim |
| Prontuário completo (exames, diagnósticos, tratamentos) | sim | sim | sim | só leitura |
| Pessoas: ver nome | sim | sim | sim | sim |
| Pessoas: ver contato e endereço | sim | sim | não | não |
| Adoções: registrar | sim | sim | não | não |
| Indicadores e relatórios | sim | sim | sim | sim (sem dado pessoal) |
| Usuários, convites e configurações | sim | não | não | não |
| Exportar dados | sim | sim | não | não |

O voluntário vê que o animal 2026-0042 está no lar temporário da Maria. Ele não vê o telefone nem o endereço da Maria. Esse corte é feito pela RLS em `pessoas_contato`, não escondido na tela.

---

## 04 — LGPD (ADR 0007)

### Quem é quem

- **A Associação São Francisco é a controladora** dos dados pessoais do sistema: ela decide para que servem e por quanto tempo ficam.
- **Quem desenvolve e mantém o sistema**, se não for membro da associação, é **operador**: trata os dados só para manter o sistema funcionando, nas condições que a associação definir. Isso pede um acordo escrito simples entre os dois (redação com assessoria jurídica).
- Fornecedores que guardam ou processam dado pessoal (Supabase, Cloudflare, Sentry, e-mail) entram no **registro das operações de tratamento** da associação, com o que cada um recebe.
- A associação indica um **encarregado** (pode ser alguém da diretoria), que responde a pedidos dos titulares.

### Que dado pessoal existe aqui

| Dado | De quem | Para quê | Base legal sugerida (conferir com jurídico) |
|---|---|---|---|
| Nome, telefone, endereço | adotante | termo de adoção e acompanhamento | execução de contrato (o termo de adoção) |
| Nome, telefone, endereço | lar temporário | saber onde o animal está | execução de contrato ou acordo de voluntariado |
| Nome, e-mail | usuário do sistema | login e auditoria | execução de contrato ou acordo de voluntariado |
| Nome, CRMV | veterinário do atendimento | registro do atendimento | legítimo interesse, registro profissional |
| IP e identificador de sessão | quem usa o sistema | segurança e auditoria | legítimo interesse (segurança) |
| Foto | animal (pode aparecer pessoa) | identificar o animal | não é dado pessoal se não houver pessoa; ver regras de foto |

Dados de animais não são dados pessoais. O sistema só trata dado pessoal onde ele é necessário para a adoção, o lar temporário ou o login.

### Regras que o código cumpre

1. **Minimização.** Só se pede o que o briefing pede: nome, contato e endereço quando necessário. CPF, RG, renda, foto da casa e redes sociais não entram sem uma decisão escrita da associação dizendo para que servem.
2. **Base legal gravada.** Toda linha de `pessoas` tem `base_legal`. O formulário não salva sem ela.
3. **Aviso de privacidade** visível no formulário de cadastro de pessoa e no termo de adoção, dizendo para que o dado é usado e por quanto tempo.
4. **Acesso por papel**, decidido pela RLS (tabela da seção 03).
5. **Registro de acesso a dado sensível.** Abrir o contato de uma pessoa e exportar dados geram linha em `auditoria`.
6. **Direitos do titular (art. 18).** O sistema permite: mostrar tudo o que existe sobre uma pessoa (exportação em JSON e PDF), corrigir, e anonimizar.
7. **Anonimizar, não apagar.** O histórico da adoção é do animal e precisa continuar existindo. Anonimizar apaga a linha de `pessoas_contato`, troca o nome por "Pessoa anonimizada" e grava `anonimizado_em`. A adoção continua contando nos indicadores.
8. **Retenção.** A associação define o prazo em `configuracoes.retencao_pessoas_meses` (sugestão inicial: 60 meses). A rotina semanal lista o que passou do prazo para a coordenação aprovar. Ela não anonimiza sozinha.
9. **Fotos sem localização.** Foto de celular carrega a coordenada GPS de onde foi tirada, que muitas vezes é a casa de quem resgatou. O front reprocessa a imagem antes do envio (redimensiona e recodifica em WebP), e isso remove os metadados EXIF.
10. **Dado no Brasil.** Projeto Supabase na região São Paulo, para não haver transferência internacional do banco. Para os fornecedores que processam fora do país (monitoramento de erros, e-mail), a transferência é registrada e só passa o mínimo.
11. **Monitoramento sem dado pessoal.** O Sentry recebe a pilha do erro, a rota e o id do usuário. Corpo de requisição, cabeçalhos e campos de formulário são removidos antes do envio (`beforeSend`). Nenhum `console.log` de corpo de requisição em produção.
12. **Rascunho de formulário sem dado pessoal.** O front guarda rascunho de formulário no navegador para não perder o que foi digitado com conexão ruim, **exceto** nos formulários de pessoa e adoção.
13. **Saída de voluntário.** Quando alguém deixa a associação, o admin desativa o usuário no mesmo dia. A conta não é apagada, porque o nome dela está na auditoria e nos registros que fez.
14. **Incidente de segurança.** Existe um roteiro escrito (Fase 6): quem percebe avisa quem, e como a associação comunica a ANPD e os titulares quando for o caso.
15. **Dado fictício fora de produção.** Seed, testes, mocks e prints de PR usam apenas dados inventados. Nunca uma cópia do banco de produção.

---

## 05 — Segurança

Ser interno não torna o sistema menos exposto: ele continua na internet, e a conta de um voluntário pode ser tomada como a de qualquer pessoa.

| Camada | Medida |
|---|---|
| Entrada no sistema | Cadastro público desligado no Supabase Auth; só entra quem o admin convida |
| Autenticação | Senha forte; MFA (TOTP) obrigatório para `admin` e `coordenacao`; sessão expira por inatividade |
| Login | Turnstile no login e na recuperação de senha; limite de tentativas na Cloudflare |
| Camada extra opcional | Cloudflare Access na frente do front e do back, liberando só os e-mails da associação (gratuito para equipes pequenas). Quem não está na lista nem vê a tela de login. Custa uma segunda verificação por e-mail ao entrar; decidir com a associação (ver Em aberto) |
| E-mail de autenticação | SMTP próprio no Supabase Auth; o envio padrão do Supabase tem limite muito baixo e não serve para produção |
| Back | Guard **global** que valida o JWT; rota nasce fechada e abrir é explícito (`@Publico()`); só `/saude` e `/openapi.json` são públicas |
| Entrada | Todo corpo de requisição passa por DTO com `class-validator` e `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`; campo desconhecido é recusado |
| Banco | RLS forçada em toda tabela; funções `security definer` com `search_path = ''`; uma política por operação; views com `security_invoker`; conta sem linha ativa em `usuarios` não lê nada |
| Arquivos | Baldes privados; URL assinada de curta duração (5 min); caminho decidido pelo servidor; tipo e tamanho conferidos antes de assinar (imagem até 5 MB, laudo PDF até 10 MB); política do balde exige usuário ativo |
| Cache | Cache de URL assinada sempre inclui quem pediu na chave. Cache só por caminho entrega para a segunda pessoa um link que só a primeira podia ter |
| Front | CSP restrita: `connect-src` só com o domínio do back e o domínio exato do projeto Supabase (nunca `*.supabase.co`); `frame-ancestors 'none'`; HSTS; `robots` com `noindex` |
| Erros | Erro do banco (tem `code`) e falha de rede (sem `code`) são separados: falha de rede responde 503, nunca uma mensagem de permissão |
| Monitoramento | Sentry nos dois repositórios, com dado pessoal filtrado; alerta para taxa de erro e para falha de rotina |
| Dependências | Dependabot nos dois repos; `npm audit` na CI |
| Backup | Backup diário do Supabase (plano pago); teste de restauração uma vez por fase |
| Auditoria | Tabela `auditoria` alimentada por trigger, sem valores pessoais, sem `update` nem `delete` |

---

## 06 — Mapa de rotas do front

Toda tela tem os três estados escritos: vazio, carregando e erro. Tela sem estado vazio mostra uma tabela em branco, e a pessoa não sabe se é falta de dado ou falha.

| Rota | Tela | Fase | Vazio | Erro |
|---|---|---|---|---|
| `/entrar`, `/recuperar`, `/nova-senha` | acesso | 0 | — | mensagem do erro, sem dizer se o e-mail existe |
| `/` | painel com os indicadores | 5 (na 0 a 4: atalhos) | "Nenhum animal cadastrado. Cadastrar o primeiro" | número substituído por "—" e aviso no topo |
| `/animais` | lista com filtros | 1 | sem filtro: "Cadastrar o primeiro animal"; com filtro: "Nenhum animal com esses filtros. Limpar filtros" | tentar de novo, filtros mantidos |
| `/animais/novo` | cadastro | 1 | — | campo com erro marcado; nada do que foi digitado se perde |
| `/animais/[id]` | ficha: Dados · Situação · Saúde · Prontuário · Adoção | 1 a 4 | cada aba diz o que falta ("Nenhuma vacina registrada. Registrar vacina") | aba com erro mostra o erro; as outras continuam |
| `/pendencias` | vacinas vencidas e a vencer, castrações agendadas, exames aguardando | 2 | "Nenhuma pendência." | tentar de novo |
| `/pessoas` e `/pessoas/[id]` | pessoas, lares temporários | 4 | "Nenhuma pessoa cadastrada" | tentar de novo |
| `/adocoes` | adoções e devoluções | 4 | "Nenhuma adoção registrada" | tentar de novo |
| `/relatorios` | relatórios e exportação | 5 | "Nenhum dado no período" | tentar de novo |
| `/configuracoes` | usuários, catálogo de vacinas, clínicas, retenção | 0 a 6 | — | tentar de novo |
| `/auditoria` | registro de acesso (admin) | 6 | "Nenhum registro no período" | tentar de novo |

Sem seletor de organização: depois do login, a pessoa cai direto no painel.

**Carregando:** listas e fichas usam esqueleto com a forma do conteúdo, nunca uma tela branca com indicador no centro. Gravação de campo mostra o estado no próprio campo.

**Componentes de domínio** (os genéricos de layout e formulário ficam no kit): `<AnimalCard>`, `<AnimalFiltros>`, `<SeloSituacao>`, `<SeloSaude>`, `<FichaAbas>`, `<MovimentacaoForm>`, `<LinhaDoTempo>`, `<AtendimentoForm>` (campos mudam por tipo), `<CartaoVacinacao>`, `<EnvioFoto>` (redimensiona e remove EXIF), `<EnvioArquivo>`, `<PessoaSeletor>`, `<AvisoPrivacidade>`, `<Indicador>`, `<GraficoSimples>`.

---

## 07 — Índice de funcionalidades

| ID | Funcionalidade | Fase | Prioridade |
|---|---|---|---|
| F-01 | Acesso: entrar, recuperar senha, MFA | 0 | P0 |
| F-02 | Usuários, papéis e convites | 0 | P0 |
| F-03 | Cadastro de animal com número automático | 1 | P0 |
| F-04 | Foto do animal | 1 | P0 |
| F-05 | Situação, localização e histórico de movimentações | 1 | P0 |
| F-06 | Reentrada e aviso de possível duplicado | 1 | P1 |
| F-07 | Vacinação com próxima dose sugerida | 2 | P0 |
| F-08 | Castração: agendar, realizar, "já chegou castrado" | 2 | P0 |
| F-09 | Vermifugação | 2 | P1 |
| F-10 | Pendências de saúde | 2 | P0 |
| F-11 | Prontuário: linha do tempo de atendimentos | 3 | P0 |
| F-12 | Exames e testes, com laudo e resultado pendente | 3 | P0 |
| F-13 | Tratamentos e internações | 3 | P1 |
| F-14 | Cadastro de pessoas com base legal | 4 | P0 |
| F-15 | Lar temporário | 4 | P0 |
| F-16 | Adoção e devolução | 4 | P0 |
| F-17 | Direitos do titular: exportar e anonimizar | 4 | P0 |
| F-18 | Painel dos onze indicadores | 5 | P0 |
| F-19 | Relatórios, CSV e impressão | 5 | P1 |
| F-20 | Retenção e auditoria de acesso | 6 | P0 |

P0 é o que a associação precisa para largar a planilha. P1 entra na mesma fase se couber.

---

## 08 — Regras permanentes (vão para o `CLAUDE.md` dos dois repositórios)

1. Regra de acesso mora no banco. O Nest não repete checagem de permissão.
2. Uma regra, um lugar. Se a mesma conta aparece no front e no back, uma das duas sai.
3. Estado calculável não é gravado (vacinado, pendente, castrado, idade).
4. Escrita em mais de uma tabela é função no banco, numa transação.
5. Toda mudança de banco é migração versionada, com prova pgTAP quando mexe em RLS.
6. Toda tabela nova: RLS forçada, uma política por operação com `to authenticated`, colunas de auditoria, e prova de que conta sem linha ativa em `usuarios` não lê nada.
7. Data de "hoje" vem de `app.hoje()`, nunca de `current_date`.
8. Nenhum dado pessoal em log, auditoria, Sentry, mensagem de erro, seed ou mock.
9. Campo novo é conferido contra o que está gravado no banco, não contra o nome que parece certo.
10. Mock de teste usa o formato real do dado (uuid onde é uuid, enum onde é enum).
11. Rota nova e rota antiga convivem por um deploy. A antiga sai num passo separado.
12. Item de menu que ainda não tem tela aparece apagado com "em breve", nunca como link que dá 404.
13. O menu é dado (`lib/menu.ts`). Barra do computador, barra do celular e folha do celular saem da mesma lista.
14. Datas sempre pelo formatador central (`fd`), nunca `dd/mm/aa` escrito na tela.
15. Grade em componente usa atributo `data-n`, nunca `style` com `repeat(N,1fr)`.
16. Toda tela tem estado vazio, carregando e erro.
17. Texto da interface: português, sem emoji, sem exclamação, botão diz o que faz ("Registrar vacina", não "OK").
18. A CI roda o mesmo comando que a publicação roda (`npm run build`).

---

## 09 — Repositórios

**Dois repositórios, sem monorepo** (ADR 0001): `asf-front` e `asf-back`. Os dois privados, com `main` protegida desde o primeiro push (merge só por PR).

```
asf-front/                        asf-back/
├── app/            (rotas)       ├── src/
├── components/                   │   ├── auth/
├── lib/                          │   ├── comum/        (erros, pipes, guards)
│   ├── api.ts      (cliente)     │   ├── supabase/
│   ├── menu.ts     (menu é dado) │   ├── usuarios/
│   └── formato.ts  (datas, nº)   │   ├── configuracoes/
├── styles/                       │   ├── animais/
│   ├── tokens.css                │   ├── saude/
│   └── components.css            │   ├── prontuario/
├── types/api.d.ts  (gerado)      │   ├── pessoas/
├── scripts/                      │   ├── adocoes/
├── CLAUDE.md                     │   ├── indicadores/
├── .env.example                  │   ├── lgpd/
└── package.json                  │   └── rotinas/      (Cron Triggers)
                                  ├── supabase/
                                  │   ├── migrations/   (SQL versionado)
                                  │   ├── tests/        (pgTAP: provas de RLS e regras)
                                  │   ├── functions/    (Edge Function admin)
                                  │   └── seed.sql      (dado fictício)
                                  ├── docs/adr/         (registros de decisão)
                                  ├── scripts/
                                  ├── wrangler.toml
                                  ├── CLAUDE.md
                                  ├── .env.example
                                  └── package.json
```

**O SQL mora no `asf-back`, em `supabase/migrations/`, versionado.** Nenhuma mudança no banco é feita à mão pelo painel. Se não está numa migração, não existe.

### Segredos

- Nenhuma chave commitada em nenhum repositório. Cada repo tem `.env.example` com valores de exemplo e `.env` no `.gitignore`.
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` ficam no `wrangler.toml` do back. A chave anônima é pública por definição, e a configuração do painel da Cloudflare é sobrescrita a cada `wrangler deploy`.
- `SUPABASE_JWT_SECRET` (se usado) e `SENTRY_DSN` do back vão como Secret do Worker.
- A `service_role` fica só na Edge Function, gerenciada pelo Supabase.
- Token que for colado em chat, issue ou log é considerado vazado e é trocado no mesmo dia.

---

## 10 — Registros de decisão (ADR)

Ficam em `asf-back/docs/adr/`. Mudar uma decisão é escrever um ADR novo que substitui o antigo, não editar o antigo.

| Nº | Decisão |
|---|---|
| 0001 | Dois repositórios, sem monorepo; contrato pelo OpenAPI |
| 0002 | NestJS como BFF; regra de acesso no Postgres (RLS); sem `service_role` no Nest |
| 0003 | Situação, local e disponibilidade em três colunas |
| 0004 | Prontuário como linha do tempo única; estado de saúde calculado |
| 0005 | Sistema interno de uma associação só, sem separação por organização |
| 0006 | Contato de pessoa em tabela separada |
| 0007 | LGPD: associação controladora; anonimizar em vez de apagar |
| 0008 | Hospedagem: Cloudflare Workers e Supabase na região São Paulo |
| 0009 | Um repositório com duas pastas independentes, separável depois (substitui a parte dos dois repositórios do 0001) |

---

## Fase 0 — Fundações

Nenhuma tela de negócio ainda. Esta fase constrói o que todas as outras vão usar. Funcionalidades: F-01, F-02.

**Infra**
- [x] Criar `asf-front` e `asf-back` (pastas no repositório `SaaS-ASF`, ADR 0009) — **falta proteger a `main`** no GitHub (exigir PR e CI verde)
- [x] `.env.example` nos dois, `.env` no `.gitignore`
- [x] `CLAUDE.md` nos dois e os ADRs 0001 a 0008 em `docs/adr/`
- [x] CI por repo: typecheck, lint, testes e `npm run build` (o mesmo comando da Cloudflare)
- [x] CI do back: `supabase db reset` + `supabase test db` (provas de RLS) + conferir que o `openapi.json` gera
- [x] Dependabot ligado
- [x] Deploy contínuo dos dois pelo Workers Builds da Cloudflare (sem token no GitHub) — `asf-back.balbuquerc.workers.dev` e `asf-front.balbuquerc.workers.dev`
- [x] Back: `wrangler.toml` com `nodejs_compat`, a flag `enable_nodejs_http_server_modules` e os `alias` dos módulos que o Nest carrega por `require` dinâmico
- [x] Front: `open-next.config.ts` com `buildCommand` próprio
- [ ] Sentry nos dois, com o filtro de dado pessoal (`beforeSend`) e um erro de teste conferido no painel — **adiado** (depende de conta)

**Banco**
- [x] Projeto Supabase na região São Paulo, com cadastro público desligado
- [x] Migração 001: `configuracoes`, `usuarios`, enum `papel`, schema `app`, `papel`, `tem_papel`, `hoje`
- [x] Migração 002: triggers de auditoria (`criado_por`, `atualizado_por`) e tabela `auditoria` sem `update` nem `delete`
- [x] Provas pgTAP: conta sem linha em `usuarios` não lê nada; usuário desativado não lê nada; anônimo não lê nada; só admin mexe em `usuarios` e `configuracoes`
- [x] `seed.sql` com um usuário fictício de cada papel
- [ ] SMTP próprio configurado no Supabase Auth — **adiado** (Resend; até lá convites e recuperação por e-mail não são confiáveis e usuários são criados no painel)

**Back**
- [x] `AuthModule` com guard global e `@Publico()`
- [x] `SupabaseService`: cliente por requisição com o JWT de quem chamou
- [x] Filtro de erro global: separa erro do banco (4xx com frase em português) de falha de rede (503)
- [x] `POST /sessao/entrar | renovar | recuperar | senha`
- [x] `GET /eu` (nome e papel de quem entrou)
- [x] `GET /usuarios`, `POST /usuarios/convites`, `PATCH /usuarios/:id` (papel, ativar, desativar), pela Edge Function admin
- [x] `GET /saude`: responde se cada configuração existe e de onde veio, nunca o valor
- [x] `@nestjs/swagger` gerando `/openapi.json` público, sem a Swagger UI

**Front**
- [x] `tokens.css` e `components.css`: cores, tipografia, espaçamento, temas claro e escuro
- [x] Script de tema antes da primeira pintura
- [x] Login, recuperação de senha e nova senha (com repetição da senha) — **Turnstile adiado** (depende de chave da Cloudflare)
- [x] `lib/menu.ts` com todos os módulos previstos; os que não existem aparecem com "em breve"
- [x] `lib/api.ts`: cliente único, tipado pelo OpenAPI — o selo de gravação entra na Fase 1, com os campos que salvam ao sair
- [x] `lib/formato.ts`: `fd(iso)`, `fdDe(Date)`, idade a partir de `nascimento_estimado`
- [x] Script de codegen (`openapi-typescript`)
- [x] Tela de usuários (admin): convidar, mudar papel, desativar
- [x] CSP, HSTS, `frame-ancestors` e `noindex`

**LGPD e segurança**
- [ ] ~~MFA obrigatório para `admin` e `coordenacao`~~ — **adiado para a Fase 6** (decisão de 17/10/2026; código pronto no PR #15, em rascunho)
- [x] Política de privacidade e registro das operações de tratamento (rascunho, para revisão jurídica) — `docs/lgpd/`
- [x] Acordo entre a associação e quem mantém o sistema, se for de fora (rascunho) — `docs/lgpd/`

**Casos de borda**
- Usuário desativado com sessão aberta: a próxima requisição dele já não lê nada, porque a RLS confere `ativo` a cada consulta.
- Convite aceito por alguém que já tinha conta no Auth: a conta ganha a linha em `usuarios` e passa a ler.
- Link de recuperação de senha expirado: a tela diz que expirou e oferece pedir outro.
- O último admin tenta se desativar: recusado, para a associação não ficar sem ninguém que convide.

**Armadilhas**
- Não deixar o cadastro público do Supabase Auth ligado: qualquer pessoa cria conta. Mesmo entrando vazia, ela não deveria existir.
- Não usar o envio de e-mail padrão do Supabase em produção: o limite é baixo, e a recuperação de senha para de chegar sem erro nenhum na tela.
- Não ligar a Swagger UI no Worker: ela depende de `__dirname` e derruba a aplicação inteira no boot.
- Não cadastrar configuração só no painel da Cloudflare: o `wrangler deploy` sobrescreve.
- Não deixar o adaptador do OpenNext chamar `npm run build` apontando para ele mesmo: o build entra em recursão e nunca termina, sem erro.

**Pronto quando:** um usuário convidado entra, vê o menu com tudo "em breve", e a CI prova que uma conta sem convite não lê nada.

**Situação (17/10/2026): fechada.** O critério foi cumprido no local e no sistema publicado. Ficaram adiados, por dependerem de contas externas ou de decisão da associação: SMTP próprio (Resend), Sentry, Turnstile e proteção da `main`. O MFA foi para a Fase 6.

---

## Fase 1 — Cadastro de animais

Funcionalidades: F-03, F-04, F-05, F-06.

**Banco**
- [x] Enums `especie`, `sexo` (com `nao_identificado`), `porte`, `origem`, `situacao`, `local_animal`
- [x] Tabelas `animais`, `numeracao`, `animal_fotos`, `movimentacoes`, `clinicas`
- [x] Trigger do número `AAAA-NNNN` por ano
- [x] `check constraint` da combinação situação, local e disponível
- [x] Função `mover_animal(animal, tipo, situacao, local, disponivel, data, motivo, origem)`: grava `animais` e `movimentacoes` juntos; `update` direto nas três colunas revogado; ao sair de `em_acolhimento`, cancela castração agendada (a tabela entra na Fase 2, e a função ganha esse passo lá)
- [x] Função `possiveis_duplicados(nome, especie, sexo)`
- [x] Balde privado `fotos-animais`, com política que exige usuário ativo (WebP, ou JPEG no Safari, que não gera WebP; a foto é sempre refeita no aparelho)
- [x] Provas pgTAP: voluntário cadastra e não exclui; `update` direto em `situacao` é recusado; número sequencial por ano (31 provas). Cadastros simultâneos: garantido pelo upsert travado na linha do ano, que o pgTAP não consegue simular numa sessão só

**Back**
- [x] `GET /animais` com filtros (espécie, sexo, porte, situação, local, disponível), busca por número ou nome e paginação
- [x] `GET /animais/:id`, `POST /animais`, `PATCH /animais/:id` (campo a campo)
- [x] `GET /animais/duplicados?nome=&especie=&sexo=`
- [x] `POST /animais/:id/movimentacoes` chamando `mover_animal`; recusa `adotado`, `transferido`, `devolvido_comunidade` e `lar_temporario` até a Fase 4 (a recusa mora em `mover_animal`, no banco)
- [x] `POST /animais/:id/fotos/assinar`: confere tipo e tamanho, decide o caminho, devolve URL assinada; `POST /animais/:id/fotos` registra depois do envio
- [x] `DELETE /animais/:id` (exclusão lógica, só admin e coordenação)
- [x] `GET /clinicas`, `POST /clinicas`

**Front**
- [x] Lista de animais com foto, número, nome, espécie, sexo, idade calculada e selo de situação
- [x] Filtros guardados na URL (dá para mandar o link de uma lista filtrada)
- [x] Formulário de cadastro: idade informada em anos ou meses e convertida em `nascimento_estimado`
- [x] `origem_detalhe` aparece e é obrigatório só quando a origem é "outra"
- [x] Aviso de possível duplicado antes de salvar
- [x] Envio de foto: redimensiona, recodifica em WebP (remove EXIF), envia direto ao Storage
- [x] Ficha do animal com abas: Dados · Situação · Saúde (em breve) · Prontuário (em breve) · Adoção (em breve)
- [x] Aba Situação: situação atual, histórico de movimentações e botão de reentrada para quem saiu
- [x] Campos salvam ao sair do campo, sem redesenhar a ficha

**Casos de borda**
- Animal sem nome: a lista mostra o número no lugar do nome.
- Idade "uns 2 anos" e filhote de "3 semanas": os dois viram data estimada; a tela mostra "cerca de 2 anos" e "3 semanas".
- Envio de foto interrompido no meio: nenhuma linha fica em `animal_fotos`; o arquivo solto é apagado pela rotina semanal.
- Duas pessoas editando o mesmo campo: vale a última gravação, e o histórico mostra as duas.
- Data de entrada no futuro: recusada.

**Armadilhas**
- Não calcular o número no front nem com `max(numero) + 1`: dois cadastros ao mesmo tempo repetem o número.
- Não gravar a idade: em um ano todas as idades estão erradas.
- Não aceitar foto sem reprocessar: o EXIF leva o GPS.

**Pronto quando:** a associação cadastra um animal com foto, ele recebe número, muda de sede para clínica e volta, e o histórico mostra as duas mudanças.

**Situação (17/10/2026): fechada.** Conferido no sistema publicado: o animal 2026-0001 foi cadastrado com foto, foi da sede para a clínica e voltou, e o histórico mostrou as duas mudanças. Mudança em relação ao plano: a foto aceita WebP ou JPEG (o Safari não gera WebP); nos dois casos ela é refeita no aparelho, sem EXIF/GPS.

---

## Fase 2 — Vacinação, castração e vermifugação

Funcionalidades: F-07, F-08, F-09, F-10.

**Banco**
- [x] Tabelas `atendimentos`, `vacinas_tipos`, `vacinacoes`, `vermifugacoes`, `castracoes`
- [x] Catálogo inicial de vacinas por espécie: cães V8, V10 e antirrábica; gatos, antirrábica (as outras vacinas de gato ainda serão informadas)
- [x] View `animal_saude` (`security_invoker`): `vacinado` (tem ao menos uma vacinação), `vacina_pendente` (alguma `proxima_dose` antes de `app.hoje()` sem aplicação posterior do mesmo tipo, ou nunca vacinado), `castracao_status` (`castrado`, `agendada`, `nao_castrado`), próxima vermifugação
- [x] Funções `registrar_vacina`, `registrar_vermifugacao`, `realizar_castracao`: atendimento e detalhe na mesma transação
- [x] Provas pgTAP para cada regra da view, incluindo a virada de dia em Fortaleza às 22h

**Back**
- [x] `POST /animais/:id/vacinas`, `POST /animais/:id/vermifugacoes`
- [x] `POST /animais/:id/castracoes` (agendar), `PATCH .../castracoes/:id` (realizar ou cancelar), opção "já chegou castrado"
- [x] `GET /pendencias`: vacinas vencidas e a vencer nos próximos 15 dias, castrações agendadas (também vermifugação; o prazo fica em `configuracoes.aviso_vacina_dias`)
- [ ] Rotina diária de resumo por e-mail (desligada por padrão; liga em `configuracoes`) — **adiada**: depende do e-mail próprio (Resend) e da resposta da pergunta 9

**Front**
- [x] Aba Saúde na ficha: cartão de vacinação, situação da castração, vermifugação
- [x] Ao escolher a vacina, a próxima dose é sugerida pelo `reforco_dias`; a pessoa pode alterar
- [x] Tela Pendências
- [x] Selos na lista de animais: vacinado, pendente, castrado, agendada
- [x] Cadastro do catálogo de vacinas (admin e coordenação)

**Casos de borda**
- Vacina aplicada antes da entrada na associação (o animal chegou com carteirinha): aceita data anterior a `data_entrada`.
- Castração agendada para um animal que morre ou é adotado antes: o agendamento fica cancelado automaticamente pela movimentação.
- Vacina de uma espécie aplicada em outra (V4 em cão): recusada.
- Segunda castração "realizada" para o mesmo animal: recusada pelo índice único.

**Armadilhas**
- Não usar `current_date` na regra de pendência: às 22h em Fortaleza o servidor já está no dia seguinte.
- Não guardar "vacinado" como campo do animal.

**Pronto quando:** registrar a V10 de um cão sugere o reforço, o animal sai de "não vacinado", e quando a data passa ele aparece em Pendências sem ninguém mexer em nada.

**Ajustes pelas respostas da associação (17/10/2026)** — migrações 007 e 008:
- [x] Protocolo de vacina: na primeira vez, 3 doses com 21 dias de intervalo; depois, reforço anual (cães e gatos). O catálogo guarda doses iniciais e intervalo, e `sugerir_proxima_dose` conta as doses já tomadas.
- [x] Vermífugo: filhote na primeira vez faz a série de 3 dias e repete em 15 dias; adulto a cada 6 meses (`sugerir_proxima_vermifugacao`).
- [x] Antiparasitário externo (antipulgas e carrapatos): Simparic semestral nos abrigados e na admissão de novo resgatado; Bravecto só em cadela parida, sem repetição. Registro próprio, estado e Pendências.
- [x] Castração agendada pela associação também com o adotante: animal adotado pode ter castração agendada e realizada; só óbito e transferência cancelam o agendamento.
- [x] Microchip no animal (a associação vai começar a microchipar), informado também ao registrar a castração.
- [x] Prioridade de castração para fêmeas: seção própria em Pendências.
- [x] Clínica Mundo Animal cadastrada.
- [ ] Vacinas de gato além da antirrábica: aguardando a associação.

---

## Fase 3 — Histórico veterinário (prontuário)

Funcionalidades: F-11, F-12, F-13.

**Banco**
- [x] Tabelas `exames`, `tratamentos`, `internacoes`
- [x] Balde privado `laudos`, só admin, coordenação e veterinário leem
- [x] View `animal_em_tratamento` (`security_invoker`): tratamento sem `fim`, internação sem `alta`, ou `local = 'clinica'`
- [x] RLS: voluntário lê o prontuário e não grava diagnóstico, exame ou tratamento

**Back**
- [x] `GET /animais/:id/prontuario`: linha do tempo de todos os atendimentos, por data e depois pela hora do registro, paginada
- [x] `POST /animais/:id/atendimentos` com o detalhe do tipo (consulta, exame, teste, tratamento, internação, retorno)
- [x] Envio de laudo em PDF ou imagem (mesmo fluxo de URL assinada)
- [x] `PATCH` para registrar resultado de exame que estava "aguardando", alta de internação e fim de tratamento
- [x] Atendimento do tipo `obito` chama `mover_animal` para `obito` na mesma transação

**Front**
- [x] Aba Prontuário: linha do tempo com filtro por tipo; vacina, vermífugo e castração da Fase 2 aparecem nela, porque é a mesma tabela
- [x] Formulário único de atendimento: os campos mudam conforme o tipo escolhido
- [x] Testes com atalho para leishmaniose, FIV/FeLV, cinomose e parvovirose, com método e resultado
- [x] Resultado "reagente" de leishmaniose mostra um selo destacado na ficha e na lista
- [x] Exames com resultado "aguardando" aparecem em Pendências
- [x] Impressão da ficha clínica do animal (janela de impressão do navegador)

**Saúde na entrada (pedido da associação: o "prontuáriozinho")**
- [x] Coluna `condicao_entrada` no animal, editável na aba Dados
- [x] `registrar_saude_entrada`: condição para todos; exames pedidos (aguardando resultado) e tratamento iniciado só para os papéis clínicos
- [x] Seção "Saúde na entrada" no cadastro, com atalhos de hemograma, bioquímico, leishmaniose, 4DX, FIV/FeLV, cinomose e parvovirose
- [x] Selo "em tratamento" na lista e na ficha

**Casos de borda**
- Vários atendimentos no mesmo dia: a ordem segue a hora em que foram registrados.
- Internação com alta antes da entrada: recusada.
- Laudo enviado e atendimento não salvo: o arquivo solto é apagado pela rotina semanal.
- Voluntário abre um laudo: o servidor não assina a URL para ele.

**Armadilhas**
- Não criar uma segunda tabela de "histórico" para a tela: a linha do tempo é `atendimentos`.
- Não registrar óbito só como atendimento ou só como situação: são os dois juntos, na mesma função.

**Pronto quando:** o veterinário registra consulta, teste de leishmaniose com resultado pendente, tratamento e internação; a alta e o resultado entram depois; tudo aparece numa linha do tempo só.

---

## Fase 4 — Pessoas, lar temporário, adoções e devoluções

Antes de abrir esta fase, a seção 04 (LGPD) precisa estar revisada pela associação. **Mudou pelo ADR 0010 (17/10/2026):** a fase foi construída antes da revisão, com padrões provisórios; nenhuma pessoa real é cadastrada antes de a associação revisar o aviso de privacidade e as bases legais. Funcionalidades: F-14, F-15, F-16, F-17.

**Banco**
- [x] Tabelas `pessoas`, `pessoas_contato` e `adocoes`; `movimentacoes.pessoa_id` passa a ter chave estrangeira
- [x] RLS de `pessoas_contato`: só admin e coordenação leem e gravam
- [x] Função `registrar_adocao`: cria a adoção e chama `mover_animal` para `adotado`, na mesma transação
- [x] Função `registrar_devolucao`: grava a devolução e volta o animal para `em_acolhimento` na sede
- [x] Função `anonimizar_pessoa`: apaga o contato, troca o nome, grava `anonimizado_em`, registra na auditoria
- [x] Função `ler_contato(pessoa)` que registra a leitura na auditoria; a tela só lê contato por ela
- [x] Provas pgTAP: voluntário e veterinário não leem `pessoas_contato`; anonimizar mantém a adoção contando; não existem duas adoções ativas para o mesmo animal

**Back**
- [x] CRUD de pessoas com `base_legal` obrigatória
- [x] `POST /animais/:id/adocao`, `POST /adocoes/:id/devolucao`
- [x] `POST /animais/:id/movimentacoes` passa a aceitar `lar_temporario` (exige pessoa), `transferido` (exige destino) e `devolvido_comunidade` (exige castração realizada)
- [x] `GET /pessoas/:id/dados` (exportação para o titular), `POST /pessoas/:id/anonimizar`
- [x] Envio do termo de adoção assinado (balde privado `termos`)

**Front**
- [x] Cadastro de pessoa com aviso de privacidade e escolha da base legal
- [x] Endereço aparece só quando o tipo de vínculo exige (lar temporário e adoção)
- [x] Fluxo de adoção na ficha do animal: escolhe ou cadastra o adotante, data, termo
- [x] Fluxo de devolução com motivo
- [x] As quatro situações da Fase 1 deixam de ser "em breve"
- [x] Lista de lares temporários com os animais em cada um
- [x] Tela da pessoa: animais ligados, exportar dados, anonimizar (com confirmação)
- [x] Formulários de pessoa e adoção sem rascunho no navegador

**Casos de borda**
- Adotante que devolve e adota outro animal: é a mesma pessoa, com duas adoções.
- Pessoa anonimizada que volta para adotar: é um cadastro novo; não há como ligar ao antigo, e isso é o esperado.
- Pedido de anonimização de quem está com um animal em lar temporário agora: recusado com explicação; primeiro o animal sai do lar.
- Animal adotado que precisa de atendimento: o prontuário continua aceitando registro.

**Armadilhas**
- Não esconder telefone e endereço só na tela: quem decide é a RLS de `pessoas_contato`.
- Não apagar a pessoa: a adoção perde o vínculo e o indicador de adoções muda de valor.
- Não gravar o contato na auditoria nem no Sentry.

**Pronto quando:** um animal vai para lar temporário, fica disponível, é adotado, é devolvido e volta para a sede, e cada passo está no histórico; o voluntário vê tudo isso sem ver o contato de ninguém.

---

## Fase 5 — Indicadores e relatórios

Funcionalidades: F-18, F-19.

### Dicionário de indicadores

Cada número tem uma definição escrita. Sem isso, "total de animais" significa uma coisa para a coordenação e outra para o código. As definições abaixo são uma proposta e precisam ser confirmadas com a associação. **Situação em 17/10/2026:** implementadas como estão aqui; as perguntas 23 (regras) e 24 (relatórios) do questionário ainda não voltaram. "Em tratamento" conta só quem está sob cuidado agora, como os outros números de saúde.

| Indicador | Regra proposta |
|---|---|
| Total de animais cadastrados | todos os animais não excluídos, desde sempre; mostrar ao lado "sob cuidado agora" (`em_acolhimento`) |
| Cães e gatos | por `especie`, dentro de "sob cuidado agora" e no total |
| Machos e fêmeas | por `sexo`, mesmo recorte |
| Vacinados / vacinação pendente | da view `animal_saude`, só animais `em_acolhimento` |
| Castrados / não castrados / castração agendada | `castracao_status`, só `em_acolhimento` |
| Disponíveis para adoção | `em_acolhimento` e `disponivel_adocao` |
| Atualmente na sede | `em_acolhimento` e `local = 'sede'` |
| Em lares temporários | `em_acolhimento` e `local = 'lar_temporario'` |
| Em tratamento veterinário | view `animal_em_tratamento` |
| Total de adoções realizadas | linhas de `adocoes` no período; devolvidas contam separadamente |
| Castrados e devolvidos à comunidade | movimentações para `devolvido_comunidade` no período |

**Banco**
- [x] Função `indicadores(de, ate)`: devolve os onze números numa chamada, a partir das views
- [x] Provas pgTAP de cada regra do dicionário, com um seed que conhece a resposta certa

**Back**
- [x] `GET /indicadores?de=&ate=`
- [x] `ReportBuilderService`: um construtor que devolve `{quadros, colunas, linhas}`; tela, CSV e impressão percorrem a mesma saída
- [x] Relatórios: animais por situação, vacinação, castração, adoções no período, movimentações
- [x] Exportação registrada na auditoria; relatórios para voluntário saem sem dado pessoal

**Front**
- [x] Painel inicial com os onze indicadores e o filtro de período
- [x] Gráficos simples (espécie, sexo, entradas e adoções por mês), com legenda e redesenho ao trocar de tema
- [x] Tocar num indicador abre a lista de animais já filtrada
- [x] Tela de relatórios com escolha de seção, CSV e impressão

**Casos de borda**
- Sistema recém-instalado: todos os números aparecem como zero, não como erro.
- Período sem nenhuma adoção: zero, e o gráfico mostra o eixo vazio.
- Animal excluído: some de todos os números.

**Armadilhas**
- Não contar no front o que o servidor já conta: a mesma regra em dois lugares diverge.
- Não abrir a lista a partir do indicador com um filtro diferente do que gerou o número.

**Pronto quando:** cada número do painel bate com a lista filtrada que ele abre, e a prova da CI confere os onze contra o seed.

---

## Fase 6 — LGPD operacional, revisão de segurança e entrada em produção

Funcionalidade: F-20.

- [ ] MFA obrigatório para `admin` e `coordenacao` — **desligado por enquanto (ADR 0012, 19/10/2026)**. Ficou no ar de 19/10 até a migração 20261023090000; o código continua no repositório para religar com uma migração nova.
- [x] Rotina semanal de retenção: lista pessoas além do prazo para a coordenação aprovar a anonimização (feita como lista calculada a cada abertura, em Pessoas → Prazo de guarda, igual às pendências; não precisa de agendamento)
- [ ] Rotina semanal de arquivos órfãos e de conferência de backup (arquivos soltos: feito em Configurações, só admin; conferência de backup espera o plano pago)
- [x] Tela de auditoria para admin (quem acessou contato, quem exportou)
- [ ] Roteiro de incidente de segurança escrito e com responsáveis definidos (rascunho em `docs/lgpd/roteiro-incidente.md`; faltam os responsáveis)
- [ ] Revisão da política de privacidade, do registro das operações de tratamento e do acordo com quem mantém o sistema, pela assessoria jurídica
- [ ] Encarregado de dados indicado pela associação
- [ ] Revisão das políticas de RLS tabela por tabela, com o Security Advisor e o Performance Advisor do Supabase sem alertas (revisão automática na CI: prova 011; falta olhar os Advisors no painel)
- [ ] Supabase em plano pago, com backup diário; teste de restauração feito
- [ ] Regras de WAF e limite de requisições revisadas na Cloudflare; Cloudflare Access ligado, se a associação decidir
- [ ] Alertas do Sentry testados (taxa de erro, falha de rotina)
- [ ] Varredura no navegador: todas as rotas nos dois temas, no celular e no computador, com os três estados de cada tela
- [ ] Acessibilidade: contraste, navegação por teclado, rótulos de formulário
- [ ] Teste em celular de entrada de linha com rede 3G simulada: lista e ficha abrem em menos de 3 s
- [ ] Domínio de produção e URL de retorno da recuperação de senha cadastrada no Supabase (a associação quer domínio próprio; o registro ainda não foi pago, então segue o endereço atual)
- [x] Migração dos dados que a associação já tem (planilha ou papel), se houver: script com conferência de contagem antes e depois — **não se aplica** (resposta de 20/10/2026: não há planilha; os animais atuais são cadastrados pela tela)
- [ ] Treinamento da equipe e manual curto de uso (manual pronto em `docs/manual/`; falta o treinamento)

**Respostas da associação (20/10/2026, ADR 0013):** vacinas de gato (V4, V5 e antirrábica) no catálogo; CPF, RG e profissão no contato (lar temporário e termo de adoção); raça e pelagem do animal; termo de adoção gerado pelo sistema a partir do modelo deles; acompanhamento pós-adoção até o fim da vida do animal, com o prazo de guarda contando depois; bairro ou rua obrigatório na devolução à comunidade; indicadores confirmados; relatório social para o Sua Nota Tem Valor (SEFAZ-CE). Ainda faltam: encarregado de dados, dados da associação (razão social, CNPJ, endereço), revisão jurídica, dois administradores e o e-mail de contato.

**Pronto quando:** a Associação São Francisco usa o sistema no dia a dia por duas semanas, sem planilha paralela.

---

## Depois da Fase 6

Fora do escopo agora. Entram só se a associação pedir, cada um com seu próprio passo de LGPD e segurança:

- **Página pública de animais disponíveis para adoção.** Muda a natureza do sistema: deixa de ser só interno. Exigiria foto em balde público separado, nenhuma informação de pessoa e uma revisão de segurança própria.
- **Formulário público de interesse em adoção.** Coleta dado pessoal de quem não é da associação, com base legal e aviso de privacidade próprios.
- **Uso sem internet** na sede.

---

## Riscos

| Risco | Fase | Como reduzir |
|---|---|---|
| Voluntários não adotam o sistema e voltam para a planilha | 1 a 6 | cadastro rápido no celular; teste com dois voluntários reais ao fim de cada fase |
| Plano gratuito do Supabase pausa projeto parado e não tem o backup de que produção precisa | 6 | produção no plano pago; conferir os limites atuais dos planos antes da Fase 6 |
| Vazamento de contato de adotante | 4 em diante | contato em tabela separada com RLS, auditoria de leitura, provas pgTAP na CI |
| Conta de voluntário tomada ou de quem já saiu da associação | todas | MFA para admin e coordenação; desativação no mesmo dia; voluntário não lê contato; Cloudflare Access como camada extra |
| Conexão ruim na sede faz perder cadastro | 1 | rascunho no navegador (exceto pessoa), envio de foto reduzido, gravação campo a campo |
| Uma pessoa só conhece o sistema | todas | ADRs, `CLAUDE.md` e este plano atualizados a cada fase |
| Mudança do runtime da Cloudflare quebra o Nest | todas | CI gera o bundle a cada push; Dockerfile mantido como saída para outro host |

---

## Em aberto

Decisões que precisam da Associação São Francisco antes da fase indicada:

- **Fase 0:** quem será admin do sistema (sugestão: duas pessoas, para a associação não ficar sem acesso se uma sair).
- **Fase 0:** ligar o Cloudflare Access como camada extra de entrada? Protege mais, mas pede uma verificação por e-mail a mais ao entrar.
- **Fase 1:** o número de identificação no formato `AAAA-NNNN` atende, ou a associação já usa outro? Animais já cadastrados em papel mantêm o número antigo?
- ~~**Fase 1:** filhote sem sexo identificado precisa de uma terceira opção?~~ **Decidido (17/10/2026): sim.** O enum `sexo` ganha `nao_identificado`; os indicadores de machos e fêmeas mostram essa terceira contagem.
- ~~**Fase 2:** quais vacinas e intervalos de reforço a associação usa?~~ **Respondido (17/10/2026):** cães V8 (às vezes V10) e antirrábica; gatos ainda a confirmar; 3 doses com 21 dias na primeira vez e reforço anual.
- **Fase 2:** a coordenação quer o resumo diário de pendências por e-mail?
- **Fase 4:** o termo de adoção atual da associação (para alinhar campos e base legal).
- **Fase 4:** por quanto tempo guardar os dados do adotante depois da adoção.
- **Fase 4:** haverá acompanhamento pós-adoção (visita, contato)? Isso muda a base legal e o prazo.
- **Fase 5:** confirmar cada regra do dicionário de indicadores.
