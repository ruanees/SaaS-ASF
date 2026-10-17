import type { NextConfig } from 'next';

// Domínio EXATO do projeto Supabase (nunca *.supabase.co): só o envio de
// arquivos fala com ele direto do navegador, a partir da Fase 1.
const supabase = process.env.SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const turnstile = 'https://challenges.cloudflare.com';

const csp = [
  "default-src 'self'",
  // 'unsafe-inline': script de tema antes da primeira pintura e os scripts
  // inline do Next. Revisar com nonce na Fase 6.
  `script-src 'self' 'unsafe-inline' ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabase}`.trim(),
  `frame-src ${turnstile}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:caminho*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
