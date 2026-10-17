import { Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { limparBusca } from '../animais/animais.service.js';
import { dados, um } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AdocaoDaPessoaDto,
  AlterarPessoaDto,
  AnimalLigadoDto,
  AnonimizacaoDto,
  ContatoDto,
  ContatoEntradaDto,
  FiltroPessoasDto,
  LarTemporarioDto,
  ListaPessoasDto,
  NovaPessoaDto,
  PassagemLarDto,
  PessoaDto,
  PessoaResumoDto,
} from './pessoas.dto.js';

export const BALDE_TERMOS = 'termos';
const CAMPOS_PESSOA =
  'id, nome, vinculos, base_legal, anonimizado_em, criado_em';
const CAMPOS_ANIMAL = 'id, numero, nome, especie';

// Animal excluído some pela RLS e chega nulo no embed: fica de fora.
function comAnimal<T extends { animal: AnimalLigadoDto | null }>(
  linhas: T[] | null,
): (T & { animal: AnimalLigadoDto })[] {
  return (linhas ?? []).filter(
    (l): l is T & { animal: AnimalLigadoDto } => l.animal !== null,
  );
}

// Nada de dado pessoal sai daqui para log: o contato só existe na resposta de
// `contato()` e de `dados()`, para quem a função do banco deixou ler.
@Injectable()
export class PessoasService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(
    usuario: UsuarioAutenticado,
    filtro: FiltroPessoasDto,
  ): Promise<ListaPessoasDto> {
    const pagina = filtro.pagina ?? 1;
    const porPagina = filtro.por_pagina ?? 30;
    let consulta = this.supabase
      .para(usuario)
      .from('pessoas')
      .select(CAMPOS_PESSOA, { count: 'exact' });
    const busca = limparBusca(filtro.busca);
    if (busca) consulta = consulta.ilike('nome', `%${busca}%`);
    if (filtro.vinculo)
      consulta = consulta.contains('vinculos', [filtro.vinculo]);
    if (!filtro.anonimizadas) consulta = consulta.is('anonimizado_em', null);
    const { data, error, count } = await consulta
      .order('nome')
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);
    if (error) throw error;
    return {
      itens: (data ?? []) as PessoaResumoDto[],
      total: count ?? 0,
      pagina,
      por_pagina: porPagina,
    };
  }

  async buscar(usuario: UsuarioAutenticado, id: string): Promise<PessoaDto> {
    const sb = this.supabase.para(usuario);
    const [pessoa, adocoes, larAtual, larHistorico] = await Promise.all([
      sb.from('pessoas').select(CAMPOS_PESSOA).eq('id', id).maybeSingle(),
      sb
        .from('adocoes')
        .select(
          `id, data_adocao, data_devolucao, motivo_devolucao, animal:animais(${CAMPOS_ANIMAL})`,
        )
        .eq('pessoa_id', id)
        .order('data_adocao', { ascending: false }),
      sb
        .from('animais')
        .select(CAMPOS_ANIMAL)
        .eq('pessoa_id', id)
        .order('numero'),
      sb
        .from('movimentacoes')
        .select(`data, animal:animais(${CAMPOS_ANIMAL})`)
        .eq('pessoa_id', id)
        .eq('local', 'lar_temporario')
        .order('data', { ascending: false }),
    ]);
    const p = dados(pessoa) as PessoaResumoDto | null;
    if (!p) throw new NotFoundException('Pessoa não encontrada.');
    return {
      id: p.id,
      nome: p.nome,
      vinculos: p.vinculos,
      base_legal: p.base_legal,
      anonimizado_em: p.anonimizado_em,
      criado_em: p.criado_em,
      adocoes: comAnimal(
        dados(adocoes) as unknown as
          | (Omit<AdocaoDaPessoaDto, 'animal'> & {
              animal: AnimalLigadoDto | null;
            })[]
          | null,
      ),
      lar_atual: (dados(larAtual) ?? []) as AnimalLigadoDto[],
      lar_historico: comAnimal(
        dados(larHistorico) as unknown as
          | (Omit<PassagemLarDto, 'animal'> & {
              animal: AnimalLigadoDto | null;
            })[]
          | null,
      ),
    };
  }

  async criar(
    usuario: UsuarioAutenticado,
    c: NovaPessoaDto,
  ): Promise<PessoaDto> {
    const id = um(
      await this.supabase.para(usuario).rpc('cadastrar_pessoa', {
        p_nome: c.nome,
        p_base_legal: c.base_legal,
        p_vinculos: c.vinculos,
        p_telefone: c.telefone ?? null,
        p_email: c.email ?? null,
        p_endereco: c.endereco ?? null,
      }),
    ) as string;
    return this.buscar(usuario, id);
  }

  async alterar(
    usuario: UsuarioAutenticado,
    id: string,
    c: AlterarPessoaDto,
  ): Promise<PessoaDto> {
    dados(
      await this.supabase.para(usuario).rpc('alterar_pessoa', {
        p_pessoa: id,
        p_nome: c.nome,
        p_base_legal: c.base_legal,
        p_vinculos: c.vinculos,
      }),
    );
    return this.buscar(usuario, id);
  }

  // Cada chamada grava uma leitura na auditoria (pela função do banco).
  async contato(usuario: UsuarioAutenticado, id: string): Promise<ContatoDto> {
    const linhas = dados(
      await this.supabase.para(usuario).rpc('ler_contato', { p_pessoa: id }),
    ) as ContatoDto[] | null;
    return linhas?.[0] ?? { telefone: null, email: null, endereco: null };
  }

  async alterarContato(
    usuario: UsuarioAutenticado,
    id: string,
    c: ContatoEntradaDto,
  ): Promise<void> {
    dados(
      await this.supabase.para(usuario).rpc('alterar_contato', {
        p_pessoa: id,
        p_telefone: c.telefone ?? null,
        p_email: c.email ?? null,
        p_endereco: c.endereco ?? null,
      }),
    );
  }

  // Direito de acesso do titular: o JSON vem pronto da função (e fica na auditoria).
  async dados(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<Record<string, unknown>> {
    return um(
      await this.supabase
        .para(usuario)
        .rpc('exportar_pessoa', { p_pessoa: id }),
    ) as Record<string, unknown>;
  }

  // O banco anonimiza e devolve os termos (que têm dado pessoal) para apagar.
  async anonimizar(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<AnonimizacaoDto> {
    const sb = this.supabase.para(usuario);
    const termos = (um(await sb.rpc('anonimizar_pessoa', { p_pessoa: id })) ??
      []) as string[];
    if (termos.length === 0) return { aviso: null };
    const { error } = await sb.storage.from(BALDE_TERMOS).remove(termos);
    return {
      aviso: error
        ? 'A pessoa foi anonimizada, mas algum termo de adoção não saiu do armazenamento. Avise a administração.'
        : null,
    };
  }

  async lares(usuario: UsuarioAutenticado): Promise<LarTemporarioDto[]> {
    const linhas = dados(
      await this.supabase
        .para(usuario)
        .from('pessoas')
        .select(`id, nome, animais:animais!animais_pessoa_fk(${CAMPOS_ANIMAL})`)
        .contains('vinculos', ['lar_temporario'])
        .is('anonimizado_em', null)
        .order('nome'),
    ) as unknown as LarTemporarioDto[] | null;
    return linhas ?? [];
  }
}
