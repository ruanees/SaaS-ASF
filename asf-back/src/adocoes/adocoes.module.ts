import { Module } from '@nestjs/common';
import { AdocoesController } from './adocoes.controller.js';
import { AdocoesService } from './adocoes.service.js';

@Module({
  controllers: [AdocoesController],
  providers: [AdocoesService],
})
export class AdocoesModule {}
