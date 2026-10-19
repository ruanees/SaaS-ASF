# Roteiro de incidente de segurança

> **Rascunho para revisão jurídica e da diretoria.** Versão de 19/10/2026. Os campos entre colchetes dependem da associação: quem é o encarregado e quem cuida da parte técnica. Os prazos legais citados precisam ser conferidos pela assessoria jurídica antes de valer.

## O que é um incidente

Qualquer situação em que dado pessoal de adotante, lar temporário, voluntário ou da equipe possa ter sido visto, copiado, alterado ou perdido por quem não devia. Exemplos:

- celular ou computador com o sistema aberto foi perdido ou roubado;
- alguém que saiu da associação ainda entra no sistema;
- senha de um usuário foi parar em grupo de WhatsApp, e-mail ou print;
- o sistema mostrou dado de uma pessoa para quem não devia ver (por exemplo, telefone para um voluntário);
- uma planilha ou PDF exportado do sistema foi compartilhado fora da associação;
- aviso de acesso estranho do Supabase, da Cloudflare ou do Sentry.

**Na dúvida, trate como incidente.** Avisar cedo e descobrir que não era nada custa pouco; demorar pode custar caro.

## Quem avisa quem

| Quem percebe | Avisa | Como |
|---|---|---|
| Qualquer pessoa da associação | [responsável técnico] e [encarregado] | Ligação ou mensagem direta, no mesmo dia. Não descrever o dado pessoal na mensagem: só o que aconteceu. |
| Responsável técnico | Encarregado e diretoria | Depois dos primeiros passos de contenção (abaixo). |
| Encarregado | ANPD e titulares, quando for o caso | Ver "Comunicação". |

- **Encarregado:** [nome], [telefone], [e-mail]
- **Responsável técnico:** [nome], [telefone], [e-mail]
- **Diretoria:** [nome], [telefone]

## Primeiras horas: conter

O responsável técnico (ou um admin do sistema) segue, conforme o caso:

1. **Pessoa que não devia ter acesso:** em Configurações → Usuários, **desativar** o usuário. A partir da próxima ação ele não lê mais nada (a regra é do banco), mesmo com a sessão aberta.
2. **Senha vazada:** desativar o usuário, pedir a troca de senha pela recuperação e só então reativar.
3. **Celular ou computador perdido:** desativar o usuário até ele trocar a senha e reconfigurar o segundo fator (admin e coordenação).
4. **Suspeita de chave técnica vazada** (chave do Supabase, token da Cloudflare): trocar a chave no painel do fornecedor e atualizar a configuração do sistema. Token colado em chat, issue ou log é considerado vazado.
5. **Arquivo exportado compartilhado fora:** pedir a quem recebeu que apague, e anotar quem era e quando.
6. **Não apagar registros** do sistema nem da auditoria: eles são a prova do que aconteceu.

## Primeiros dias: entender

1. Abrir **Auditoria** (só admin) e filtrar o período: quem abriu contato de pessoa, quem exportou, o que foi alterado.
2. Responder, por escrito:
   - o que aconteceu e quando foi percebido;
   - quais dados pessoais (nome, telefone, e-mail, endereço) e de quantas pessoas;
   - se o dado chegou a ser visto ou copiado por alguém de fora;
   - o que já foi feito para conter.
3. Avaliar o risco para as pessoas: endereço de adotante exposto, por exemplo, é mais grave que um nome sozinho.

## Comunicação

- **ANPD:** quando o incidente puder trazer risco ou dano relevante às pessoas, a associação comunica à ANPD. Pelo regulamento de comunicação de incidentes (Resolução CD/ANPD nº 15/2024), o prazo é de **3 dias úteis** a partir de quando a associação souber que dado pessoal foi afetado. **[A conferir com a assessoria jurídica.]**
- **Pessoas afetadas:** no mesmo caso, avisar cada pessoa, em linguagem simples: o que aconteceu, quais dados, o que a associação já fez e o que a pessoa pode fazer. Também em **3 dias úteis**. **[A conferir.]**
- **Agente de pequeno porte:** se a associação se enquadrar (Resolução CD/ANPD nº 2/2022), alguns prazos podem ser maiores. **[A conferir.]**

## Registro

Todo incidente, mesmo o que não precisou de comunicação, fica registrado num documento da associação com: data, o que aconteceu, dados e pessoas envolvidos, avaliação de risco, o que foi feito e se houve comunicação (e quando). A LGPD pede que a associação consiga mostrar isso depois.

## Depois

Uma conversa curta, sem procurar culpado: o que deixou o incidente acontecer e o que muda para não se repetir (uma regra do sistema, um costume da equipe, um treinamento). Se mudar o sistema, entra no plano como qualquer outra tarefa.
