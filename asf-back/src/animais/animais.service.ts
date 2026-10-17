import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados, um } from '../supabase/resultado.js';
import { SaudeAnimalService } from '../saude-animal/saude.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AlterarAnimalDto,
  AnimalDto,
  AnimalResumoDto,
  CriarAnimalDto,
  DuplicadoDto,
  FiltroAnimaisDto,
  FotoAssinadaDto,
  FotoDto,
  ListaAnimaisDto,
  MovimentacaoDto,
  NovaMovimentacaoDto,
  TipoFoto,
} from './animais.dto.js';

export const BALDE_FOTOS = 'fotos-animais';
const VALIDADE_URL_SEGUNDOS = 300; // 5 min (plano, seção 05)

const CAMPOS_RESUMO =
  'id, numero, nome, especie, sexo, nascimento_estimado, idade_precisao, porte, situacao, local, disponivel_adocao, data_entrada';

type LinhaAnimal = Omit<
  AnimalResumoDto,
  'foto_url' | 'vacinacao_status' | 'castracao_status'
> & {
  animal_fotos?: { caminho: string }[];
};

// Busca por número ou nome: só letras, números, espaço e hífen, para o texto
// não virar sintaxe do filtro do PostgREST.
export function limparBusca(texto: string | undefined): string | undefined {
  const limpo = (texto ?? '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return limpo === '' ? undefined : limpo;
}

@Injectable()
export class AnimaisService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly saude: SaudeAnimalService,
  ) {}

  async listar(
    usuario: UsuarioAutenticado,
    filtro: FiltroAnimaisDto,
  ): Promise<ListaAnimaisDto> {
    const sb = this.supabase.para(usuario);
    const pagina = filtro.pagina ?? 1;
    const porPagina = filtro.por_pagina ?? 20;

    let consulta = sb
      .from('animais')
      .select(`${CAMPOS_RESUMO}, animal_fotos(caminho)`, { count: 'exact' })
      .eq('animal_fotos.principal', true);

    if (filtro.especie) consulta = consulta.eq('especie', filtro.especie);
    if (filtro.sexo) consulta = consulta.eq('sexo', filtro.sexo);
    if (filtro.porte) consulta = consulta.eq('porte', filtro.porte);
    if (filtro.situacao) consulta = consulta.eq('situacao', filtro.situacao);
    if (filtro.local) consulta = consulta.eq('local', filtro.local);
    if (filtro.disponivel) {
      consulta = consulta.eq('disponivel_adocao', filtro.disponivel === 'sim');
    }
    const busca = limparBusca(filtro.q);
    if (busca) {
      consulta = consulta.or(`numero.ilike.%${busca}%,nome.ilike.%${busca}%`);
    }

    const { data, error, count } = await consulta
      .order('criado_em', { ascending: false })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);
    if (error) throw error;

    const linhas = (data ?? []) as unknown as LinhaAnimal[];
    const [urls, estados] = await Promise.all([
      this.urlsAssinadas(
        sb,
        linhas.map((l) => l.animal_fotos?.[0]?.caminho),
      ),
      this.saude.estados(
        sb,
        linhas.map((l) => l.id),
      ),
    ]);
    return {
      itens: linhas.map((l, i) => paraResumo(l, urls[i], estados.get(l.id))),
      total: count ?? 0,
      pagina,
      por_pagina: porPagina,
    };
  }

  async buscar(usuario: UsuarioAutenticado, id: string): Promise<AnimalDto> {
    const sb = this.supabase.para(usuario);
    const linha = dados(
      await sb
        .from('animais')
        .select(
          `${CAMPOS_RESUMO}, origem, origem_detalhe, observacoes, criado_em, atualizado_em, clinica:clinicas(id, nome, ativo), animal_fotos(caminho)`,
        )
        .eq('id', id)
        .eq('animal_fotos.principal', true)
        .maybeSingle(),
    ) as
      | (LinhaAnimal & {
          origem: AnimalDto['origem'];
          origem_detalhe: string | null;
          observacoes: string | null;
          criado_em: string;
          atualizado_em: string;
          clinica: AnimalDto['clinica'];
        })
      | null;
    if (!linha) throw new NotFoundException('Animal não encontrado.');

    const [[url], estados] = await Promise.all([
      this.urlsAssinadas(sb, [linha.animal_fotos?.[0]?.caminho]),
      this.saude.estados(sb, [linha.id]),
    ]);
    return {
      ...paraResumo(linha, url, estados.get(linha.id)),
      origem: linha.origem,
      origem_detalhe: linha.origem_detalhe,
      observacoes: linha.observacoes,
      clinica: linha.clinica,
      criado_em: linha.criado_em,
      atualizado_em: linha.atualizado_em,
    };
  }

  // Cadastro e movimentação de entrada na mesma transação (função no banco).
  async criar(
    usuario: UsuarioAutenticado,
    corpo: CriarAnimalDto,
  ): Promise<AnimalDto> {
    const criado = um(
      await this.supabase
        .para(usuario)
        .rpc('cadastrar_animal', {
          p_especie: corpo.especie,
          p_sexo: corpo.sexo,
          p_data_entrada: corpo.data_entrada,
          p_origem: corpo.origem,
          p_local: corpo.local,
          p_nome: corpo.nome ?? null,
          p_nascimento_estimado: corpo.nascimento_estimado ?? null,
          p_idade_precisao: corpo.idade_precisao ?? null,
          p_porte: corpo.porte ?? null,
          p_origem_detalhe: corpo.origem_detalhe ?? null,
          p_disponivel_adocao: corpo.disponivel_adocao ?? false,
          p_clinica_id: corpo.clinica_id ?? null,
          p_observacoes: corpo.observacoes ?? null,
        })
        .single<{ id: string }>(),
    );
    return this.buscar(usuario, criado.id);
  }

  // Campo a campo. Vale a última gravação; a auditoria guarda cada uma.
  async alterar(
    usuario: UsuarioAutenticado,
    id: string,
    corpo: AlterarAnimalDto,
  ): Promise<AnimalDto> {
    const campos: Record<string, unknown> = Object.fromEntries(
      Object.entries(corpo).filter(([, v]) => v !== undefined),
    );
    // nascimento e precisão andam juntos (check no banco).
    if (corpo.nascimento_estimado === null) campos.idade_precisao = null;
    else if (corpo.nascimento_estimado && corpo.idade_precisao === undefined) {
      campos.idade_precisao = 'aproximada';
    }
    if (Object.keys(campos).length === 0) return this.buscar(usuario, id);

    const linha = dados(
      await this.supabase
        .para(usuario)
        .from('animais')
        .update(campos)
        .eq('id', id)
        .select('id')
        .maybeSingle(),
    );
    if (!linha) throw new NotFoundException('Animal não encontrado.');
    return this.buscar(usuario, id);
  }

  async excluir(usuario: UsuarioAutenticado, id: string): Promise<void> {
    dados(
      await this.supabase.para(usuario).rpc('excluir_animal', { p_animal: id }),
    );
  }

  async duplicados(
    usuario: UsuarioAutenticado,
    nome: string,
    especie: string,
    sexo: string,
  ): Promise<DuplicadoDto[]> {
    const linhas = dados(
      await this.supabase.para(usuario).rpc('possiveis_duplicados', {
        p_nome: nome,
        p_especie: especie,
        p_sexo: sexo,
      }),
    ) as (DuplicadoDto & { semelhanca: number })[] | null;
    return (linhas ?? []).map((d) => ({
      id: d.id,
      numero: d.numero,
      nome: d.nome,
      sexo: d.sexo,
      situacao: d.situacao,
      data_entrada: d.data_entrada,
    }));
  }

  // Situação, local e disponibilidade só mudam pela função no banco, que
  // também decide o que ainda não é permitido (lar temporário, adoção...).
  async mover(
    usuario: UsuarioAutenticado,
    id: string,
    corpo: NovaMovimentacaoDto,
  ): Promise<MovimentacaoDto> {
    const m = um(
      await this.supabase
        .para(usuario)
        .rpc('mover_animal', {
          p_animal: id,
          p_situacao: corpo.situacao,
          p_local: corpo.local ?? null,
          p_disponivel: corpo.disponivel_adocao,
          p_data: corpo.data,
          p_motivo: corpo.motivo ?? null,
          p_tipo: corpo.tipo ?? 'mudanca',
          p_origem: corpo.origem ?? null,
          p_clinica_id: corpo.clinica_id ?? null,
        })
        .single<{ id: string }>(),
    );
    const historico = await this.movimentacoes(usuario, id);
    const nova = historico.find((h) => h.id === m.id);
    if (!nova) throw new NotFoundException('Movimentação não encontrada.');
    return nova;
  }

  async movimentacoes(
    usuario: UsuarioAutenticado,
    id: string,
  ): Promise<MovimentacaoDto[]> {
    const linhas = dados(
      await this.supabase
        .para(usuario)
        .from('movimentacoes')
        .select(
          'id, tipo, origem, situacao, local, disponivel_adocao, data, motivo, criado_em, clinica:clinicas(nome), autor:usuarios(nome)',
        )
        .eq('animal_id', id)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
    ) as unknown as
      | (Omit<MovimentacaoDto, 'clinica' | 'autor'> & {
          clinica: { nome: string } | null;
          autor: { nome: string } | null;
        })[]
      | null;
    return (linhas ?? []).map((l) => ({
      ...l,
      clinica: l.clinica?.nome ?? null,
      autor: l.autor?.nome ?? null,
    }));
  }

  // Envio de foto: o servidor decide o caminho e assina; os bytes vão do
  // navegador direto ao Storage. A política do balde exige usuário ativo.
  async assinarFoto(
    usuario: UsuarioAutenticado,
    id: string,
    tipo: TipoFoto,
  ): Promise<FotoAssinadaDto> {
    const sb = this.supabase.para(usuario);
    const animal = dados(
      await sb.from('animais').select('id').eq('id', id).maybeSingle(),
    );
    if (!animal) throw new NotFoundException('Animal não encontrado.');

    const extensao = tipo === 'image/jpeg' ? 'jpg' : 'webp';
    const caminho = `${id}/${randomUUID()}.${extensao}`;
    const assinada = um(
      await sb.storage.from(BALDE_FOTOS).createSignedUploadUrl(caminho),
    );
    return { caminho, url: assinada.signedUrl };
  }

  async registrarFoto(
    usuario: UsuarioAutenticado,
    id: string,
    caminho: string,
  ): Promise<FotoDto> {
    const sb = this.supabase.para(usuario);
    const foto = um(
      await sb
        .rpc('registrar_foto', { p_animal: id, p_caminho: caminho })
        .single<{ id: string; caminho: string }>(),
    );
    const [url] = await this.urlsAssinadas(sb, [foto.caminho]);
    return { id: foto.id, caminho: foto.caminho, url };
  }

  // URLs de leitura de curta duração, uma chamada para a página inteira.
  private async urlsAssinadas(
    sb: SupabaseClient,
    caminhos: (string | undefined)[],
  ): Promise<(string | null)[]> {
    const existentes = caminhos.filter((c): c is string => !!c);
    if (existentes.length === 0) return caminhos.map(() => null);
    const { data, error } = await sb.storage
      .from(BALDE_FOTOS)
      .createSignedUrls(existentes, VALIDADE_URL_SEGUNDOS);
    // Sem URL a lista continua funcionando, só sem foto.
    if (error || !data) return caminhos.map(() => null);
    const porCaminho = new Map(
      data.map((d) => [d.path, d.error ? null : d.signedUrl]),
    );
    return caminhos.map((c) => (c ? (porCaminho.get(c) ?? null) : null));
  }
}

// Objeto simples (não instância de classe): pode ser espalhado com segurança.
type Resumo = { [K in keyof AnimalResumoDto]: AnimalResumoDto[K] };

function paraResumo(
  l: LinhaAnimal,
  url: string | null,
  estado?: Pick<AnimalResumoDto, 'vacinacao_status' | 'castracao_status'>,
): Resumo {
  return {
    id: l.id,
    numero: l.numero,
    nome: l.nome,
    especie: l.especie,
    sexo: l.sexo,
    nascimento_estimado: l.nascimento_estimado,
    idade_precisao: l.idade_precisao,
    porte: l.porte,
    situacao: l.situacao,
    local: l.local,
    disponivel_adocao: l.disponivel_adocao,
    data_entrada: l.data_entrada,
    foto_url: url,
    vacinacao_status: estado?.vacinacao_status ?? null,
    castracao_status: estado?.castracao_status ?? null,
  };
}
