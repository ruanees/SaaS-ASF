import Link from 'next/link';
import { SelosSaude } from '@/components/selos-saude';
import { api, chamar } from '@/lib/api';
import { fd } from '@/lib/formato';
import type { Animal } from '@/lib/tipos';
import { FormCastracao, FormVacina, FormVermifugacao } from './forms-saude';

export async function AbaSaude({ animal, hoje }: { animal: Animal; hoje: string }) {
  const cliente = await api();
  const [saude, vacinas, clinicas] = await Promise.all([
    chamar(cliente.GET('/animais/{id}/saude', { params: { path: { id: animal.id } } })),
    chamar(cliente.GET('/vacinas-tipos', { params: { query: { especie: animal.especie } } })),
    chamar(cliente.GET('/clinicas')),
  ]);

  if (!saude.ok) {
    return (
      <div className="pilha">
        <p className="aviso" data-tipo="erro" role="alert">
          {saude.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href={`/animais/${animal.id}?aba=saude`}>
            Tentar de novo
          </Link>
        </div>
      </div>
    );
  }
  const s = saude.dados;
  const listaClinicas = clinicas.ok ? clinicas.dados : [];
  const emAcolhimento = animal.situacao === 'em_acolhimento';

  return (
    <div className="pilha" data-e="5">
      <SelosSaude vacinacao={s.estado.vacinacao_status} castracao={s.estado.castracao_status} />

      <section className="cartao pilha" aria-labelledby="t-vacinas">
        <h2 id="t-vacinas">Cartão de vacinação</h2>
        {s.vacinacoes.length === 0 ? (
          <p>Nenhuma vacina registrada.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Vacina</th>
                  <th scope="col">Aplicação</th>
                  <th scope="col">Próxima dose</th>
                  <th scope="col">Lote</th>
                </tr>
              </thead>
              <tbody>
                {s.vacinacoes.map((v) => (
                  <tr key={v.atendimento_id}>
                    <td>
                      <b>{v.vacina}</b>
                      {v.clinica && <div className="ajuda">{v.clinica}</div>}
                    </td>
                    <td>{fd(v.data)}</td>
                    <td>{fd(v.proxima_dose)}</td>
                    <td>{v.lote ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <FormVacina
          animalId={animal.id}
          hoje={hoje}
          vacinas={vacinas.ok ? vacinas.dados : []}
          clinicas={listaClinicas}
        />
      </section>

      <section className="cartao pilha" aria-labelledby="t-castracao">
        <h2 id="t-castracao">Castração</h2>
        <FormCastracao
          animalId={animal.id}
          hoje={hoje}
          estado={s.estado}
          castracoes={s.castracoes}
          clinicas={listaClinicas}
          emAcolhimento={emAcolhimento}
        />
      </section>

      <section className="cartao pilha" aria-labelledby="t-verm">
        <h2 id="t-verm">Vermifugação</h2>
        {s.vermifugacoes.length === 0 ? (
          <p>Nenhuma vermifugação registrada.</p>
        ) : (
          <ul className="linha-do-tempo">
            {s.vermifugacoes.map((v) => (
              <li key={v.atendimento_id}>
                <span className="data">{fd(v.data)}</span>
                <span className="pilha" data-e="2">
                  <span>{v.produto}</span>
                  {v.proxima_dose && <span className="ajuda">Próxima dose em {fd(v.proxima_dose)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <FormVermifugacao animalId={animal.id} hoje={hoje} />
      </section>
    </div>
  );
}
