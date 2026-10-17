// Esqueleto com a forma do conteúdo, nunca tela branca com indicador no centro.
export default function Carregando() {
  return (
    <div className="pilha" data-e="5" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto" style={{ height: '2rem', width: '40%' }} />
      <div className="grade" data-n="3">
        <div className="esqueleto" style={{ height: '6rem' }} />
        <div className="esqueleto" style={{ height: '6rem' }} />
        <div className="esqueleto" style={{ height: '6rem' }} />
      </div>
    </div>
  );
}
