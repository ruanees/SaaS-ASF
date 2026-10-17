import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE, OPCOES_COOKIE } from './cookies';
import type { Sessao } from './tipos';

export async function guardarSessao(sessao: Sessao): Promise<void> {
  const c = await cookies();
  c.set(COOKIE.acesso, sessao.access_token, OPCOES_COOKIE);
  c.set(COOKIE.renovacao, sessao.refresh_token, OPCOES_COOKIE);
  c.set(COOKIE.expira, String(sessao.expires_at), OPCOES_COOKIE);
}

export async function limparSessao(): Promise<void> {
  const c = await cookies();
  for (const nome of Object.values(COOKIE)) c.delete(nome);
}

export async function tokenAtual(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE.acesso)?.value;
}
