import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados, um } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AssinarLaudoDto,
  AtendimentoDto,
  LaudoAssinadoDto,
  LaudoUrlDto,
  NovoAtendimentoDto,
  ProntuarioDto,
  ProntuarioQueryDto,
  Resultado,
  ResultadoExameDto,
  SaudeEntradaDto,
} from './prontuario.dto.js';

export const BALDE_LAUDOS = 'laudos';
const EXTENSAO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// PostgREST devolve relação 1:1 como objeto ou como lista, conforme detecta.
function primeiro<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

type Exame = {
  nome: string;
  metodo: string | null;
  resultado: Resultado;
  resultado_detalhe: string | null;
  resultado_em: string | null;
  laudo_caminho: string | null;
};
type Produto = { produto: string; proxima_dose: string | null };
type Linha = Omit<
  AtendimentoDto,
  'clinica' | 'autor' | 'exame' | 'tratamento' | 'internacao' | 'dose'
> & {
  clinica: { nome: string } | null;
  autor: { nome: string } | null;
  exames: Exame | Exame[] | null;
  tratamentos:
    | NonNullable<AtendimentoDto['tratamento']>
    | NonNullable<AtendimentoDto['tratamento']>[]
    | null;
  internacoes:
    | NonNullable<AtendimentoDto['internacao']>
    | NonNullable<AtendimentoDto['internacao']>[]
    | null;
  vacinacoes:
    | {
        proxima_dose: string | null;
        lote: string | null;
        vacina: { nome: string } | null;
      }
    | {
        proxima_dose: string | null;
        lote: string | null;
        vacina: { nome: string } | null;
      }[]
    | null;
  vermifugacoes: Produto | Produto[] | null;
  antiparasitarios: Produto | Produto[] | null;
};

const CAMPOS =
  'id, tipo, data, veterinario, diagnostico, observacoes, criado_em, clinica:clinicas(nome), autor:usuarios(nome), ' +
  'exames(nome, metodo, resultado, resultado_detalhe, resultado_em, laudo_caminho), ' +
  'tratamentos(medicamento, dose, frequencia, inicio, fim), internacoes(entrada, alta), ' +
  'vacinacoes(proxima_dose, lote, vacina:vacinas_tipos(nome)), vermifugacoes(produto, proxima_dose), ' +
  'antiparasitarios(produto, proxima_dose)';

export function paraAtendimento(l: Linha): AtendimentoDto {
  const a: AtendimentoDto = {
    id: l.id,
    tipo: l.tipo,
    data: l.data,
    veterinario: l.veterinario,
    diagnostico: l.diagnostico,
    observacoes: l.observacoes,
    clinica: l.clinica?.nome ?? null,
    autor: l.autor?.nome ?? null,
    criado_em: l.criado_em,
  };
  const exame = primeiro(l.exames);
  if (exame) {
    a.exame = {
      nome: exame.nome,
      metodo: exame.metodo,
      resultado: exame.resultado,
      resultado_detalhe: exame.resultado_detalhe,
      resultado_em: exame.resultado_em,
      tem_laudo: !!exame.laudo_caminho,
    };
  }
  const tratamento = primeiro(l.tratamentos);
  if (tratamento) a.tratamento = tratamento;
  const internacao = primeiro(l.internacoes);
  if (internacao) a.internacao = internacao;
  const vacina = primeiro(l.vacinacoes);
  if (vacina) {
    a.dose = {
      nome: vacina.vacina?.nome ?? 'Vacina',
      proxima_dose: vacina.proxima_dose,
      lote: vacina.lote,
    };
  }
  const produto = primeiro(l.vermifugacoes) ?? primeiro(l.antiparasitarios);
  if (produto)
    a.dose = {
      nome: produto.produto,
      proxima_dose: produto.proxima_dose,
      lote: null,
    };
  return a;
}

@Injectable()
export class ProntuarioService {
  constructor(private readonly supabase: SupabaseService) {}

