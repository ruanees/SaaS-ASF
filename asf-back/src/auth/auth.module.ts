import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './jwt.guard.js';
import { VerificadorJwt } from './verificador-jwt.js';

@Module({
  providers: [VerificadorJwt, { provide: APP_GUARD, useClass: JwtGuard }],
  exports: [VerificadorJwt],
})
export class AuthModule {}
