const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Gráficos simples em SVG e CSS, sem biblioteca. As cores vêm dos tokens
// (variáveis CSS), então trocar o tema redesenha o gráfico sem JavaScript.
// Toda cor aparece com o nome na legenda, e os números ficam numa tabela
// escondida para leitor de tela.

export interface Barra {
  rotulo: string;
  valor: number;
  cor: string; // token CSS, ex.: 'var(--cordao)'
}

export function BarrasHorizontais({ titulo, itens }: { titulo: string; itens: Barra[] }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <ul className="barras" aria-hidden="true">
        {itens.map((i) => (
          <li key={i.rotulo}>
            <span className="barras-rotulo">{i.rotulo}</span>
            <span className="barras-trilho">
              <span className="barras-barra" style={{ width: `${(i.valor / maximo) * 100}%`, background: i.cor }} />
            </span>
            <span className="barras-valor">{i.valor}</span>
          </li>
        ))}
      </ul>
      <table className="visualmente-oculto">
        <caption>{titulo}</caption>
        <tbody>
          {itens.map((i) => (
            <tr key={i.rotulo}>
              <th scope="row">{i.rotulo}</th>
              <td>{i.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface Serie<K extends string> {
  chave: K;
  rotulo: string;
  cor: string;
}

export function ColunasMensais<K extends string>({
  titulo,
  pontos,
  series,
}: {
  titulo: string;
  pontos: ({ mes: string } & Record<K, number>)[];
  series: Serie<K>[];
}) {
  const maximo = Math.max(1, ...pontos.flatMap((p) => series.map((s) => p[s.chave])));
  const largura = 640;
  const altura = 200;
  const base = altura - 24;
  const grupo = largura / Math.max(1, pontos.length);
  const coluna = Math.min(18, (grupo - 8) / series.length);
  const linhasGuia = [0, 0.5, 1];
  const variosAnos = new Set(pontos.map((p) => p.mes.slice(0, 4))).size > 1;
  const mesCurto = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}${variosAnos ? `/${iso.slice(2, 4)}` : ''}`;

  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <ul className="legenda">
        {series.map((s) => (
          <li key={s.chave}>
            <span className="legenda-cor" style={{ background: s.cor }} aria-hidden="true" />
            {s.rotulo}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="colunas" role="img" aria-label={titulo}>
        {linhasGuia.map((g) => (
          <line key={g} x1={0} x2={largura} y1={base - g * (base - 12)} y2={base - g * (base - 12)} className="guia" />
        ))}
        {pontos.map((p, i) => {
          const x0 = i * grupo + (grupo - coluna * series.length) / 2;
          return (
            <g key={p.mes}>
              {series.map((s, j) => {
                const h = (p[s.chave] / maximo) * (base - 12);
                return <rect key={s.chave} x={x0 + j * coluna} y={base - h} width={coluna - 2} height={h} style={{ fill: s.cor }} rx={2} />;
              })}
              <text x={i * grupo + grupo / 2} y={altura - 6} textAnchor="middle" className="eixo">
                {mesCurto(p.mes)}
              </text>
            </g>
          );
        })}
        <text x={4} y={14} className="eixo">
          {maximo}
        </text>
      </svg>
      <table className="visualmente-oculto">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            {series.map((s) => (
              <th key={s.chave} scope="col">
                {s.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.mes}>
              <th scope="row">{mesCurto(p.mes)}</th>
              {series.map((s) => (
                <td key={s.chave}>{p[s.chave]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
