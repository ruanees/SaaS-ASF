'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, chamar } from '@/lib/api';
import type { BaseLegal, Contato, Vinculo } from '@/lib/tipos';

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v.trim() : '';
};
const opcional = (v: string) => (v === '' ? undefined : v);
const vinculos = (form: FormData) =>
  form.getAll('vinculos').filter((v): v is Vinculo => v === 'adotante' || v === 'lar_temporario');

// Só volta para uma tela do próprio sistema (nada de redirecionar para fora).
function destinoSeguro(voltar: string | undefined): string | undefined {
  return voltar && /^\/(animais|pessoas|adocoes)(\/|\?|$)/.test(voltar) ? voltar : undefined;
}

// Nada aqui grava rascunho nem loga o que foi digitado (dado pessoal).
export async function cadastrarPessoa(voltar: string | undefined, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const nome = texto(form, 'nome');
  const base = texto(form, 'base_legal') as BaseLegal;
  const v = vinculos(form);
  if (!nome) return { erro: 'Informe o nome.' };
  if (v.length === 0) return { erro: 'Escolha o vínculo: adotante ou lar temporário.' };
  if (!base) return { erro: 'Escolha a base legal.' };

  const cliente = await api();
  const r = await chamar(
    cliente.POST('/pessoas', {
      body: {
        nome,
        base_legal: base,
        vinculos: v,
        telefone: opcional(texto(form, 'telefone')),
        email: opcional(texto(form, 'email')),
        endereco: opcional(texto(form, 'endereco')),
      },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/pessoas');
  const volta = destinoSeguro(voltar);
  redirect(volta ? `${volta}${volta.includes('?') ? '&' : '?'}pessoa=${r.dados.id}` : `/pessoas/${r.dados.id}?nova=1`);
}

export async function alterarPessoa(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const nome = texto(form, 'nome');
  const v = vinculos(form);
  if (!nome) return { erro: 'Informe o nome.' };
  if (v.length === 0) return { erro: 'Escolha o vínculo: adotante ou lar temporário.' };
  const cliente = await api();
  const r = await chamar(
    cliente.PATCH('/pessoas/{id}', {
      params: { path: { id } },
      body: { nome, base_legal: texto(form, 'base_legal') as BaseLegal, vinculos: v },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath(`/pessoas/${id}`);
  revalidatePath('/pessoas');
  return { ok: 'Dados salvos.' };
}

// Cada leitura fica registrada na auditoria (o banco grava).
export async function verContato(id: string): Promise<{ contato?: Contato; erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.GET('/pessoas/{id}/contato', { params: { path: { id } } }));
  return r.ok ? { contato: r.dados } : { erro: r.falha.mensagem };
}

export async function alterarContato(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const cliente = await api();
  const r = await chamar(
    cliente.PUT('/pessoas/{id}/contato', {
      params: { path: { id } },
      body: {
        telefone: opcional(texto(form, 'telefone')),
        email: opcional(texto(form, 'email')),
        endereco: opcional(texto(form, 'endereco')),
      },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  return { ok: 'Contato salvo.' };
}

// Direito de acesso do titular: o JSON vai para o aparelho de quem pediu.
export async function exportarDados(id: string): Promise<{ json?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.GET('/pessoas/{id}/dados', { params: { path: { id } } }));
  return r.ok ? { json: JSON.stringify(r.dados, null, 2) } : { erro: r.falha.mensagem };
}

export async function anonimizarPessoa(id: string): Promise<{ erro?: string; aviso?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.POST('/pessoas/{id}/anonimizar', { params: { path: { id } } }));
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath(`/pessoas/${id}`);
  revalidatePath('/pessoas');
  revalidatePath('/adocoes');
  return { aviso: r.dados.aviso ?? undefined };
}
