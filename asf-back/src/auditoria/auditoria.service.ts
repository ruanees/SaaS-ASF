import { BadRequestException, Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  FiltroAuditoriaDto,
  Grupo,
  ListaAuditoriaDto,
  Operacao,
  RegistroAuditoriaDto,
} from './auditoria.dto.js';

const OPERACOES_DO_GRUPO: Record<Grupo, Operacao[]> = {
  acessos: ['leitura_sensivel'],
  exportacoes: ['exportacao'],
  alteracoes: ['insert', 'update', 'delete'],
};

// O fuso da associação (America/Fortaleza) não tem horário de verão.
const FUSO = '-03:00';

/** AAAA-MM-DD -> dia seguinte, para o fim do período ser inclusivo. */
export function diaSeguinte(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Só o admin lê a auditoria: quem decide é a RLS (para os outros a lista
// volta vazia). Aqui só se filtra e se troca o id pelo nome.
@Injectable()
export class AuditoriaService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(
    usuario: UsuarioAutenticado,
    f: FiltroAuditoriaDto,
  ): Promise<ListaAuditoriaDto> {
    if (f.de && f.ate && f.de > f.ate) {
      throw new BadRequestException(
        'O início do período não pode ser depois do fim.',
      );
    }
    const pagina = f.pagina ?? 1;
    const porPagina = f.por_pagina ?? 50;
    const sb = this.supabase.para(usuario);

    let consulta = sb
      .from('auditoria')
      .select(
        'id, em, user_id, tabela, registro_id, operacao, campos_alterados',
        { count: 'exact' },
      );
    if (f.de) consulta = consulta.gte('em', `${f.de}T00:00:00${FUSO}`);
    if (f.ate)
      consulta = consulta.lt('em', `${diaSeguinte(f.ate)}T00:00:00${FUSO}`);
    if (f.grupo)
      consulta = consulta.in('operacao', OPERACOES_DO_GRUPO[f.grupo]);
    const { data, error, count } = await consulta
      .order('em', { ascending: false })
      .order('id', { ascending: false })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);
    if (error) throw error;

    const linhas = (data ?? []) as (Omit<RegistroAuditoriaDto, 'usuario'> & {
      user_id: string | null;
    })[];
    const ids = [
      ...new Set(linhas.map((l) => l.user_id).filter((i): i is string => !!i)),
    ];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const usuarios = (dados(
        await sb.from('usuarios').select('user_id, nome').in('user_id', ids),
      ) ?? []) as { user_id: string; nome: string }[];
      for (const u of usuarios) nomes.set(u.user_id, u.nome);
    }

    return {
      itens: linhas.map((l) => ({
        id: l.id,
        em: l.em,
        usuario: l.user_id ? (nomes.get(l.user_id) ?? 'Conta removida') : null,
        tabela: l.tabela,
        registro_id: l.registro_id,
        operacao: l.operacao,
        campos_alterados: l.campos_alterados,
      })),
      total: count ?? 0,
      pagina,
      por_pagina: porPagina,
    };
  }
}
