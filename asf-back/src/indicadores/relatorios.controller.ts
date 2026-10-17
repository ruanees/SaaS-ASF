import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import { paraCsv, ReportBuilderService } from './report-builder.service.js';
import {
  RelatorioDto,
  RelatorioQueryDto,
  SECOES,
  type Secao,
} from './relatorios.dto.js';

const SecaoParam = () =>
  Param(
    'secao',
    new ParseEnumPipe(Object.fromEntries(SECOES.map((s) => [s, s])), {
      errorHttpStatusCode: 400,
      exceptionFactory: () =>
        new BadRequestException('Relatório desconhecido.'),
    }),
  );

@ApiTags('relatorios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatorios: ReportBuilderService) {}

  @Get(':secao')
  @ApiParam({ name: 'secao', enum: SECOES })
  @ApiOkResponse({ type: RelatorioDto })
  ver(
    @Usuario() usuario: UsuarioAutenticado,
    @SecaoParam() secao: Secao,
    @Query() q: RelatorioQueryDto,
  ): Promise<RelatorioDto> {
    return this.relatorios.construir(usuario, secao, q);
  }

  // Exportar fica na auditoria (só o fato, nunca o conteúdo).
  @Get(':secao/csv')
  @ApiParam({ name: 'secao', enum: SECOES })
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string' }, description: 'CSV (;) com BOM' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(
    @Usuario() usuario: UsuarioAutenticado,
    @SecaoParam() secao: Secao,
    @Query() q: RelatorioQueryDto,
  ): Promise<string> {
    const r = await this.relatorios.construir(usuario, secao, q);
    await this.relatorios.registrarExportacao(usuario, secao);
    return paraCsv(r);
  }

  // A impressão (ou PDF pelo navegador) também é exportação.
  @Post(':secao/impressao')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'secao', enum: SECOES })
  @ApiNoContentResponse({ description: 'Impressão registrada na auditoria' })
  impressao(
    @Usuario() usuario: UsuarioAutenticado,
    @SecaoParam() secao: Secao,
  ): Promise<void> {
    return this.relatorios.registrarExportacao(usuario, secao);
  }
}
