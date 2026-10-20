import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import type { AnimalLigadoDto } from '../pessoas/pessoas.dto.js';
import { BALDE_TERMOS } from '../pessoas/pessoas.service.js';
import { dados, um } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AcompanhamentoDto,
  AdocaoDto,
  AssinarTermoDto,
  DevolucaoDto,
  FiltroAdocoesDto,
  ListaAdocoesDto,
  NovaAdocaoDto,
  NovoAcompanhamentoDto,
  PessoaLigadaDto,
  TermoAssinadoDto,
  TermoUrlDto,
} from './adocoes.dto.js';

const EXTENSAO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const CAMPOS =
  'id, data_adocao, data_devolucao, motivo_devolucao, termo_caminho, ' +
  'animal:animais(id, numero, nome, especie), pessoa:pessoas(id, nome)';

type Linha = Omit<AdocaoDto, 'animal' | 'pessoa' | 'tem_termo'> & {
  termo_caminho: string | null;
  animal: AnimalLigadoDto | null;
  pessoa: PessoaLigadaDto | null;
};

// O caminho do termo nunca sai do back: só a indicação de que existe.
export function paraAdocao(l: Linha): AdocaoDto | null {
  if (!l.animal || !l.pessoa) return null;
  return {
    id: l.id,
    animal: l.animal,
    pessoa: l.pessoa,
    data_adocao: l.data_adocao,
    data_devolucao: l.data_devolucao,
    motivo_devolucao: l.motivo_devolucao,
    tem_termo: !!l.termo_caminho,
  };
}

const lista = (linhas: Linha[] | null): AdocaoDto[] =>
  (linhas ?? []).map(paraAdocao).filter((a): a is AdocaoDto => a !== null);

@Injectable()
export class AdocoesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(
    usuario: UsuarioAutenticado,
    filtro: FiltroAdocoesDto,
  ): Promise<ListaAdocoesDto> {
    const pagina = filtro.pagina ?? 1;
    const porPagina = filtro.por_pagina ?? 30;
    let consulta = this.supabase
      .para(usuario)
      .from('adocoes')
      .select(CAMPOS, { count: 'exact' });
    if (filtro.ativas) consulta = consulta.is('data_devolucao', null);
    const { data, error, count } = await consulta
      .order('data_adocao', { ascending: false })
      .order('criado_em', { ascending: false })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);
    if (error) throw error;
    return {
      itens: lista(data as unknown as Linha[]),
      total: count ?? 0,
      pagina,
      por_pagina: porPagina,
    };
  }

  async doAnimal(
    usuario: UsuarioAutenticado,
    animalId: string,
  ): Promise<AdocaoDto[]> {
    return lista(
      dados(
        await this.supabase
          .para(usuario)
          .from('adocoes')
          .select(CAMPOS)
          .eq('animal_id', animalId)
          .order('data_adocao', { ascending: false }),
      ) as unknown as Linha[] | null,
    );
  }

  // Adoção e movimentação para "adotado" na mesma transação (função no banco).
  async registrar(
    usuario: UsuarioAutenticado,
    animalId: string,
    c: NovaAdocaoDto,
  ): Promise<AdocaoDto> {
    const id = um(
      await this.supabase.para(usuario).rpc('registrar_adocao', {
        p_animal: animalId,
        p_pessoa: c.pessoa_id,
        p_data: c.data,
      }),
    ) as string;
    return this.buscar(usuario, id);
  }

  async devolver(
    usuario: UsuarioAutenticado,
    id: string,
    c: DevolucaoDto,
  ): Promise<AdocaoDto> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_devolucao', {
        p_adocao: id,
        p_data: c.data,
        p_motivo: c.motivo,
      }),
    );
    return this.buscar(usuario, id);
  }

  async uma(usuario: UsuarioAutenticado, id: string): Promise<AdocaoDto> {
    return this.buscar(usuario, id);
  }

  // Acompanhamento pós-adoção (visita, WhatsApp, ligação) ---------------------

  async acompanhamentos(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<AcompanhamentoDto[]> {
    return (dados(
      await this.supabase
        .para(usuario)
        .from('acompanhamentos')
        .select('id, data, forma, observacoes')
        .eq('adocao_id', id)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
    ) ?? []) as AcompanhamentoDto[];
  }

  async registrarAcompanhamento(
    usuario: UsuarioAutenticado,
    id: string,
    c: NovoAcompanhamentoDto,
  ): Promise<AcompanhamentoDto[]> {
    dados(
      await this.supabase.para(usuario).rpc('registrar_acompanhamento', {
        p_adocao: id,
        p_data: c.data,
        p_forma: c.forma,
        p_observacoes: c.observacoes ?? null,
      }),
    );
    return this.acompanhamentos(usuario, id);
  }

  // Termo assinado ----------------------------------------------------------------

  async assinarTermo(
    usuario: UsuarioAutenticado,
    id: string,
    c: AssinarTermoDto,
  ): Promise<TermoAssinadoDto> {
    const sb = this.supabase.para(usuario);
    const adocao = dados(
      await sb.from('adocoes').select('animal_id').eq('id', id).maybeSingle(),
    ) as { animal_id: string } | null;
    if (!adocao) throw new NotFoundException('Adoção não encontrada.');
    const caminho = `${adocao.animal_id}/${randomUUID()}.${EXTENSAO[c.tipo]}`;
    // A política do balde só deixa administração e coordenação enviarem.
    const { data, error } = await sb.storage
      .from(BALDE_TERMOS)
      .createSignedUploadUrl(caminho);
    if (error || !data) {
      throw new ForbiddenException(
        'Só a administração e a coordenação enviam o termo de adoção.',
      );
    }
    return { caminho, url: data.signedUrl };
  }

  async registrarTermo(
    usuario: UsuarioAutenticado,
    id: string,
    caminho: string,
  ): Promise<AdocaoDto> {
    dados(
      await this.supabase
        .para(usuario)
        .rpc('anexar_termo', { p_adocao: id, p_caminho: caminho }),
    );
    return this.buscar(usuario, id);
  }

  async urlTermo(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<TermoUrlDto> {
    const sb = this.supabase.para(usuario);
    const adocao = dados(
      await sb
        .from('adocoes')
        .select('termo_caminho')
        .eq('id', id)
        .maybeSingle(),
    ) as { termo_caminho: string | null } | null;
    if (!adocao?.termo_caminho)
      throw new NotFoundException('Esta adoção não tem termo anexado.');
    const { data, error } = await sb.storage
      .from(BALDE_TERMOS)
      .createSignedUrl(adocao.termo_caminho, 300);
    if (error || !data) {
      throw new ForbiddenException(
        'Só a administração e a coordenação abrem o termo de adoção.',
      );
    }
    return { url: data.signedUrl };
  }

  private async buscar(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<AdocaoDto> {
    const linha = dados(
      await this.supabase
        .para(usuario)
        .from('adocoes')
        .select(CAMPOS)
        .eq('id', id)
        .maybeSingle(),
    ) as unknown as Linha | null;
    const a = linha && paraAdocao(linha);
    if (!a) throw new NotFoundException('Adoção não encontrada.');
    return a;
  }
}
