import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados, um } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  IndicadoresDto,
  PeriodoDto,
  PontoMensalDto,
} from './indicadores.dto.js';

// Quem conta é o banco (função indicadores); aqui só se repassa. Contar de
// novo no Nest ou no front seria a mesma regra em dois lugares.
@Injectable()
export class IndicadoresService {
  constructor(private readonly supabase: SupabaseService) {}

  async painel(
    usuario: UsuarioAutenticado,
    p: PeriodoDto,
  ): Promise<IndicadoresDto> {
    return um(
      await this.supabase.para(usuario).rpc('indicadores', {
        p_de: p.de ?? null,
        p_ate: p.ate ?? null,
      }),
    ) as IndicadoresDto;
  }

  // A série usa o mesmo período já resolvido pelo banco (padrão: o ano).
  async mensal(
    usuario: UsuarioAutenticado,
    p: PeriodoDto,
  ): Promise<PontoMensalDto[]> {
    const sb = this.supabase.para(usuario);
    let { de, ate } = p;
    if (!de || !ate) {
      const resolvido = await this.painel(usuario, p);
      de = resolvido.de;
      ate = resolvido.ate;
    }
    return (dados(
      await sb.rpc('indicadores_mensais', { p_de: de, p_ate: ate }),
    ) ?? []) as PontoMensalDto[];
  }
}
