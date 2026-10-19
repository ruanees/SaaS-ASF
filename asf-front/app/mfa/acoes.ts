'use server';

import { redirect } from 'next/navigation';
import { api, chamar } from '@/lib/api';
import { guardarSessao } from '@/lib/sessao';

export interface EstadoMfa {
  erro?: string;
  fatorId?: string;
  qrCode?: string;
  segredo?: string;
}

// Começa a configuração do autenticador: o back pede ao Auth um QR code novo.
export async function inscrever(): Promise<EstadoMfa> {
  const cliente = await api();
  const r = await chamar(cliente.POST('/sessao/mfa/inscrever'));
  if (!r.ok) return { erro: r.falha.mensagem };
  return { fatorId: r.dados.fator_id, qrCode: r.dados.qr_code, segredo: r.dados.segredo };
}

// Confere o código de 6 números e troca a sessão pela sessão com segundo fator.
export async function verificar(estado: EstadoMfa, form: FormData): Promise<EstadoMfa> {
  const fatorId = String(form.get('fator_id') ?? '');
  const codigo = String(form.get('codigo') ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(codigo)) return { ...estado, erro: 'O código tem 6 números.' };

  const cliente = await api();
  const r = await chamar(
    cliente.POST('/sessao/mfa/verificar', { body: { fator_id: fatorId, codigo } }),
  );
  if (!r.ok) return { ...estado, erro: r.falha.mensagem };

  await guardarSessao(r.dados);
  redirect('/');
}
