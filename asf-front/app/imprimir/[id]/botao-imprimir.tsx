'use client';

export function BotaoImprimir() {
  return (
    <button type="button" className="botao" data-tipo="principal" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </button>
  );
}
