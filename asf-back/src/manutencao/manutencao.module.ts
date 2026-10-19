import { Module } from '@nestjs/common';
import { ManutencaoController } from './manutencao.controller.js';
import { ManutencaoService } from './manutencao.service.js';

@Module({
  controllers: [ManutencaoController],
  providers: [ManutencaoService],
})
export class ManutencaoModule {}
