import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { ArquivoSoltoDto, LimpezaDto } from './manutencao.dto.js';

/** Agrupa os caminhos por balde (o Storage apaga balde a balde). */
export function porBalde(arquivos: ArquivoSoltoDto[]): Map<string, string[]> {
  const grupos = new Map<string, string[]>();
  for (const a of arquivos) {
    grupos.set(a.balde, [...(grupos.get(a.balde) ?? []), a.caminho]);
  }
  return grupos;
}

// Quem pode ver e apagar decide o banco: a função só responde ao admin com
// segundo fator, e a política do balde só deixa apagar o que está solto.
@Injectable()
export class ManutencaoService {
  constructor(private readonly supabase: SupabaseService) {}

  async soltos(usuario: UsuarioAutenticado): Promise<ArquivoSoltoDto[]> {
    return (dados(await this.supabase.para(usuario).rpc('arquivos_soltos')) ??
      []) as ArquivoSoltoDto[];
  }

  async limpar(usuario: UsuarioAutenticado): Promise<LimpezaDto> {
    const sb = this.supabase.para(usuario);
    const antes = await this.soltos(usuario);
    for (const [balde, caminhos] of porBalde(antes)) {
      // Falha num balde não impede os outros; o que sobrar aparece na contagem.
      await sb.storage.from(balde).remove(caminhos);
    }
    const depois = await this.soltos(usuario);
    return {
      apagados: antes.length - depois.length,
      restantes: depois.length,
    };
  }
}
