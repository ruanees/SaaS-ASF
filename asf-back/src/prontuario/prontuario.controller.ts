import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import {
  AssinarLaudoDto,
  AtendimentoDto,
  DataDto,
  LaudoAssinadoDto,
  LaudoUrlDto,
  NovoAtendimentoDto,
  ProntuarioDto,
  ProntuarioQueryDto,
  RegistrarLaudoDto,
  ResultadoExameDto,
  SaudeEntradaDto,
} from './prontuario.dto.js';
import { ProntuarioService } from './prontuario.service.js';

const Uuid = (nome: string) =>
  Param(nome, new ParseUUIDPipe({ errorHttpStatusCode: 400 }));

@ApiTags('prontuario')
@Controller()
export class ProntuarioController {
  constructor(private readonly prontuario: ProntuarioService) {}

  @Get('animais/:id/prontuario')
  @ApiOkResponse({ type: ProntuarioDto })
  daAnimal(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Query() q: ProntuarioQueryDto,
  ): Promise<ProntuarioDto> {
    return this.prontuario.daAnimal(usuario, id, q);
  }

  @Post('animais/:id/atendimentos')
  @ApiCreatedResponse({ type: AtendimentoDto })
  registrar(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: NovoAtendimentoDto,
  ): Promise<AtendimentoDto> {
    return this.prontuario.registrar(usuario, id, corpo);
  }

  @Post('animais/:id/saude-entrada')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Condição na entrada, exames pedidos e tratamento iniciado',
  })
  saudeEntrada(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: SaudeEntradaDto,
  ): Promise<void> {
    return this.prontuario.saudeEntrada(usuario, id, corpo);
  }

  @Patch('atendimentos/:atendimentoId/resultado')
  @ApiOkResponse({ type: AtendimentoDto })
  resultado(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('atendimentoId') atendimentoId: string,
    @Body() corpo: ResultadoExameDto,
  ): Promise<AtendimentoDto> {
    return this.prontuario.resultado(usuario, atendimentoId, corpo);
  }

  @Patch('atendimentos/:atendimentoId/fim-tratamento')
  @ApiOkResponse({ type: AtendimentoDto })
  encerrarTratamento(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('atendimentoId') atendimentoId: string,
    @Body() corpo: DataDto,
  ): Promise<AtendimentoDto> {
    return this.prontuario.encerrarTratamento(
      usuario,
      atendimentoId,
      corpo.data,
    );
  }

  @Patch('atendimentos/:atendimentoId/alta')
  @ApiOkResponse({ type: AtendimentoDto })
  darAlta(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('atendimentoId') atendimentoId: string,
    @Body() corpo: DataDto,
  ): Promise<AtendimentoDto> {
    return this.prontuario.darAlta(usuario, atendimentoId, corpo.data);
  }

  @Post('atendimentos/:atendimentoId/laudo/assinar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LaudoAssinadoDto })
  assinarLaudo(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('atendimentoId') atendimentoId: string,
    @Body() corpo: AssinarLaudoDto,
  ): Promise<LaudoAssinadoDto> {
    return this.prontuario.assinarLaudo(usuario, atendimentoId, corpo);
  }

  @Post('atendimentos/:atendimentoId/laudo')
  @ApiCreatedResponse({ type: AtendimentoDto })
  registrarLaudo(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('atendimentoId') atendimentoId: string,
    @Body() corpo: RegistrarLaudoDto,
  ): Promise<AtendimentoDto> {
    return this.prontuario.registrarLaudo(
      usuario,
      atendimentoId,
      corpo.caminho,
    );
  }

  @Get('atendimentos/:atendimentoId/laudo')
  @ApiOkResponse({ type: LaudoUrlDto })
  urlLaudo(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('atendimentoId') atendimentoId: string,
  ): Promise<LaudoUrlDto> {
    return this.prontuario.urlLaudo(usuario, atendimentoId);
  }
}
