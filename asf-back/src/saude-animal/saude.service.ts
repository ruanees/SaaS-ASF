import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados, um } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AlterarCastracaoDto,
  AntiparasitarioDto,
  NovoAntiparasitarioDto,
  SugestaoDto,
  SugestaoQueryDto,
  AlterarVacinaTipoDto,
  CastracaoDto,
  CriarVacinaTipoDto,
  EstadoSaudeDto,
  NovaCastracaoDto,
  NovaVacinacaoDto,
  NovaVermifugacaoDto,
  PendenciaDto,
  SaudeAnimalDto,
  VacinaTipoDto,
  VacinacaoDto,
  VermifugacaoDto,
} from './saude.dto.js';

// PostgREST devolve relação 1:1 como objeto ou como lista, conforme detecta.
function primeiro<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

type LinhaAtendimento = {
  id: string;
  tipo: 'vacina' | 'vermifugacao' | 'antiparasitario';
  data: string;
  veterinario: string | null;
  clinica: { nome: string } | null;
  vacinacoes:
    | {
        lote: string | null;
        proxima_dose: string | null;
        vacina: { nome: string } | null;
      }
    | {
        lote: string | null;
        proxima_dose: string | null;
        vacina: { nome: string } | null;
      }[]
    | null;
  vermifugacoes: ProdutoDose | ProdutoDose[] | null;
  antiparasitarios: ProdutoDose | ProdutoDose[] | null;
};

type ProdutoDose = { produto: string; proxima_dose: string | null };

type LinhaCastracao = Omit<CastracaoDto, 'clinica' | 'data_realizada'> & {
  clinica: { nome: string } | null;
  atendimento: { data: string } | { data: string }[] | null;
};

const CAMPOS_ESTADO =
  'vacinado, vacina_pendente, vacinacao_status, proxima_vacina, castracao_status, castracao_agendada_para, ultima_vermifugacao, proxima_vermifugacao, vermifugacao_vencida, proximo_antiparasitario, antiparasitario_vencido';

@Injectable()
export class SaudeAnimalService {
  constructor(private readonly supabase: SupabaseService) {}

  // Catálogo de vacinas -------------------------------------------------------

  async listarVacinas(
    usuario: UsuarioAutenticado,
    especie?: string,
    todas = false,
  ): Promise<VacinaTipoDto[]> {
    let q = this.supabase
      .para(usuario)
      .from('vacinas_tipos')
      .select(
        'id, nome, especie, reforco_dias, doses_iniciais, intervalo_inicial_dias, ativo',
      );
    if (especie) q = q.eq('especie', especie);
    if (!todas) q = q.eq('ativo', true);
    const linhas = dados(await q.order('especie').order('nome'));
    return (linhas ?? []) as VacinaTipoDto[];
  }

  async criarVacina(
    usuario: UsuarioAutenticado,
    corpo: CriarVacinaTipoDto,
  ): Promise<VacinaTipoDto> {
    return um(
      await this.supabase
        .para(usuario)
        .from('vacinas_tipos')
        .insert({
          nome: corpo.nome,
          especie: corpo.especie,
          reforco_dias: corpo.reforco_dias ?? null,
          doses_iniciais: corpo.doses_iniciais ?? 1,
          intervalo_inicial_dias: corpo.intervalo_inicial_dias ?? null,
        })
        .select(
          'id, nome, especie, reforco_dias, doses_iniciais, intervalo_inicial_dias, ativo',
        )
        .single<VacinaTipoDto>(),
    );
  }

  async alterarVacina(
    usuario: UsuarioAutenticado,
    id: string,
    corpo: AlterarVacinaTipoDto,
  ): Promise<VacinaTipoDto> {
    const campos = Object.fromEntries(
      Object.entries(corpo).filter(([, v]) => v !== undefined),
    );
    const linha = dados(
      await this.supabase
        .para(usuario)
        .from('vacinas_tipos')
        .update(campos)
        .eq('id', id)
        .select(
          'id, nome, especie, reforco_dias, doses_iniciais, intervalo_inicial_dias, ativo',
        )
        .maybeSingle<VacinaTipoDto>(),
    );
    if (!linha) throw new NotFoundException('Vacina não encontrada.');
    return linha;
  }

  // Saúde do animal --------------------------------------------------------------

