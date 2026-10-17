import { writeFileSync } from 'node:fs';
import { criarApp } from './app.js';

// npm run openapi: gera openapi.json sem subir servidor. A CI roda isto para
// provar que o contrato gera; o front gera os tipos a partir dele.
const { app, openapi } = await criarApp();
writeFileSync('openapi.json', JSON.stringify(openapi, null, 2) + '\n');
await app.close();
console.log(`openapi.json gerado: ${Object.keys(openapi.paths).length} rotas`);
