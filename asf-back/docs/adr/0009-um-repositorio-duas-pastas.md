---
adr: 9
status: aceita
data: 2026-10-16
substitui: 0001 (só a parte dos dois repositórios)
---

# 0009. Um repositório com duas pastas independentes, separável depois

## Situação

**Aceita** em 16/10/2026. Substitui a parte do ADR 0001 que pedia dois repositórios. O resto do 0001 (contrato pelo OpenAPI, SQL no back) continua valendo.

## Contexto

O ADR 0001 pedia `asf-front` e `asf-back` em repositórios separados. Para começar, a associação tem um repositório só no GitHub (`ruanees/SaaS-ASF`), e manter dois repositórios desde o primeiro dia é mais trabalho de configuração (dois conjuntos de proteção de `main`, Dependabot, CI e PRs) sem ganho enquanto uma pessoa desenvolve. A intenção declarada é separar em dois repositórios mais tarde.

## Decisão

- Um repositório, `SaaS-ASF`, com duas pastas na raiz: `asf-front/` e `asf-back/`.
- **As duas pastas são projetos independentes, como se fossem repositórios separados:** cada uma tem seu `package.json`, seu `package-lock.json`, seu `CLAUDE.md`, seu `.env.example`, seu `wrangler.toml` e sua CI.
- **Sem ferramenta de workspace** (npm workspaces, Turborepo, pnpm): nada na raiz instala dependência para as duas.
- **Nenhuma importação entre as pastas.** O front não importa arquivo do back por caminho relativo (`../asf-back/...`). O único contrato continua sendo o `/openapi.json`.
- A raiz guarda só o que é dos dois: `PLANO-DESENVOLVIMENTO.md`, `CLAUDE.md` de orientação, `README.md`, `.gitignore` e `.github/`.
- Na Cloudflare, cada Worker aponta o Workers Builds para a sua pasta (diretório raiz do build = `asf-front` ou `asf-back`).
- Na CI, cada fluxo roda só quando a sua pasta muda (`paths: ['asf-front/**']`).

## Consequências

- Separar depois é mecânico: `git subtree split --prefix=asf-back` (ou `git filter-repo --subdirectory-filter asf-back`) gera um repositório com o histórico só daquela pasta. Como nada cruza as pastas, nenhum código precisa mudar na separação; só os caminhos da CI e do Workers Builds.
- Um PR pode mexer nas duas pastas ao mesmo tempo. Isso é cômodo, mas a regra de publicar o back antes do front (ADR 0001) continua valendo: rota antiga e nova convivem por um deploy.
- O plano e os ADRs são um só para os dois lados. Na separação, os ADRs vão com o `asf-back` e o plano é copiado para os dois, como estava previsto.

## Alternativas consideradas

- **Dois repositórios desde já (ADR 0001).** Fica como destino. Adiado por custo de configuração.
- **Monorepo com workspaces e pacote de tipos compartilhado.** Descartado pelo mesmo motivo do ADR 0001, e porque prenderia as pastas uma à outra e dificultaria a separação.
