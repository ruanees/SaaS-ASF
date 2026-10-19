# Registros de decisão de arquitetura

Cada registro guarda o porquê de uma escolha: o contexto, a decisão, as consequências aceitas e as alternativas descartadas. Mudar uma decisão é escrever um registro novo que substitui o antigo, não editar o antigo.

| Nº | Decisão | Situação |
|---|---|---|
| [0001](0001-dois-repositorios-contrato-openapi.md) | Dois repositórios, sem monorepo; contrato pelo OpenAPI | aceita; parte dos dois repositórios substituída pela 0009 |
| [0002](0002-bff-nest-regra-de-acesso-no-banco.md) | NestJS como BFF; regra de acesso no Postgres | aceita |
| [0003](0003-situacao-local-disponibilidade.md) | Situação, local e disponibilidade em três colunas | aceita |
| [0004](0004-prontuario-linha-do-tempo-unica.md) | Prontuário como linha do tempo única; estado de saúde calculado | aceita |
| [0005](0005-sistema-interno-sem-multi-organizacao.md) | Sistema interno de uma associação só, sem separação por organização | aceita |
| [0006](0006-contato-de-pessoa-em-tabela-separada.md) | Contato de pessoa em tabela separada | aceita |
| [0007](0007-lgpd-controladora-anonimizacao.md) | LGPD: associação controladora; anonimizar em vez de apagar | aceita |
| [0008](0008-hospedagem-cloudflare-supabase-sp.md) | Hospedagem: Cloudflare Workers e Supabase na região São Paulo | aceita |
| [0009](0009-um-repositorio-duas-pastas.md) | Um repositório com duas pastas independentes, separável depois | aceita |
| [0010](0010-fase-4-antes-da-revisao-lgpd.md) | Fase 4 construída antes da revisão da LGPD, com padrões provisórios | aceita |
| [0011](0011-prazo-de-guarda-calculado-na-abertura.md) | Prazo de guarda calculado a cada abertura, sem rotina agendada | aceita; substitui a parte da rotina semanal do 0007 |
| [0012](0012-mfa-desligado-por-enquanto.md) | MFA desligado por enquanto; o código fica guardado para voltar | aceita |
