---
adr: 7
status: aceita
data: 2026-10-16
---

# 0007. LGPD: associação controladora; anonimizar em vez de apagar

## Situação

**Aceita** em 16/10/2026. A redação jurídica (política de privacidade, registro das operações, acordo com quem mantém o sistema) depende de revisão por assessoria.

## Contexto

O sistema trata dado pessoal de adotantes, lares temporários, usuários e veterinários. A Associação São Francisco decide para que esses dados servem. O histórico de adoção precisa continuar existindo para o animal e para os indicadores, mesmo depois que o titular pedir a eliminação ou o prazo de guarda vencer.

## Decisão

- A associação é a controladora e indica um encarregado.
- Quem desenvolve e mantém o sistema, se não for da associação, é operador, com acordo escrito.
- Os fornecedores (Supabase, Cloudflare, Sentry, e-mail) entram no registro das operações de tratamento da associação.
- Só se coleta o que o briefing pede. Campo novo de pessoa exige decisão escrita da associação.
- Toda pessoa tem `base_legal` gravada.
- Pedido de eliminação e fim do prazo de guarda resultam em **anonimização**: contato apagado, nome trocado, `anonimizado_em` gravado. A adoção continua.
- O prazo fica em `configuracoes`; a rotina semanal sugere, a coordenação aprova.
- Banco na região São Paulo. Auditoria, logs e Sentry nunca recebem valor pessoal.
- Fotos são reprocessadas no aparelho para remover EXIF (GPS).
- Usuário que sai da associação é desativado, não apagado.

## Consequências

- O titular pode receber tudo o que existe sobre ele, corrigir e pedir anonimização.
- Os indicadores não mudam quando uma pessoa é anonimizada.
- Uma pessoa anonimizada que volta é um cadastro novo, sem ligação com o antigo.

## Alternativas consideradas

- **Apagar a pessoa.** Quebra o vínculo da adoção e altera os indicadores.
- **Manter tudo indefinidamente.** Contraria a minimização e a limitação de prazo.
