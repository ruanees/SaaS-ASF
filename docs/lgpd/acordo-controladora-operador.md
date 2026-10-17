# Acordo de tratamento de dados pessoais entre controladora e operador

> **Rascunho para revisão jurídica.** Versão de 17/10/2026. Só se aplica se quem desenvolve e mantém o sistema **não for membro da associação**. A redação final deve ser feita pela assessoria jurídica.

## Partes

**Controladora:** Associação São Francisco Defensora dos Animais, [razão social], CNPJ [00.000.000/0000-00], [endereço], Granja-CE, representada por [nome e cargo].

**Operador:** [nome ou razão social], [CPF/CNPJ], [endereço], que desenvolve e mantém o sistema interno da associação.

## 1. Objeto

O operador trata dados pessoais **apenas para desenvolver, manter, corrigir e operar** o sistema interno da associação, conforme as instruções da controladora (LGPD, art. 39). Nenhum outro uso é permitido.

## 2. O que o operador pode fazer

- Acessar a infraestrutura (Supabase, Cloudflare, repositório e monitoramento) para manter o sistema funcionando.
- Acessar dados de produção **somente quando indispensável** para corrigir um problema, com aviso prévio à controladora, pelo menor tempo e com o menor escopo possíveis.
- Usar os suboperadores listados no [registro das operações](registro-operacoes-tratamento.md#fornecedores-operadores-e-suboperadores).

## 3. O que o operador não pode fazer

- Usar os dados para qualquer finalidade própria ou de terceiros.
- Copiar dados de produção para o computador pessoal, para ambientes de teste, para o repositório de código, para prints ou para mensagens. **Testes usam apenas dados fictícios.**
- Contratar um novo fornecedor que receba dados pessoais sem autorização escrita da controladora.
- Compartilhar credenciais de acesso. Um token colado em chat, issue ou log é considerado vazado e precisa ser trocado no mesmo dia.

## 4. Segurança (art. 46)

O operador mantém, no mínimo, as medidas que já estão no sistema:

- regra de acesso no banco de dados (RLS), com prova automática a cada mudança;
- entrada no sistema só por convite;
- contato de pessoas em tabela separada, que só admin e coordenação leem;
- auditoria sem valores pessoais;
- nenhum dado pessoal em log, monitoramento ou mensagem de erro;
- chave administrativa (`service_role`) restrita a uma única função no servidor;
- dados guardados no Brasil;
- backups diários com teste de restauração;
- dependências atualizadas e verificação de segurança automática.

## 5. Incidentes

O operador avisa a controladora **em até [24 horas]** depois de saber de um incidente que envolva dados pessoais. O aviso informa o que aconteceu, quais dados e titulares foram afetados, as medidas já tomadas e as recomendadas. A comunicação à ANPD e aos titulares cabe à controladora, com o apoio do operador.

## 6. Direitos dos titulares

O operador ajuda a controladora a atender os pedidos dos titulares (art. 18). O sistema já oferece as ferramentas de exportação, correção e anonimização. Se o operador receber um pedido diretamente, ele o repassa à controladora sem responder sozinho.

## 7. Fim do contrato

Ao fim do contrato, o operador:
1. transfere à controladora todos os acessos administrativos (Supabase, Cloudflare, domínio, repositório e monitoramento);
2. apaga qualquer cópia de dados pessoais que tenha e confirma isso por escrito;
3. entrega a documentação atualizada (plano, ADRs e instruções de operação).

**A titularidade de todas as contas de serviço deve ser da associação desde o início**, com o operador como convidado. Assim, a associação não depende do operador para continuar usando o sistema.

## 8. Responsabilidade

[Cláusula a ser redigida pela assessoria jurídica, conforme os arts. 42 a 45 da LGPD.]

## 9. Vigência

[Prazo, forma de renovação e foro.]

---

[Local e data]

______________________________
Controladora

______________________________
Operador
