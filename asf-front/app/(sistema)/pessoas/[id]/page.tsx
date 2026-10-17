import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, chamar, obterEu } from '@/lib/api';
import { fd } from '@/lib/formato';
import { BASE_LEGAL, ESPECIE, VINCULO, nomeDoAnimal } from '@/lib/rotulos';
import { FormAlterarPessoa } from '../form-pessoa';
import { Anonimizar, ContatoPessoa, ExportarDados } from './controles';

export const metadata: Metadata = { title: 'Pessoa' };

export default async function FichaPessoa({ params, searchParams }: PageProps<'/pessoas/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const cliente = await api();
  const [r, eu] = await Promise.all([chamar(cliente.GET('/pessoas/{id}', { params: { path: { id } } })), obterEu()]);
  if (!r.ok && r.falha.status === 404) notFound();
  if (!r.ok) {
    return (
      <div className="pilha">
        <h1>Pessoa</h1>
        <p className="aviso" data-tipo="erro" role="alert">
          {r.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href={`/pessoas/${id}`}>
            Tentar de novo
          </Link>
        </div>
      </div>
    );
  }
  const p = r.dados;
  const coordena = eu.ok && (eu.dados.papel === 'admin' || eu.dados.papel === 'coordenacao');
  const anonimizada = p.anonimizado_em !== null;

  return (
    <div className="pilha" data-e="5">
      <Link href="/pessoas">Voltar para pessoas</Link>

      {sp.nova === '1' && (
        <p className="aviso" data-tipo="ok" role="status">
          {p.nome} cadastrada.
        </p>
      )}

      <header className="cartao pilha" data-e="2">
        <h1 style={{ fontSize: 'var(--t-titulo)' }}>{p.nome}</h1>
        <span className="linha" style={{ gap: 'var(--e-2)' }}>
          {anonimizada ? (
            <span className="selo" data-cor="cinza">
              Anonimizada em {fd(p.anonimizado_em)}
            </span>
          ) : (
            p.vinculos.map((v) => (
              <span key={v} className="selo" data-contorno="">
                {VINCULO[v]}
              </span>
            ))
          )}
        </span>
        <p className="ajuda">
          Base legal: {BASE_LEGAL[p.base_legal].rotulo} · cadastrada em {fd(p.criado_em)}
        </p>
      </header>

      <section className="cartao pilha">
        <h2>Animais</h2>
        {p.lar_atual.length > 0 && (
          <div className="pilha" data-e="2">
            <span className="rotulo">No lar temporário agora</span>
            <span className="linha" style={{ gap: 'var(--e-2)' }}>
              {p.lar_atual.map((a) => (
                <Link key={a.id} href={`/animais/${a.id}`} className="selo" data-contorno="">
                  {nomeDoAnimal(a)} · {ESPECIE[a.especie]}
                </Link>
              ))}
            </span>
          </div>
        )}
        {p.adocoes.length === 0 && p.lar_historico.length === 0 ? (
          <p>Nenhum animal ligado a esta pessoa.</p>
        ) : (
          <ol className="linha-do-tempo">
            {p.adocoes.map((a) => (
              <li key={a.id}>
                <span className="data">{fd(a.data_adocao)}</span>
                <span className="pilha" data-e="2">
                  <span>
                    Adotou <Link href={`/animais/${a.animal.id}?aba=adocao`}>{nomeDoAnimal(a.animal)}</Link>{' '}
                    <span className="ajuda">· {a.animal.numero}</span>
                  </span>
                  {a.data_devolucao && (
                    <span className="ajuda">
                      Devolvido em {fd(a.data_devolucao)}: {a.motivo_devolucao}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {p.lar_historico.map((l, i) => (
              <li key={`lar-${l.animal.id}-${l.data}-${i}`}>
                <span className="data">{fd(l.data)}</span>
                <span>
                  Recebeu <Link href={`/animais/${l.animal.id}?aba=situacao`}>{nomeDoAnimal(l.animal)}</Link> em lar
                  temporário <span className="ajuda">· {l.animal.numero}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {coordena && !anonimizada && (
        <>
          <section className="cartao pilha">
            <h2>Contato</h2>
            <ContatoPessoa id={p.id} pedeEndereco={p.vinculos.length > 0} />
          </section>
          <section className="cartao pilha">
            <FormAlterarPessoa id={p.id} nome={p.nome} vinculos={p.vinculos} base={p.base_legal} />
          </section>
          <section className="cartao pilha">
            <h2>Direitos da pessoa (LGPD)</h2>
            <ExportarDados id={p.id} />
            <Anonimizar id={p.id} nome={p.nome} />
          </section>
        </>
      )}
      {coordena && anonimizada && (
        <section className="cartao pilha">
          <h2>Direitos da pessoa (LGPD)</h2>
          <p className="ajuda">O contato desta pessoa foi apagado. As adoções continuam no histórico dos animais.</p>
          <ExportarDados id={p.id} />
        </section>
      )}
      {!coordena && (
        <p className="ajuda">Telefone, e-mail e endereço só a administração e a coordenação veem.</p>
      )}
    </div>
  );
}
