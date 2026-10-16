---
adr: 2
status: aceita
data: 2026-10-16
---

# 0002. NestJS como BFF; regra de acesso no Postgres

## Situação

**Aceita** em 16/10/2026.

## Contexto

O sistema guarda contato de adotantes e tem quatro papéis com acessos diferentes. A regra de quem vê o quê pode morar no banco (RLS) ou no servidor de aplicação. Se morar nos dois, as duas versões se desencontram sem erro nenhum; o DIME já teve bug dessa família.

## Decisão

- A regra de acesso mora no Postgres: RLS forçada em toda tabela e funções `security definer` para escritas que mexem em mais de uma tabela.
- O NestJS é um BFF: recebe o JWT da sessão, valida o formato da entrada (DTO) e repassa ao Supabase com a chave anônima e o JWT de quem pediu.
- O Nest não usa `service_role` e não repete checagem de permissão.
- A `service_role` existe só numa Edge Function do Supabase, para convidar e desativar usuários.

## Consequências

- Uma regra de acesso, um lugar. As provas pgTAP na CI conferem a regra onde ela de fato vale.
- O navegador não tem nenhuma credencial.
- Cada requisição passa por um salto a mais, e há um segundo serviço para publicar.
- Rotinas agendadas e envio de e-mail têm um lugar natural (o Nest).

## Alternativas consideradas

- **Front direto no Supabase.** Mais simples para um sistema interno deste tamanho, mas expõe a estrutura do banco ao navegador, não dá contrato tipado e não tem lugar para rotinas.
- **Nest com `service_role` e regra de acesso em TypeScript.** Duplicaria a RLS em outra linguagem.

## Quando reabrir

Se o Nest virar só repasse, sem validação, rotina ou integração, avaliar remover o BFF.
