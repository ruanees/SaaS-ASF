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
  castracao: 'Castração',
};

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
                {p.tipo !== 'castracao' && `: ${p.descricao}`}
              </span>
            </span>
            <span className="selo" data-cor={p.vencida ? 'vermelho' : p.tipo === 'castracao' ? 'azul' : 'amarelo'}>
              {p.vencida ? (p.tipo === 'castracao' ? 'Data passou' : 'Vencida') : p.tipo === 'castracao' ? 'Agendada' : 'Vence em breve'}
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
  const proximas = r.dados.filter((p) => !p.vencida && p.tipo !== 'castracao');
  const castracoes = r.dados.filter((p) => !p.vencida && p.tipo === 'castracao');

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Pendências</h1>
        <p className="ajuda">Vacinas e vermífugos vencidos ou a vencer, e castrações agendadas, dos animais em acolhimento.</p>
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
