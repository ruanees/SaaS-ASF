import { Module } from '@nestjs/common';
import { SessaoController } from './sessao.controller.js';
import { SessaoService } from './sessao.service.js';

@Module({
  controllers: [SessaoController],
  providers: [SessaoService],
})
export class SessaoModule {}
