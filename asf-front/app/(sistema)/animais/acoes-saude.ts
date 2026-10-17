'use server';

import { revalidatePath } from 'next/cache';
import { api, chamar } from '@/lib/api';
import { fdCurta } from '@/lib/formato';
import type { components } from '@/types/api';

type NovaCastracao = components['schemas']['NovaCastracaoDto'];

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v.trim() : '';
};
const opcional = (v: string) => (v === '' ? undefined : v);

function atualizar(id: string) {
  revalidatePath(`/animais/${id}`);
  revalidatePath('/animais');
  revalidatePath('/pendencias');
}

export async function registrarVacina(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const vacina = texto(form, 'vacina_tipo_id');
  const data = texto(form, 'data');
  if (!vacina) return { erro: 'Escolha a vacina.' };
  if (!data) return { erro: 'Informe a data da aplicação.' };
  const proxima = opcional(texto(form, 'proxima_dose'));

  const cliente = await api();
  const r = await chamar(
    cliente.POST('/animais/{id}/vacinas', {
      params: { path: { id } },
      body: {
        vacina_tipo_id: vacina,
        data,
        proxima_dose: proxima,
        lote: opcional(texto(form, 'lote')),
        clinica_id: opcional(texto(form, 'clinica_id')),
        veterinario: opcional(texto(form, 'veterinario')),
      },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(id);
  // Brandbook, seção 05: "V10 registrada. Próxima dose em 12/11."
  const nome = texto(form, 'vacina_nome') || 'Vacina';
  return { ok: proxima ? `${nome} registrada. Próxima dose em ${fdCurta(proxima)}.` : `${nome} registrada.` };
}

export async function registrarVermifugacao(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const produto = texto(form, 'produto');
  const data = texto(form, 'data');
  if (!produto) return { erro: 'Informe o vermífugo usado.' };
  if (!data) return { erro: 'Informe a data.' };
  const proxima = opcional(texto(form, 'proxima_dose'));

  const cliente = await api();
  const r = await chamar(
    cliente.POST('/animais/{id}/vermifugacoes', {
      params: { path: { id } },
      body: { produto, data, proxima_dose: proxima },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(id);
  return { ok: proxima ? `Vermifugação registrada. Próxima dose em ${fdCurta(proxima)}.` : 'Vermifugação registrada.' };
}

export async function castracao(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const acao = texto(form, 'acao');
  const data = opcional(texto(form, 'data'));
  const clinica = opcional(texto(form, 'clinica_id'));
  const veterinario = opcional(texto(form, 'veterinario'));
  const cliente = await api();

  let r;
  if (acao === 'cancelar') {
    const castracaoId = texto(form, 'castracao_id');
    r = await chamar(
      cliente.PATCH('/animais/{id}/castracoes/{castracaoId}', {
        params: { path: { id, castracaoId } },
        body: { acao: 'cancelar', motivo: opcional(texto(form, 'motivo')) },
      }),
    );
  } else if (acao === 'agendar' || acao === 'realizar' || acao === 'anterior') {
    if (acao !== 'anterior' && !data) return { erro: 'Informe a data.' };
    r = await chamar(
      cliente.POST('/animais/{id}/castracoes', {
        params: { path: { id } },
        body: { acao: acao as NovaCastracao['acao'], data, clinica_id: clinica, veterinario },
      }),
    );
  } else {
    return { erro: 'Ação inválida.' };
  }
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(id);
  const mensagens: Record<string, string> = {
    agendar: `Castração agendada para ${fdCurta(data)}.`,
    realizar: 'Castração registrada.',
    anterior: 'Registrado: o animal já chegou castrado.',
    cancelar: 'Agendamento cancelado.',
  };
  return { ok: mensagens[acao] };
}
