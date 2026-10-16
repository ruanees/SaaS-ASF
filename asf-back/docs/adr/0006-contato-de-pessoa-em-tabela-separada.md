---
adr: 6
status: aceita
data: 2026-10-16
---

# 0006. Contato de pessoa em tabela separada

## Situação

**Aceita** em 16/10/2026.

## Contexto

O voluntário precisa ver o nome de quem está com um animal em lar temporário. Ele não deve ver telefone, e-mail nem endereço. A RLS do Postgres decide linhas, não colunas.

## Decisão

- `pessoas` guarda nome, base legal e o vínculo; todos os papéis leem.
- `pessoas_contato` (1:1) guarda telefone, e-mail e endereço; só admin e coordenação leem e gravam.
- A leitura de contato passa pela função `ler_contato`, que registra o acesso na auditoria.
- Anonimizar apaga a linha de `pessoas_contato` e troca o nome.

## Consequências

- O corte é feito pela RLS, não pela tela.
- Anonimizar é simples e verificável: a linha de contato deixa de existir.
- Cadastrar uma pessoa grava em duas tabelas, por uma função.

## Alternativas consideradas

- **View com `security definer` escondendo colunas.** Funciona até alguém consultar a tabela original com uma política mal escrita.
- **Permissão de coluna (`grant select (nome)`).** Válida no Postgres, mas fácil de desfazer sem perceber num `grant` amplo de outra migração.
