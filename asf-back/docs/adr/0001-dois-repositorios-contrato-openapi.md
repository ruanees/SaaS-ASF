---
adr: 1
status: aceita
data: 2026-10-16
---

# 0001. Dois repositórios, sem monorepo; contrato pelo OpenAPI

## Situação

**Aceita** em 16/10/2026.

## Contexto

O sistema da Associação São Francisco tem um front (Next.js) e um back (NestJS), publicados separadamente na Cloudflare. Os dois precisam concordar sobre o formato de cada requisição e resposta. O projeto DIME, que serve de base, já usou essa divisão e funcionou.

## Decisão

- Dois repositórios independentes: `asf-front` e `asf-back`.
- O DTO do Nest é a fonte da verdade do contrato. O `@nestjs/swagger` gera o `/openapi.json`, público e sem guard.
- O front gera os tipos com `openapi-typescript` a partir desse arquivo, no próprio build.
- O SQL (migrações, provas pgTAP, Edge Function) mora no `asf-back`.

## Consequências

- Mudar um DTO sem atualizar o front quebra o build do front, não a produção.
- Não há pacote compartilhado para publicar nem versionar.
- Quem muda uma rota precisa publicar o back antes do front. Rota antiga e nova convivem por um deploy.

## Alternativas consideradas

- **Monorepo com pacote de tipos compartilhado.** Tipos sempre alinhados, mas exige ferramenta de workspace e um build mais lento na Cloudflare. O OpenAPI dá o mesmo resultado sem isso.
- **Front falando direto com o Supabase.** Sem contrato próprio. Ver ADR 0002.
