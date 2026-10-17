'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, chamar } from '@/lib/api';
import type { Duplicado } from '@/lib/tipos';
import type { components } from '@/types/api';

type CriarAnimal = components['schemas']['CriarAnimalDto'];
type AlterarAnimal = components['schemas']['AlterarAnimalDto'];
type NovaMovimentacao = components['schemas']['NovaMovimentacaoDto'];

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v.trim() : '';
};
const opcional = (v: string) => (v === '' ? undefined : v);

// Cadastro ---------------------------------------------------------------------

export async function procurarDuplicados(
  nome: string,
  especie: string,
  sexo: string,
): Promise<Duplicado[]> {
  if (!nome.trim() || !especie || !sexo) return [];
  const cliente = await api();
  const r = await chamar(
    cliente.GET('/animais/duplicados', {
      params: {
        query: {
          nome: nome.trim(),
          especie: especie as CriarAnimal['especie'],
          sexo: sexo as CriarAnimal['sexo'],
        },
      },
    }),
  );
  // Sem a checagem o cadastro continua: o aviso é ajuda, não trava.
  return r.ok ? r.dados : [];
}

export async function cadastrarAnimal(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const corpo: CriarAnimal = {
    nome: opcional(texto(form, 'nome')),
    especie: texto(form, 'especie') as CriarAnimal['especie'],
    sexo: texto(form, 'sexo') as CriarAnimal['sexo'],
    nascimento_estimado: opcional(texto(form, 'nascimento_estimado')),
    idade_precisao: opcional(texto(form, 'idade_precisao')) as CriarAnimal['idade_precisao'],
    porte: opcional(texto(form, 'porte')) as CriarAnimal['porte'],
    data_entrada: texto(form, 'data_entrada'),
    origem: texto(form, 'origem') as CriarAnimal['origem'],
    origem_detalhe: opcional(texto(form, 'origem_detalhe')),
    local: texto(form, 'local') as CriarAnimal['local'],
    disponivel_adocao: form.get('disponivel_adocao') === 'sim',
    clinica_id: opcional(texto(form, 'clinica_id')),
    observacoes: opcional(texto(form, 'observacoes')),
  };
  if (!corpo.especie) return { erro: 'Escolha a espécie.' };
  if (!corpo.sexo) return { erro: 'Escolha o sexo.' };
  if (!corpo.data_entrada) return { erro: 'Informe a data de entrada do animal.' };
  if (!corpo.origem) return { erro: 'Escolha a origem.' };
  if (corpo.origem === 'outra' && !corpo.origem_detalhe) return { erro: 'Conte qual foi a origem.' };
  if (!corpo.local) return { erro: 'Informe onde o animal está.' };

  const cliente = await api();
  const r = await chamar(cliente.POST('/animais', { body: corpo }));
  if (!r.ok) return { erro: r.falha.mensagem };

  // Saúde na entrada: condição, exames pedidos e tratamento iniciado.
  const condicao = opcional(texto(form, 'condicao_entrada'));
  const exames = form.getAll('exames').filter((e): e is string => typeof e === 'string' && e.trim() !== '');
  const medicamento = texto(form, 'medicamento');
  let saude = '';
  if (condicao || exames.length > 0 || medicamento) {
    const s = await chamar(
      cliente.POST('/animais/{id}/saude-entrada', {
        params: { path: { id: r.dados.id } },
        body: {
          condicao,
          exames,
          tratamento: medicamento
            ? { medicamento, dose: opcional(texto(form, 'dose')), frequencia: opcional(texto(form, 'frequencia')) }
            : undefined,
        },
      }),
    );
    if (!s.ok) saude = '&saude=falhou';
  }

  revalidatePath('/animais');
  redirect(`/animais/${r.dados.id}?novo=1${saude}`);
}

// Ficha: campo a campo ------------------------------------------------------------

export async function alterarCampos(
  id: string,
  campos: AlterarAnimal,
): Promise<{ erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.PATCH('/animais/{id}', { params: { path: { id } }, body: campos }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath(`/animais/${id}`);
  return {};
}

export async function excluirAnimal(id: string): Promise<{ erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.DELETE('/animais/{id}', { params: { path: { id } } }));
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/animais');
  redirect('/animais');
}

// Situação ------------------------------------------------------------------------

export async function registrarMovimentacao(
  id: string,
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const situacao = texto(form, 'situacao') as NovaMovimentacao['situacao'];
  const corpo: NovaMovimentacao = {
    situacao,
    local: opcional(texto(form, 'local')) as NovaMovimentacao['local'],
    disponivel_adocao: form.get('disponivel_adocao') === 'sim',
    data: texto(form, 'data'),
    motivo: opcional(texto(form, 'motivo')),
    tipo: (opcional(texto(form, 'tipo')) as NovaMovimentacao['tipo']) ?? 'mudanca',
    origem: opcional(texto(form, 'origem')) as NovaMovimentacao['origem'],
    clinica_id: opcional(texto(form, 'clinica_id')),
  };
  if (!corpo.data) return { erro: 'Informe a data.' };

  const cliente = await api();
  const r = await chamar(
    cliente.POST('/animais/{id}/movimentacoes', { params: { path: { id } }, body: corpo }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath(`/animais/${id}`);
  revalidatePath('/animais');
  return { ok: situacao === 'obito' ? 'Óbito registrado.' : 'Mudança registrada.' };
}

// Foto ------------------------------------------------------------------------------

export async function assinarFoto(
  id: string,
  tipo: 'image/webp' | 'image/jpeg',
  tamanho: number,
): Promise<{ caminho?: string; url?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/animais/{id}/fotos/assinar', {
      params: { path: { id } },
      body: { tipo, tamanho },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  return { caminho: r.dados.caminho, url: r.dados.url };
}

export async function registrarFoto(id: string, caminho: string): Promise<{ erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/animais/{id}/fotos', { params: { path: { id } }, body: { caminho } }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath(`/animais/${id}`);
  revalidatePath('/animais');
  return {};
}
