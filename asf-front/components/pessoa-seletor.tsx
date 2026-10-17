'use client';

import { useState } from 'react';
import type { PessoaResumo } from '@/lib/tipos';
import { VINCULO } from '@/lib/rotulos';

/** Escolhe uma pessoa pelo nome (só o nome: o contato nunca vem para cá). */
export function PessoaSeletor({
  id,
  rotulo,
  pessoas,
  inicial,
  nome = 'pessoa_id',
}: {
  id: string;
  rotulo: string;
  pessoas: PessoaResumo[];
  inicial?: string;
  nome?: string;
}) {
  const [filtro, setFiltro] = useState('');
  const [escolhida, setEscolhida] = useState(inicial && pessoas.some((p) => p.id === inicial) ? inicial : '');
  const termo = filtro.trim().toLocaleLowerCase('pt-BR');
  const visiveis = termo
    ? pessoas.filter((p) => p.id === escolhida || p.nome.toLocaleLowerCase('pt-BR').includes(termo))
    : pessoas;

  return (
    <div className="pilha" data-e="2">
      <div className="campo">
        <label htmlFor={`${id}-busca`}>{rotulo}</label>
        <input
          id={`${id}-busca`}
          type="search"
          placeholder="Procurar pelo nome"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          autoComplete="off"
        />
      </div>
      <select
        id={id}
        name={nome}
        aria-label={rotulo}
        value={escolhida}
        onChange={(e) => setEscolhida(e.target.value)}
        size={Math.min(6, Math.max(2, visiveis.length + 1))}
        required
      >
        <option value="">Escolha</option>
        {visiveis.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
            {p.vinculos.length > 0 ? ` (${p.vinculos.map((v) => VINCULO[v].toLowerCase()).join(', ')})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
