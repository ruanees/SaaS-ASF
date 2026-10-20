import type { Metadata } from 'next';
import { obterEu } from '@/lib/api';
import { nomePapel } from '@/lib/formato';
import { FormSenha } from './form-senha';

export const metadata: Metadata = { title: 'Minha senha' };

export default async function MinhaConta() {
  const eu = await obterEu();
  if (!eu.ok) return null; // o layout já tratou

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Minha senha</h1>
        <p className="ajuda">
          {eu.dados.nome} · <span className="selo">{nomePapel(eu.dados.papel)}</span>
        </p>
      </div>
      <section className="cartao pilha">
        <h2>Trocar senha</h2>
        <p className="ajuda">
          Recebeu uma senha provisória? Troque aqui no primeiro acesso. A senha é só sua: não mande para ninguém.
        </p>
        <FormSenha />
      </section>
    </div>
  );
}
