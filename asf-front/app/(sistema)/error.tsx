'use client';

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pilha">
      <h1>Algo deu errado</h1>
      <p className="aviso" data-tipo="erro" role="alert">
        Não foi possível mostrar esta tela. Tente de novo; se continuar, avise a coordenação.
      </p>
      <div>
        <button className="botao" data-tipo="principal" type="button" onClick={reset}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