  // A linha do tempo é `atendimentos`: vacina, vermífugo, castração, consulta,
  // exame, tratamento, internação e óbito, por data e depois pela hora do registro.
  async daAnimal(
    usuario: UsuarioAutenticado,
    id: string,
    q: ProntuarioQueryDto,
  ): Promise<ProntuarioDto> {
    const pagina = q.pagina ?? 1;
    const porPagina = q.por_pagina ?? 30;
    let consulta = this.supabase
      .para(usuario)
      .from('atendimentos')
      .select(CAMPOS, { count: 'exact' })
      .eq('animal_id', id);
    if (q.tipo) consulta = consulta.eq('tipo', q.tipo);
    const { data, error, count } = await consulta
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);
    if (error) throw error;
    return {
      itens: ((data ?? []) as unknown as Linha[]).map(paraAtendimento),
      total: count ?? 0,
      pagina,
      por_pagina: porPagina,
    };
  }

  async registrar(
    usuario: UsuarioAutenticado,
    id: string,
    c: NovoAtendimentoDto,
  ): Promise<AtendimentoDto> {
    const detalhe =
      c.tipo === 'exame' || c.tipo === 'teste'
        ? (c.exame ?? {})
        : c.tipo === 'tratamento'
          ? (c.tratamento ?? {})
          : c.tipo === 'internacao'
            ? (c.internacao ?? {})
            : {};
    const sb = this.supabase.para(usuario);
    const atendimentoId = um(
      await sb.rpc('registrar_atendimento', {
        p_animal: id,
        p_tipo: c.tipo,
        p_data: c.data,
        p_clinica_id: c.clinica_id ?? null,
        p_veterinario: c.veterinario ?? null,
        p_diagnostico: c.diagnostico ?? null,
        p_observacoes: c.observacoes ?? null,
        p_detalhe: detalhe,
      }),
    ) as string;
    return this.buscar(usuario, atendimentoId);
  }

  async saudeEntrada(
    usuario: UsuarioAutenticado,
    id: string,
    c: SaudeEntradaDto,
  ): Promise<void> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_saude_entrada', {
        p_animal: id,
        p_condicao: c.condicao ?? null,
        p_exames: (c.exames ?? []).map((e) => e.trim()).filter(Boolean),
        p_tratamento: c.tratamento ?? null,
      }),
    );
  }

  async resultado(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
    c: ResultadoExameDto,
  ): Promise<AtendimentoDto> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_resultado_exame', {
        p_atendimento: atendimentoId,
        p_resultado: c.resultado,
        p_detalhe: c.detalhe ?? null,
        p_data: c.data ?? null,
      }),
    );
    return this.buscar(usuario, atendimentoId);
  }

  async encerrarTratamento(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
    data: string,
  ): Promise<AtendimentoDto> {
    dados(
      await this.supabase
        .para(usuario)
        .rpc('encerrar_tratamento', {
          p_atendimento: atendimentoId,
          p_fim: data,
        }),
    );
    return this.buscar(usuario, atendimentoId);
  }

  async darAlta(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
    data: string,
  ): Promise<AtendimentoDto> {
    dados(
      await this.supabase
        .para(usuario)
        .rpc('dar_alta', { p_atendimento: atendimentoId, p_alta: data }),
    );
    return this.buscar(usuario, atendimentoId);
  }

  // Laudo ------------------------------------------------------------------------

  async assinarLaudo(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
    c: AssinarLaudoDto,
  ): Promise<LaudoAssinadoDto> {
    const sb = this.supabase.para(usuario);
    const exame = dados(
      await sb
        .from('atendimentos')
        .select('animal_id, exames!inner(atendimento_id)')
        .eq('id', atendimentoId)
        .maybeSingle(),
    ) as { animal_id: string } | null;
    if (!exame) throw new NotFoundException('Exame não encontrado.');
    const caminho = `${exame.animal_id}/${randomUUID()}.${EXTENSAO[c.tipo]}`;
    // A política do balde só deixa os papéis clínicos enviarem.
    const { data, error } = await sb.storage
      .from(BALDE_LAUDOS)
      .createSignedUploadUrl(caminho);
    if (error || !data) {
      throw new ForbiddenException(
        'Só administração, coordenação e veterinários enviam laudos.',
      );
    }
    return { caminho, url: data.signedUrl };
  }

  async registrarLaudo(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
    caminho: string,
  ): Promise<AtendimentoDto> {
    dados(
      await this.supabase
        .para(usuario)
        .rpc('anexar_laudo', {
          p_atendimento: atendimentoId,
          p_caminho: caminho,
        }),
    );
    return this.buscar(usuario, atendimentoId);
  }

  // URL de leitura assinada na hora, de curta duração. Para voluntário a política
  // do balde recusa, e o servidor não entrega URL nenhuma.
  async urlLaudo(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
  ): Promise<LaudoUrlDto> {
    const sb = this.supabase.para(usuario);
    const exame = dados(
      await sb
        .from('exames')
        .select('laudo_caminho')
        .eq('atendimento_id', atendimentoId)
        .maybeSingle(),
    ) as { laudo_caminho: string | null } | null;
    if (!exame?.laudo_caminho)
      throw new NotFoundException('Este exame não tem laudo.');
    const { data, error } = await sb.storage
      .from(BALDE_LAUDOS)
      .createSignedUrl(exame.laudo_caminho, 300);
    if (error || !data) {
      throw new ForbiddenException(
        'Só administração, coordenação e veterinários abrem laudos.',
      );
    }
    return { url: data.signedUrl };
  }

  private async buscar(
    usuario: UsuarioAutenticado,
    atendimentoId: string,
  ): Promise<AtendimentoDto> {
    const linha = dados(
      await this.supabase
        .para(usuario)
        .from('atendimentos')
        .select(CAMPOS)
        .eq('id', atendimentoId)
        .maybeSingle(),
    ) as unknown as Linha | null;
    if (!linha) throw new NotFoundException('Atendimento não encontrado.');
    return paraAtendimento(linha);
  }
}
