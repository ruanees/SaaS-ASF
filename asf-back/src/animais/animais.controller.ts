import {
  Body,
  Controller,
  Delete,
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
  AlterarAnimalDto,
  AnimalDto,
  AssinarFotoDto,
  CriarAnimalDto,
  DuplicadoDto,
  DuplicadosQueryDto,
  FiltroAnimaisDto,
  FotoAssinadaDto,
  FotoDto,
  ListaAnimaisDto,
  MovimentacaoDto,
  NovaMovimentacaoDto,
  RegistrarFotoDto,
} from './animais.dto.js';
import { AnimaisService } from './animais.service.js';

const Id = () => Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }));

@ApiTags('animais')
@Controller('animais')
export class AnimaisController {
  constructor(private readonly animais: AnimaisService) {}

  @Get()
  @ApiOkResponse({ type: ListaAnimaisDto })
  listar(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() filtro: FiltroAnimaisDto,
  ): Promise<ListaAnimaisDto> {
    return this.animais.listar(usuario, filtro);
  }

  // Antes de /:id, senão "duplicados" seria lido como id.
  @Get('duplicados')
  @ApiOkResponse({ type: [DuplicadoDto] })
  duplicados(
    @Usuario() usuario: UsuarioAutenticado,
    @Query() q: DuplicadosQueryDto,
  ): Promise<DuplicadoDto[]> {
    return this.animais.duplicados(usuario, q.nome, q.especie, q.sexo);
  }

  @Post()
  @ApiCreatedResponse({ type: AnimalDto })
  criar(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: CriarAnimalDto,
  ): Promise<AnimalDto> {
    return this.animais.criar(usuario, corpo);
  }

  @Get(':id')
  @ApiOkResponse({ type: AnimalDto })
  buscar(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
  ): Promise<AnimalDto> {
    return this.animais.buscar(usuario, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AnimalDto })
  alterar(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
    @Body() corpo: AlterarAnimalDto,
  ): Promise<AnimalDto> {
    return this.animais.alterar(usuario, id, corpo);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Exclusão lógica (admin e coordenação)',
  })
  excluir(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
  ): Promise<void> {
    return this.animais.excluir(usuario, id);
  }

  @Get(':id/movimentacoes')
  @ApiOkResponse({ type: [MovimentacaoDto] })
  movimentacoes(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
  ): Promise<MovimentacaoDto[]> {
    return this.animais.movimentacoes(usuario, id);
  }

  @Post(':id/movimentacoes')
  @ApiCreatedResponse({ type: MovimentacaoDto })
  mover(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
    @Body() corpo: NovaMovimentacaoDto,
  ): Promise<MovimentacaoDto> {
    return this.animais.mover(usuario, id, corpo);
  }

  @Post(':id/fotos/assinar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FotoAssinadaDto })
  assinarFoto(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
    // tipo e tamanho conferidos pelo DTO antes de assinar
    @Body() _corpo: AssinarFotoDto,
  ): Promise<FotoAssinadaDto> {
    return this.animais.assinarFoto(usuario, id);
  }

  @Post(':id/fotos')
  @ApiCreatedResponse({ type: FotoDto })
  registrarFoto(
    @Usuario() usuario: UsuarioAutenticado,
    @Id() id: string,
    @Body() corpo: RegistrarFotoDto,
  ): Promise<FotoDto> {
    return this.animais.registrarFoto(usuario, id, corpo.caminho);
  }
}
