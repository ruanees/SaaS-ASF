import { BadRequestException, Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  ColunaDto,
  QuadroDto,
  RelatorioDto,
  RelatorioQueryDto,
  Secao,
} from './relatorios.dto.js';

const LIMITE = 5000;

const ESPECIE: Record<string, string> = { cao: 'Cão', gato: 'Gato' };
const SEXO: Record<string, string> = {
  macho: 'Macho',
  femea: 'Fêmea',
  nao_identificado: 'Não identificado',
};
export const SITUACAO: Record<string, string> = {
  em_acolhimento: 'Em acolhimento',
  adotado: 'Adotado',
  devolvido_comunidade: 'Devolvido à comunidade',
  transferido: 'Transferido',
  obito: 'Óbito',
};
const LOCAL: Record<string, string> = {
  sede: 'Sede',
  lar_temporario: 'Lar temporário',
  clinica: 'Clínica',
};
const VACINACAO: Record<string, string> = {
  nao_vacinado: 'Não vacinado',
  vencida: 'Vacina vencida',
  vence_em_breve: 'Vence em breve',
  vacinado: 'Vacinado',
};
const CASTRACAO: Record<string, string> = {
  castrado: 'Castrado',
  agendada: 'Castração agendada',
  nao_castrado: 'Não castrado',
};
const TIPO_MOV: Record<string, string> = {
  entrada: 'Entrada',
  mudanca: 'Mudança',
  reentrada: 'Reentrada',
  devolucao: 'Devolução de adoção',
};

/** AAAA-MM-DD -> DD/MM/AAAA (sem fuso: a data já é do dia certo). */
export function dataBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const rotulo = (mapa: Record<string, string>, v: string | null) =>
  v ? (mapa[v] ?? v) : null;

function contar<T>(
  linhas: T[],
  chave: (l: T) => string | null,
  mapa: Record<string, string>,
): QuadroDto[] {
  return Object.entries(mapa).map(([v, r]) => ({
    rotulo: r,
    valor: linhas.filter((l) => chave(l) === v).length,
  }));
}

/**
 * CSV para planilha (pt-BR): separador ";", BOM para o Excel reconhecer UTF-8 e
 * proteção contra fórmula (célula que começa com =, +, - ou @ ganha um ').
 */
