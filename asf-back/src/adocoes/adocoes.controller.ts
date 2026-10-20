import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import {
  AcompanhamentoDto,
  AdocaoDto,
  AssinarTermoDto,
  DevolucaoDto,
  FiltroAdocoesDto,
  ListaAdocoesDto,
  NovaAdocaoDto,
  NovoAcompanhamentoDto,
  RegistrarTermoDto,
  TermoAssinadoDto,
  TermoUrlDto,
} from './adocoes.dto.js';
import { AdocoesService } from './adocoes.service.js';

const Uuid = (nome: string) =>
  Param(nome, new ParseUUIDPipe({ errorHttpStatusCode: 400 }));

@ApiTags('adocoes')
@Controller()
export class AdocoesController {
  constructor(private readonly adocoes: AdocoesService) {}

  @Get('adocoes')
  @ApiOkResponse({ type: ListaAdocoesDto })
  listar(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() filtro: FiltroAdocoesDto,
  ): Promise<ListaAdocoesDto> {
    return this.adocoes.listar(usuario, filtro);
  }

  @Get('animais/:id/adocoes')
  @ApiOkResponse({ type: [AdocaoDto] })
  doAnimal(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
  ): Promise<AdocaoDto[]> {
    return this.adocoes.doAnimal(usuario, id);
  }

  @Post('animais/:id/adocao')
  @ApiCreatedResponse({ type: AdocaoDto })
  registrar(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: NovaAdocaoDto,
  ): Promise<AdocaoDto> {
    return this.adocoes.registrar(usuario, id, corpo);
  }

  @Get('adocoes/:adocaoId')
  @ApiOkResponse({ type: AdocaoDto })
  uma(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
  ): Promise<AdocaoDto> {
    return this.adocoes.uma(usuario, adocaoId);
  }

  @Get('adocoes/:adocaoId/acompanhamentos')
  @ApiOkResponse({ type: [AcompanhamentoDto] })
  acompanhamentos(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
  ): Promise<AcompanhamentoDto[]> {
    return this.adocoes.acompanhamentos(usuario, adocaoId);
  }

  @Post('adocoes/:adocaoId/acompanhamentos')
  @ApiCreatedResponse({
    type: [AcompanhamentoDto],
    description: 'A lista atualizada',
  })
  registrarAcompanhamento(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
    @Body() corpo: NovoAcompanhamentoDto,
  ): Promise<AcompanhamentoDto[]> {
    return this.adocoes.registrarAcompanhamento(usuario, adocaoId, corpo);
  }

  @Post('adocoes/:adocaoId/devolucao')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdocaoDto })
  devolver(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
    @Body() corpo: DevolucaoDto,
  ): Promise<AdocaoDto> {
    return this.adocoes.devolver(usuario, adocaoId, corpo);
  }

  @Post('adocoes/:adocaoId/termo/assinar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TermoAssinadoDto })
  assinarTermo(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
    @Body() corpo: AssinarTermoDto,
  ): Promise<TermoAssinadoDto> {
    return this.adocoes.assinarTermo(usuario, adocaoId, corpo);
  }

  @Post('adocoes/:adocaoId/termo')
  @ApiCreatedResponse({ type: AdocaoDto })
  registrarTermo(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
    @Body() corpo: RegistrarTermoDto,
  ): Promise<AdocaoDto> {
    return this.adocoes.registrarTermo(usuario, adocaoId, corpo.caminho);
  }

  @Get('adocoes/:adocaoId/termo')
  @ApiOkResponse({ type: TermoUrlDto })
  urlTermo(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('adocaoId') adocaoId: string,
  ): Promise<TermoUrlDto> {
    return this.adocoes.urlTermo(usuario, adocaoId);
  }
}
