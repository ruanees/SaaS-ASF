import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario, type UsuarioAutenticado } from '../auth/usuario.js';
import { dados, um } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { ClinicaDto, CriarClinicaDto } from './animais.dto.js';

// Clínicas parceiras. Todos leem; só admin e coordenação cadastram (RLS).
@ApiTags('clinicas')
@Controller('clinicas')
export class ClinicasController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  @ApiOkResponse({ type: [ClinicaDto] })
  async listar(@Usuario() usuario: UsuarioAutenticado): Promise<ClinicaDto[]> {
    const linhas = dados(
      await this.supabase
        .para(usuario)
        .from('clinicas')
        .select('id, nome, ativo')
        .eq('ativo', true)
        .order('nome'),
    );
    return (linhas ?? []) as ClinicaDto[];
  }

  @Post()
  @ApiCreatedResponse({ type: ClinicaDto })
  async criar(
    @Usuario() usuario: UsuarioAutenticado,
    @Body() corpo: CriarClinicaDto,
  ): Promise<ClinicaDto> {
    return um(
      await this.supabase
        .para(usuario)
        .from('clinicas')
        .insert({ nome: corpo.nome })
        .select('id, nome, ativo')
        .single<ClinicaDto>(),
    );
  }
}
