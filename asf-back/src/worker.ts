// Entrada do Worker na Cloudflare. O Nest sobe com o servidor HTTP do Node
// que o Workers oferece (flag enable_nodejs_http_server_modules) e o
// httpServerHandler entrega cada requisição a ele.
//
// O wrangler empacota o JavaScript que o `nest build` gerou (dist/), não o
// TypeScript: o esbuild do wrangler não emite metadados de decorators, e a
// injeção de dependência do Nest precisa deles.
import { httpServerHandler } from 'cloudflare:node';
import { criarApp } from './app.js';

const PORTA = 8080;

const { app } = await criarApp();
await app.listen(PORTA);

export default httpServerHandler({ port: PORTA });
