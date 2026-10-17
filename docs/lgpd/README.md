# LGPD — rascunhos para revisão jurídica

> **Rascunhos.** Estes textos organizam o que o sistema faz com dados pessoais, para a Associação São Francisco e a assessoria jurídica revisarem. Não são parecer jurídico. Nada aqui vale antes da revisão e da aprovação da diretoria.

| Documento | Para quem | O que é |
|---|---|---|
| [Política de privacidade](politica-de-privacidade.md) | Adotantes, lares temporários, voluntários, público | O que a associação faz com os dados, por quanto tempo e como pedir acesso, correção ou anonimização. Inclui o **aviso curto** que aparece no formulário de pessoa e no termo de adoção. |
| [Registro das operações de tratamento](registro-operacoes-tratamento.md) | Associação (documento interno, art. 37) | Cada uso de dado pessoal: finalidade, base legal, quem acessa, fornecedores, prazo e medidas de segurança. |
| [Acordo entre controladora e operador](acordo-controladora-operador.md) | Associação e quem desenvolve e mantém o sistema | O que o operador pode e não pode fazer com os dados, segurança, incidentes e fim do contrato. |

## Decisões que a associação precisa tomar

Os campos entre colchetes nos documentos dependem destas respostas:

1. **Encarregado (art. 41):** quem responde aos titulares e à ANPD, com nome e um e-mail de contato. Pode ser alguém da diretoria.
   - **A conferir:** a associação pode se enquadrar como agente de tratamento de pequeno porte (Resolução CD/ANPD nº 2/2022). Nesse caso, indicar um encarregado deixa de ser obrigatório, mas continua sendo preciso manter um canal de atendimento.
2. **Prazo de retenção** dos dados de adotantes e lares temporários depois do fim do vínculo. O sistema sugere **60 meses** (`configuracoes.retencao_pessoas_meses`).
3. **Acompanhamento pós-adoção** (visita, contato): se houver, ele muda a finalidade e pode mudar o prazo.
4. **Termo de adoção atual:** é preciso alinhar os campos e a base legal com ele.
5. **Dados da associação:** razão social, CNPJ e endereço.
6. **Quem desenvolve e mantém o sistema** é membro da associação ou alguém de fora? Se for de fora, o acordo de operador se aplica.

## Como estes documentos se ligam ao sistema

O que está escrito aqui é cumprido pelo código. Se uma regra mudar, o código muda junto. A referência técnica é a seção 04 do [plano](../../PLANO-DESENVOLVIMENTO.md).

| Compromisso no documento | Onde o sistema cumpre |
|---|---|
| Só quem precisa vê o contato | RLS de `pessoas_contato`: só admin e coordenação leem (ADR 0006, Fase 4) |
| Registro de quem acessou o contato | Tabela `auditoria`, que guarda o nome do campo e nunca o valor (migração 002) |
| Anonimizar em vez de apagar | Função `anonimizar_pessoa` (ADR 0007, Fase 4) |
| Retenção com aprovação | Rotina semanal que lista o que passou do prazo, para a coordenação aprovar (Fase 6) |
| Foto sem localização | O front reprocessa a imagem e remove o EXIF com GPS antes do envio (Fase 1) |
| Dado no Brasil | Banco no Supabase, região São Paulo (ADR 0008) |
| Sem dado pessoal em log e monitoramento | Filtro `beforeSend` do Sentry; os erros do back não trazem dado (Fase 0) |
| Só entra quem é convidado | Cadastro público desligado; conta sem convite ativo não lê nada (migração 001, provas pgTAP) |
