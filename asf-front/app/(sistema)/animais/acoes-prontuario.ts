'use server';

import { revalidatePath } from 'next/cache';
import { api, chamar } from '@/lib/api';
import { TIPO_ATENDIMENTO } from '@/lib/rotulos';
import type { components } from '@/types/api';

type NovoAtendimento = components['schemas']['NovoAtendimentoDto'];
type Resultado = components['schemas']['ResultadoExameDto']['resultado'];

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v.trim() : '';
};
const opcional = (v: string) => (v === '' ? undefined : v);

function atualizar(animalId: string) {
  revalidatePath(`/animais/${animalId}`);
  revalidatePath('/animais');
  revalidatePath('/pendencias');
}

export async function registrarAtendimento(animalId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const tipo = texto(form, 'tipo') as NovoAtendimento['tipo'];
  const data = texto(form, 'data');
  if (!tipo) return { erro: 'Escolha o tipo de atendimento.' };
  if (!data) return { erro: 'Informe a data.' };

  const corpo: NovoAtendimento = {
    tipo,
    data,
    clinica_id: opcional(texto(form, 'clinica_id')),
    veterinario: opcional(texto(form, 'veterinario')),
    diagnostico: opcional(texto(form, 'diagnostico')),
    observacoes: opcional(texto(form, 'observacoes')),
  };
  if (tipo === 'exame' || tipo === 'teste') {
    const nome = texto(form, 'exame_nome');
    if (!nome) return { erro: 'Informe qual exame ou teste foi feito.' };
    corpo.exame = {
      nome,
      metodo: opcional(texto(form, 'exame_metodo')),
      resultado: (opcional(texto(form, 'exame_resultado')) as Resultado | undefined) ?? 'aguardando',
      resultado_detalhe: opcional(texto(form, 'exame_detalhe')),
    };
  } else if (tipo === 'tratamento') {
    const medicamento = texto(form, 'medicamento');
    if (!medicamento) return { erro: 'Informe o medicamento.' };
    corpo.tratamento = {
      medicamento,
      dose: opcional(texto(form, 'dose')),
      frequencia: opcional(texto(form, 'frequencia')),
      inicio: data,
      fim: opcional(texto(form, 'fim')),
    };
  } else if (tipo === 'internacao') {
    corpo.internacao = { entrada: data, alta: opcional(texto(form, 'alta')) };
  }

  const cliente = await api();
  const r = await chamar(cliente.POST('/animais/{id}/atendimentos', { params: { path: { id: animalId } }, body: corpo }));
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return { ok: `${TIPO_ATENDIMENTO[tipo]} registrado no prontuário.` };
}

export async function registrarResultado(
  atendimentoId: string,
  animalId: string,
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const resultado = texto(form, 'resultado') as Resultado;
  if (!resultado) return { erro: 'Escolha o resultado.' };
  const cliente = await api();
  const r = await chamar(
    cliente.PATCH('/atendimentos/{atendimentoId}/resultado', {
      params: { path: { atendimentoId } },
      body: { resultado, detalhe: opcional(texto(form, 'detalhe')), data: opcional(texto(form, 'data')) },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return { ok: 'Resultado registrado.' };
}

export async function encerrar(
  qual: 'fim-tratamento' | 'alta',
  atendimentoId: string,
  animalId: string,
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const data = texto(form, 'data');
  if (!data) return { erro: 'Informe a data.' };
  const cliente = await api();
  const r =
    qual === 'alta'
      ? await chamar(cliente.PATCH('/atendimentos/{atendimentoId}/alta', { params: { path: { atendimentoId } }, body: { data } }))
      : await chamar(
          cliente.PATCH('/atendimentos/{atendimentoId}/fim-tratamento', { params: { path: { atendimentoId } }, body: { data } }),
        );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return { ok: qual === 'alta' ? 'Alta registrada.' : 'Tratamento encerrado.' };
}

// Laudo: assinar o envio, mandar os bytes direto ao Storage e registrar.
export async function assinarLaudo(
  atendimentoId: string,
  tipo: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
  tamanho: number,
): Promise<{ caminho?: string; url?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/atendimentos/{atendimentoId}/laudo/assinar', {
      params: { path: { atendimentoId } },
      body: { tipo, tamanho },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  return { caminho: r.dados.caminho, url: r.dados.url };
}

export async function registrarLaudo(atendimentoId: string, animalId: string, caminho: string): Promise<{ erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/atendimentos/{atendimentoId}/laudo', { params: { path: { atendimentoId } }, body: { caminho } }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return {};
}

// URL de leitura assinada na hora (5 min). Voluntário recebe a recusa do servidor.
export async function abrirLaudo(atendimentoId: string): Promise<{ url?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.GET('/atendimentos/{atendimentoId}/laudo', { params: { path: { atendimentoId } } }));
  return r.ok ? { url: r.dados.url } : { erro: r.falha.mensagem };
}
