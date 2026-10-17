'use client';

import { useState, useTransition } from 'react';
import type { SecaoRelatorio } from '@/lib/tipos';
import { baixarCsv, registrarImpressao } from './acoes';

export function Exportar({
  secao,
  filtro,
  arquivo,
}: {
  secao: SecaoRelatorio;
  filtro: { de?: string; ate?: string; situacao?: string; evento?: string };
  arquivo: string;
}) {
  const [erro, setErro] = useState<string>();
  const [ocupado, iniciar] = useTransition();

  return (
    <div className="pilha nao-imprimir" data-e="2">
      <div className="linha">
        <button
          type="button"
          className="botao"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              setErro(undefined);
              const r = await baixarCsv(secao, filtro as Parameters<typeof baixarCsv>[1]);
              if (!r.csv) {
                setErro(r.erro);
                return;
              }
              const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `${arquivo}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          {ocupado ? 'Preparando…' : 'Baixar CSV'}
        </button>
        <button
          type="button"
          className="botao"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              setErro(undefined);
              const r = await registrarImpressao(secao);
              if (r.erro) {
                setErro(r.erro);
                return;
              }
              window.print();
            })
          }
        >
          Imprimir ou salvar em PDF
        </button>
      </div>
      {erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {erro}
        </p>
      )}
      <p className="ajuda">Baixar e imprimir ficam registrados na auditoria.</p>
    </div>
  );
}
