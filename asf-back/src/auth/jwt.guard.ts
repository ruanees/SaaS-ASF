import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROTA_PUBLICA } from '../comum/publico.decorator.js';
import type { RequisicaoAutenticada } from './usuario.js';
import { VerificadorJwt } from './verificador-jwt.js';

// Guard global: toda rota exige JWT válido, exceto as marcadas com @Publico().
// Ele só confirma quem é a pessoa. O que ela pode ver ou gravar é a RLS.
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificador: VerificadorJwt,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publica) return true;

    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = extrairToken(req.headers.authorization);
    if (!token)
      throw new UnauthorizedException('Sessão ausente. Entre de novo.');

    try {
      const { sub } = await this.verificador.verificar(token);
      req.usuario = { id: sub, token };
      return true;
    } catch {
      throw new UnauthorizedException(
        'Sessão expirada ou inválida. Entre de novo.',
      );
    }
  }
}

export function extrairToken(
  cabecalho: string | string[] | undefined,
): string | undefined {
  if (typeof cabecalho !== 'string') return undefined;
  const [tipo, token] = cabecalho.split(' ');
  if (tipo?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token;
}
