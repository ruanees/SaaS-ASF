import Link from 'next/link';
import { api, chamar, obterEu } from '@/lib/api';
import { fd } from '@/lib/formato';
import { RESULTADO, TIPO_ATENDIMENTO, type TipoAtendimento } from '@/lib/rotulos';
import type { Animal, Atendimento } from '@/lib/tipos';
import { AcoesItem, FormAtendimento } from './forms-prontuario';

const FILTROS: (TipoAtendimento | '')[] = ['', 'consulta', 'exame', 'teste', 'tratamento', 'internacao', 'vacina', 'vermifugacao', 'antiparasitario', 'castracao'];

function Detalhe({ a }: { a: Atendimento }) {
  return (
    <span className="pilha" data-e="2">
      {a.exame && (
        <span>
          <b>{a.exame.nome}</b>
          {a.exame.metodo && <span className="ajuda"> · {a.exame.metodo}</span>}{' '}
          <span className="selo" data-cor={RESULTADO[a.exame.resultado].cor}>
            {RESULTADO[a.exame.resultado].rotulo}
          </span>
          {a.exame.resultado_detalhe && <span className="ajuda"> {a.exame.resultado_detalhe}</span>}
        </span>
      )}
      {a.tratamento && (
        <span>
          <b>{a.tratamento.medicamento}</b>
          {[a.tratamento.dose, a.tratamento.frequencia].filter(Boolean).length > 0 && (
            <span className="ajuda"> · {[a.tratamento.dose, a.tratamento.frequencia].filter(Boolean).join(' · ')}</span>
          )}{' '}
          <span className="selo" data-cor={a.tratamento.fim ? 'verde' : 'laranja'}>
            {a.tratamento.fim ? `Encerrado em ${fd(a.tratamento.fim)}` : 'Em andamento'}
          </span>
        </span>
      )}
      {a.internacao && (
        <span>
          Internação desde {fd(a.internacao.entrada)}{' '}
          <span className="selo" data-cor={a.internacao.alta ? 'verde' : 'laranja'}>
            {a.internacao.alta ? `Alta em ${fd(a.internacao.alta)}` : 'Internado'}
          </span>
        </span>
      )}
      {a.dose && (
        <span>
          <b>{a.dose.nome}</b>
          {a.dose.proxima_dose && <span className="ajuda"> · próxima em {fd(a.dose.proxima_dose)}</span>}
        </span>
      )}
      {a.diagnostico && <span>{a.diagnostico}</span>}
      {a.observacoes && <span className="ajuda">{a.observacoes}</span>}
      <span className="ajuda">
        {[a.clinica, a.veterinario, a.autor ? `registrado por ${a.autor}` : null].filter(Boolean).join(' · ')}
      </span>
    </span>
  );
}

export async function AbaProntuario({ animal, hoje, tipo }: { animal: Animal; hoje: string; tipo?: string }) {
  const filtro = FILTROS.includes(tipo as TipoAtendimento) ? (tipo as TipoAtendimento) : undefined;
  const cliente = await api();
  const [prontuario, clinicas, eu] = await Promise.all([
    chamar(
      cliente.GET('/animais/{id}/prontuario', {
        params: { path: { id: animal.id }, query: { tipo: filtro, por_pagina: 100 } },
      }),
    ),
    chamar(cliente.GET('/clinicas')),
    obterEu(),
  ]);
  const clinico = eu.ok && ['admin', 'coordenacao', 'veterinario'].includes(eu.dados.papel);

  return (
    <div className="pilha" data-e="5">
      {animal.condicao_entrada && (
        <section className="cartao pilha" data-e="2">
          <span className="rotulo">Condição na entrada</span>
          <p>{animal.condicao_entrada}</p>
        </section>
      )}

      <section className="cartao pilha">
        <div className="linha" data-separar>
          <h2>Linha do tempo</h2>
          <Link className="botao" data-tipo="texto" href={`/imprimir/${animal.id}`} target="_blank">
            Imprimir ficha clínica
          </Link>
        </div>
        <nav className="linha" aria-label="Filtrar por tipo" style={{ gap: 'var(--e-2)' }}>
          {FILTROS.map((f) => (
            <Link
              key={f || 'todos'}
              href={`/animais/${animal.id}?aba=prontuario${f ? `&tipo=${f}` : ''}`}
              className="selo"
              data-contorno={filtro === (f || undefined) ? undefined : ''}
              aria-current={filtro === (f || undefined) ? 'page' : undefined}
            >
              {f ? TIPO_ATENDIMENTO[f] : 'Todos'}
            </Link>
          ))}
        </nav>

        {!prontuario.ok ? (
          <div className="pilha">
            <p className="aviso" data-tipo="erro" role="alert">
              {prontuario.falha.mensagem}
            </p>
            <div>
              <Link className="botao" href={`/animais/${animal.id}?aba=prontuario`}>
                Tentar de novo
              </Link>
            </div>
          </div>
        ) : prontuario.dados.itens.length === 0 ? (
          <p>{filtro ? 'Nenhum registro deste tipo.' : 'Nenhum atendimento registrado.'}</p>
        ) : (
          <ol className="linha-do-tempo">
            {prontuario.dados.itens.map((a) => (
              <li key={a.id}>
                <span className="data">{fd(a.data)}</span>
                <span className="pilha" data-e="2">
                  <span className="rotulo">{TIPO_ATENDIMENTO[a.tipo]}</span>
                  <Detalhe a={a} />
                  {clinico && <AcoesItem animalId={animal.id} atendimento={a} hoje={hoje} />}
                  {!clinico && a.exame?.tem_laudo && <span className="ajuda">Laudo anexado (aberto só pela equipe clínica).</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {clinico ? (
        <section className="cartao pilha">
          <FormAtendimento animalId={animal.id} hoje={hoje} clinicas={clinicas.ok ? clinicas.dados : []} />
        </section>
      ) : (
        <p className="ajuda">
          Voluntários veem o prontuário. Consultas, exames e tratamentos são registrados pela administração, pela coordenação
          ou pelos veterinários.
        </p>
      )}
    </div>
  );
}
