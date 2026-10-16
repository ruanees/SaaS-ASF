# SaaS-ASF

Sistema interno da **Associação São Francisco** para cadastrar, organizar e acompanhar os animais atendidos: histórico, vacinação, castração, atendimento veterinário, adoções, devoluções e indicadores de gestão.

Uso interno: uma associação só, acesso apenas por convite.

## Estrutura

| Pasta | O que é |
|---|---|
| [`asf-back/`](asf-back/) | NestJS (BFF) em Cloudflare Workers, banco Supabase (Postgres com RLS), migrações e provas pgTAP |
| [`asf-front/`](asf-front/) | Next.js (App Router) em Cloudflare Workers |

As duas pastas são projetos independentes dentro do mesmo repositório ([ADR 0009](asf-back/docs/adr/0009-um-repositorio-duas-pastas.md)).

## Documentos

- [Plano de desenvolvimento](PLANO-DESENVOLVIMENTO.md): fases, banco, LGPD, segurança e regras do projeto
- [Registros de decisão (ADR)](asf-back/docs/adr/README.md)
