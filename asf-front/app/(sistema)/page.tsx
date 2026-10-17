import { obterEu } from '@/lib/api';
import { nomePapel } from '@/lib/formato';
import { MENU } from '@/lib/menu';

// Na Fase 0 a 4 o painel mostra atalhos; os indicadores chegam na Fase 5.
export default async function Painel() {
  const eu = await obterEu();
  if (!eu.ok) return null; // o layout já tratou

  const proximos = MENU.filter((i) => i.emBreve && (!i.papeis || i.papeis.includes(eu.dados.papel)));

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <h1>Olá, {eu.dados.nome.split(' ')[0]}</h1>
        <p className="ajuda">
          Você entrou como <span className="selo">{nomePapel(eu.dados.papel)}</span>
        </p>
      </div>
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
    </div>
  );
}
