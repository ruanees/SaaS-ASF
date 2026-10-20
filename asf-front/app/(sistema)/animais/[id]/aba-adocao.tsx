import Link from 'next/link';
import { AvisoPrivacidade } from '@/components/aviso-privacidade';
import { api, chamar, obterEu } from '@/lib/api';
import { fd } from '@/lib/formato';
import type { Animal } from '@/lib/tipos';
import { FORMA_ACOMPANHAMENTO } from '@/lib/rotulos';
import { AcoesAdocao, FormAcompanhamento, FormAdocao } from './forms-adocao';

export async function AbaAdocao({ animal, hoje, pessoa }: { animal: Animal; hoje: string; pessoa?: string }) {
  const cliente = await api();
  const [adocoes, eu] = await Promise.all([
    chamar(cliente.GET('/animais/{id}/adocoes', { params: { path: { id: animal.id } } })),
    obterEu(),
  ]);
  const coordena = eu.ok && (eu.dados.papel === 'admin' || eu.dados.papel === 'coordenacao');
  const podeAdotar = coordena && animal.situacao === 'em_acolhimento';
  const pessoas = podeAdotar
    ? await chamar(cliente.GET('/pessoas', { params: { query: { por_pagina: 100 } } }))
    : null;

  if (!adocoes.ok) {
    return (
      <div className="pilha">
        <p className="aviso" data-tipo="erro" role="alert">
          {adocoes.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href={`/animais/${animal.id}?aba=adocao`}>
            Tentar de novo
          </Link>
        </div>
      </div>
    );
  }
  const ativa = adocoes.dados.find((a) => a.data_devolucao === null);
  const acompanhamentos = new Map(
    await Promise.all(
      adocoes.dados.map(async (a) => {
        const r = await chamar(cliente.GET('/adocoes/{adocaoId}/acompanhamentos', { params: { path: { adocaoId: a.id } } }));
        return [a.id, r.ok ? r.dados : []] as const;
      }),
    ),
  );

  return (
    <div className="pilha" data-e="5">
      <section className="cartao pilha">
        <h2>Adoções</h2>
        {adocoes.dados.length === 0 ? (
          <p>Nenhuma adoção registrada.</p>
        ) : (
          <ol className="linha-do-tempo">
            {adocoes.dados.map((a) => (
              <li key={a.id}>
                <span className="data">{fd(a.data_adocao)}</span>
                <span className="pilha" data-e="2">
                  <span>
                    Adotado por <Link href={`/pessoas/${a.pessoa.id}`}>{a.pessoa.nome}</Link>{' '}
                    <span className="selo" data-cor={a.data_devolucao ? 'laranja' : 'verde'}>
                      {a.data_devolucao ? `Devolvido em ${fd(a.data_devolucao)}` : 'Adoção ativa'}
                    </span>
                  </span>
                  {a.motivo_devolucao && <span className="ajuda">Motivo da devolução: {a.motivo_devolucao}</span>}
                  {coordena && (
                    <span>
                      <Link className="botao" data-tipo="texto" href={`/imprimir/termo/${a.id}`} target="_blank">
                        Gerar termo de adoção para imprimir
                      </Link>
                    </span>
                  )}
                  {coordena && a.id === ativa?.id && <AcoesAdocao animalId={animal.id} adocao={a} hoje={hoje} />}
                  <span className="pilha" data-e="2">
                    <span className="rotulo">Acompanhamentos</span>
                    {(acompanhamentos.get(a.id) ?? []).length === 0 ? (
                      <span className="ajuda">Nenhum acompanhamento registrado.</span>
                    ) : (
                      <ul className="pilha" data-e="1" style={{ margin: 0, paddingLeft: 'var(--e-4)' }}>
                        {(acompanhamentos.get(a.id) ?? []).map((ac) => (
                          <li key={ac.id}>
                            <b>{fd(ac.data)}</b> · {FORMA_ACOMPANHAMENTO[ac.forma]}
                            {ac.observacoes && <span className="ajuda"> · {ac.observacoes}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {animal.situacao !== 'obito' && <FormAcompanhamento animalId={animal.id} adocao={a} hoje={hoje} />}
                  </span>
                  {!coordena && a.tem_termo && <span className="ajuda">Termo assinado anexado.</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {podeAdotar && (
        <section className="cartao pilha">
          <FormAdocao
            animalId={animal.id}
            hoje={hoje}
            minimo={animal.data_entrada}
            pessoas={pessoas?.ok ? pessoas.dados.itens : []}
            pessoaInicial={pessoa}
          />
          <AvisoPrivacidade />
        </section>
      )}
      {!coordena && animal.situacao === 'em_acolhimento' && (
        <p className="ajuda">A adoção é registrada pela administração ou pela coordenação.</p>
      )}
      {animal.situacao !== 'em_acolhimento' && animal.situacao !== 'adotado' && (
        <p className="ajuda">Só animal em acolhimento pode ser adotado.</p>
      )}
    </div>
  );
}
