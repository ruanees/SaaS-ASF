---
adr: 5
status: aceita
data: 2026-10-16
---

# 0005. Sistema interno de uma associação só, sem separação por organização

## Situação

**Aceita** em 16/10/2026.

## Contexto

O sistema é de uso interno da Associação São Francisco. Não haverá outras associações, cadastro aberto nem cobrança. Um desenho multi-organização (`org_id` em toda tabela, chave estrangeira composta, seletor de organização) só faz sentido se houver mais de uma.

## Decisão

- Nenhuma tabela tem `org_id`. Chaves estrangeiras simples.
- A configuração da associação (nome, fuso, prazo de retenção) fica numa tabela `configuracoes` de uma linha só.
- Quem entra no sistema está em `usuarios` (papel e `ativo`). Conta no Supabase Auth sem linha ativa ali não lê nada.
- O cadastro público do Supabase Auth fica desligado; só entra quem o admin convida.
- A RLS continua ligada e forçada em toda tabela: ela separa os papéis e barra quem não foi convidado.
- O número do animal é sequencial por ano (`AAAA-NNNN`), sem prefixo de organização.

## Consequências

- Menos colunas, políticas mais curtas, consultas mais simples, menos lugares para errar.
- Sem seletor de organização no front: depois do login, a pessoa cai no painel.
- Se um dia o sistema atender outra associação, a migração é grande: acrescentar `org_id` em todas as tabelas, refazer chaves e políticas. Aceito, porque não está previsto.

## Alternativas consideradas

- **Manter `org_id` por precaução.** Custo pago em toda migração e toda política, para um uso que não existe.
- **Uma instância por associação, se outra aparecer.** Continua sendo a saída mais barata nesse caso: outro projeto Supabase e outro deploy com o mesmo código.

## Substitui

A versão anterior deste registro (multi-organização por `org_id` com chave estrangeira composta), descartada antes de qualquer código.
