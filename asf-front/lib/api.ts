import 'server-only';
import createClient from 'openapi-fetch';
import { cache } from 'react';
import type { paths } from '@/types/api';
import { apiUrl } from './cookies';
import { tokenAtual } from './sessao';
import type { Eu } from './tipos';

// Cliente único da API, tipado pelo OpenAPI do back. Roda só no servidor do
// front: o token sai do cookie httpOnly e nunca chega ao navegador.
export async function api() {
  return apiCom(await tokenAtual());
}

// Com um token que ainda não está no cookie (o do link de convite/recuperação).
export function apiCom(token: string | undefined) {
  return createClient<paths>({
    baseUrl: apiUrl(),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
}

export interface Falha {
  status: number;
  mensagem: string;
  /** Só quando a tela precisa agir (ex.: 'mfa_obrigatorio'). */
  codigo?: string;
}

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

const SEM_CONEXAO = 'Sem conexão com o servidor. Tente de novo em instantes.';

/** Executa uma chamada e separa sucesso, erro do back e falha de rede. */
export async function chamar<T>(
  pedido: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<Resultado<T>> {
  try {
    const { data, error, response } = await pedido;
    if (response.ok) return { ok: true, dados: data as T };
    const corpo = (error && typeof error === 'object' ? error : {}) as {
      mensagem?: unknown;
      codigo?: unknown;
    };
    const mensagem =
      typeof corpo.mensagem === 'string' ? corpo.mensagem : 'Não foi possível concluir a operação.';
    const falha: Falha = { status: response.status, mensagem };
    if (typeof corpo.codigo === 'string') falha.codigo = corpo.codigo;
    return { ok: false, falha };
  } catch {
    return { ok: false, falha: { status: 503, mensagem: SEM_CONEXAO } };
  }
}

/** Quem entrou. Uma chamada por requisição, mesmo usada no layout e na página. */
export const obterEu = cache(async (): Promise<Resultado<Eu>> => {
  const cliente = await api();
  return chamar(cliente.GET('/eu'));
});
