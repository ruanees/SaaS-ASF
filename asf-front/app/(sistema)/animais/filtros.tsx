'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ESPECIE, LOCAL, SEXO, SITUACAO } from '@/lib/rotulos';

// Filtros ficam na URL: dá para mandar o link de uma lista filtrada.
export function Filtros({ valores }: { valores: Record<string, string> }) {
  const router = useRouter();
  const caminho = usePathname();
  const [, iniciar] = useTransition();
  const [busca, setBusca] = useState(valores.q ?? '');
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function aplicar(mudanca: Record<string, string>) {
    const q = new URLSearchParams(valores);
    for (const [k, v] of Object.entries(mudanca)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete('pagina'); // filtro novo volta para a primeira página
    const s = q.toString();
    iniciar(() => router.replace(s ? `${caminho}?${s}` : caminho, { scroll: false }));
  }

  // A busca espera a pessoa parar de digitar.
  useEffect(() => () => clearTimeout(espera.current), []);
  function digitar(v: string) {
    setBusca(v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar({ q: v.trim() }), 400);
  }

  const seletor = (nome: string, rotulo: string, opcoes: [string, string][]) => (
    <div className="campo">
      <label htmlFor={`filtro-${nome}`}>{rotulo}</label>
      <select id={`filtro-${nome}`} value={valores[nome] ?? ''} onChange={(e) => aplicar({ [nome]: e.target.value })}>
        <option value="">Todos</option>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="cartao pilha" role="search">
      <div className="campo">
        <label htmlFor="filtro-q">Buscar por número ou nome</label>
        <input
          id="filtro-q"
          type="search"
          value={busca}
          onChange={(e) => digitar(e.target.value)}
          placeholder="2026-0042 ou Bolinha"
          autoComplete="off"
        />
      </div>
      <div className="grade" data-n="4">
        {seletor('especie', 'Espécie', Object.entries(ESPECIE))}
        {seletor('sexo', 'Sexo', Object.entries(SEXO))}
        {seletor(
          'situacao',
          'Situação',
          Object.entries(SITUACAO).map(([v, s]) => [v, s.rotulo]),
        )}
        {seletor('local', 'Local', Object.entries(LOCAL))}
      </div>
      <label className="linha" style={{ gap: 'var(--e-2)' }}>
        <input
          type="checkbox"
          checked={valores.disponivel === 'sim'}
          onChange={(e) => aplicar({ disponivel: e.target.checked ? 'sim' : '' })}
        />
        Só disponíveis para adoção
      </label>
    </div>
  );
}
