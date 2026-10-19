import type { Metadata } from 'next';
import Link from 'next/link';
import { FiltroPeriodo } from '@/components/filtro-periodo';
import { api, chamar, obterEu } from '@/lib/api';
import { fdh, hojeIso } from '@/lib/formato';
import { consulta, lerPeriodo } from '@/lib/periodo';
import type { Esquemas } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Auditoria' };

type Registro = Esquemas['RegistroAuditoriaDto'];
type Grupo = 'acessos' | 'exportacoes' | 'alteracoes';

const GRUPOS: { chave: Grupo | ''; rotulo: string }[] = [
  { chave: '', rotulo: 'Tudo' },
  { chave: 'acessos', rotulo: 'Acesso a contato' },
  { chave: 'exportacoes', rotulo: 'Exportações' },
  { chave: 'alteracoes', rotulo: 'Alterações' },
];

const TABELA: Record<string, string> = {
  animais: 'animal',
  animal_fotos: 'foto de animal',
  movimentacoes: 'movimentação',
  atendimentos: 'atendimento',
  vacinacoes: 'vacina',
  vermifugacoes: 'vermífugo',
  antiparasitarios: 'antipulgas',
  castracoes: 'castração',
  exames: 'exame',
  tratamentos: 'tratamento',
  internacoes: 'internação',
  pessoas: 'pessoa',
  pessoas_contato: 'contato de pessoa',
  adocoes: 'adoção',
  usuarios: 'usuário',
  configuracoes: 'configurações',
  clinicas: 'clínica',
  vacinas_tipos: 'vacina do catálogo',
  numeracao: 'numeração',
};

const RELATORIO: Record<string, string> = {
  relatorio_animais: 'animais por situação',
  relatorio_vacinacao: 'vacinação',
  relatorio_castracao: 'castração',
  relatorio_adocoes: 'adoções',
  relatorio_movimentacoes: 'movimentações',
};

function descrever(r: Registro): string {
  if (r.operacao === 'leitura_sensivel') return 'Abriu o contato de uma pessoa';
  if (r.operacao === 'exportacao') {
    if (r.tabela === 'pessoas') return 'Exportou os dados de uma pessoa (pedido do titular)';
    return `Exportou o relatório ${RELATORIO[r.tabela] ?? r.tabela}`;
  }
  const o = TABELA[r.tabela] ?? r.tabela;
  if (r.operacao === 'insert') return `Incluiu ${o}`;
  if (r.operacao === 'delete') return `Apagou ${o}`;
  const campos = (r.campos_alterados ?? []).join(', ');
  return `Alterou ${o}${campos ? ` (${campos})` : ''}`;
}

function linkDo(r: Registro): string | null {
  if (!r.registro_id) return null;
  if (r.tabela === 'animais') return `/animais/${r.registro_id}`;
  if (r.tabela === 'pessoas' || r.tabela === 'pessoas_contato') return `/pessoas/${r.registro_id}`;
  return null;
}

export default async function Auditoria({ searchParams }: PageProps<'/auditoria'>) {
  const sp = await searchParams;
  const eu = await obterEu();
  if (eu.ok && eu.dados.papel !== 'admin') {
    return (
      <div className="pilha">
        <h1>Auditoria</h1>
        <p>Só a administração vê a auditoria.</p>
      </div>
    );
  }

  const hoje = hojeIso();
  const periodo = lerPeriodo(sp, hoje);
  const grupo = GRUPOS.find((g) => g.chave && g.chave === sp.grupo)?.chave || undefined;
  const pagina = Math.max(1, Number(typeof sp.pagina === 'string' ? sp.pagina : 1) || 1);
  const cliente = await api();
  const r = await chamar(
    cliente.GET('/auditoria', { params: { query: { ...periodo, grupo: grupo as Grupo | undefined, pagina, por_pagina: 50 } } }),
  );
  const link = (extra: Record<string, string | undefined>) => `/auditoria?${consulta(periodo, { grupo, ...extra })}`;

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Auditoria</h1>
        <p className="ajuda">
          Quem abriu contato de pessoa, quem exportou e o que mudou. A auditoria guarda o nome dos campos, nunca os valores.
        </p>
      </div>

      <nav className="linha" aria-label="Tipo de registro" style={{ gap: 'var(--e-2)' }}>
        {GRUPOS.map((g) => (
          <Link
            key={g.chave || 'tudo'}
            href={`/auditoria?${consulta(periodo, { grupo: g.chave || undefined })}`}
            className="selo"
            data-contorno={(grupo ?? '') === g.chave ? undefined : ''}
            aria-current={(grupo ?? '') === g.chave ? 'page' : undefined}
          >
            {g.rotulo}
          </Link>
        ))}
      </nav>

      <FiltroPeriodo caminho="/auditoria" periodo={periodo} hoje={hoje} extra={{ grupo }} />

      {!r.ok ? (
        <div className="pilha">
          <p className="aviso" data-tipo="erro" role="alert">
            {r.falha.mensagem}
          </p>
          <div>
            <Link className="botao" href={link({ pagina: pagina > 1 ? String(pagina) : undefined })}>
              Tentar de novo
            </Link>
          </div>
        </div>
      ) : r.dados.itens.length === 0 ? (
        <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="aureola" aria-hidden="true" />
          <p>Nenhum registro no período.</p>
        </div>
      ) : (
        <section className="cartao pilha">
          <p className="ajuda">
            {r.dados.total} {r.dados.total === 1 ? 'registro' : 'registros'}
          </p>
          <div className="rolagem-tabela">
            <table className="tabela-impressao">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem</th>
                  <th scope="col">O quê</th>
                </tr>
              </thead>
              <tbody>
                {r.dados.itens.map((i) => {
                  const href = linkDo(i);
                  return (
                    <tr key={i.id}>
                      <td>{fdh(i.em)}</td>
                      <td>{i.usuario ?? 'Sistema'}</td>
                      <td>{href ? <Link href={href}>{descrever(i)}</Link> : descrever(i)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {r.dados.total > r.dados.por_pagina && (
            <nav className="linha" data-separar aria-label="Páginas">
              {pagina > 1 ? (
                <Link className="botao" href={link({ pagina: String(pagina - 1) })}>
                  Página anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="ajuda">
                Página {pagina} de {Math.ceil(r.dados.total / r.dados.por_pagina)}
              </span>
              {pagina * r.dados.por_pagina < r.dados.total ? (
                <Link className="botao" href={link({ pagina: String(pagina + 1) })}>
                  Próxima página
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
