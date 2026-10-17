// Nomes e opções dos cookies de sessão. Os tokens ficam em cookie httpOnly:
// o JavaScript do navegador nunca os lê. Só o servidor do front os usa para
// chamar o back.

export const COOKIE = {
  acesso: 'asf_acesso',
  renovacao: 'asf_renovacao',
  expira: 'asf_expira',
} as const;

// Sessão expira por inatividade: cada renovação empurra o prazo (deslizante).
export const INATIVIDADE_SEGUNDOS = 12 * 60 * 60;

export const OPCOES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: INATIVIDADE_SEGUNDOS,
};

export const ROTAS_PUBLICAS = ['/entrar', '/recuperar', '/nova-senha'];

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

/** Só aceita caminho interno, para "volta" não virar redirecionamento aberto. */
export function voltaSegura(volta: unknown): string {
  if (typeof volta !== 'string' || !volta.startsWith('/') || volta.startsWith('//') || volta.includes('\\')) {
    return '/';
  }
  return rotaPublica(volta) ? '/' : volta;
}

export function apiUrl(): string {
  const url = process.env.API_URL;
  if (!url) throw new Error('Configuração ausente: API_URL');
  return url.replace(/\/+$/, '');
}
