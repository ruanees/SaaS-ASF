import Link from 'next/link';
import { FiltroPeriodo } from '@/components/filtro-periodo';
import { BarrasHorizontais, ColunasMensais } from '@/components/graficos';
import { api, chamar, obterEu } from '@/lib/api';
import { fd, hojeIso, nomePapel } from '@/lib/formato';
import { MENU } from '@/lib/menu';
import { consulta, lerPeriodo } from '@/lib/periodo';
import type { Indicadores } from '@/lib/tipos';

type Chave = Exclude<keyof Indicadores, 'de' | 'ate'>;

// Cada cartão abre a lista com o mesmo filtro que gerou o número (Fase 5).
const ACOLHIDOS = '/animais?situacao=em_acolhimento';

function Indicador({
  rotulo,
  valor,
  href,
  extra,
}: {
  rotulo: string;
  valor: number | undefined;
  href: string;
  extra?: { texto: string; href: string };
}) {
  return (
    <div className="cartao indicador">
      <Link href={href} className="indicador-link">
        <span className="indicador-valor">{valor ?? '—'}</span>
        <span className="indicador-rotulo">{rotulo}</span>
      </Link>
      {extra && (
        <Link href={extra.href} className="ajuda">
          {extra.texto}
        </Link>
      )}
    </div>
  );
}

