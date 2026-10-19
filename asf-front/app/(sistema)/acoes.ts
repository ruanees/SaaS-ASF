'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, chamar } from '@/lib/api';
import { limparSessao } from '@/lib/sessao';
import type { Papel } from '@/lib/tipos';

export interface EstadoAcao {
  erro?: string;
  ok?: string;
}

export async function sair(): Promise<void> {
  const cliente = await api();
  // Mesmo se o back não responder, a sessão local sai.
  await chamar(cliente.POST('/sessao/sair'));
  await limparSessao();
  redirect('/entrar?motivo=saiu');
}

const PAPEIS: Papel[] = ['admin', 'coordenacao', 'veterinario', 'voluntario'];
const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v.trim() : '';
};

export async function convidar(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const email = texto(form, 'email');
  const nome = texto(form, 'nome');
  const papel = texto(form, 'papel') as Papel;
  if (!email || !nome) return { erro: 'Informe nome e e-mail.' };
  if (!PAPEIS.includes(papel)) return { erro: 'Escolha o papel.' };

  const cliente = await api();
  const r = await chamar(cliente.POST('/usuarios/convites', { body: { email, nome, papel } }));
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/configuracoes');
  return { ok: `Convite enviado para ${nome}.` };
}

export async function alterarUsuario(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const id = texto(form, 'id');
  const papel = texto(form, 'papel');
  const ativo = texto(form, 'ativo');

  const corpo: { papel?: Papel; ativo?: boolean } = {};
  if (papel) {
    if (!PAPEIS.includes(papel as Papel)) return { erro: 'Papel inválido.' };
    corpo.papel = papel as Papel;
  }
  if (ativo === 'sim' || ativo === 'nao') corpo.ativo = ativo === 'sim';

  const cliente = await api();
  const r = await chamar(
    cliente.PATCH('/usuarios/{id}', { params: { path: { id } }, body: corpo }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/configuracoes');
  return { ok: 'Alteração salva.' };
}

export async function criarClinica(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const nome = texto(form, 'nome');
  if (!nome) return { erro: 'Informe o nome da clínica.' };
  const cliente = await api();
  const r = await chamar(cliente.POST('/clinicas', { body: { nome } }));
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/configuracoes');
  return { ok: `${nome} cadastrada.` };
}

export async function criarVacinaTipo(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const nome = texto(form, 'nome');
  const especie = texto(form, 'especie') as 'cao' | 'gato';
  const reforco = texto(form, 'reforco_dias');
  const doses = Number(texto(form, 'doses_iniciais') || 1);
  const intervalo = texto(form, 'intervalo_inicial_dias');
  if (!nome) return { erro: 'Informe o nome da vacina.' };
  if (doses > 1 && !intervalo) return { erro: 'Informe os dias entre as doses da primeira vez.' };
  if (especie !== 'cao' && especie !== 'gato') return { erro: 'Escolha a espécie.' };
  const cliente = await api();
  const r = await chamar(
    cliente.POST('/vacinas-tipos', {
      body: {
        nome,
        especie,
        reforco_dias: reforco ? Number(reforco) : null,
        doses_iniciais: doses,
        intervalo_inicial_dias: doses > 1 && intervalo ? Number(intervalo) : null,
      },
    }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/configuracoes');
  return { ok: `${nome} cadastrada no catálogo.` };
}

export async function alterarVacinaTipo(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const id = texto(form, 'id');
  const reforco = texto(form, 'reforco_dias');
  const ativo = texto(form, 'ativo');
  const corpo: { reforco_dias?: number | null; ativo?: boolean } = {};
  if (form.has('reforco_dias')) corpo.reforco_dias = reforco ? Number(reforco) : null;
  if (ativo === 'sim' || ativo === 'nao') corpo.ativo = ativo === 'sim';
  const cliente = await api();
  const r = await chamar(
    cliente.PATCH('/vacinas-tipos/{id}', { params: { path: { id } }, body: corpo }),
  );
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/configuracoes');
  return { ok: 'Alteração salva.' };
}

// Arquivos soltos no Storage (Fase 6): o banco lista, a política só deixa o
// admin apagar o que não está ligado a nenhum registro.
export async function limparArquivosSoltos(): Promise<{ ok?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.POST('/arquivos-soltos/apagar'));
  if (!r.ok) return { erro: r.falha.mensagem };
  revalidatePath('/configuracoes');
  return r.dados.restantes > 0
    ? { erro: `${r.dados.apagados} apagados; ${r.dados.restantes} não saíram. Tente de novo mais tarde.` }
    : { ok: `${r.dados.apagados} ${r.dados.apagados === 1 ? 'arquivo apagado' : 'arquivos apagados'}.` };
}
