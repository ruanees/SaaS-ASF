'use client';

import { useSyncExternalStore } from 'react';

type Tema = 'sistema' | 'claro' | 'escuro';
const ORDEM: Tema[] = ['sistema', 'claro', 'escuro'];
const ROTULO: Record<Tema, string> = { sistema: 'Tema do sistema', claro: 'Tema claro', escuro: 'Tema escuro' };

const ouvintes = new Set<() => void>();
function lerTema(): Tema {
  const t = document.documentElement.dataset.tema;
  return t === 'claro' || t === 'escuro' ? t : 'sistema';
}

function aplicar(tema: Tema) {
  const raiz = document.documentElement;
  try {
    if (tema === 'sistema') localStorage.removeItem('asf-tema');
    else localStorage.setItem('asf-tema', tema);
  } catch {
    // navegador sem armazenamento: o tema vale só nesta página
  }
  if (tema === 'sistema') delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
  ouvintes.forEach((o) => o());
}

export function SeletorTema() {
  const tema = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    lerTema,
    () => 'sistema' as Tema,
  );
  const proximo = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length];
  return (
    <button
      type="button"
      className="botao"
      data-tipo="texto"
      onClick={(e) => {
        e.stopPropagation();
        aplicar(proximo);
      }}
      title={`Mudar para: ${ROTULO[proximo].toLowerCase()}`}
    >
      {ROTULO[tema]}
    </button>
  );
}
