import type { Metadata } from 'next';
import Link from 'next/link';
import { api, chamar, obterEu } from '@/lib/api';
import { fd } from '@/lib/formato';
import { ESPECIE, VINCULO, nomeDoAnimal } from '@/lib/rotulos';
import type { Vinculo } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Pessoas' };

const POR_PAGINA = 30;

function Erro({ mensagem, href }: { mensagem: string; href: string }) {
  return (
    <div className="pilha">
      <p className="aviso" data-tipo="erro" role="alert">
        {mensagem}
      </p>
      <div>
        <Link className="botao" href={href}>
          Tentar de novo
        </Link>
      </div>
    </div>
  );
}

async function Lares() {
  const cliente = await api();
  const r = await chamar(cliente.GET('/lares-temporarios'));
  if (!r.ok) return <Erro mensagem={r.falha.mensagem} href="/pessoas?aba=lares" />;
  if (r.dados.length === 0) {
    return (
      <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="aureola" aria-hidden="true" />
        <p>Nenhum lar temporário cadastrado.</p>
      </div>
    );
  }
  return (
    <ul className="lista-pessoas">
      {r.dados.map((l) => (
        <li key={l.id} className="cartao pilha" data-e="2">
          <Link href={`/pessoas/${l.id}`} className="nome-pessoa">
            {l.nome}
          </Link>
          {l.animais.length === 0 ? (
            <span className="ajuda">Sem animal agora.</span>
          ) : (
            <span className="linha" style={{ gap: 'var(--e-2)' }}>
              {l.animais.map((a) => (
                <Link key={a.id} href={`/animais/${a.id}`} className="selo" data-contorno="">
                  {nomeDoAnimal(a)} · {ESPECIE[a.especie]}
                </Link>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Prazo de guarda (Fase 6): calculado a cada abertura; a coordenação abre a
// pessoa e anonimiza. Ninguém é anonimizado sozinho.
async function Prazo() {
  const cliente = await api();
  const r = await chamar(cliente.GET('/pessoas/alem-do-prazo'));
  if (!r.ok) return <Erro mensagem={r.falha.mensagem} href="/pessoas?aba=prazo" />;
  return (
    <div className="pilha">
      <p className="ajuda">
        Pessoas cujo último vínculo com a associação (cadastro, adoção, devolução ou lar temporário) passou do prazo de
        guarda. Abra a pessoa, exporte os dados se for preciso e anonimize. Quem está com animal em lar temporário agora
        não aparece aqui.
      </p>
      {r.dados.length === 0 ? (
        <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="aureola" aria-hidden="true" />
          <p>Ninguém passou do prazo de guarda.</p>
        </div>
      ) : (
        <ul className="lista-pessoas">
          {r.dados.map((p) => (
            <li key={p.id}>
              <Link href={`/pessoas/${p.id}`} className="cartao cartao-pessoa">
                <span className="nome-pessoa">{p.nome}</span>
                <span className="ajuda">
                  Último vínculo em {fd(p.ultimo_evento)} · prazo venceu em {fd(p.venceu_em)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Filtro = { busca?: string; vinculo?: Vinculo; anonimizadas: boolean; pagina: number };

function linkDe(f: Filtro, p: number): string {
  const q = new URLSearchParams();
  if (f.busca) q.set('q', f.busca);
  if (f.vinculo) q.set('vinculo', f.vinculo);
  if (f.anonimizadas) q.set('anonimizadas', '1');
  if (p > 1) q.set('pagina', String(p));
  const t = q.toString();
  return t ? `/pessoas?${t}` : '/pessoas';
}

async function ListaPessoas(f: Filtro) {
  const { busca, vinculo, anonimizadas, pagina } = f;
  const linkPagina = (p: number) => linkDe(f, p);
  const cliente = await api();
  const lista = await chamar(
    cliente.GET('/pessoas', {
      params: { query: { busca, vinculo, anonimizadas: anonimizadas || undefined, pagina, por_pagina: POR_PAGINA } },
    }),
  );
  const temFiltro = linkDe(f, 1) !== '/pessoas';

  return (
    <div className="pilha">
      <form className="linha filtros" action="/pessoas" style={{ alignItems: 'flex-end' }}>
        <div className="campo" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="p-busca">Nome</label>
          <input id="p-busca" name="q" defaultValue={busca} maxLength={40} autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="p-vinculo">Vínculo</label>
          <select id="p-vinculo" name="vinculo" defaultValue={vinculo ?? ''}>
            <option value="">Todos</option>
            {Object.entries(VINCULO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <label className="opcao">
          <input type="checkbox" name="anonimizadas" value="1" defaultChecked={anonimizadas} />
          Incluir anonimizadas
        </label>
        <button className="botao" type="submit">
          Filtrar
        </button>
      </form>

      {!lista.ok ? (
        <Erro mensagem={lista.falha.mensagem} href={linkPagina(pagina)} />
      ) : lista.dados.itens.length === 0 ? (
        <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="aureola" aria-hidden="true" />
          {temFiltro ? (
            <>
              <p>Nenhuma pessoa com esses filtros.</p>
              <Link className="botao" href="/pessoas">
                Limpar filtros
              </Link>
            </>
          ) : (
            <p>Nenhuma pessoa cadastrada.</p>
          )}
        </div>
      ) : (
        <>
          <p className="ajuda">
            {lista.dados.total} {lista.dados.total === 1 ? 'pessoa' : 'pessoas'}
          </p>
          <ul className="lista-pessoas">
            {lista.dados.itens.map((p) => (
              <li key={p.id}>
                <Link href={`/pessoas/${p.id}`} className="cartao cartao-pessoa">
                  <span className="nome-pessoa">{p.nome}</span>
                  <span className="linha" style={{ gap: 'var(--e-2)' }}>
                    {p.anonimizado_em ? (
                      <span className="selo" data-cor="cinza">
                        Anonimizada
                      </span>
                    ) : (
                      p.vinculos.map((v) => (
                        <span key={v} className="selo" data-contorno="">
                          {VINCULO[v]}
                        </span>
                      ))
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {lista.dados.total > POR_PAGINA && (
            <nav className="linha" data-separar aria-label="Páginas">
              {pagina > 1 ? (
                <Link className="botao" href={linkPagina(pagina - 1)}>
                  Página anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="ajuda">
                Página {pagina} de {Math.ceil(lista.dados.total / POR_PAGINA)}
              </span>
              {pagina * POR_PAGINA < lista.dados.total ? (
                <Link className="botao" href={linkPagina(pagina + 1)}>
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

export default async function PaginaPessoas({ searchParams }: PageProps<'/pessoas'>) {
  const params = await searchParams;
  const um = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined);
  const abaPedida = um('aba');
  const busca = um('q')?.slice(0, 40);
  const vinculo = um('vinculo') === 'adotante' || um('vinculo') === 'lar_temporario' ? (um('vinculo') as Vinculo) : undefined;
  const anonimizadas = um('anonimizadas') === '1';
  const pagina = Math.max(1, Number(um('pagina')) || 1);

  const eu = await obterEu();
  const coordena = eu.ok && (eu.dados.papel === 'admin' || eu.dados.papel === 'coordenacao');
  const aba = abaPedida === 'lares' ? 'lares' : abaPedida === 'prazo' && coordena ? 'prazo' : 'pessoas';

  return (
    <div className="pilha" data-e="5">
      <div className="linha" data-separar>
        <h1>Pessoas</h1>
        {coordena && (
          <Link className="botao" data-tipo="principal" href="/pessoas/nova">
            Cadastrar pessoa
          </Link>
        )}
      </div>
      <p className="ajuda">
        Adotantes e lares temporários. Todos veem o nome; telefone, e-mail e endereço só a administração e a coordenação.
      </p>

      <nav className="abas" aria-label="Seções">
        <Link className="aba" href="/pessoas" aria-current={aba === 'pessoas' ? 'page' : undefined}>
          Pessoas
        </Link>
        <Link className="aba" href="/pessoas?aba=lares" aria-current={aba === 'lares' ? 'page' : undefined}>
          Lares temporários
        </Link>
        {coordena && (
          <Link className="aba" href="/pessoas?aba=prazo" aria-current={aba === 'prazo' ? 'page' : undefined}>
            Prazo de guarda
          </Link>
        )}
      </nav>

      {aba === 'prazo' ? <Prazo /> : aba === 'lares' ? <Lares /> : <ListaPessoas busca={busca} vinculo={vinculo} anonimizadas={anonimizadas} pagina={pagina} />}
    </div>
  );
}
