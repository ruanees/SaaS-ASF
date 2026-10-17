# Registro das operações de tratamento de dados pessoais

> **Rascunho para revisão jurídica.** Documento interno da associação (LGPD, art. 37). Versão de 17/10/2026. Atualizar sempre que o sistema passar a tratar um dado novo ou trocar de fornecedor.

**Controladora:** Associação São Francisco Defensora dos Animais, [CNPJ], Granja-CE
**Encarregado:** [nome], [e-mail]
**Operador (desenvolvimento e manutenção do sistema):** [nome ou empresa], se não for membro da associação. Ver o [acordo](acordo-controladora-operador.md).
**Porte:** a associação pode se enquadrar como agente de tratamento de pequeno porte (Resolução CD/ANPD nº 2/2022). **A confirmar com o jurídico.** Se for o caso, este registro pode seguir o modelo simplificado da ANPD.

---

## Operações

### 1. Cadastro de adotante e registro da adoção (Fase 4)

| Item | Descrição |
|---|---|
| Titulares | Pessoas que adotam animais da associação |
| Dados | Nome, telefone, e-mail e endereço. **Nenhum dado sensível.** |
| Finalidade | Registrar a adoção, emitir o termo e fazer contato sobre o animal |
| Base legal | Execução de contrato, art. 7º, V |
| Onde fica | Tabelas `pessoas` (nome) e `pessoas_contato` (contato), no Supabase em São Paulo |
| Quem acessa | Nome: todos os papéis. Contato: só admin e coordenação, com registro de cada leitura na `auditoria` |
| Compartilhamento | Nenhum, além dos fornecedores da seção "Fornecedores" |
| Retenção | Durante o vínculo, depois [60 meses]; então anonimização aprovada pela coordenação |
| Segurança | RLS forçada, tabela de contato separada, auditoria sem valores, HTTPS e backups diários |

### 2. Cadastro de lar temporário (Fase 4)

Igual à operação 1, com estas diferenças:
- **Finalidade:** saber onde o animal está e falar com o responsável.
- **Base legal:** execução de contrato ou acordo de voluntariado (art. 7º, V).
- **Regra extra:** a anonimização é recusada enquanto houver animal no lar.

### 3. Usuários do sistema (Fase 0, em uso)

| Item | Descrição |
|---|---|
| Titulares | Membros e voluntários da associação com acesso ao sistema |
| Dados | Nome, e-mail, papel (admin, coordenação, veterinário ou voluntário) e data de criação |
| Finalidade | Login, controle de acesso por papel e registro de autoria das alterações |
| Base legal | Execução de contrato ou acordo de voluntariado, art. 7º, V |
| Onde fica | Supabase Auth (e-mail e senha protegida) e tabela `usuarios`, em São Paulo |
| Quem acessa | Todos os usuários ativos veem nome e papel dos colegas; só admin altera |
| Retenção | Enquanto a pessoa fizer parte da associação. Ao sair, a conta é desativada (não apagada, porque o nome está nos registros que a pessoa fez) |
| Segurança | Entrada só por convite, senha com no mínimo 10 caracteres, MFA para admin e coordenação (previsto para a Fase 6), RLS e bloqueio do login quando a conta é desativada |

### 4. Registro do veterinário no atendimento (Fase 3)

| Item | Descrição |
|---|---|
| Titulares | Veterinários que atendem os animais |
| Dados | Nome e CRMV |
| Finalidade | Registrar quem fez o atendimento clínico |
| Base legal | Legítimo interesse, art. 7º, IX (registro profissional do atendimento) |
| Retenção | Junto com o prontuário do animal |

### 5. Registros de segurança e auditoria (Fase 0, em uso)

| Item | Descrição |
|---|---|
| Titulares | Quem usa o sistema |
| Dados | Identificador do usuário, tabela e registro alterados, nomes dos campos alterados, data e hora. IP e sessão ficam nos registros dos fornecedores. **Sem valores de campos.** |
| Finalidade | Segurança, investigação de acesso indevido e prestação de contas |
| Base legal | Legítimo interesse, art. 7º, IX |
| Quem acessa | Só admin (tela de auditoria, Fase 6) |
| Retenção | [a definir; sugestão de 5 anos para a auditoria de dados e 6 meses para os registros de acesso] |

### 6. Fotos dos animais (Fase 1)

| Item | Descrição |
|---|---|
| Dados | Imagem do animal. Pode conter pessoas por acidente. |
| Medidas | Remoção automática da localização (EXIF/GPS) antes do envio; orientação para não fotografar pessoas; balde privado com links temporários |
| Observação | Se a foto não tiver pessoa, não é dado pessoal |

---

## Fornecedores (operadores e suboperadores)

| Fornecedor | Função | Dados que recebe | Localização | Transferência internacional |
|---|---|---|---|---|
| Supabase | Banco, login e arquivos | Todos os acima | Brasil (AWS São Paulo, `sa-east-1`) | Não, para o armazenamento |
| Cloudflare | Hospedagem do front e do back, WAF | Dados em trânsito (requisições) | Rede global | Possível, em trânsito: registrar |
| [Sentry] | Monitoramento de erros | Pilha do erro, rota e id do usuário. **Corpo, cabeçalhos e campos removidos** | [EUA] | Sim, mínima: registrar |
| [Resend] | E-mail de convite e de troca de senha | E-mail e nome do usuário | [a confirmar] | [a confirmar] |
| GitHub | Código-fonte | **Nenhum dado pessoal** (regra: só dados fictícios no repositório) | EUA | Não se aplica |

## Incidentes

O roteiro de incidente é escrito na Fase 6. Até lá:
- Quem perceber um problema avisa o encarregado e o operador no mesmo dia.
- Quando houver risco ou dano relevante aos titulares, a associação comunica a ANPD e os titulares (art. 48), no prazo que a ANPD define.
- Todo incidente fica registrado, mesmo os que não precisam ser comunicados.

## Histórico

| Data | Mudança |
|---|---|
| 17/10/2026 | Primeiro rascunho (Fase 0) |
