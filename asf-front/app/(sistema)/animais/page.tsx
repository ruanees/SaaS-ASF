import type { Metadata } from 'next';
import Link from 'next/link';
import { SelosAnimal } from '@/components/selos-animal';
import { SelosSaude } from '@/components/selos-saude';
import { api, chamar } from '@/lib/api';
import { idade } from '@/lib/formato';
import { ESPECIE, SEXO, nomeDoAnimal } from '@/lib/rotulos';
import type { paths } from '@/types/api';
import { Filtros } from './filtros';

export const metadata: Metadata = { title: 'Animais' };

type Filtro = NonNullable<paths['/animais']['get']['parameters']['query']>;
const CHAVES = ['especie', 'sexo', 'porte', 'situacao', 'local', 'disponivel', 'vacinacao', 'castracao', 'tratamento', 'q'] as const;
const POR_PAGINA = 20;

export default async function PaginaAnimais({ searchParams }: PageProps<'/animais'>) {
  const params = await searchParams;
  const um = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined);

  const filtro: Record<string, string> = {};
  for (const k of CHAVES) {
    const v = um(k);
    if (v) filtro[k] = v;
  }
  const pagina = Math.max(1, Number(um('pagina')) || 1);
  const temFiltro = Object.keys(filtro).length > 0;

  const cliente = await api();
  const lista = await chamar(
    cliente.GET('/animais', {
      params: { query: { ...(filtro as Filtro), pagina, por_pagina: POR_PAGINA } },
    }),
  );

  const linkPagina = (p: number) => {
    const q = new URLSearchParams(filtro);
    if (p > 1) q.set('pagina', String(p));
    const s = q.toString();
    return s ? `/animais?${s}` : '/animais';
  };

  return (
    <div className="pilha" data-e="5">
      <div className="linha" data-separar>
        <h1>Animais</h1>
        <Link className="botao" data-tipo="principal" href="/animais/novo">
          Cadastrar animal
        </Link>
      </div>

      <Filtros valores={filtro} />

      {!lista.ok ? (
        <div className="pilha">
          <p className="aviso" data-tipo="erro" role="alert">
            {lista.falha.mensagem}
          </p>
          <div>
            <Link className="botao" href={linkPagina(pagina)}>
              Tentar de novo
            </Link>
          </div>
        </div>
      ) : lista.dados.itens.length === 0 ? (
        <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="aureola" aria-hidden="true" />
          {temFiltro ? (
            <>
              <p>Nenhum animal com esses filtros.</p>
              <Link className="botao" href="/animais">
                Limpar filtros
              </Link>
            </>
          ) : (
            <>
              <p>Nenhum animal cadastrado ainda.</p>
              <Link className="botao" href="/animais/novo">
                Cadastrar o primeiro animal
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="ajuda">
            {lista.dados.total} {lista.dados.total === 1 ? 'animal' : 'animais'}
          </p>
          <ul className="lista-animais">
            {lista.dados.itens.map((a) => (
              <li key={a.id}>
                <Link href={`/animais/${a.id}`} className="cartao cartao-animal">
                  {a.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, expira em 5 min
                    <img src={a.foto_url} alt="" className="foto-animal" loading="lazy" />
                  ) : (
                    <span className="foto-animal" data-vazia aria-hidden="true">
                      {ESPECIE[a.especie]}
                    </span>
                  )}
                  <span className="pilha" data-e="2">
                    <span className="nome-animal">{nomeDoAnimal(a)}</span>
                    <span className="ajuda">
                      {[a.nome ? a.numero : null, ESPECIE[a.especie], SEXO[a.sexo], a.nascimento_estimado ? idade(a.nascimento_estimado, a.idade_precisao) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <SelosAnimal situacao={a.situacao} local={a.local} disponivel={a.disponivel_adocao} />
                    <SelosSaude
                      vacinacao={a.situacao === 'em_acolhimento' ? a.vacinacao_status : null}
                      castracao={a.situacao === 'em_acolhimento' ? a.castracao_status : null}
                      emTratamento={a.situacao === 'em_acolhimento' ? a.em_tratamento : null}
                      leishmaniose={a.leishmaniose_reagente}
                    />
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
