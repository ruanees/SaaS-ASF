# asf-back

Back (BFF) e banco do sistema interno da Associação São Francisco: cadastro e acompanhamento de animais, saúde, prontuário, adoções e indicadores.
É de uso interno: uma associação só, sem cadastro aberto. O plano completo, com as fases, está em `../PLANO-DESENVOLVIMENTO.md` (raiz do repositório). As decisões de arquitetura estão em `docs/adr/`. Ler os dois antes de começar uma fase.

Por enquanto esta pasta vive dentro do repositório `SaaS-ASF`, ao lado de `asf-front/` (ADR 0009). Tratar como projeto independente: nada aqui importa arquivo de `../asf-front`, e nada na raiz instala dependência para esta pasta.

## Pilha

- NestJS + TypeScript, publicado em Cloudflare Workers (`nodejs_compat`, `enable_nodejs_http_server_modules`)
- Supabase: Postgres com RLS, Auth (cadastro público desligado), Storage, uma Edge Function administrativa
- Migrações e provas: Supabase CLI + pgTAP
- Validação: `class-validator` + `class-transformer`
- Contrato: `@nestjs/swagger` gerando `/openapi.json`
- Monitoramento: Sentry (`@sentry/cloudflare`)
- Rotinas: Cron Triggers do Worker

## Sempre

- A regra de acesso mora no banco. O Nest valida formato (DTO); a RLS valida permissão.
- O cliente Supabase é criado por requisição, com a chave anônima e o JWT de quem chamou.
- Escrita que mexe em mais de uma tabela é uma função no banco, chamada por RPC, numa transação.
- Toda mudança de banco é uma migração em `supabase/migrations/`.
- Toda tabela nova: `enable` e `force row level security`, uma política por operação com `to authenticated`, colunas `criado_em/criado_por/atualizado_em/atualizado_por` por trigger.
- Toda política ou regra nova tem prova pgTAP, incluindo a prova de que conta sem linha ativa em `usuarios` não lê nada.
- Permissão por papel com `app.papel()` e `app.tem_papel(...)`, sempre dentro de `(select ...)` nas políticas.
- Funções `security definer` com `set search_path = ''`.
- Views sobre tabelas com RLS: `with (security_invoker = true)`.
- "Hoje" é `app.hoje()` (fuso de `configuracoes`, padrão `America/Fortaleza`).
- Estado calculável (vacinado, pendente, castrado, idade, em tratamento) sai de view, nunca de coluna.
- Erro do banco (tem `code`) vira 4xx com frase em português; falha de rede (sem `code`) vira 503.
- Rota nova convive com a antiga por um deploy; a antiga sai num passo separado.
- Campo novo é conferido contra o que está gravado no banco.
- Mock e seed usam o formato real do dado e apenas dados inventados.

## Nunca

- Nunca usar `service_role` no Nest. Ela existe só em `supabase/functions/`.
- Nunca repetir no Nest uma checagem de permissão que a RLS já faz.
- Nunca criar política `for all`.
- Nunca mudar o banco pelo painel do Supabase.
- Nunca ligar o cadastro público do Supabase Auth.
- Nunca acrescentar `org_id` ou separação por organização (ADR 0005).
- Nunca gravar `situacao`, `local` ou `disponivel_adocao` direto; só por `mover_animal`.
- Nunca apagar uma pessoa; anonimizar com `anonimizar_pessoa`. Nunca apagar um usuário; desativar.
- Nunca colocar dado pessoal (nome, telefone, e-mail, endereço) em log, auditoria, Sentry, mensagem de erro, seed ou mock.
- Nunca usar `current_date` em regra de negócio.
- Nunca ligar a Swagger UI (`swagger-ui-dist` usa `__dirname` e derruba o Worker no boot).
- Nunca cadastrar configuração só no painel da Cloudflare; o `wrangler deploy` sobrescreve.
- Nunca fazer cache de URL assinada só pelo caminho; a chave inclui quem pediu.
- Nunca commitar `.env` nem colar token em chat, issue ou log.

## Onde fica cada coisa

```
src/
  auth/            guard global, @Publico(), sessão
  comum/           filtro de erro, pipes, decorators
  supabase/        SupabaseService (cliente por requisição)
  usuarios/        usuários, papéis, convites (pela Edge Function)
  configuracoes/   fuso, retenção, catálogo de vacinas, clínicas
  animais/         animais, fotos, movimentações
  saude/           vacinas, vermifugação, castração, pendências
  prontuario/      atendimentos, exames, tratamentos, internações
  pessoas/         pessoas e contato
  adocoes/         adoções e devoluções
  indicadores/     indicadores e ReportBuilderService
  lgpd/            exportação do titular, anonimização, retenção
  rotinas/         Cron Triggers
supabase/
  migrations/      SQL versionado
  tests/           provas pgTAP
  functions/       Edge Function admin (única com service_role)
  seed.sql         um usuário fictício de cada papel, animais fictícios
docs/adr/          registros de decisão
```

## Como rodar

Os scripts abaixo são criados na Fase 0.

```bash
npm run dev            # Nest local
npm run build          # o mesmo comando que a Cloudflare roda
npm run typecheck
npm run lint
npm test               # testes do Nest
npm run openapi        # gera openapi.json e confere que não quebrou
supabase start         # banco local
supabase db reset      # aplica migrações e seed do zero
supabase test db       # provas pgTAP
npx wrangler dev       # Worker local
```

## O que é arriscado e pede revisão

- Qualquer migração que mexe em política de RLS, função `security definer` ou `grant`.
- Qualquer coisa em `usuarios`, `pessoas`, `pessoas_contato`, `adocoes` e `auditoria`.
- Qualquer mudança em `supabase/functions/`.
- `wrangler.toml`: flags e `alias` sem os quais o bundle não gera.
- Rotinas agendadas: precisam ser repetíveis.

## Links

- Plano: `../PLANO-DESENVOLVIMENTO.md`
- Decisões: `docs/adr/README.md`
- Contrato: `/openapi.json` do back publicado
- Diagnóstico: `/saude` (diz se cada configuração existe e de onde veio, nunca o valor)
