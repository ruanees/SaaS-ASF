# SaaS-ASF

Sistema interno da Associação São Francisco: cadastro e acompanhamento de animais, saúde, prontuário, adoções e indicadores.

## Antes de qualquer tarefa

1. Ler `PLANO-DESENVOLVIMENTO.md` (o plano vivo, com as fases e as regras permanentes da seção 08).
2. Ler o `CLAUDE.md` da pasta onde vai mexer: `asf-back/CLAUDE.md` ou `asf-front/CLAUDE.md`.
3. Conferir as decisões em `asf-back/docs/adr/`.

## Estrutura (ADR 0009)

```
asf-back/     NestJS (BFF) + Supabase (migrações, pgTAP, Edge Function) + ADRs
asf-front/    Next.js (App Router)
```

- As duas pastas são projetos independentes, como se fossem repositórios separados. Cada uma tem seu `package.json`, sua CI e seu deploy.
- Nada importa arquivo da outra pasta. O único contrato entre front e back é o `/openapi.json`.
- Sem npm workspaces nem ferramenta de monorepo na raiz.
- A ideia é separar em dois repositórios depois (`git subtree split`); por isso nada pode depender de estar no mesmo repositório.

## Como trabalhamos

- Uma fase só começa quando a anterior estiver fechada (critério "Pronto quando" de cada fase).
- Ao terminar um item do plano, marcar `[x]` no `PLANO-DESENVOLVIMENTO.md`.
- Mudou uma decisão: ADR novo, nunca editar o antigo.
- Commits e textos do projeto em português.
- Nenhum segredo commitado. Token colado em chat, issue ou log é considerado vazado.
