import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Session } from '@supabase/supabase-js';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { exigir, lerConfiguracao } from '../configuracao.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { FatorDto, InscricaoMfaDto, SessaoDto } from './sessao.dto.js';

// Erro do Supabase Auth (AuthError do supabase-js ou corpo da API REST).
interface ErroAuth {
  status?: number;
  code?: string;
  error_code?: string;
  name?: string;
}

const INDISPONIVEL =
  'Serviço temporariamente indisponível. Tente de novo em instantes.';

// Traduz o erro do Auth sem nunca dizer se um e-mail existe.
export function traduzirErroAuth(
  erro: ErroAuth,
  padrao: HttpException,
): HttpException {
  const codigo = erro.code ?? erro.error_code;
  if (codigo === 'captcha_failed') {
    return new BadRequestException(
      'Não foi possível confirmar que você não é um robô. Tente de novo.',
    );
  }
  if (
    codigo === 'over_request_rate_limit' ||
    codigo === 'over_email_send_rate_limit' ||
    erro.status === 429
  ) {
    return new HttpException(
      'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (codigo === 'weak_password') {
    return new UnprocessableEntityException(
      'Senha fraca: use ao menos 10 caracteres, com letras e números.',
    );
  }
  if (
    codigo === 'mfa_verification_failed' ||
    codigo === 'mfa_challenge_expired'
  ) {
    return new UnprocessableEntityException(
      'Código incorreto ou vencido. Confira o aplicativo e tente de novo.',
    );
  }
  if (codigo === 'same_password') {
    return new UnprocessableEntityException(
      'A nova senha precisa ser diferente da atual.',
    );
  }
  // Sem status ou status 0: não alcançou o Auth (rede ou Supabase fora do ar).
  if (
    erro.name === 'AuthRetryableFetchError' ||
    !erro.status ||
    erro.status >= 500
  ) {
    return new ServiceUnavailableException(INDISPONIVEL);
  }
  return padrao;
}

@Injectable()
export class SessaoService {
  constructor(private readonly supabase: SupabaseService) {}

  async entrar(
    email: string,
    senha: string,
    captcha?: string,
  ): Promise<SessaoDto> {
    const { data, error } = await this.supabase
      .anonimo()
      .auth.signInWithPassword({
        email,
        password: senha,
        options: captcha ? { captchaToken: captcha } : undefined,
      });
    if (error || !data.session) {
      throw traduzirErroAuth(
        error ?? {},
        new UnauthorizedException('E-mail ou senha incorretos.'),
      );
    }
    return paraSessao(data.session);
  }

  async renovar(refreshToken: string): Promise<SessaoDto> {
    const { data, error } = await this.supabase
      .anonimo()
      .auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      throw traduzirErroAuth(
        error ?? {},
        new UnauthorizedException('Sessão expirada. Entre de novo.'),
      );
    }
    return paraSessao(data.session);
  }

  // Responde igual exista ou não o e-mail: a tela nunca revela quem tem conta.
  async recuperar(email: string, captcha?: string): Promise<void> {
    const frontUrl = exigir(lerConfiguracao(), 'frontUrl').replace(/\/+$/, '');
    const { error } = await this.supabase
      .anonimo()
      .auth.resetPasswordForEmail(email, {
        redirectTo: `${frontUrl}/nova-senha`,
        captchaToken: captcha,
      });
    if (!error) return;
    const traduzido = traduzirErroAuth(
      error,
      new HttpException('', HttpStatus.NO_CONTENT),
    );
    if (traduzido.getStatus() !== HttpStatus.NO_CONTENT) throw traduzido;
  }

  // Troca a senha de quem está com a sessão (inclusive a sessão aberta pelo
  // link de recuperação). O supabase-js só troca senha com sessão guardada no
  // cliente; como o back não guarda sessão, chama a API do Auth direto.
  async trocarSenha(usuario: UsuarioAutenticado, senha: string): Promise<void> {
    const resposta = await this.chamarAuth('PUT', '/user', usuario, {
      password: senha,
    });
    if (resposta.ok) return;
    const erro = (await resposta.json().catch(() => ({}))) as ErroAuth;
    throw traduzirErroAuth(
      { ...erro, status: resposta.status },
      new UnauthorizedException(
        'Link expirado ou sessão inválida. Peça um novo link.',
      ),
    );
  }

  // Quem já está dentro troca a senha confirmando a atual. A conferência abre
  // uma sessão a mais no Auth, que é encerrada logo em seguida.
  async trocarComAtual(
    usuario: UsuarioAutenticado,
    atual: string,
    nova: string,
  ): Promise<void> {
    if (atual === nova) {
      throw new UnprocessableEntityException(
        'A nova senha precisa ser diferente da atual.',
      );
    }
    const quem = await this.chamarAuth('GET', '/user', usuario);
    const email = quem.ok
      ? ((await quem.json().catch(() => ({}))) as { email?: string }).email
      : undefined;
    if (!email) {
      throw traduzirErroAuth(
        { status: quem.status },
        new UnauthorizedException('Sessão expirada. Entre de novo.'),
      );
    }

    const { data, error } = await this.supabase
      .anonimo()
      .auth.signInWithPassword({ email, password: atual });
    if (error || !data.session) {
      throw traduzirErroAuth(
        error ?? {},
        new BadRequestException('A senha atual não confere.'),
      );
    }
    await this.chamarAuth('POST', '/logout?scope=local', {
      id: usuario.id,
      token: data.session.access_token,
    }).catch(() => undefined);

    await this.trocarSenha(usuario, nova);
  }

  async sair(usuario: UsuarioAutenticado): Promise<void> {
    const resposta = await this.chamarAuth(
      'POST',
      '/logout?scope=local',
      usuario,
    );
    // 401/404: a sessão já não existe; para quem pediu para sair, está feito.
    if (resposta.ok || resposta.status === 401 || resposta.status === 404)
      return;
    throw new ServiceUnavailableException(INDISPONIVEL);
  }

  // MFA (TOTP) -------------------------------------------------------------
  // Tudo pela API do Auth com o token de quem pediu: o back não guarda
  // segredo nenhum do autenticador.

  async fatores(usuario: UsuarioAutenticado): Promise<FatorDto[]> {
    const resposta = await this.chamarAuth('GET', '/user', usuario);
    if (!resposta.ok) throw await this.erroDeResposta(resposta);
    const corpo = (await resposta.json()) as {
      factors?: Array<{ id: string; factor_type: string; status: string }>;
    };
    return (corpo.factors ?? [])
      .filter((f) => f.factor_type === 'totp')
      .map((f) => ({ id: f.id, verificado: f.status === 'verified' }));
  }

  async inscreverMfa(usuario: UsuarioAutenticado): Promise<InscricaoMfaDto> {
    // Inscrição abandonada deixa um fator não verificado; ele sai antes de
    // criar outro, senão o Auth recusa por nome repetido.
    for (const fator of await this.fatores(usuario)) {
      if (!fator.verificado) {
        await this.chamarAuth('DELETE', `/factors/${fator.id}`, usuario);
      }
    }
    const resposta = await this.chamarAuth('POST', '/factors', usuario, {
      factor_type: 'totp',
      friendly_name: 'Autenticador',
      issuer: 'Associação São Francisco',
    });
    if (!resposta.ok) throw await this.erroDeResposta(resposta);
    const corpo = (await resposta.json()) as {
      id: string;
      totp: { qr_code: string; secret: string };
    };
    return {
      fator_id: corpo.id,
      qr_code: corpo.totp.qr_code,
      segredo: corpo.totp.secret,
    };
  }

  // Confirma o código e devolve uma sessão nova, já com o segundo fator (aal2).
  async verificarMfa(
    usuario: UsuarioAutenticado,
    fatorId: string,
    codigo: string,
  ): Promise<SessaoDto> {
    const desafio = await this.chamarAuth(
      'POST',
      `/factors/${fatorId}/challenge`,
      usuario,
      {},
    );
    if (!desafio.ok) throw await this.erroDeResposta(desafio);
    const { id: desafioId } = (await desafio.json()) as { id: string };

    const resposta = await this.chamarAuth(
      'POST',
      `/factors/${fatorId}/verify`,
      usuario,
      { challenge_id: desafioId, code: codigo },
    );
    if (!resposta.ok) throw await this.erroDeResposta(resposta);
    const sessao = (await resposta.json()) as Session;
    return paraSessao(sessao);
  }

  private async erroDeResposta(resposta: Response): Promise<HttpException> {
    const erro = (await resposta.json().catch(() => ({}))) as ErroAuth;
    return traduzirErroAuth(
      { ...erro, status: resposta.status },
      resposta.status === 401
        ? new UnauthorizedException('Sessão expirada. Entre de novo.')
        : new BadRequestException('Não foi possível concluir a operação.'),
    );
  }

  private async chamarAuth(
    metodo: 'GET' | 'PUT' | 'POST' | 'DELETE',
    caminho: string,
    usuario: UsuarioAutenticado,
    corpo?: unknown,
  ): Promise<Response> {
    const configuracao = lerConfiguracao();
    const url = exigir(configuracao, 'supabaseUrl').replace(/\/+$/, '');
    const init: RequestInit = {
      method: metodo,
      headers: {
        apikey: exigir(configuracao, 'supabaseChavePublica'),
        Authorization: `Bearer ${usuario.token}`,
        'Content-Type': 'application/json',
      },
    };
    if (corpo !== undefined) init.body = JSON.stringify(corpo);
    try {
      return await fetch(`${url}/auth/v1${caminho}`, init);
    } catch {
      throw new ServiceUnavailableException(INDISPONIVEL);
    }
  }
}

function paraSessao(sessao: Session): SessaoDto {
  return {
    access_token: sessao.access_token,
    refresh_token: sessao.refresh_token,
    expires_at:
      sessao.expires_at ?? Math.floor(Date.now() / 1000) + sessao.expires_in,
  };
}
