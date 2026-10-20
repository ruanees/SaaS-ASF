import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { SessaoService, traduzirErroAuth } from './sessao.service.js';

const SESSAO = {
  access_token: 'a',
  refresh_token: 'r',
  expires_at: 1800000000,
  expires_in: 3600,
};

function servico(auth: Record<string, unknown>) {
  const supabase = { anonimo: () => ({ auth }) } as unknown as SupabaseService;
  return new SessaoService(supabase);
}

const padrao = new UnauthorizedException('padrão');

describe('traduzirErroAuth', () => {
  it.each([
    [{ status: 400, code: 'invalid_credentials' }, 401],
    [{ status: 400, code: 'email_not_confirmed' }, 401], // não revela situação da conta
    [{ status: 400, code: 'captcha_failed' }, 400],
    [{ status: 429, code: 'over_request_rate_limit' }, 429],
    [{ status: 422, code: 'weak_password' }, 422],
    [{ status: 0, name: 'AuthRetryableFetchError' }, 503],
    [{}, 503],
    [{ status: 502 }, 503],
  ])('%j -> %i', (erro, status) => {
    expect(traduzirErroAuth(erro, padrao).getStatus()).toBe(status);
  });
});

describe('SessaoService', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_teste';
    process.env.FRONT_URL = 'https://asf.exemplo.test/';
  });

  it('entrar devolve só os campos da sessão', async () => {
    const s = servico({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { ...SESSAO, user: { id: 'x' } } },
        error: null,
      }),
    });
    await expect(s.entrar('a@b.test', 'senha')).resolves.toEqual({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 1800000000,
    });
  });

  it('senha errada: mensagem genérica, sem dizer se o e-mail existe', async () => {
    const s = servico({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: null },
        error: {
          status: 400,
          code: 'invalid_credentials',
          name: 'AuthApiError',
        },
      }),
    });
    const erro = (await s
      .entrar('a@b.test', 'x')
      .catch((e: unknown) => e)) as HttpException;
    expect(erro.getStatus()).toBe(401);
    expect(erro.message).toBe('E-mail ou senha incorretos.');
  });

  it('recuperar responde igual para e-mail inexistente e manda o link para /nova-senha', async () => {
    const reset = vi
      .fn()
      .mockResolvedValue({ error: { status: 400, code: 'user_not_found' } });
    await expect(
      servico({ resetPasswordForEmail: reset }).recuperar('nao@existe.test'),
    ).resolves.toBeUndefined();
    expect(reset).toHaveBeenCalledWith('nao@existe.test', {
      redirectTo: 'https://asf.exemplo.test/nova-senha',
      captchaToken: undefined,
    });
  });

  it('recuperar repassa limite de tentativas', async () => {
    const reset = vi.fn().mockResolvedValue({
      error: { status: 429, code: 'over_email_send_rate_limit' },
    });
    await expect(
      servico({ resetPasswordForEmail: reset }).recuperar('a@b.test'),
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it('trocar senha chama a API do Auth com o token de quem pediu', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);
    await servico({}).trocarSenha(
      { id: 'u', token: 'jwt-do-link' },
      'novaSenha123',
    );
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exemplo.supabase.co/auth/v1/user');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer jwt-do-link',
    );
    expect(init.method).toBe('PUT');
    vi.unstubAllGlobals();
  });

  it('link expirado ao trocar senha vira 401 com orientação', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error_code: 'bad_jwt' }), {
          status: 401,
        }),
      ),
    );
    const erro = (await servico({})
      .trocarSenha({ id: 'u', token: 'velho' }, 'novaSenha123')
      .catch((e: unknown) => e)) as HttpException;
    expect(erro.getStatus()).toBe(401);
    expect(erro.message).toContain('Peça um novo link');
    vi.unstubAllGlobals();
  });
});

