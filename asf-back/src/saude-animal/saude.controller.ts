import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import {
  AlterarCastracaoDto,
  AlterarVacinaTipoDto,
  CriarVacinaTipoDto,
  FiltroVacinasTiposDto,
  NovaCastracaoDto,
  NovaVacinacaoDto,
  NovaVermifugacaoDto,
  NovoAntiparasitarioDto,
  SugestaoDto,
  SugestaoQueryDto,
  PendenciaDto,
  SaudeAnimalDto,
  VacinaTipoDto,
} from './saude.dto.js';
import { SaudeAnimalService } from './saude.service.js';

const Uuid = (nome: string) =>
  Param(nome, new ParseUUIDPipe({ errorHttpStatusCode: 400 }));

@ApiTags('saude-animal')
@Controller()
export class SaudeAnimalController {
  constructor(private readonly saude: SaudeAnimalService) {}

  @Get('vacinas-tipos')
  @ApiOkResponse({ type: [VacinaTipoDto] })
  listarVacinas(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() q: FiltroVacinasTiposDto,
  ): Promise<VacinaTipoDto[]> {
    return this.saude.listarVacinas(usuario, q.especie, q.todas === 'sim');
  }

  @Post('vacinas-tipos')
  @ApiCreatedResponse({ type: VacinaTipoDto })
  criarVacina(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: CriarVacinaTipoDto,
  ): Promise<VacinaTipoDto> {
    return this.saude.criarVacina(usuario, corpo);
  }

  @Patch('vacinas-tipos/:id')
  @ApiOkResponse({ type: VacinaTipoDto })
  alterarVacina(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: AlterarVacinaTipoDto,
  ): Promise<VacinaTipoDto> {
    return this.saude.alterarVacina(usuario, id, corpo);
  }

  @Get('animais/:id/saude')
  @ApiOkResponse({ type: SaudeAnimalDto })
  daAnimal(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
  ): Promise<SaudeAnimalDto> {
    return this.saude.daAnimal(usuario, id);
  }

  @Post('animais/:id/vacinas')
  @ApiCreatedResponse({ type: SaudeAnimalDto })
  registrarVacina(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: NovaVacinacaoDto,
  ): Promise<SaudeAnimalDto> {
    return this.saude.registrarVacina(usuario, id, corpo);
  }

  @Post('animais/:id/vermifugacoes')
  @ApiCreatedResponse({ type: SaudeAnimalDto })
  registrarVermifugacao(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: NovaVermifugacaoDto,
  ): Promise<SaudeAnimalDto> {
    return this.saude.registrarVermifugacao(usuario, id, corpo);
  }

  @Post('animais/:id/antiparasitarios')
  @ApiCreatedResponse({ type: SaudeAnimalDto })
  registrarAntiparasitario(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: NovoAntiparasitarioDto,
  ): Promise<SaudeAnimalDto> {
    return this.saude.registrarAntiparasitario(usuario, id, corpo);
  }

  @Get('animais/:id/sugestao')
  @ApiOkResponse({ type: SugestaoDto })
  sugestao(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Query() q: SugestaoQueryDto,
  ): Promise<SugestaoDto> {
    return this.saude.sugestao(usuario, id, q);
  }

  @Post('animais/:id/castracoes')
  @ApiCreatedResponse({ type: SaudeAnimalDto })
  novaCastracao(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Body() corpo: NovaCastracaoDto,
  ): Promise<SaudeAnimalDto> {
    return this.saude.novaCastracao(usuario, id, corpo);
  }

  @Patch('animais/:id/castracoes/:castracaoId')
  @ApiOkResponse({ type: SaudeAnimalDto })
  alterarCastracao(
    @Usuario() usuario: UsuarioAutenticado,
    @Uuid('id') id: string,
    @Uuid('castracaoId') castracaoId: string,
    @Body() corpo: AlterarCastracaoDto,
  ): Promise<SaudeAnimalDto> {
    return this.saude.alterarCastracao(usuario, id, castracaoId, corpo);
  }

  @Get('pendencias')
  @ApiOkResponse({ type: [PendenciaDto] })
  pendencias(@Usuario() usuario: UsuarioAutenticado): Promise<PendenciaDto[]> {
    return this.saude.pendencias(usuario);
  }
}
