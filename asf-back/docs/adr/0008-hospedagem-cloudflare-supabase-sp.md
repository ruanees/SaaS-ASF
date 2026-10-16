---
adr: 8
status: aceita
data: 2026-10-16
---

# 0008. Hospedagem: Cloudflare Workers e Supabase na região São Paulo

## Situação

**Aceita** em 16/10/2026.

## Contexto

O cliente é uma associação voluntária: custo baixo importa. O projeto DIME já publica Next.js e NestJS em Cloudflare Workers e usa Supabase. A LGPD favorece manter o banco no Brasil.

## Decisão

- Front em Cloudflare Workers pelo adaptador `@opennextjs/cloudflare`.
- Back (NestJS) em Cloudflare Workers com `nodejs_compat`, a flag `enable_nodejs_http_server_modules` e os `alias` no `wrangler.toml`.
- Rotinas agendadas por Cron Triggers do Worker do back.
- Supabase (Postgres, Auth, Storage, Edge Function) na região São Paulo; plano pago em produção, por causa do backup.
- Publicação pelo Workers Builds, sem token de API no GitHub.

## Consequências

- Custo de hospedagem do código próximo de zero no volume previsto.
- Herdamos as armadilhas que o DIME documentou: nada de Swagger UI no Worker, configuração no `wrangler.toml` e não só no painel, `buildCommand` próprio no OpenNext, CI rodando `npm run build`.
- PDF gerado no servidor (navegador headless) não roda no Worker; impressão é pelo navegador.

## Alternativas consideradas

- **Fly.io ou Railway para o Nest.** Os planos gratuitos acabaram, e seria um segundo fornecedor.
- **Vercel para o Next.** Funciona, mas separa o front do restante na Cloudflare sem ganho para este volume.

## Quando reabrir

Se o runtime do Workers deixar de rodar o Nest, o Dockerfile mantido no repositório permite publicar em outro host.
