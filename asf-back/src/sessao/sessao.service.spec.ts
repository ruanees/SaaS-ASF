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
