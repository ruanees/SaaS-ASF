import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Assinatura } from '@/components/marca';
import { api, chamar } from '@/lib/api';
import { fd, fdDe, idade } from '@/lib/formato';
import { CASTRACAO, ESPECIE, PORTE, RESULTADO, SEXO, SITUACAO, TIPO_ATENDIMENTO, VACINACAO, nomeDoAnimal } from '@/lib/rotulos';
import type { Atendimento } from '@/lib/tipos';
import { BotaoImprimir } from './botao-imprimir';

export const metadata: Metadata = { title: 'Ficha clínica' };

function descrever(a: Atendimento): string {
  const partes: string[] = [];
  if (a.exame) {
    partes.push(
      [a.exame.nome, a.exame.metodo, RESULTADO[a.exame.resultado].rotulo.toLowerCase(), a.exame.resultado_detalhe]
        .filter(Boolean)
        .join(' · '),
    );
  }
  if (a.tratamento) {
    partes.push(
      [
        a.tratamento.medicamento,
        a.tratamento.dose,
        a.tratamento.frequencia,
        a.tratamento.fim ? `até ${fd(a.tratamento.fim)}` : 'em andamento',
      ]
        .filter(Boolean)
        .join(' · '),
    );
  }
  if (a.internacao) partes.push(a.internacao.alta ? `alta em ${fd(a.internacao.alta)}` : 'internado');
  if (a.dose) partes.push([a.dose.nome, a.dose.lote ? `lote ${a.dose.lote}` : null].filter(Boolean).join(' · '));
  if (a.diagnostico) partes.push(a.diagnostico);
  if (a.observacoes) partes.push(a.observacoes);
  return partes.join('. ');
}

// Ficha clínica para imprimir ou salvar em PDF pelo navegador: fora do layout
// com menu, em preto sobre branco.
export default async function Imprimir({ params }: PageProps<'/imprimir/[id]'>) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const cliente = await api();
  const animal = await chamar(cliente.GET('/animais/{id}', { params: { path: { id } } }));
  if (!animal.ok && animal.falha.status === 404) notFound();

  // Todas as páginas da linha do tempo (100 por vez).
  const itens: Atendimento[] = [];
  let erro: string | undefined;
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await chamar(
      cliente.GET('/animais/{id}/prontuario', { params: { path: { id }, query: { pagina, por_pagina: 100 } } }),
    );
    if (!r.ok) {
      erro = r.falha.mensagem;
      break;
    }
    itens.push(...r.dados.itens);
    if (itens.length >= r.dados.total || r.dados.itens.length === 0) break;
  }

  if (!animal.ok || erro) {
    return (
      <main className="impressao pilha">
        <p className="aviso" data-tipo="erro" role="alert">
          {animal.ok ? erro : animal.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href={`/imprimir/${id}`}>
            Tentar de novo
          </Link>
        </div>
      </main>
    );
  }

  const a = animal.dados;

  return (
    <main className="impressao pilha" data-e="4">
      <div className="linha nao-imprimir" data-separar>
        <Link href={`/animais/${a.id}?aba=prontuario`}>Voltar para a ficha</Link>
        <BotaoImprimir />
      </div>

      <header className="linha" data-separar>
        <Assinatura />
        <span className="ajuda">Emitida em {fdDe(new Date())}</span>
      </header>

      <section className="pilha" data-e="2">
        <h1>
          Ficha clínica · {nomeDoAnimal(a)} <span className="ajuda">{a.numero}</span>
        </h1>
        <dl className="dados-impressao">
          <dt>Espécie e sexo</dt>
          <dd>
            {ESPECIE[a.especie]}, {SEXO[a.sexo]}
            {a.porte ? `, porte ${PORTE[a.porte]}` : ''}
          </dd>
          <dt>Idade</dt>
          <dd>{a.nascimento_estimado ? idade(a.nascimento_estimado, a.idade_precisao) : 'não informada'}</dd>
          <dt>Entrada</dt>
          <dd>{fd(a.data_entrada)}</dd>
          <dt>Situação</dt>
          <dd>{SITUACAO[a.situacao].rotulo}</dd>
          <dt>Microchip</dt>
          <dd>{a.microchip ?? 'sem microchip'}</dd>
          <dt>Vacinação</dt>
          <dd>{a.vacinacao_status ? VACINACAO[a.vacinacao_status].rotulo : 'sem registro'}</dd>
          <dt>Castração</dt>
          <dd>{a.castracao_status ? CASTRACAO[a.castracao_status].rotulo : 'sem registro'}</dd>
          <dt>Leishmaniose</dt>
          <dd>{a.leishmaniose_reagente ? 'reagente' : 'sem resultado reagente'}</dd>
          {a.condicao_entrada && (
            <>
              <dt>Condição na entrada</dt>
              <dd>{a.condicao_entrada}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="pilha" data-e="2">
        <h2>Atendimentos ({itens.length})</h2>
        {itens.length === 0 ? (
          <p>Nenhum atendimento registrado.</p>
        ) : (
          <table className="tabela-impressao">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Tipo</th>
                <th scope="col">Registro</th>
                <th scope="col">Clínica e veterinário</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id}>
                  <td>{fd(i.data)}</td>
                  <td>{TIPO_ATENDIMENTO[i.tipo]}</td>
                  <td>{descrever(i)}</td>
                  <td>{[i.clinica, i.veterinario].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
