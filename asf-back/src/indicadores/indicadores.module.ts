import { Module } from '@nestjs/common';
import { IndicadoresController } from './indicadores.controller.js';
import { IndicadoresService } from './indicadores.service.js';
import { RelatoriosController } from './relatorios.controller.js';
import { ReportBuilderService } from './report-builder.service.js';

@Module({
  controllers: [IndicadoresController, RelatoriosController],
  providers: [IndicadoresService, ReportBuilderService],
})
export class IndicadoresModule {}
