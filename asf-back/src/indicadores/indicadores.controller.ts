import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import {
  IndicadoresDto,
  PeriodoDto,
  PontoMensalDto,
} from './indicadores.dto.js';
import { IndicadoresService } from './indicadores.service.js';

@ApiTags('indicadores')
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get()
  @ApiOkResponse({ type: IndicadoresDto })
  painel(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() p: PeriodoDto,
  ): Promise<IndicadoresDto> {
    return this.indicadores.painel(usuario, p);
  }

  @Get('mensal')
  @ApiOkResponse({ type: [PontoMensalDto] })
  mensal(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() p: PeriodoDto,
  ): Promise<PontoMensalDto[]> {
    return this.indicadores.mensal(usuario, p);
  }
}
