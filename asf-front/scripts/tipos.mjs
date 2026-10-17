// npm run tipos: gera types/api.d.ts a partir do /openapi.json do back.
// API_URL no ambiente (padrão: back local). O DTO do Nest é a fonte da
// verdade; se ele mudar e o front não acompanhar, o typecheck quebra.
import { execFileSync } from 'node:child_process';

const base = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const origem = `${base}/openapi.json`;

console.log(`Gerando types/api.d.ts de ${origem}`);
execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['openapi-typescript', origem, '-o', 'types/api.d.ts'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
