import type { Metadata } from 'next';
import Link from 'next/link';
import { api, chamar } from '@/lib/api';
import { fd } from '@/lib/formato';
import { ESPECIE, nomeDoAnimal } from '@/lib/rotulos';
import type { Pendencia } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Pendências' };

const TIPO: Record<Pendencia['tipo'], string> = {
  vacina: 'Vacina',
  vermifugacao: 'Vermifugação',
  antiparasitario: 'Antipulgas e carrapatos',
  castracao: 'Castração',
  castracao_prioridade: 'Castração',
};

const EH_CASTRACAO = (p: Pendencia) => p.tipo === 'castracao' || p.tipo === 'castracao_prioridade';

function Lista({ itens }: { itens: Pendencia[] }) {
  return (
    <ul className="lista-pendencias">
      {itens.map((p) => (
        <li key={`${p.tipo}-${p.animal_id}-${p.descricao}`}>
          <Link href={`/animais/${p.animal_id}?aba=saude`} className="cartao cartao-pendencia">
            <span className="data">{fd(p.data)}</span>
            <span className="pilha" data-e="2">
              <span>
                <b>{nomeDoAnimal(p)}</b> <span className="ajuda">· {p.numero} · {ESPECIE[p.especie]}</span>
              </span>
              <span>
                {TIPO[p.tipo]}
                {`: ${p.descricao}`}
              </span>
            </span>
            <span
              className="selo"
              data-cor={p.tipo === 'castracao_prioridade' ? undefined : p.vencida ? 'vermelho' : p.tipo === 'castracao' ? 'azul' : 'amarelo'}
            >
              {p.tipo === 'castracao_prioridade'
                ? 'Sem castração'
                : p.vencida
                  ? p.tipo === 'castracao'
                    ? 'Data passou'
                    : 'Vencida'
                  : p.tipo === 'castracao'
                    ? 'Agendada'
                    : 'Vence em breve'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Calculado no banco a cada abertura: quando a data passa, o animal aparece
// aqui sem ninguém mexer em nada.
export default async function Pendencias() {
  const cliente = await api();
  const r = await chamar(cliente.GET('/pendencias'));

  if (!r.ok) {
    return (
      <div className="pilha">
        <h1>Pendências</h1>
        <p className="aviso" data-tipo="erro" role="alert">
          {r.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href="/pendencias">
            Tentar de novo
          </Link>
        </div>
      </div>
    );
  }

  const vencidas = r.dados.filter((p) => p.vencida);
  const proximas = r.dados.filter((p) => !p.vencida && !EH_CASTRACAO(p));
  const castracoes = r.dados.filter((p) => !p.vencida && p.tipo === 'castracao');
  const prioridade = r.dados.filter((p) => p.tipo === 'castracao_prioridade');

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Pendências</h1>
        <p className="ajuda">
          Vacinas, vermífugos e antipulgas vencidos ou a vencer, castrações agendadas (inclusive com adotantes) e as fêmeas
          ainda sem castração.
        </p>
      </div>

      {r.dados.length === 0 ? (
        <div className="cartao pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="aureola" aria-hidden="true" />
          <p>Nenhuma pendência.</p>
        </div>
      ) : (
        <>
          {vencidas.length > 0 && (
            <section className="pilha" aria-labelledby="p-vencidas">
              <h2 id="p-vencidas">Atrasadas ({vencidas.length})</h2>
              <Lista itens={vencidas} />
            </section>
          )}
          {proximas.length > 0 && (
            <section className="pilha" aria-labelledby="p-proximas">
              <h2 id="p-proximas">A vencer ({proximas.length})</h2>
              <Lista itens={proximas} />
            </section>
          )}
          {prioridade.length > 0 && (
            <section className="pilha" aria-labelledby="p-prioridade">
              <h2 id="p-prioridade">Prioridade de castração: fêmeas ({prioridade.length})</h2>
              <p className="ajuda">Gatas e cadelas em acolhimento sem castração realizada nem agendada. A data é a da entrada.</p>
              <Lista itens={prioridade} />
            </section>
          )}
          {castracoes.length > 0 && (
            <section className="pilha" aria-labelledby="p-castracoes">
              <h2 id="p-castracoes">Castrações agendadas ({castracoes.length})</h2>
              <Lista itens={castracoes} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
