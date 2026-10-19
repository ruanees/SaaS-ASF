import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { sair } from '@/app/(sistema)/acoes';
import { api, chamar } from '@/lib/api';
import { FluxoMfa } from './fluxo-mfa';

export const metadata: Metadata = { title: 'Verificação em duas etapas' };

// Admin e coordenação só leem dados com o segundo fator (regra no banco).
// Esta tela configura o aplicativo autenticador ou pede o código.
export default async function PaginaMfa() {
  const cliente = await api();
  const fatores = await chamar(cliente.GET('/sessao/mfa/fatores'));
  if (!fatores.ok && fatores.falha.status === 401) redirect('/entrar?motivo=expirou');

  const verificado = fatores.ok ? fatores.dados.find((f) => f.verificado) : undefined;

  return (
    <main className="acesso">
      <div className="cartao pilha" data-e="5">
        <p className="marca-nome">Associação São Francisco</p>
        <h1>Verificação em duas etapas</h1>
        {!fatores.ok ? (
          <p className="aviso" data-tipo="erro" role="alert">
            {fatores.falha.mensagem}
          </p>
        ) : (
          <FluxoMfa fatorVerificado={verificado?.id} />
        )}
        <form action={sair}>
          <button className="botao" data-tipo="texto" type="submit">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
