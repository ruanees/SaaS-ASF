// Módulo do runtime da Cloudflare, resolvido pelo wrangler no empacotamento.
declare module 'cloudflare:node' {
  export function httpServerHandler(opcoes: { port: number }): ExportedHandler;
}

interface ExportedHandler {
  fetch?: (...args: unknown[]) => unknown;
}
