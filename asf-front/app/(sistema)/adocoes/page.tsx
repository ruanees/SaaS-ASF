import type { Metadata } from 'next';
import Link from 'next/link';
import { api, chamar } from '@/lib/api';
import { fd } from '@/lib/formato';
import { ESPECIE, nomeDoAnimal } from '@/lib/rotulos';

export const metadata: Metadata = { title: 'Adoções' };

const POR_PAGINA = 30;

export default async function PaginaAdocoes({ searchParams }: PageProps<'/adocoes'>) {
  const sp = await searchParams;
  const ativas = sp.ativas === '1';
  const pagina = Math.max(1, Number(typeof sp.pagina === 'string' ? sp.pagina : 1) || 1);
  const link = (p: number, a = ativas) => {
    const q = new URLSearchParams();
    if (a) q.set('ativas', '1');
    if (p > 1) q.set('pagina', String(p));
    const s = q.toString();
    return s ? `/adocoes?${s}` : '/adocoes';
  };

  const cliente = await api();
  const lista = await chamar(
    cliente.GET('/adocoes', { params: { query: { ativas: ativas || undefined, pagina, por_pagina: POR_PAGINA } } }),
  );

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Adoções</h1>
        <p className="ajuda">A adoção é registrada na ficha do animal, na aba Adoção.</p>
      </div>

      <nav className="linha" aria-label="Filtrar" style={{ gap: 'var(--e-2)' }}>
        <Link href={link(1, false)} className="selo" data-contorno={ativas ? '' : undefined} aria-current={ativas ? undefined : 'page'}>
          Todas
        </Link>
        <Link href={link(1, true)} className="selo" data-contorno={ativas ? undefined : ''} aria-current={ativas ? 'page' : undefined}>
          Sem devolução
        </Link>
      </nav>

      {!lista.ok ? (
        <div className="pilha">
          <p className="aviso" data-tipo="erro" role="alert">
            {lista.falha.mensagem}
          </p>
          <div>
            <Link className="botao" href={link(pagina)}>
              Tentar de novo
            </Link>
          </div>
        </div>
      ) : lista.dados.itens.length === 0 ? (
        <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="aureola" aria-hidden="true" />
          <p>Nenhuma adoção registrada.</p>
        </div>
      ) : (
        <>
          <p className="ajuda">
            {lista.dados.total} {lista.dados.total === 1 ? 'adoção' : 'adoções'}
          </p>
          <ul className="lista-pendencias">
            {lista.dados.itens.map((a) => (
              <li key={a.id} className="cartao cartao-pendencia">
                <span className="data">{fd(a.data_adocao)}</span>
                <span className="pilha" data-e="2">
                  <span>
                    <Link href={`/animais/${a.animal.id}?aba=adocao`}>
                      <b>{nomeDoAnimal(a.animal)}</b>
                    </Link>{' '}
                    <span className="ajuda">
                      · {a.animal.numero} · {ESPECIE[a.animal.especie]}
                    </span>
                  </span>
                  <span>
                    Adotante: <Link href={`/pessoas/${a.pessoa.id}`}>{a.pessoa.nome}</Link>
                  </span>
                  {a.data_devolucao && (
                    <span className="ajuda">
                      Devolvido em {fd(a.data_devolucao)}: {a.motivo_devolucao}
                    </span>
                  )}
                </span>
                <span className="selo" data-cor={a.data_devolucao ? 'laranja' : a.tem_termo ? 'verde' : 'amarelo'}>
                  {a.data_devolucao ? 'Devolvido' : a.tem_termo ? 'Com termo' : 'Sem termo anexado'}
                </span>
              </li>
            ))}
          </ul>
          {lista.dados.total > POR_PAGINA && (
            <nav className="linha" data-separar aria-label="Páginas">
              {pagina > 1 ? (
                <Link className="botao" href={link(pagina - 1)}>
                  Página anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="ajuda">
                Página {pagina} de {Math.ceil(lista.dados.total / POR_PAGINA)}
              </span>
              {pagina * POR_PAGINA < lista.dados.total ? (
                <Link className="botao" href={link(pagina + 1)}>
                  Próxima página
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
