---
adr: 11
status: aceita
data: 2026-10-19
substitui: 0007 (só a parte da "rotina semanal")
---

# 0011. Prazo de guarda calculado a cada abertura, sem rotina agendada

## Situação

**Aceita** em 19/10/2026. Substitui, no ADR 0007, a frase "o prazo fica em `configuracoes`; a rotina semanal sugere, a coordenação aprova". O resto do 0007 continua valendo.

## Contexto

O ADR 0007 previa uma rotina semanal (Cron Trigger do Worker) para listar as pessoas cujo prazo de guarda venceu. Só que uma rotina agendada roda sem usuário. Para ler `pessoas`, ela precisaria da `service_role` dentro do Nest, e isso é proibido (ADR 0002 e regras do back). A alternativa seria uma Edge Function ou o `pg_cron`, mais uma peça para manter só para montar uma lista.

## Decisão

- A lista de quem passou do prazo é a função `pessoas_alem_do_prazo()`, calculada a cada abertura, como as pendências de saúde. Ela fica em Pessoas → Prazo de guarda, para administração e coordenação.
- O fim do vínculo, até a associação responder sobre acompanhamento pós-adoção (pergunta 15), é o último evento com a pessoa: cadastro, adoção, devolução ou movimentação de lar temporário.
- Quem está com animal em lar temporário agora nunca entra na lista.
- Ninguém é anonimizado sozinho: a coordenação abre a pessoa e anonimiza (ADR 0007).
- Os arquivos soltos no Storage seguem o mesmo modelo: lista calculada na abertura (só admin) e botão para apagar.

## Consequências

- Nenhuma credencial de serviço fora de `supabase/functions/`.
- A lista está sempre atualizada; não há "semana" de atraso.
- Ninguém recebe aviso se não abrir a tela. Quando o resumo por e-mail existir (depende do e-mail de envio), ele pode incluir a contagem.

## Alternativas consideradas

- **Cron Trigger com `service_role` no Nest.** Proibido pelas regras do back.
- **`pg_cron` gravando uma tabela de sugestões.** Funciona, mas cria estado a manter para algo que a consulta já calcula.
