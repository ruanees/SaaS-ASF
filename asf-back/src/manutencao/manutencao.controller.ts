import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import { ArquivoSoltoDto, LimpezaDto } from './manutencao.dto.js';
import { ManutencaoService } from './manutencao.service.js';

@ApiTags('manutencao')
@Controller('arquivos-soltos')
export class ManutencaoController {
  constructor(private readonly manutencao: ManutencaoService) {}

  @Get()
  @ApiOkResponse({
    type: [ArquivoSoltoDto],
    description: 'Só admin. Arquivos sem registro há mais de um dia.',
  })
  soltos(@Usuario() usuario: UsuarioAutenticado): Promise<ArquivoSoltoDto[]> {
    return this.manutencao.soltos(usuario);
  }

  @Post('apagar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LimpezaDto })
  limpar(@Usuario() usuario: UsuarioAutenticado): Promise<LimpezaDto> {
    return this.manutencao.limpar(usuario);
  }
}