export function paraCsv(r: Pick<RelatorioDto, 'colunas' | 'linhas'>): string {
  const celula = (v: string | null | undefined) => {
    let t = v ?? '';
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cabecalho = r.colunas.map((c) => celula(c.rotulo)).join(';');
  const corpo = r.linhas.map((l) =>
    r.colunas.map((c) => celula(l[c.chave])).join(';'),
  );
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}

type Animal = {
  numero: string;
  nome: string | null;
  especie: string;
};
type LinhaAnimal = Animal & {
  sexo: string;
  situacao: string;
  local: string | null;
  disponivel_adocao: boolean;
  data_entrada: string;
  vacinacao_status: string;
  vacina_pendente: boolean;
  proxima_vacina: string | null;
  castracao_status: string;
  castracao_agendada_para: string | null;
};

// Um construtor para todos os relatórios: cada seção diz de onde lê, as
// colunas e os quadros de resumo. Lê as mesmas fontes dos indicadores.
@Injectable()
export class ReportBuilderService {
  constructor(private readonly supabase: SupabaseService) {}

  async construir(
    usuario: UsuarioAutenticado,
    secao: Secao,
    q: RelatorioQueryDto,
  ): Promise<RelatorioDto> {
    switch (secao) {
      case 'animais':
        return this.animais(usuario, q);
      case 'vacinacao':
        return this.vacinacao(usuario);
      case 'castracao':
        return this.castracao(usuario);
      case 'adocoes':
        return this.adocoes(usuario, q);
      case 'movimentacoes':
        return this.movimentacoes(usuario, q);
    }
  }

  async registrarExportacao(
    usuario: UsuarioAutenticado,
    secao: Secao,
  ): Promise<void> {
    dados(
      await this.supabase
        .para(usuario)
        .rpc('registrar_exportacao', { p_relatorio: secao }),
    );
  }

  private async lista(
    usuario: UsuarioAutenticado,
    situacao?: string,
  ): Promise<LinhaAnimal[]> {
    let consulta = this.supabase
      .para(usuario)
      .from('animais_lista')
      .select(
        'numero, nome, especie, sexo, situacao, local, disponivel_adocao, data_entrada, vacinacao_status, vacina_pendente, proxima_vacina, castracao_status, castracao_agendada_para',
      );
    if (situacao) consulta = consulta.eq('situacao', situacao);
    return (dados(await consulta.order('numero').limit(LIMITE)) ??
      []) as LinhaAnimal[];
  }

  private periodo(q: RelatorioQueryDto): { de: string; ate: string } {
    if (!q.de || !q.ate)
      throw new BadRequestException('Informe o período (de e até).');
    if (q.de > q.ate)
      throw new BadRequestException(
        'O início do período não pode ser depois do fim.',
      );
    return { de: q.de, ate: q.ate };
  }

  private async animais(
    usuario: UsuarioAutenticado,
    q: RelatorioQueryDto,
  ): Promise<RelatorioDto> {
    const linhas = await this.lista(usuario, q.situacao);
    return {
      secao: 'animais',
      titulo: 'Animais por situação',
      descricao: q.situacao
        ? `Animais com a situação "${SITUACAO[q.situacao]}" agora.`
        : 'Todos os animais cadastrados, com a situação de agora.',
      de: null,
      ate: null,
      quadros: [
        { rotulo: 'Total', valor: linhas.length },
        ...contar(linhas, (l) => l.situacao, SITUACAO),
      ],
      colunas: col([
        ['numero', 'Número'],
        ['nome', 'Nome'],
        ['especie', 'Espécie'],
        ['sexo', 'Sexo'],
        ['situacao', 'Situação'],
        ['local', 'Local'],
        ['disponivel', 'Disponível para adoção'],
        ['entrada', 'Entrada'],
      ]),
      linhas: linhas.map((l) => ({
        numero: l.numero,
        nome: l.nome,
        especie: rotulo(ESPECIE, l.especie),
        sexo: rotulo(SEXO, l.sexo),
        situacao: rotulo(SITUACAO, l.situacao),
        local: rotulo(LOCAL, l.local),
        disponivel:
          l.situacao === 'em_acolhimento'
            ? l.disponivel_adocao
              ? 'Sim'
              : 'Não'
            : null,
        entrada: dataBr(l.data_entrada),
      })),
    };
  }

  private async vacinacao(usuario: UsuarioAutenticado): Promise<RelatorioDto> {
    const linhas = await this.lista(usuario, 'em_acolhimento');
    return {
      secao: 'vacinacao',
      titulo: 'Vacinação',
      descricao:
        'Animais em acolhimento. Pendente = nunca vacinado ou com vacina vencida.',
      de: null,
      ate: null,
      quadros: [
        {
          rotulo: 'Em dia',
          valor: linhas.filter((l) => !l.vacina_pendente).length,
        },
        {
          rotulo: 'Pendente',
          valor: linhas.filter((l) => l.vacina_pendente).length,
        },
      ],
      colunas: col([
        ['numero', 'Número'],
        ['nome', 'Nome'],
        ['especie', 'Espécie'],
        ['situacao_vacina', 'Vacinação'],
        ['proxima', 'Próxima dose'],
      ]),
      linhas: linhas.map((l) => ({
        numero: l.numero,
        nome: l.nome,
        especie: rotulo(ESPECIE, l.especie),
        situacao_vacina: rotulo(VACINACAO, l.vacinacao_status),
        proxima: dataBr(l.proxima_vacina),
      })),
    };
  }

  private async castracao(usuario: UsuarioAutenticado): Promise<RelatorioDto> {
    const linhas = await this.lista(usuario, 'em_acolhimento');
    return {
      secao: 'castracao',
      titulo: 'Castração',
      descricao: 'Animais em acolhimento.',
      de: null,
      ate: null,
      quadros: contar(linhas, (l) => l.castracao_status, CASTRACAO),
      colunas: col([
        ['numero', 'Número'],
        ['nome', 'Nome'],
        ['especie', 'Espécie'],
        ['sexo', 'Sexo'],
        ['castracao', 'Castração'],
        ['agendada', 'Agendada para'],
      ]),
      linhas: linhas.map((l) => ({
        numero: l.numero,
        nome: l.nome,
        especie: rotulo(ESPECIE, l.especie),
        sexo: rotulo(SEXO, l.sexo),
        castracao: rotulo(CASTRACAO, l.castracao_status),
        agendada: dataBr(l.castracao_agendada_para),
      })),
    };
  }

  // Sem o nome do adotante: relatório não leva dado pessoal.
  private async adocoes(
    usuario: UsuarioAutenticado,
    q: RelatorioQueryDto,
  ): Promise<RelatorioDto> {
    const { de, ate } = this.periodo(q);
    const evento = q.evento ?? 'adocao';
    const coluna = evento === 'adocao' ? 'data_adocao' : 'data_devolucao';
    const brutas = (dados(
      await this.supabase
        .para(usuario)
        .from('adocoes')
        .select(
          'data_adocao, data_devolucao, animal:animais(numero, nome, especie)',
        )
        .gte(coluna, de)
        .lte(coluna, ate)
        .order(coluna)
        .limit(LIMITE),
    ) ?? []) as unknown as {
      data_adocao: string;
      data_devolucao: string | null;
      animal: Animal | null;
    }[];
    // Animal excluído some pela RLS (mesma regra dos indicadores).
    const linhas = brutas.filter(
      (l): l is typeof l & { animal: Animal } => l.animal !== null,
    );
    return {
      secao: 'adocoes',
      titulo:
        evento === 'adocao' ? 'Adoções no período' : 'Devoluções no período',
      descricao:
        evento === 'adocao'
          ? 'Adoções com data no período. Devolvidas depois continuam contando aqui.'
          : 'Adoções devolvidas com data de devolução no período.',
      de,
      ate,
      quadros: [
        {
          rotulo: evento === 'adocao' ? 'Adoções' : 'Devoluções',
          valor: linhas.length,
        },
        ...(evento === 'adocao'
          ? [
              {
                rotulo: 'Já devolvidas',
                valor: linhas.filter((l) => l.data_devolucao).length,
              },
            ]
          : []),
      ],
      colunas: col([
        ['adocao', 'Adoção'],
        ['numero', 'Número'],
        ['nome', 'Nome'],
        ['especie', 'Espécie'],
        ['devolucao', 'Devolução'],
      ]),
      linhas: linhas.map((l) => ({
        adocao: dataBr(l.data_adocao),
        numero: l.animal.numero,
        nome: l.animal.nome,
        especie: rotulo(ESPECIE, l.animal.especie),
        devolucao: dataBr(l.data_devolucao),
      })),
    };
  }

  private async movimentacoes(
    usuario: UsuarioAutenticado,
    q: RelatorioQueryDto,
  ): Promise<RelatorioDto> {
    const { de, ate } = this.periodo(q);
    let consulta = this.supabase
      .para(usuario)
      .from('movimentacoes')
      .select(
        'data, tipo, situacao, local, destino, animal:animais(numero, nome, especie)',
      )
      .gte('data', de)
      .lte('data', ate);
    if (q.situacao) consulta = consulta.eq('situacao', q.situacao);
    const brutas = (dados(
      await consulta.order('data').order('criado_em').limit(LIMITE),
    ) ?? []) as unknown as {
      data: string;
      tipo: string;
      situacao: string;
      local: string | null;
      destino: string | null;
      animal: Animal | null;
    }[];
    const linhas = brutas.filter(
      (l): l is typeof l & { animal: Animal } => l.animal !== null,
    );
    return {
      secao: 'movimentacoes',
      titulo: q.situacao
        ? `Movimentações para "${SITUACAO[q.situacao]}"`
        : 'Movimentações no período',
      descricao: 'Entradas, mudanças, saídas e devoluções com data no período.',
      de,
      ate,
      quadros: [
        { rotulo: 'Movimentações', valor: linhas.length },
        ...contar(linhas, (l) => l.tipo, TIPO_MOV),
      ],
      colunas: col([
        ['data', 'Data'],
        ['numero', 'Número'],
        ['nome', 'Nome'],
        ['tipo', 'Tipo'],
        ['situacao', 'Situação'],
        ['local', 'Local'],
        ['destino', 'Destino'],
      ]),
      linhas: linhas.map((l) => ({
        data: dataBr(l.data),
        numero: l.animal.numero,
        nome: l.animal.nome,
        tipo: rotulo(TIPO_MOV, l.tipo),
        situacao: rotulo(SITUACAO, l.situacao),
        local: rotulo(LOCAL, l.local),
        destino: l.destino,
      })),
    };
  }
}

function col(pares: [string, string][]): ColunaDto[] {
  return pares.map(([chave, r]) => ({ chave, rotulo: r }));
}
