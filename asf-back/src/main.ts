import { existsSync } from 'node:fs';
import { criarApp } from './app.js';

// Servidor local (npm run dev). Em produção a entrada é o Worker.
if (existsSync('.env')) process.loadEnvFile('.env');

const { app } = await criarApp();
const porta = Number(process.env.PORT ?? 3001);
await app.listen(porta);
console.log(`asf-back em http://localhost:${porta}`);
