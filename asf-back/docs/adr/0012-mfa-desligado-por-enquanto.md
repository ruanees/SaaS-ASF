---
adr: 12
status: aceita
data: 2026-10-19
---

# 0012. MFA desligado por enquanto; o código fica guardado para voltar

## Situação

**Aceita** em 19/10/2026, por decisão do usuário ("tire a autenticação de dois fatores por hora, futuramente retornamos com ela"). Suspende a exigência de MFA para admin e coordenação (plano, seção 05, e migração `20261021090000_mfa.sql`).

## Contexto

O MFA (TOTP) para admin e coordenação entrou no ar na Fase 6. Antes de a associação começar a usar o sistema, a equipe preferiu tirar essa etapa do login e retomá-la mais tarde.

## Decisão

- A migração `20261023090000_mfa_desligado.sql` volta `app.papel()` à versão da migração 001: admin e coordenação leem só com a sessão de senha (`aal1`).
- `minha_situacao_acesso()` continua existindo e passa a responder `exige_mfa = false`. O back só pede o código quando ela diz que é exigido, então a tela `/mfa` não aparece para ninguém.
- O código do MFA fica no repositório, sem uso: a tela `/mfa`, as rotas `/sessao/mfa/*` e o tratamento de `mfa_obrigatorio` no back e no front.
- **Para religar:** uma migração nova com a `app.papel()` e a `minha_situacao_acesso()` da migração `20261021090000_mfa.sql`, e a prova 003 voltando a exigir `aal2`.

## Consequências

- O login de admin e coordenação depende só da senha. A proteção restante: convite obrigatório, cadastro público desligado, RLS em todas as tabelas, auditoria de acesso a contato e exportação, e desativação imediata de quem sai.
- Uma senha de admin vazada dá acesso total até alguém desativar o usuário. O roteiro de incidente (`docs/lgpd/roteiro-incidente.md`) cobre esse caso.
- Quem já configurou o autenticador não precisa fazer nada; o fator continua cadastrado no Supabase Auth e volta a valer quando o MFA for religado.

## Alternativas consideradas

- **Apagar o código do MFA.** Faria refazer tudo depois.
- **Deixar o MFA opcional.** Mais telas e regras para algo que vai voltar a ser obrigatório.
