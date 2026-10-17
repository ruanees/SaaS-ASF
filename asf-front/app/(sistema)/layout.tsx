import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Menu } from '@/components/menu';
import { obterEu } from '@/lib/api';
import { menuPara } from '@/lib/menu';
import { sair } from './acoes';

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const eu = await obterEu();

  if (!eu.ok && eu.falha.status === 401) redirect('/entrar?motivo=expirou');

  if (!eu.ok && eu.falha.status === 403) {
    return (
      <main className="acesso">
        <div className="cartao pilha">
          <h1>Sem acesso</h1>
          <p>{eu.falha.mensagem}</p>
          <form action={sair}>
            <button className="botao" type="submit">
              Sair
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (!eu.ok) {
    return (
      <main className="acesso">
        <div className="cartao pilha">
          <h1>Não foi possível carregar</h1>
          <p className="aviso" data-tipo="erro" role="alert">
            {eu.falha.mensagem}
          </p>
          <Link className="botao" data-tipo="principal" href="/">
            Tentar de novo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="estrutura">
      <Menu itens={menuPara(eu.dados.papel)} nome={eu.dados.nome} />
      <main className="conteudo">{children}</main>
    </div>
  );
}
