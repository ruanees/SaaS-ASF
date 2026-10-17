import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { exigir, lerConfiguracao } from '../configuracao.js';

// Confere o JWT emitido pelo Supabase Auth pelas chaves públicas do projeto
// (JWKS). Não precisa de segredo: o back não guarda `SUPABASE_JWT_SECRET`.
@Injectable()
export class VerificadorJwt {
  private chaves?: JWTVerifyGetKey;
  private emissor?: string;

  async verificar(token: string): Promise<{ sub: string }> {
    if (!this.chaves || !this.emissor) {
      const url = exigir(lerConfiguracao(), 'supabaseUrl').replace(/\/+$/, '');
      this.emissor = `${url}/auth/v1`;
      this.chaves = createRemoteJWKSet(
        new URL(`${this.emissor}/.well-known/jwks.json`),
      );
    }
    const { payload } = await jwtVerify(token, this.chaves, {
      issuer: this.emissor,
      audience: 'authenticated',
    });
    if (typeof payload.sub !== 'string' || payload.sub === '') {
      throw new Error('JWT sem sub');
    }
    return { sub: payload.sub };
  }
}
