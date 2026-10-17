---
adr: 10
status: aceita
data: 2026-10-17
---

# 0010. Fase 4 construída antes da revisão da LGPD, com padrões provisórios

## Situação

**Aceita** em 17/10/2026. Muda a condição de abertura da Fase 4 no plano ("a seção 04 precisa estar revisada pela associação"). Os ADRs 0006 e 0007 continuam valendo inteiros.

## Contexto

A Fase 4 é a primeira que guarda dado pessoal: nome, telefone e endereço de adotantes e lares temporários. O plano pedia que a associação revisasse a seção de LGPD antes de abrir a fase. As perguntas 13 a 22 do questionário (termo de adoção, prazo de guarda, dados do lar temporário, entidades de transferência, local da devolução à comunidade, encarregado, advogado) ainda não foram respondidas. A equipe decidiu não parar o desenvolvimento por isso.

## Decisão

- A Fase 4 é construída agora, com os padrões que o plano já sugeria:
  - prazo de guarda de 60 meses (`configuracoes.retencao_pessoas_meses`, alterável);
  - da pessoa, só nome, telefone, e-mail e endereço; o endereço só para adotante e lar temporário;
  - bases legais da tabela da seção 04: execução de contrato, acordo de voluntariado, consentimento e legítimo interesse;
  - aviso de privacidade com o texto do rascunho em `docs/lgpd/`.
- O destino da transferência é um texto livre (nome da entidade), não uma pessoa: entidade não é dado pessoal e não precisa de contato no sistema.
- Na devolução à comunidade o local (bairro) é opcional, no mesmo campo de destino, até a associação responder a pergunta 18.
- O responsável atual do lar temporário fica em `animais.pessoa_id`, gravado só por `mover_animal`, como situação e local (ADR 0003).
- **Nenhuma pessoa real é cadastrada antes de a associação revisar o aviso de privacidade e as bases legais.** As telas vão para o endereço publicado no merge, mas o uso com dado real espera essa revisão.

## Consequências

- Quando as respostas chegarem, os ajustes são de texto e de configuração (prazo, aviso, rótulos), não de estrutura.
- Se a associação pedir um campo novo de pessoa, ele entra por migração e por decisão escrita (ADR 0007).
- Até a revisão, a responsabilidade de não cadastrar dado real é de quem administra o sistema.

## Alternativas consideradas

- **Esperar as respostas.** Mais seguro, mas parava o projeto sem prazo.
- **Fazer só a parte sem dado pessoal (transferência e devolução à comunidade).** Considerada; a equipe preferiu a fase inteira.
