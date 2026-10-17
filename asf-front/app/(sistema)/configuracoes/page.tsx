import type { Metadata } from 'next';
import Link from 'next/link';
import { api, chamar, obterEu } from '@/lib/api';
import { fd, nomePapel } from '@/lib/formato';
import { FormConvite, LinhaUsuario } from './formularios';

export const metadata: Metadata = { title: 'Configurações' };

export default async function Configuracoes() {
  const eu = await obterEu();
  if (!eu.ok) return null;

  // Esconder a tela é conveniência; quem recusa de verdade é a Edge Function e a RLS.
  if (eu.dados.papel !== 'admin') {
    return (
      <div className="pilha">
        <h1>Configurações</h1>
        <p>Só a administração do sistema mexe nas configurações.</p>
      </div>
    );
  }

  const cliente = await api();
  const usuarios = await chamar(cliente.GET('/usuarios'));

  return (
    <div className="pilha" data-e="5">
      <h1>Configurações</h1>

      <section className="cartao pilha" aria-labelledby="titulo-convite">
        <h2 id="titulo-convite">Convidar pessoa</h2>
        <p className="ajuda">
          A pessoa recebe um e-mail com o link para criar a senha. Só entra no sistema quem foi convidado.
        </p>
        <FormConvite />
      </section>

      <section className="cartao pilha" aria-labelledby="titulo-usuarios">
        <h2 id="titulo-usuarios">Usuários</h2>
        {!usuarios.ok ? (
          <div className="pilha">
            <p className="aviso" data-tipo="erro" role="alert">
              {usuarios.falha.mensagem}
            </p>
            <div>
              <Link className="botao" href="/configuracoes">
                Tentar de novo
              </Link>
            </div>
          </div>
        ) : usuarios.dados.length === 0 ? (
          <p>Nenhum usuário cadastrado. Convide a primeira pessoa acima.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Desde</th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {usuarios.dados.map((u) => (
                  <LinhaUsuario
                    key={u.user_id}
                    usuario={u}
                    papelNome={nomePapel(u.papel)}
                    desde={fd(u.criado_em)}
                    souEu={u.user_id === eu.dados.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
