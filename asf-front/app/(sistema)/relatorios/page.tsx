import type { Metadata } from 'next';
import Link from 'next/link';
import { FiltroPeriodo } from '@/components/filtro-periodo';
import { api, chamar } from '@/lib/api';
import { fd, hojeIso } from '@/lib/formato';
import { consulta, lerPeriodo } from '@/lib/periodo';
import { SITUACAO, type Situacao } from '@/lib/rotulos';
import type { SecaoRelatorio } from '@/lib/tipos';
import { Exportar } from './exportar';

export const metadata: Metadata = { title: 'Relatórios' };

const SECOES: { chave: SecaoRelatorio; rotulo: string; periodo: boolean }[] = [
  { chave: 'animais', rotulo: 'Animais por situação', periodo: false },
  { chave: 'vacinacao', rotulo: 'Vacinação', periodo: false },
  { chave: 'castracao', rotulo: 'Castração', periodo: false },
  { chave: 'adocoes', rotulo: 'Adoções', periodo: true },
  { chave: 'movimentacoes', rotulo: 'Movimentações', periodo: true },
];

export default async function Relatorios({ searchParams }: PageProps<'/relatorios'>) {
  const sp = await searchParams;
  const hoje = hojeIso();
  const secao = SECOES.find((s) => s.chave === sp.secao) ?? SECOES[0];
  const periodo = lerPeriodo(sp, hoje);
  const situacao =
    typeof sp.situacao === 'string' && sp.situacao in SITUACAO && (secao.chave === 'animais' || secao.chave === 'movimentacoes')
      ? (sp.situacao as Situacao)
      : undefined;
  const evento = secao.chave === 'adocoes' && sp.evento === 'devolucao' ? 'devolucao' : undefined;
  const filtro = {
    ...(secao.periodo ? periodo : {}),
    situacao,
    evento,
  } as { de?: string; ate?: string; situacao?: Situacao; evento?: 'devolucao' };

  const cliente = await api();
  const r = await chamar(cliente.GET('/relatorios/{secao}', { params: { path: { secao: secao.chave }, query: filtro } }));
  const extra = { secao: secao.chave, situacao, evento };
  const linkSecao = (s: SecaoRelatorio) => `/relatorios?${consulta(periodo, { secao: s })}`;

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Relatórios</h1>
        <p className="ajuda nao-imprimir">
          Os relatórios usam as mesmas regras do painel e não levam dado pessoal (nome de adotante, contato).
        </p>
      </div>

      <nav className="abas nao-imprimir" aria-label="Relatórios">
        {SECOES.map((s) => (
          <Link key={s.chave} className="aba" href={linkSecao(s.chave)} aria-current={s.chave === secao.chave ? 'page' : undefined}>
            {s.rotulo}
          </Link>
        ))}
      </nav>

      {secao.periodo && <FiltroPeriodo caminho="/relatorios" periodo={periodo} hoje={hoje} extra={extra} />}

      {(secao.chave === 'animais' || secao.chave === 'movimentacoes' || secao.chave === 'adocoes') && (
        <form action="/relatorios" className="linha nao-imprimir" style={{ alignItems: 'flex-end' }}>
          <input type="hidden" name="secao" value={secao.chave} />
          {secao.periodo && (
            <>
              <input type="hidden" name="de" value={periodo.de} />
              <input type="hidden" name="ate" value={periodo.ate} />
            </>
          )}
          {secao.chave === 'adocoes' ? (
            <div className="campo">
              <label htmlFor="r-evento">Contar pela data da</label>
              <select id="r-evento" name="evento" defaultValue={evento ?? ''}>
                <option value="">Adoção</option>
                <option value="devolucao">Devolução</option>
              </select>
            </div>
          ) : (
            <div className="campo">
              <label htmlFor="r-situacao">Situação</label>
              <select id="r-situacao" name="situacao" defaultValue={situacao ?? ''}>
                <option value="">Todas</option>
                {Object.entries(SITUACAO).map(([v, s]) => (
                  <option key={v} value={v}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="botao" type="submit">
            Filtrar
          </button>
        </form>
      )}

      {!r.ok ? (
        <div className="pilha">
          <p className="aviso" data-tipo="erro" role="alert">
            {r.falha.mensagem}
          </p>
          <div>
            <Link className="botao" href={`/relatorios?${consulta(periodo, extra)}`}>
              Tentar de novo
            </Link>
          </div>
        </div>
      ) : (
        <section className="cartao pilha relatorio">
          <div className="pilha" data-e="2">
            <h2>{r.dados.titulo}</h2>
            <p className="ajuda">
              {r.dados.descricao}
              {r.dados.de && r.dados.ate && ` Período: ${fd(r.dados.de)} a ${fd(r.dados.ate)}.`} Emitido em {fd(hoje)}.
            </p>
          </div>
          <div className="grade-indicadores">
            {r.dados.quadros.map((q) => (
              <div key={q.rotulo} className="cartao indicador" data-pequeno>
                <span className="indicador-valor">{q.valor}</span>
                <span className="indicador-rotulo">{q.rotulo}</span>
              </div>
            ))}
          </div>
          <Exportar secao={secao.chave} filtro={filtro} arquivo={`relatorio-${secao.chave}-${hoje}`} />
          {r.dados.linhas.length === 0 ? (
            <p>Nenhum dado {secao.periodo ? 'no período' : 'para mostrar'}.</p>
          ) : (
            <div className="rolagem-tabela">
              <table className="tabela-impressao">
                <thead>
                  <tr>
                    {r.dados.colunas.map((c) => (
                      <th key={c.chave} scope="col">
                        {c.rotulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.dados.linhas.map((l, i) => (
                    <tr key={i}>
                      {r.dados.colunas.map((c) => (
                        <td key={c.chave}>{l[c.chave] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
