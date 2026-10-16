---
adr: 4
status: aceita
data: 2026-10-16
---

# 0004. Prontuário como linha do tempo única; estado de saúde calculado

## Situação

**Aceita** em 16/10/2026.

## Contexto

O briefing pede controles de vacinação e castração e, separadamente, um histórico veterinário que também inclui vacinas e castrações. Se cada controle tiver sua tabela e o histórico tiver outra, a mesma vacina pode existir em um lugar e faltar no outro.

## Decisão

- Todo evento clínico é uma linha em `atendimentos`, com `tipo`.
- Tipos com dados próprios têm tabela de detalhe 1:1: `vacinacoes`, `vermifugacoes`, `exames`, `tratamentos`, `internacoes`.
- A castração tem tabela própria porque o agendamento existe antes do atendimento; ela aponta para o atendimento quando é realizada.
- "Vacinado", "vacinação pendente", "castrado" e "em tratamento" são calculados por views. Nunca gravados como campo do animal.
- Atendimento e detalhe são gravados juntos por funções no banco.

## Consequências

- A aba Saúde e a aba Prontuário leem a mesma tabela.
- Os estados de saúde nunca ficam desatualizados.
- As consultas dos indicadores dependem das views; elas precisam de índice em `animal_id` e em `proxima_dose`.

## Alternativas consideradas

- **Campos no animal (`vacinado`, `castrado`).** Rápido de consultar, mas diverge do histórico.
- **Uma tabela por tipo, sem tabela comum.** A linha do tempo vira uma união de dez tabelas.