export default async function Painel({ searchParams }: PageProps<'/'>) {
  const eu = await obterEu();
  if (!eu.ok) return null; // o layout já tratou

  const hoje = hojeIso();
  const periodo = lerPeriodo(await searchParams, hoje);
  const cliente = await api();
  const [ind, mensal] = await Promise.all([
    chamar(cliente.GET('/indicadores', { params: { query: periodo } })),
    chamar(cliente.GET('/indicadores/mensal', { params: { query: periodo } })),
  ]);
  const n = (k: Chave) => (ind.ok ? ind.dados[k] : undefined);
  const rel = (secao: string, extra: Record<string, string> = {}) => `/relatorios?${consulta(periodo, { secao, ...extra })}`;
  const proximos = MENU.filter((i) => i.emBreve && (!i.papeis || i.papeis.includes(eu.dados.papel)));

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Olá, {eu.dados.nome.split(' ')[0]}</h1>
        <p className="ajuda">
          Você entrou como <span className="selo">{nomePapel(eu.dados.papel)}</span>
        </p>
      </div>

      {!ind.ok && (
        <p className="aviso" data-tipo="erro" role="alert">
          Não foi possível carregar os indicadores: {ind.falha.mensagem}{' '}
          <Link href={`/?${consulta(periodo)}`}>Tentar de novo</Link>
        </p>
      )}

      <section className="pilha" aria-labelledby="sob-cuidado">
        <h2 id="sob-cuidado">Sob cuidado agora</h2>
        <div className="grade-indicadores">
          <Indicador
            rotulo="Em acolhimento"
            valor={n('sob_cuidado')}
            href={ACOLHIDOS}
            extra={{ texto: `${n('total') ?? '—'} cadastrados desde sempre`, href: '/animais' }}
          />
          <Indicador rotulo="Disponíveis para adoção" valor={n('disponiveis')} href={`${ACOLHIDOS}&disponivel=sim`} />
          <Indicador rotulo="Na sede" valor={n('na_sede')} href={`${ACOLHIDOS}&local=sede`} />
          <Indicador rotulo="Em lares temporários" valor={n('em_lar_temporario')} href={`${ACOLHIDOS}&local=lar_temporario`} />
          <Indicador rotulo="Em tratamento veterinário" valor={n('em_tratamento')} href={`${ACOLHIDOS}&tratamento=sim`} />
        </div>
      </section>

      <section className="pilha" aria-labelledby="especie-sexo">
        <h2 id="especie-sexo">Espécie e sexo</h2>
        <p className="ajuda">O número grande é de quem está sob cuidado agora; embaixo, o total desde sempre.</p>
        <div className="grade-indicadores">
          <Indicador
            rotulo="Cães"
            valor={n('caes_sob_cuidado')}
            href={`${ACOLHIDOS}&especie=cao`}
            extra={{ texto: `${n('caes') ?? '—'} no total`, href: '/animais?especie=cao' }}
          />
          <Indicador
            rotulo="Gatos"
            valor={n('gatos_sob_cuidado')}
            href={`${ACOLHIDOS}&especie=gato`}
            extra={{ texto: `${n('gatos') ?? '—'} no total`, href: '/animais?especie=gato' }}
          />
          <Indicador
            rotulo="Machos"
            valor={n('machos_sob_cuidado')}
            href={`${ACOLHIDOS}&sexo=macho`}
            extra={{ texto: `${n('machos') ?? '—'} no total`, href: '/animais?sexo=macho' }}
          />
          <Indicador
            rotulo="Fêmeas"
            valor={n('femeas_sob_cuidado')}
            href={`${ACOLHIDOS}&sexo=femea`}
            extra={{ texto: `${n('femeas') ?? '—'} no total`, href: '/animais?sexo=femea' }}
          />
        </div>
      </section>

      <section className="pilha" aria-labelledby="saude">
        <h2 id="saude">Saúde de quem está sob cuidado</h2>
        <div className="grade-indicadores">
          <Indicador rotulo="Vacinados" valor={n('vacinados')} href={`${ACOLHIDOS}&vacinacao=em_dia`} />
          <Indicador rotulo="Vacinação pendente" valor={n('vacinacao_pendente')} href={`${ACOLHIDOS}&vacinacao=pendente`} />
          <Indicador rotulo="Castrados" valor={n('castrados')} href={`${ACOLHIDOS}&castracao=castrado`} />
          <Indicador rotulo="Não castrados" valor={n('nao_castrados')} href={`${ACOLHIDOS}&castracao=nao_castrado`} />
          <Indicador rotulo="Castração agendada" valor={n('castracao_agendada')} href={`${ACOLHIDOS}&castracao=agendada`} />
        </div>
      </section>

      <section className="pilha" aria-labelledby="periodo">
        <h2 id="periodo">
          No período · {fd(periodo.de)} a {fd(periodo.ate)}
        </h2>
        <FiltroPeriodo caminho="/" periodo={periodo} hoje={hoje} />
        <div className="grade-indicadores">
          <Indicador rotulo="Adoções" valor={n('adocoes')} href={rel('adocoes')} />
          <Indicador rotulo="Devoluções de adoção" valor={n('devolucoes')} href={rel('adocoes', { evento: 'devolucao' })} />
          <Indicador
            rotulo="Castrados e devolvidos à comunidade"
            valor={n('devolvidos_comunidade')}
            href={rel('movimentacoes', { situacao: 'devolvido_comunidade' })}
          />
        </div>
      </section>

      <section className="pilha" aria-labelledby="graficos">
        <h2 id="graficos">Gráficos</h2>
        <div className="grade" data-n="2">
          <div className="cartao">
            <BarrasHorizontais
              titulo="Espécie (sob cuidado)"
              itens={[
                { rotulo: 'Cães', valor: n('caes_sob_cuidado') ?? 0, cor: 'var(--cordao)' },
                { rotulo: 'Gatos', valor: n('gatos_sob_cuidado') ?? 0, cor: 'var(--caramelo)' },
              ]}
            />
          </div>
          <div className="cartao">
            <BarrasHorizontais
              titulo="Sexo (sob cuidado)"
              itens={[
                { rotulo: 'Machos', valor: n('machos_sob_cuidado') ?? 0, cor: 'var(--selo-azul-texto)' },
                { rotulo: 'Fêmeas', valor: n('femeas_sob_cuidado') ?? 0, cor: 'var(--selo-verde-texto)' },
              ]}
            />
          </div>
        </div>
        <div className="cartao">
          {mensal.ok ? (
            <ColunasMensais
              titulo="Entradas e adoções por mês"
              pontos={mensal.dados}
              series={[
                { chave: 'entradas', rotulo: 'Entradas', cor: 'var(--cordao)' },
                { chave: 'adocoes', rotulo: 'Adoções', cor: 'var(--selo-verde-texto)' },
                { chave: 'devolvidos_comunidade', rotulo: 'Devolvidos à comunidade', cor: 'var(--selo-azul-texto)' },
              ]}
            />
          ) : (
            <p className="aviso" data-tipo="erro" role="alert">
              {mensal.falha.mensagem}
            </p>
          )}
        </div>
      </section>

      {proximos.length > 0 && (
        <section className="pilha" aria-labelledby="em-breve">
          <h2 id="em-breve">Em construção</h2>
          <div className="grade" data-n="3">
            {proximos.map((item) => (
              <div key={item.rota} className="cartao pilha" data-apagado data-e="2">
                <div className="linha" data-separar>
                  <strong>{item.rotulo}</strong>
                  <span className="selo">em breve</span>
                </div>
                <span className="ajuda">Previsto para a fase {item.fase}.</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
