import Link from 'next/link';
import { api, chamar, obterEu } from '@/lib/api';
import { fd } from '@/lib/formato';
import { LOCAL, ORIGEM, SITUACAO } from '@/lib/rotulos';
import type { Animal, Movimentacao } from '@/lib/tipos';
import { FormsSituacao } from './forms-situacao';

function descrever(m: Movimentacao): string {
  if (m.tipo === 'devolucao') return 'Devolvido pelo adotante; voltou para a sede';
  if (m.situacao === 'adotado') return `Adotado${m.pessoa ? ` por ${m.pessoa.nome}` : ''}`;
  if (m.situacao === 'transferido') return `Transferido${m.destino ? ` para ${m.destino}` : ''}`;
  if (m.situacao === 'devolvido_comunidade') return `Devolvido à comunidade${m.destino ? ` (${m.destino})` : ''}`;
  if (m.tipo === 'entrada') {
    return `Entrada${m.origem ? ` (${ORIGEM[m.origem].toLowerCase()})` : ''}${m.local ? ` na ${m.local === 'sede' ? 'sede' : LOCAL[m.local].toLowerCase()}` : ''}`;
  }
  if (m.tipo === 'reentrada') {
    return `Voltou para a associação${m.origem ? ` (${ORIGEM[m.origem].toLowerCase()})` : ''}`;
  }
  if (m.situacao !== 'em_acolhimento') return SITUACAO[m.situacao].rotulo;
  const onde =
    m.local === 'clinica'
      ? `Clínica${m.clinica ? ` ${m.clinica}` : ''}`
      : m.local === 'lar_temporario'
        ? `Lar temporário${m.pessoa ? ` de ${m.pessoa.nome}` : ''}`
        : m.local
          ? LOCAL[m.local]
          : '';
  return `${onde}${m.disponivel_adocao ? ' · disponível para adoção' : ''}`;
}

export async function AbaSituacao({ animal, hoje }: { animal: Animal; hoje: string }) {
  const cliente = await api();
  const [historico, clinicas, lares, eu] = await Promise.all([
    chamar(cliente.GET('/animais/{id}/movimentacoes', { params: { path: { id: animal.id } } })),
    chamar(cliente.GET('/clinicas')),
    chamar(cliente.GET('/pessoas', { params: { query: { vinculo: 'lar_temporario', por_pagina: 100 } } })),
    obterEu(),
  ]);
  const coordena = eu.ok && (eu.dados.papel === 'admin' || eu.dados.papel === 'coordenacao');

  return (
    <div className="pilha" data-e="5">
      <section className="cartao pilha">
        <h2>Situação atual</h2>
        <p>
          <b>{SITUACAO[animal.situacao].rotulo}</b> · {SITUACAO[animal.situacao].descricao}
          {animal.situacao === 'em_acolhimento' && animal.local && (
            <>
              {' '}
              ·{' '}
              {animal.local === 'clinica' && animal.clinica ? (
                `Clínica ${animal.clinica.nome}`
              ) : animal.local === 'lar_temporario' && animal.responsavel ? (
                <>
                  Lar temporário de <Link href={`/pessoas/${animal.responsavel.id}`}>{animal.responsavel.nome}</Link>
                </>
              ) : (
                LOCAL[animal.local]
              )}
              {animal.disponivel_adocao ? ' · disponível para adoção' : ''}
            </>
          )}
        </p>
        <FormsSituacao
          animal={animal}
          hoje={hoje}
          clinicas={clinicas.ok ? clinicas.dados : []}
          lares={lares.ok ? lares.dados.itens : []}
          coordena={coordena}
        />
      </section>

      <section className="cartao pilha">
        <h2>Histórico</h2>
        {!historico.ok ? (
          <div className="pilha">
            <p className="aviso" data-tipo="erro" role="alert">
              {historico.falha.mensagem}
            </p>
            <div>
              <Link className="botao" href={`/animais/${animal.id}?aba=situacao`}>
                Tentar de novo
              </Link>
            </div>
          </div>
        ) : historico.dados.length === 0 ? (
          <p>Nenhuma movimentação registrada.</p>
        ) : (
          <ol className="linha-do-tempo">
            {historico.dados.map((m) => (
              <li key={m.id}>
                <span className="data">{fd(m.data)}</span>
                <span className="pilha" data-e="2">
                  <span>{descrever(m)}</span>
                  {m.motivo && <span className="ajuda">{m.motivo}</span>}
                  {m.autor && <span className="ajuda">Registrado por {m.autor}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
