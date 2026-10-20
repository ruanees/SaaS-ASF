# Política de privacidade — Associação São Francisco Defensora dos Animais

> **Rascunho para revisão jurídica.** Versão de 17/10/2026. Os campos entre colchetes dependem de decisões da associação (ver [README](README.md)).

## 1. Quem cuida dos seus dados

A **Associação São Francisco Defensora dos Animais** ([razão social], CNPJ [00.000.000/0000-00], [endereço], Granja-CE) é a **controladora** dos dados pessoais tratados no seu sistema interno de acompanhamento de animais. É ela quem decide para que os dados servem e por quanto tempo ficam guardados.

**Contato para assuntos de privacidade (encarregado):** [nome], [e-mail].

## 2. Que dados guardamos, de quem e para quê

A associação guarda apenas o necessário para cuidar dos animais e acompanhar quem fica com eles.

| De quem | Quais dados | Para quê |
|---|---|---|
| **Adotante** | Nome, telefone, e-mail e endereço | Registrar a adoção, fazer o termo de adoção e falar com você sobre o animal |
| **Lar temporário** | Nome, telefone, e-mail e endereço | Saber onde o animal está e falar com você enquanto ele estiver sob seus cuidados |
| **Voluntário ou membro com acesso ao sistema** | Nome, e-mail e papel na associação | Permitir a entrada no sistema e registrar quem fez cada alteração |
| **Veterinário que atende o animal** | Nome e CRMV | Registrar quem fez o atendimento |
| **Quem usa o sistema** | Endereço IP e identificador da sessão | Segurança e investigação de acessos indevidos |

**O que a associação não pede:** CPF, RG, renda, fotos da casa nem redes sociais. Isso só muda se a associação decidir por escrito, explicando para que o dado serve.

**Fotos dos animais:** o sistema remove automaticamente a localização (GPS) gravada nas fotos de celular antes de guardá-las. Evitamos fotos em que apareçam pessoas.

Os dados dos animais (vacinas, exames e histórico) não são dados pessoais.

## 3. Por que podemos tratar esses dados (base legal)

| Uso | Base legal (LGPD, art. 7º) |
|---|---|
| Adoção e termo de adoção | Execução de contrato (o termo de adoção), inciso V |
| Lar temporário | Execução de contrato ou acordo de voluntariado, inciso V |
| Acesso de voluntários ao sistema | Execução de contrato ou acordo de voluntariado, inciso V |
| Registro do veterinário no atendimento | Legítimo interesse da associação, inciso IX |
| IP e sessão, para segurança | Legítimo interesse da associação, inciso IX |

## 4. Quem tem acesso

- **Dentro da associação:** só a administração e a coordenação veem telefone e endereço. Voluntários e veterinários veem o nome de quem está com o animal, mas não os seus contatos. Todo acesso ao contato fica registrado.
- **Fornecedores que guardam ou processam dados** para o sistema funcionar:

  | Fornecedor | O que faz | Onde |
  |---|---|---|
  | Supabase | Banco de dados, login e arquivos | Brasil (São Paulo) |
  | Cloudflare | Hospedagem do sistema e proteção contra ataques | Rede mundial; os dados ficam guardados no Brasil |
  | [Sentry] | Monitoramento de erros, sem dados pessoais | [Estados Unidos] |
  | [Resend ou outro] | Envio de e-mails de acesso (convite e troca de senha) | [a confirmar] |

  Quando um fornecedor processa dados fora do Brasil, enviamos apenas o mínimo necessário e registramos essa transferência (LGPD, art. 33).
- **A associação não vende nem empresta dados** para ninguém e não usa os dados para propaganda.

## 5. Por quanto tempo

- **Adotantes e lares temporários:** enquanto durar o vínculo com o animal (para o adotante, enquanto a associação acompanha o animal, até o fim da vida dele), e depois por **60 meses**. Passado esse prazo, os dados são **anonimizados**: o nome vira "Pessoa anonimizada" e os contatos são apagados. O histórico do animal continua existindo, mas sem identificar você.
- **Usuários do sistema:** enquanto a pessoa fizer parte da associação. Quando alguém sai, o acesso é desativado no mesmo dia. O nome continua nos registros que a pessoa fez, porque eles fazem parte do histórico dos animais.
- **Registros de acesso (IP e sessão):** [prazo a definir, sugestão de 6 meses].

## 6. Seus direitos

Pela LGPD (art. 18), você pode pedir à associação:

- confirmação de que temos dados seus e acesso a eles (enviamos tudo o que existe sobre você);
- correção de dados errados ou desatualizados;
- anonimização dos dados que não forem mais necessários;
- informação sobre com quem compartilhamos seus dados;
- revisão de um pedido que tenha sido negado.

**Como pedir:** escreva para [e-mail do encarregado]. Respondemos em até [15 dias].

**Quando a anonimização precisa esperar:** se um animal estiver com você em lar temporário agora, o animal precisa sair do lar antes, para a associação não perder o contato com ele.

Se não ficar satisfeito com a resposta, você pode reclamar à **Autoridade Nacional de Proteção de Dados (ANPD)**.

## 7. Segurança

- Só entra no sistema quem a associação convida. Não existe cadastro aberto.
- Cada pessoa vê apenas o que o seu papel permite, e essa regra fica no próprio banco de dados.
- As conexões são criptografadas (HTTPS).
- Os arquivos (fotos e termos) ficam em áreas privadas e só abrem por links temporários.
- Os registros técnicos e o monitoramento de erros não guardam dados pessoais.
- Se houver um incidente de segurança que possa causar risco ou dano a você, a associação avisa a ANPD e as pessoas afetadas (LGPD, art. 48).

## 8. Mudanças nesta política

Se esta política mudar, a nova versão fica disponível com a data de atualização. Mudanças importantes são avisadas a quem tem dados cadastrados.

---

## Aviso curto (formulário de pessoa e termo de adoção)

Texto para a tela de cadastro de pessoa e para o fim do termo de adoção (brandbook, seção 07):

> Seus dados servem só para acompanhar esta adoção (ou o lar temporário) e falar com você sobre o animal. Só a coordenação da associação vê seu telefone, endereço e documentos. Guardamos enquanto a associação acompanha o animal e por 60 meses depois, e então anonimizamos. Para ver, corrigir ou pedir a anonimização dos seus dados: [e-mail do encarregado].
