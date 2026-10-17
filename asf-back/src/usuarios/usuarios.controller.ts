import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import {
  AlterarUsuarioDto,
  ConviteCriadoDto,
  ConviteDto,
  EuDto,
  UsuarioDto,
} from './usuarios.dto.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('usuarios')
@Controller()
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get('eu')
  @ApiOkResponse({ type: EuDto })
  eu(@Usuario() usuario: UsuarioAutenticado): Promise<EuDto> {
    return this.usuarios.eu(usuario);
  }

  @Get('usuarios')
  @ApiOkResponse({ type: [UsuarioDto] })
  listar(@Usuario() usuario: UsuarioAutenticado): Promise<UsuarioDto[]> {
    return this.usuarios.listar(usuario);
  }

  @Post('usuarios/convites')
  @ApiCreatedResponse({ type: ConviteCriadoDto })
  convidar(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() convite: ConviteDto,
  ): Promise<ConviteCriadoDto> {
    return this.usuarios.convidar(usuario, convite);
  }

  @Patch('usuarios/:id')
  @ApiOkResponse({ type: UsuarioDto })
  alterar(
    @Usuario() usuario: UsuarioAutenticado,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() alteracao: AlterarUsuarioDto,
  ): Promise<UsuarioDto> {
    return this.usuarios.alterar(usuario, id, alteracao);
  }
}
