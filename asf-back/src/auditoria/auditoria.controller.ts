import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import { FiltroAuditoriaDto, ListaAuditoriaDto } from './auditoria.dto.js';
import { AuditoriaService } from './auditoria.service.js';

@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @ApiOkResponse({
    type: ListaAuditoriaDto,
    description: 'Só o admin vê registros (RLS); para os outros, lista vazia',
  })
  listar(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() filtro: FiltroAuditoriaDto,
  ): Promise<ListaAuditoriaDto> {
    return this.auditoria.listar(usuario, filtro);
  }
}
