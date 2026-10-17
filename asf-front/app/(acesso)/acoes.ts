'use server';

import { redirect } from 'next/navigation';
import { api, apiCom, chamar } from '@/lib/api';
import { voltaSegura } from '@/lib/cookies';
import { guardarSessao } from '@/lib/sessao';

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
  email?: string;
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === 'string' ? v : '';
};

export async function entrar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const email = texto(form, 'email').trim();
  const senha = texto(form, 'senha');
  if (!email || !senha) return { erro: 'Informe e-mail e senha.', email };

  const cliente = await api();
  const r = await chamar(cliente.POST('/sessao/entrar', { body: { email, senha } }));
  if (!r.ok) return { erro: r.falha.mensagem, email };

  await guardarSessao(r.dados);
  redirect(voltaSegura(texto(form, 'volta')));
}

export async function recuperar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const email = texto(form, 'email').trim();
  if (!email) return { erro: 'Informe o e-mail.' };

  const cliente = await api();
  const r = await chamar(cliente.POST('/sessao/recuperar', { body: { email } }));
  if (!r.ok) return { erro: r.falha.mensagem, email };
  return {
    ok: 'Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.',
  };
}

// Chamada pela tela /nova-senha com a sessão que veio no link do e-mail
// (convite ou recuperação). Troca a senha e já deixa a pessoa dentro.
export async function definirSenha(
  _: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  const senha = texto(form, 'senha');
  const repeticao = texto(form, 'repeticao');
  const acesso = texto(form, 'access_token');
  const renovacao = texto(form, 'refresh_token');
  const expira = Number(texto(form, 'expires_at'));

  if (senha.length < 10) return { erro: 'A senha precisa ter ao menos 10 caracteres.' };
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return { erro: 'A senha precisa ter letras e números.' };
  if (senha !== repeticao) return { erro: 'As duas senhas não são iguais.' };
  if (!acesso || !renovacao) return { erro: 'Link inválido. Peça um novo link.' };

  const r = await chamar(apiCom(acesso).POST('/sessao/senha', { body: { senha } }));
  if (!r.ok) return { erro: r.falha.mensagem };

  await guardarSessao({
    access_token: acesso,
    refresh_token: renovacao,
    expires_at: Number.isFinite(expira) && expira > 0 ? expira : Math.floor(Date.now() / 1000) + 3600,
  });
  redirect('/');
}
