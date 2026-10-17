import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extrairToken, JwtGuard } from './jwt.guard.js';
import type { RequisicaoAutenticada } from './usuario.js';
import type { VerificadorJwt } from './verificador-jwt.js';

const UUID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

function contexto(req: RequisicaoAutenticada): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guard(publica: boolean, verificar: VerificadorJwt['verificar']) {
  const reflector = {
    getAllAndOverride: () => publica,
  } as unknown as Reflector;
  return new JwtGuard(reflector, { verificar } as VerificadorJwt);
}

describe('JwtGuard', () => {
  it('deixa passar rota @Publico() sem token', async () => {
    const verificar = vi.fn();
    await expect(
      guard(true, verificar).canActivate(contexto({ headers: {} })),
    ).resolves.toBe(true);
    expect(verificar).not.toHaveBeenCalled();
  });

  it('recusa rota fechada sem token', async () => {
    await expect(
      guard(false, vi.fn()).canActivate(contexto({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token inválido', async () => {
    const verificar = vi.fn().mockRejectedValue(new Error('assinatura'));
    await expect(
      guard(false, verificar).canActivate(
        contexto({ headers: { authorization: 'Bearer abc' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('aceita token válido e guarda quem chamou na requisição', async () => {
    const req: RequisicaoAutenticada = {
      headers: { authorization: 'Bearer abc.def.ghi' },
    };
    const verificar = vi.fn().mockResolvedValue({ sub: UUID });
    await expect(
      guard(false, verificar).canActivate(contexto(req)),
    ).resolves.toBe(true);
    expect(verificar).toHaveBeenCalledWith('abc.def.ghi');
    expect(req.usuario).toEqual({ id: UUID, token: 'abc.def.ghi' });
  });
});

describe('extrairToken', () => {
  it.each([
    [undefined, undefined],
    ['', undefined],
    ['Basic abc', undefined],
    ['Bearer', undefined],
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
  ])('%s -> %s', (cabecalho, esperado) => {
    expect(extrairToken(cabecalho)).toBe(esperado);
  });

  it('ignora cabeçalho repetido', () => {
    expect(extrairToken(['Bearer a', 'Bearer b'])).toBeUndefined();
  });
});
