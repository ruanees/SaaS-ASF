---
adr: 13
status: aceita
data: 2026-10-20
---

# 0013. Respostas da associação: documentos da pessoa, prazo de guarda e acompanhamento

## Situação

**Aceita** em 20/10/2026, a partir das respostas da associação ao questionário (perguntas 13 a 18 e 23 a 25). Completa o ADR 0010 (padrões provisórios) e o ADR 0011 (prazo calculado na abertura). A revisão jurídica e o encarregado (perguntas 19 a 22) continuam pendentes.

## Contexto

O ADR 0007 diz que campo novo de pessoa exige decisão escrita da associação. As respostas trouxeram essa decisão:
- o lar temporário precisa de CPF ou identidade;
- o termo de adoção usado hoje pede identidade, CPF, endereço com bairro e cidade, profissão e telefones do adotante; do animal, raça e cor da pelagem;
- o acompanhamento pós-adoção (visita, fotos e vídeos por WhatsApp) vai até o fim da vida do animal;
- os dados do adotante devem ficar "para sempre, se der; se não, 5 anos".

## Decisão

- **Contato da pessoa** ganha CPF (conferido pelos dígitos verificadores e guardado só com números), RG e profissão. Ficam em `pessoas_contato`, que só administração e coordenação leem, e só pela função `ler_contato`, que registra a leitura na auditoria (ADR 0006). Só para adotante e lar temporário.
- **Animal** ganha raça e cor da pelagem.
- **Termo de adoção** gerado pelo sistema a partir do modelo da associação (cláusulas sem mudança), com o aviso de privacidade no fim. Gerar o termo lê o contato do adotante e fica na auditoria.
- **"Para sempre" não é possível pela LGPD** (limitação da finalidade e do prazo). A solução que atende a associação: o vínculo do adotante dura enquanto existir a finalidade, que é acompanhar o animal até o fim da vida. Enquanto houver adoção sem devolução de animal vivo, a pessoa nunca entra na lista de prazo de guarda. Os **60 meses** (5 anos) contam do último evento: óbito do animal adotado, devolução, último acompanhamento ou última passagem por lar temporário.
- **Óbito de animal adotado** passa a ser registrável na aba Situação, para fechar o acompanhamento.
- **Acompanhamento pós-adoção** registrado por qualquer papel (data, forma, observação). Anonimizar a pessoa apaga as observações.
- **Devolução à comunidade** exige o bairro ou a rua (pergunta 18).
- **Transferência:** a associação só transfere animais silvestres (Ibama, Instituto Pró-Silvestre), que hoje não são cadastrados no sistema. O campo continua livre, com essas duas sugestões.
- **Indicadores:** a associação concordou com o dicionário do plano (pergunta 23).
- **Relatório social** do período para o programa Sua Nota Tem Valor (SEFAZ-CE): o que a associação fez, mês a mês, sem dado pessoal. A parte financeira fica fora do sistema.

## Consequências

- O registro das operações de tratamento e a política de privacidade passam a citar CPF, RG e profissão, e o prazo contado do fim do acompanhamento.
- CPF e RG aumentam o cuidado necessário com exportação e incidente; o roteiro de incidente já cobre.
- Animais atuais: a associação não tem planilha, então não há migração de dados. Os animais são cadastrados pela tela.

## Alternativas consideradas

- **Guardar para sempre.** Contraria a LGPD; a finalidade (acompanhar o animal) é que define o prazo.
- **Pedir CPF e RG de todos.** Minimização: só para quem fica com o animal.
