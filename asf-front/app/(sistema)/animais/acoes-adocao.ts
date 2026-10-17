'use server';

import { revalidatePath } from 'next/cache';
import { api, chamar } from '@/lib/api';

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v.trim() : '';
};

function atualizar(animalId: string) {
  revalidatePath(`/animais/${animalId}`);
  revalidatePath('/animais');
  revalidatePath('/adocoes');
  revalidatePath('/pessoas', 'layout');
}

// Adoção e movimentação para "adotado" na mesma transação (função no banco).
export async function registrarAdocao(animalId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const pessoa = texto(form, 'pessoa_id');
  const data = texto(form, 'data');
  if (!pessoa) return { erro: 'Escolha o adotante.' };
  if (!data) return { erro: 'Informe a data da adoção.' };
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/animais/{id}/adocao', { params: { path: { id: animalId } }, body: { pessoa_id: pessoa, data } }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return { ok: 'Adoção registrada. Anexe o termo assinado quando tiver.' };
}

export async function registrarDevolucao(
  adocaoId: string,
  animalId: string,
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const data = texto(form, 'data');
  const motivo = texto(form, 'motivo');
  if (!data) return { erro: 'Informe a data da devolução.' };
  if (!motivo) return { erro: 'Informe o motivo da devolução.' };
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/adocoes/{adocaoId}/devolucao', { params: { path: { adocaoId } }, body: { data, motivo } }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return { ok: 'Devolução registrada. O animal voltou para a sede.' };
}

// Termo assinado: assinar o envio, mandar os bytes direto ao Storage e registrar.
export async function assinarTermo(
  adocaoId: string,
  tipo: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
  tamanho: number,
): Promise<{ caminho?: string; url?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/adocoes/{adocaoId}/termo/assinar', { params: { path: { adocaoId } }, body: { tipo, tamanho } }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  return { caminho: r.dados.caminho, url: r.dados.url };
}

export async function registrarTermo(adocaoId: string, animalId: string, caminho: string): Promise<{ erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/adocoes/{adocaoId}/termo', { params: { path: { adocaoId } }, body: { caminho } }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  atualizar(animalId);
  return {};
}

export async function abrirTermo(adocaoId: string): Promise<{ url?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.GET('/adocoes/{adocaoId}/termo', { params: { path: { adocaoId } } }));
  return r.ok ? { url: r.dados.url } : { erro: r.falha.mensagem };
}