describe('SessaoService MFA', () => {
  const EU = { id: 'u', token: 'jwt-aal1' };

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_teste';
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status });

  it('inscrever apaga inscrição abandonada antes de criar outra', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        chamadas.push(
          `${init.method} ${url.replace('https://exemplo.supabase.co/auth/v1', '')}`,
        );
        if (init.method === 'GET') {
          return Promise.resolve(
            json({
              factors: [
                { id: 'velho', factor_type: 'totp', status: 'unverified' },
              ],
            }),
          );
        }
        if (init.method === 'DELETE') return Promise.resolve(json({}));
        return Promise.resolve(
          json({
            id: 'novo',
            totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABC' },
          }),
        );
      }),
    );
    await expect(servico({}).inscreverMfa(EU)).resolves.toEqual({
      fator_id: 'novo',
      qr_code: 'data:image/svg+xml;utf-8,<svg/>',
      segredo: 'ABC',
    });
    expect(chamadas).toEqual([
      'GET /user',
      'DELETE /factors/velho',
      'POST /factors',
    ]);
  });

  it('verificar devolve a sessão nova (aal2)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'desafio' }))
        .mockResolvedValueOnce(json(SESSAO)),
    );
    await expect(
      servico({}).verificarMfa(EU, 'fator', '123456'),
    ).resolves.toEqual({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 1800000000,
    });
  });

  it('código errado vira 422 com orientação', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'desafio' }))
        .mockResolvedValueOnce(
          json({ error_code: 'mfa_verification_failed' }, 422),
        ),
    );
    const erro = (await servico({})
      .verificarMfa(EU, 'fator', '000000')
      .catch((e: unknown) => e)) as HttpException;
    expect(erro.getStatus()).toBe(422);
    expect(erro.message).toContain('Código incorreto');
  });
});

describe('SessaoService.trocarComAtual', () => {
  const EU = { id: 'u', token: 'jwt-atual' };
  const respostaUsuario = () =>
    new Response(JSON.stringify({ email: 'pessoa@exemplo.test' }), {
      status: 200,
    });

  afterEach(() => vi.unstubAllGlobals());

  it('senha atual errada: recusa e não troca nada', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaUsuario());
    vi.stubGlobal('fetch', fetchFalso);
    const entrar = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { status: 400, code: 'invalid_credentials' },
    });
    const erro = (await servico({ signInWithPassword: entrar })
      .trocarComAtual(EU, 'errada123x', 'novaSenha123')
      .catch((e: unknown) => e)) as HttpException;
    expect(erro.getStatus()).toBe(400);
    expect(erro.message).toBe('A senha atual não confere.');
    const metodos = fetchFalso.mock.calls.map(
      (c) => (c[1] as RequestInit).method,
    );
    expect(metodos).toEqual(['GET']); // só leu quem é; não trocou
  });

  it('senha atual certa: confere, fecha a sessão extra e troca', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respostaUsuario())
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);
    const entrar = vi.fn().mockResolvedValue({
      data: { session: { ...SESSAO, access_token: 'sessao-extra' } },
      error: null,
    });
    await servico({ signInWithPassword: entrar }).trocarComAtual(
      EU,
      'atualSenha1',
      'novaSenha123',
    );
    expect(entrar).toHaveBeenCalledWith({
      email: 'pessoa@exemplo.test',
      password: 'atualSenha1',
    });
    const chamadas = fetchFalso.mock.calls.map((c) => [
      (c[1] as RequestInit).method,
      String(c[0]).replace('https://exemplo.supabase.co/auth/v1', ''),
      ((c[1] as RequestInit).headers as Record<string, string>).Authorization,
    ]);
    expect(chamadas).toEqual([
      ['GET', '/user', 'Bearer jwt-atual'],
      ['POST', '/logout?scope=local', 'Bearer sessao-extra'],
      ['PUT', '/user', 'Bearer jwt-atual'],
    ]);
  });

  it('nova igual à atual: recusa antes de qualquer chamada', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    const erro = (await servico({})
      .trocarComAtual(EU, 'mesmaSenha1', 'mesmaSenha1')
      .catch((e: unknown) => e)) as HttpException;
    expect(erro.getStatus()).toBe(422);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