  async daAnimal(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<SaudeAnimalDto> {
    const sb = this.supabase.para(usuario);
    const [estado, atendimentos, castracoes] = await Promise.all([
      sb
        .from('animal_saude')
        .select(CAMPOS_ESTADO)
        .eq('animal_id', id)
        .maybeSingle(),
      sb
        .from('atendimentos')
        .select(
          'id, tipo, data, veterinario, clinica:clinicas(nome), vacinacoes(lote, proxima_dose, vacina:vacinas_tipos(nome)), vermifugacoes(produto, proxima_dose), antiparasitarios(produto, proxima_dose)',
        )
        .eq('animal_id', id)
        .in('tipo', ['vacina', 'vermifugacao', 'antiparasitario'])
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
      sb
        .from('castracoes')
        .select(
          'id, status, data_agendada, anterior_a_entrada, motivo_cancelamento, clinica:clinicas(nome), atendimento:atendimentos(data)',
        )
        .eq('animal_id', id)
        .order('criado_em', { ascending: false }),
    ]);
    const e = dados(estado) as EstadoSaudeDto | null;
    if (!e) throw new NotFoundException('Animal não encontrado.');

    const linhas = (dados(atendimentos) ?? []) as unknown as LinhaAtendimento[];
    const vacinacoes: VacinacaoDto[] = [];
    const vermifugacoes: VermifugacaoDto[] = [];
    const antiparasitarios: AntiparasitarioDto[] = [];
    for (const l of linhas) {
      if (l.tipo === 'vacina') {
        const v = primeiro(l.vacinacoes);
        if (!v) continue;
        vacinacoes.push({
          atendimento_id: l.id,
          vacina: v.vacina?.nome ?? 'Vacina',
          data: l.data,
          proxima_dose: v.proxima_dose,
          lote: v.lote,
          clinica: l.clinica?.nome ?? null,
          veterinario: l.veterinario,
        });
      } else if (l.tipo === 'antiparasitario') {
        const v = primeiro(l.antiparasitarios);
        if (!v) continue;
        antiparasitarios.push({
          atendimento_id: l.id,
          produto: v.produto,
          data: l.data,
          proxima_dose: v.proxima_dose,
        });
      } else {
        const v = primeiro(l.vermifugacoes);
        if (!v) continue;
        vermifugacoes.push({
          atendimento_id: l.id,
          produto: v.produto,
          data: l.data,
          proxima_dose: v.proxima_dose,
        });
      }
    }

    const cast = (dados(castracoes) ?? []) as unknown as LinhaCastracao[];
    return {
      estado: e,
      vacinacoes,
      vermifugacoes,
      antiparasitarios,
      castracoes: cast.map((c) => ({
        id: c.id,
        status: c.status,
        data_agendada: c.data_agendada,
        data_realizada: primeiro(c.atendimento)?.data ?? null,
        anterior_a_entrada: c.anterior_a_entrada,
        clinica: c.clinica?.nome ?? null,
        motivo_cancelamento: c.motivo_cancelamento,
      })),
    };
  }

  // Estado de vários animais de uma vez (selos da lista).
  async estados(
    sb: SupabaseClient,
    ids: string[],
  ): Promise<
    Map<string, Pick<EstadoSaudeDto, 'vacinacao_status' | 'castracao_status'>>
  > {
    if (ids.length === 0) return new Map();
    const { data, error } = await sb
      .from('animal_saude')
      .select('animal_id, vacinacao_status, castracao_status')
      .in('animal_id', ids);
    if (error || !data) return new Map(); // sem selo de saúde, a lista continua
    return new Map(
      (
        data as {
          animal_id: string;
          vacinacao_status: string;
          castracao_status: string;
        }[]
      ).map((d) => [
        d.animal_id,
        {
          vacinacao_status:
            d.vacinacao_status as EstadoSaudeDto['vacinacao_status'],
          castracao_status:
            d.castracao_status as EstadoSaudeDto['castracao_status'],
        },
      ]),
    );
  }

  // Escritas: cada uma é uma função no banco (atendimento e detalhe juntos).

  async registrarVacina(
    usuario: UsuarioAutenticado,
    id: string,
    c: NovaVacinacaoDto,
  ): Promise<SaudeAnimalDto> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_vacina', {
        p_animal: id,
        p_vacina_tipo: c.vacina_tipo_id,
        p_data: c.data,
        p_proxima_dose: c.proxima_dose ?? null,
        p_lote: c.lote ?? null,
        p_clinica_id: c.clinica_id ?? null,
        p_veterinario: c.veterinario ?? null,
        p_observacoes: c.observacoes ?? null,
      }),
    );
    return this.daAnimal(usuario, id);
  }

  async registrarVermifugacao(
    usuario: UsuarioAutenticado,
    id: string,
    c: NovaVermifugacaoDto,
  ): Promise<SaudeAnimalDto> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_vermifugacao', {
        p_animal: id,
        p_produto: c.produto,
        p_data: c.data,
        p_proxima_dose: c.proxima_dose ?? null,
        p_observacoes: c.observacoes ?? null,
      }),
    );
    return this.daAnimal(usuario, id);
  }

  async novaCastracao(
    usuario: UsuarioAutenticado,
    id: string,
    c: NovaCastracaoDto,
  ): Promise<SaudeAnimalDto> {
    const sb = this.supabase.para(usuario);
    if (c.acao === 'agendar') {
      dados(
        await sb.rpc('agendar_castracao', {
          p_animal: id,
          p_data: c.data,
          p_clinica_id: c.clinica_id ?? null,
        }),
      );
    } else if (c.acao === 'realizar') {
      await this.realizar(sb, id, c);
    } else {
      dados(await sb.rpc('registrar_castracao_anterior', { p_animal: id }));
    }
    return this.daAnimal(usuario, id);
  }

  async alterarCastracao(
    usuario: UsuarioAutenticado,
    id: string,
    castracaoId: string,
    c: AlterarCastracaoDto,
  ): Promise<SaudeAnimalDto> {
    const sb = this.supabase.para(usuario);
    if (c.acao === 'cancelar') {
      dados(
        await sb.rpc('cancelar_castracao', {
          p_castracao: castracaoId,
          p_motivo: c.motivo ?? null,
        }),
      );
    } else {
      // realizar_castracao encontra o agendamento aberto do animal.
      await this.realizar(sb, id, c);
    }
    return this.daAnimal(usuario, id);
  }

  private async realizar(
    sb: SupabaseClient,
    id: string,
    c: {
      data?: string;
      clinica_id?: string;
      veterinario?: string;
      observacoes?: string;
      microchip?: string;
    },
  ): Promise<void> {
    dados(
      await sb.rpc('realizar_castracao', {
        p_animal: id,
        p_data: c.data,
        p_clinica_id: c.clinica_id ?? null,
        p_veterinario: c.veterinario ?? null,
        p_observacoes: c.observacoes ?? null,
        p_microchip: c.microchip ?? null,
      }),
    );
  }

  async registrarAntiparasitario(
    usuario: UsuarioAutenticado,
    id: string,
    c: NovoAntiparasitarioDto,
  ): Promise<SaudeAnimalDto> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_antiparasitario', {
        p_animal: id,
        p_produto: c.produto,
        p_data: c.data,
        p_proxima_dose: c.proxima_dose ?? null,
        p_observacoes: c.observacoes ?? null,
      }),
    );
    return this.daAnimal(usuario, id);
  }

  // Sugestão da próxima dose: a regra (protocolo, filhote, produto) mora no banco.
  async sugestao(
    usuario: UsuarioAutenticado,
    id: string,
    q: SugestaoQueryDto,
  ): Promise<SugestaoDto> {
    const sb = this.supabase.para(usuario);
    const r =
      q.tipo === 'vacina'
        ? await sb.rpc('sugerir_proxima_dose', {
            p_animal: id,
            p_vacina_tipo: q.vacina_tipo_id,
            p_data: q.data,
          })
        : q.tipo === 'vermifugacao'
          ? await sb.rpc('sugerir_proxima_vermifugacao', {
              p_animal: id,
              p_data: q.data,
            })
          : await sb.rpc('sugerir_proximo_antiparasitario', {
              p_produto: q.produto ?? '',
              p_data: q.data,
            });
    const data = dados(r) as unknown;
    return { proxima_dose: typeof data === 'string' ? data : null };
  }

  // Pendências: a regra (o que vence, em quantos dias, quem entra) mora no banco.
  async pendencias(usuario: UsuarioAutenticado): Promise<PendenciaDto[]> {
    const linhas = dados(
      await this.supabase.para(usuario).rpc('pendencias_saude'),
    );
    return (linhas ?? []) as PendenciaDto[];
  }
}
