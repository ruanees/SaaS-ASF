import Link from 'next/link';
import { atalhos, consulta, type Periodo } from '@/lib/periodo';

/** Atalhos de período e intervalo livre; tudo na URL (formulário GET). */
export function FiltroPeriodo({
  caminho,
  periodo,
  hoje,
  extra = {},
}: {
  caminho: string;
  periodo: Periodo;
  hoje: string;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <div className="cartao pilha nao-imprimir" data-e="3">
      <nav className="linha" aria-label="Atalhos de período" style={{ gap: 'var(--e-2)' }}>
        {atalhos(hoje).map((a) => {
          const atual = a.periodo.de === periodo.de && a.periodo.ate === periodo.ate;
          return (
            <Link
              key={a.chave}
              href={`${caminho}?${consulta(a.periodo, extra)}`}
              className="selo"
              data-contorno={atual ? undefined : ''}
              aria-current={atual ? 'page' : undefined}
            >
              {a.rotulo}
            </Link>
          );
        })}
      </nav>
      <form action={caminho} className="linha" style={{ alignItems: 'flex-end' }}>
        {Object.entries(extra).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <div className="campo">
          <label htmlFor="periodo-de">De</label>
          <input id="periodo-de" name="de" type="date" defaultValue={periodo.de} max={hoje} required />
        </div>
        <div className="campo">
          <label htmlFor="periodo-ate">Até</label>
          <input id="periodo-ate" name="ate" type="date" defaultValue={periodo.ate} max={hoje} required />
        </div>
        <button className="botao" type="submit">
          Aplicar período
        </button>
      </form>
    </div>
  );
}
