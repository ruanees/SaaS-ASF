import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import { Publico } from '../comum/publico.decorator.js';
import {
  EntrarDto,
  FatorDto,
  InscricaoMfaDto,
  NovaSenhaDto,
  TrocarSenhaDto,
  VerificarMfaDto,
  RecuperarDto,
  RenovarDto,
  SessaoDto,
} from './sessao.dto.js';
import { SessaoService } from './sessao.service.js';

// Entrar, renovar e recuperar são públicas por natureza: quem chama ainda não
// tem sessão. Trocar senha e sair exigem sessão (inclusive a do link de
// recuperação).
@ApiTags('sessao')
@Controller('sessao')
export class SessaoController {
  constructor(private readonly sessao: SessaoService) {}

  @Publico()
  @Post('entrar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessaoDto })
  entrar(@Body() corpo: EntrarDto): Promise<SessaoDto> {
    return this.sessao.entrar(corpo.email, corpo.senha, corpo.captcha);
  }

  @Publico()
  @Post('renovar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessaoDto })
  renovar(@Body() corpo: RenovarDto): Promise<SessaoDto> {
    return this.sessao.renovar(corpo.refresh_token);
  }

  @Publico()
  @Post('recuperar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Igual para e-mail que existe ou não' })
  recuperar(@Body() corpo: RecuperarDto): Promise<void> {
    return this.sessao.recuperar(corpo.email, corpo.captcha);
  }

  @Post('senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  senha(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: NovaSenhaDto,
  ): Promise<void> {
    return this.sessao.trocarSenha(usuario, corpo.senha);
  }

  // Tela "Trocar minha senha": confere a senha atual antes.
  @Post('trocar-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  trocarSenha(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: TrocarSenhaDto,
  ): Promise<void> {
    return this.sessao.trocarComAtual(usuario, corpo.atual, corpo.senha);
  }

  @Get('mfa/fatores')
  @ApiOkResponse({ type: [FatorDto] })
  fatores(@Usuario() usuario: UsuarioAutenticado): Promise<FatorDto[]> {
    return this.sessao.fatores(usuario);
  }

  @Post('mfa/inscrever')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InscricaoMfaDto })
  inscreverMfa(
    @Usuario() usuario: UsuarioAutenticado,
  ): Promise<InscricaoMfaDto> {
    return this.sessao.inscreverMfa(usuario);
  }

  @Post('mfa/verificar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: SessaoDto,
    description: 'Sessão nova, com o segundo fator',
  })
  verificarMfa(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: VerificarMfaDto,
  ): Promise<SessaoDto> {
    return this.sessao.verificarMfa(usuario, corpo.fator_id, corpo.codigo);
  }

  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  sair(@Usuario() usuario: UsuarioAutenticado): Promise<void> {
    return this.sessao.sair(usuario);
  }
}
