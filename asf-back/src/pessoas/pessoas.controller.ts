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
  Put,
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
  AlterarPessoaDto,
  AnonimizacaoDto,
  ContatoDto,
  ContatoEntradaDto,
  FiltroPessoasDto,
  LarTemporarioDto,
  ListaPessoasDto,
  NovaPessoaDto,
  PessoaAlemDoPrazoDto,
  PessoaDto,
} from './pessoas.dto.js';
import { PessoasService } from './pessoas.service.js';

const Uuid = (nome: string) =>
  Param(nome, new ParseUUIDPipe({ errorHttpStatusCode: 400 }));

// Quem pode o quê decide o banco (RLS e funções): todos veem o nome; só
// administração e coordenação cadastram e veem contato.
@ApiTags('pessoas')
@Controller()
export class PessoasController {
  constructor(private readonly pessoas: PessoasService) {}

  @Get('pessoas')
  @ApiOkResponse({ type: ListaPessoasDto })
  listar(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() filtro: FiltroPessoasDto,
  ): Promise<ListaPessoasDto> {
    return this.pessoas.listar(usuario, filtro);
  }

  @Post('pessoas')
  @ApiCreatedResponse({ type: PessoaDto })
  criar(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: NovaPessoaDto,
  ): Promise<PessoaDto> {
    return this.pessoas.criar(usuario, corpo);
  }

  // Antes de pessoas/:id: senão "alem-do-prazo" seria lido como id.
  @Get('pessoas/alem-do-prazo')
  @ApiOkResponse({
    type: [PessoaAlemDoPrazoDto],
    description: 'Só administração e coordenação',
  })
  alemDoPrazo(
    @Usuario() usuario: UsuarioAutenticado,
  ): Promise<PessoaAlemDoPrazoDto[]> {
    return this.pessoas.alemDoPrazo(usuario);
  }

  @Get('pessoas/:id')
  @ApiOkResponse({ type: PessoaDto })
  buscar(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
  ): Promise<PessoaDto> {
    return this.pessoas.buscar(usuario, id);
  }

  @Patch('pessoas/:id')
  @ApiOkResponse({ type: PessoaDto })
  alterar(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: AlterarPessoaDto,
  ): Promise<PessoaDto> {
    return this.pessoas.alterar(usuario, id, corpo);
  }

  @Get('pessoas/:id/contato')
  @ApiOkResponse({
    type: ContatoDto,
    description: 'Cada leitura fica registrada na auditoria',
  })
  contato(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
  ): Promise<ContatoDto> {
    return this.pessoas.contato(usuario, id);
  }

  @Put('pessoas/:id/contato')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Contato corrigido' })
  alterarContato(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: ContatoEntradaDto,
  ): Promise<void> {
    return this.pessoas.alterarContato(usuario, id, corpo);
  }

  @Get('pessoas/:id/dados')
  @ApiOkResponse({
    description: 'Tudo o que existe sobre a pessoa (LGPD, art. 18)',
    schema: { type: 'object', additionalProperties: true },
  })
  dados(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.pessoas.dados(usuario, id);
  }

  @Post('pessoas/:id/anonimizar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AnonimizacaoDto })
  anonimizar(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
  ): Promise<AnonimizacaoDto> {
    return this.pessoas.anonimizar(usuario, id);
  }

  @Get('lares-temporarios')
  @ApiOkResponse({ type: [LarTemporarioDto] })
  lares(@Usuario() usuario: UsuarioAutenticado): Promise<LarTemporarioDto[]> {
    return this.pessoas.lares(usuario);
  }
}
