# asf-front

Front do sistema interno da Associação São Francisco: cadastro e acompanhamento de animais, saúde, prontuário, adoções e indicadores.
É de uso interno: uma associação só, só entra quem foi convidado. O plano completo, com as fases, está em `../PLANO-DESENVOLVIMENTO.md` (raiz do repositório). As decisões de arquitetura estão em `../asf-back/docs/adr/`. Ler os dois antes de começar uma fase.

Por enquanto esta pasta vive dentro do repositório `SaaS-ASF`, ao lado de `asf-back/` (ADR 0009). Tratar como projeto independente: nada aqui importa arquivo de `../asf-back`; o único contrato com o back é o `/openapi.json`.

Next.js 16: antes de usar uma API do Next, conferir a documentação da versão instalada em `node_modules/next/dist/docs/` (ver `AGENTS.md`). Exemplo: o antigo `middleware.ts` agora é `proxy.ts`.

## Sessão

Os tokens ficam em cookies `httpOnly` (`lib/cookies.ts`, `lib/sessao.ts`): o JavaScript do navegador nunca os lê. Páginas e server actions chamam o back pelo servidor do front (`lib/api.ts`); o `proxy.ts` manda para `/entrar` quem não tem sessão e renova o token perto de vencer.

## Pilha

- Next.js (App Router) + TypeScript
- Publicado em Cloudflare Workers pelo adaptador `@opennextjs/cloudflare`
- Tipos da API gerados com `openapi-typescript` a partir do `/openapi.json` do back
- CSS próprio: `styles/tokens.css` + `styles/components.css`, temas claro e escuro
- Monitoramento: Sentry (`@sentry/nextjs`)
- Turnstile no login e na recuperação de senha

## Sempre

- Toda chamada passa por `lib/api.ts`, tipada pelo OpenAPI. O front não fala com o Supabase para ler ou gravar dado.
- Envio de arquivo: pedir URL assinada ao back, enviar os bytes direto ao Storage, avisar o back que terminou.
- Foto é redimensionada e recodificada em WebP no aparelho antes do envio (remove o EXIF com GPS).
- Componentes de servidor por padrão; componente de cliente só onde há interação.
- Toda tela tem estado vazio, carregando (esqueleto com a forma do conteúdo) e erro.
- Campos da ficha salvam ao sair do campo, sem redesenhar a ficha.
- O selo de gravação só aparece quando uma escrita falha; só o sucesso de outra escrita o limpa.
- Datas por `fd(iso)` e `fdDe(Date)` de `lib/formato.ts`; idade calculada de `nascimento_estimado`.
- O menu é dado em `lib/menu.ts`; barra do computador, barra do celular e folha do celular saem dele.
- Item sem tela pronta aparece apagado com "em breve".
- Filtros de lista ficam na URL.
- Grade em componente usa `data-n`.
- Texto em português, sem emoji, sem exclamação; botão diz o que faz.

## Nunca

- Nunca colocar chave nem segredo no bundle. `NEXT_PUBLIC_*` vai colado no JavaScript que o navegador baixa.
- Nunca decidir permissão no front. Esconder um botão é conveniência; quem corta o dado é a RLS.
- Nunca calcular no front uma regra que o back já calcula (pendências, indicadores, número do animal).
- Nunca criar tela de cadastro aberto, seletor de organização ou página pública: o sistema é interno.
- Nunca guardar rascunho dos formulários de pessoa e adoção no navegador.
- Nunca colocar dado pessoal em `console.log`, Sentry ou URL.
- Nunca usar `style` com `repeat(N,1fr)` em grade; o React reescreve com espaço e o seletor do CSS não casa.
- Nunca usar curinga `*.supabase.co` na CSP; só o domínio exato do projeto.
- Nunca escrever data à mão (`dd/mm/aa`) na tela.
- Nunca criar link de menu para rota que ainda não existe.

## Onde fica cada coisa

```
app/
  (acesso)/entrar, recuperar, nova-senha
  page.tsx                      painel (indicadores a partir da Fase 5)
  animais/, animais/novo, animais/[id]
  pendencias/, pessoas/, adocoes/, relatorios/, configuracoes/, auditoria/
components/                     kit genérico e componentes de domínio
lib/
  api.ts                        cliente único da API
  menu.ts                       menu como dado
  formato.ts                    datas, números, idade
styles/
  tokens.css, components.css
types/api.d.ts                  gerado; não editar à mão
scripts/                        codegen e conferências da CI
open-next.config.ts             buildCommand próprio (evita recursão no build)
```

## Como rodar

Os scripts abaixo são criados na Fase 0.

```bash
npm run dev            # Next local
npm run build          # o mesmo comando que a Cloudflare roda
npm run typecheck
npm run lint
npm test
npm run tipos          # gera types/api.d.ts a partir do /openapi.json (API_URL no ambiente)
npm run preview        # build do OpenNext rodando no workerd local
```

## O que é arriscado e pede revisão

- CSP e cabeçalhos de segurança (`noindex` incluído).
- `NEXT_PUBLIC_*`: são variáveis de build, não de execução, e ficam visíveis no navegador.
- Telas de usuários, pessoas, adoção, exportação e auditoria.
- Envio de arquivos.
- `open-next.config.ts` e `wrangler.toml`.

## Links

- Plano: `../PLANO-DESENVOLVIMENTO.md`
- Decisões: `../asf-back/docs/adr/README.md`
- Contrato: `/openapi.json` do back publicado
