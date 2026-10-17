import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl, COOKIE, OPCOES_COOKIE, rotaPublica } from './lib/cookies';

// Antes de cada página: sem sessão, vai para /entrar; com o access token
// perto de vencer, renova pelo back e grava os cookies novos (o que também
// empurra o prazo de inatividade).
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const publica = rotaPublica(pathname);
  const renovacao = req.cookies.get(COOKIE.renovacao)?.value;

  if (!renovacao) {
    return publica ? NextResponse.next() : paraEntrar(req, pathname + search);
  }

  const expira = Number(req.cookies.get(COOKIE.expira)?.value ?? 0);
  if (expira - Date.now() / 1000 > 60) return NextResponse.next();

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl()}/sessao/renovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: renovacao }),
      cache: 'no-store',
    });
  } catch {
    // Back fora do ar: segue; a página mostra o estado de erro.
    return NextResponse.next();
  }

  if (resposta.status === 401) {
    const destino = publica ? NextResponse.next() : paraEntrar(req, pathname + search, 'expirou');
    for (const nome of Object.values(COOKIE)) destino.cookies.delete(nome);
    return destino;
  }
  if (!resposta.ok) return NextResponse.next();

  const sessao = (await resposta.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  const valores = {
    [COOKIE.acesso]: sessao.access_token,
    [COOKIE.renovacao]: sessao.refresh_token,
    [COOKIE.expira]: String(sessao.expires_at),
  };
  // Na requisição, para a página desta mesma navegação já usar o token novo;
  // na resposta, para o navegador guardar.
  for (const [nome, valor] of Object.entries(valores)) req.cookies.set(nome, valor);
  const res = NextResponse.next({ request: req });
  for (const [nome, valor] of Object.entries(valores)) res.cookies.set(nome, valor, OPCOES_COOKIE);
  return res;
}

function paraEntrar(req: NextRequest, volta: string, motivo?: string) {
  const url = new URL('/entrar', req.url);
  if (volta !== '/') url.searchParams.set('volta', volta);
  if (motivo) url.searchParams.set('motivo', motivo);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|robots.txt|.*\\.(?:png|svg|ico|webp|jpg)$).*)'],
};
