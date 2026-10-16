---
adr: 3
status: aceita
data: 2026-10-16
---

# 0003. Situação, local e disponibilidade em três colunas

## Situação

**Aceita** em 16/10/2026.

## Contexto

O briefing lista oito opções de "situação e localização": na sede, em lar temporário, em clínica ou internado, disponível para adoção, adotado, castrado e devolvido à comunidade, transferido, óbito. Um animal pode estar disponível para adoção **e** em lar temporário ao mesmo tempo. Os indicadores pedem as duas contagens separadas.

## Decisão

- `situacao`: `em_acolhimento`, `adotado`, `devolvido_comunidade`, `transferido`, `obito`.
- `local`: `sede`, `lar_temporario`, `clinica`; só quando `em_acolhimento`.
- `disponivel_adocao`: booleano; só quando `em_acolhimento`.
- Uma `check constraint` impede combinações inválidas.
- As três colunas só mudam pela função `mover_animal`, que grava também a linha em `movimentacoes`. O `update` direto é revogado.
- A tela continua mostrando as oito opções como o cliente pediu.

## Consequências

- "Disponíveis para adoção" e "em lares temporários" contam certo.
- O histórico de situação nunca diverge do estado atual, porque os dois são gravados juntos.
- A tela precisa traduzir a escolha do usuário para as três colunas.

## Alternativas consideradas

- **Um enum com as oito opções.** Mais simples, mas cada animal só entra em um indicador, e os números da gestão saem errados.
