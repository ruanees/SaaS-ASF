'use client';

import { useActionState } from 'react';
import type { Usuario, VacinaTipo } from '@/lib/tipos';
import { alterarUsuario, alterarVacinaTipo, convidar, criarClinica, criarVacinaTipo, type EstadoAcao } from '../acoes';

const PAPEIS = [
  ['voluntario', 'Voluntário(a)'],
  ['veterinario', 'Veterinário(a)'],
  ['coordenacao', 'Coordenação'],
  ['admin', 'Admin'],
] as const;

export function FormConvite() {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(convidar, {});
  return (
    <form action={acao} className="pilha" noValidate>
      {estado.erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="aviso" data-tipo="ok" role="status">
          {estado.ok}
        </p>
      )}
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="convite-nome">Nome</label>
          <input id="convite-nome" name="nome" autoComplete="off" required maxLength={120} />
        </div>
        <div className="campo">
          <label htmlFor="convite-email">E-mail</label>
          <input id="convite-email" name="email" type="email" autoComplete="off" inputMode="email" required />
        </div>
        <div className="campo">
          <label htmlFor="convite-papel">Papel</label>
          <select id="convite-papel" name="papel" defaultValue="voluntario">
            {PAPEIS.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Enviando convite…' : 'Enviar convite'}
        </button>
      </div>
    </form>
  );
}

export function LinhaUsuario({
  usuario,
  papelNome,
  desde,
  souEu,
}: {
  usuario: Usuario;
  papelNome: string;
  desde: string;
  souEu: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(alterarUsuario, {});
  const idPapel = `papel-${usuario.user_id}`;

  return (
    <tr>
      <td>
        {usuario.nome}
        {souEu && <span className="selo"> você</span>}
        {estado.erro && (
          <p className="aviso" data-tipo="erro" role="alert">
            {estado.erro}
          </p>
        )}
      </td>
      <td>
        <form action={acao} className="linha">
          <input type="hidden" name="id" value={usuario.user_id} />
          <label htmlFor={idPapel} className="visualmente-oculto">
            Papel de {usuario.nome}
          </label>
          <select id={idPapel} name="papel" defaultValue={usuario.papel} disabled={enviando}>
            {PAPEIS.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <button className="botao" type="submit" disabled={enviando} title={`Atual: ${papelNome}`}>
            Mudar papel
          </button>
        </form>
      </td>
      <td>
        <span className="selo" data-cor={usuario.ativo ? 'verde' : 'cinza'}>
          {usuario.ativo ? 'Ativo' : 'Desativado'}
        </span>
      </td>
      <td>{desde}</td>
      <td>
        <form action={acao}>
          <input type="hidden" name="id" value={usuario.user_id} />
          <input type="hidden" name="ativo" value={usuario.ativo ? 'nao' : 'sim'} />
          <button
            className="botao"
            data-tipo={usuario.ativo ? 'perigo' : undefined}
            type="submit"
            disabled={enviando}
          >
            {usuario.ativo ? 'Desativar' : 'Reativar'}
          </button>
        </form>
      </td>
    </tr>
  );
}

export function FormClinica() {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(criarClinica, {});
  return (
    <form action={acao} className="pilha" noValidate>
      {estado.erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="aviso" data-tipo="ok" role="status">
          {estado.ok}
        </p>
      )}
      <div className="linha" style={{ alignItems: 'flex-end' }}>
        <div className="campo" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="clinica-nome">Nome da clínica</label>
          <input id="clinica-nome" name="nome" maxLength={120} required autoComplete="off" />
        </div>
        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar clínica'}
        </button>
      </div>
    </form>
  );
}

export function FormVacinaTipo() {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(criarVacinaTipo, {});
  return (
    <form action={acao} className="pilha" noValidate>
      {estado.erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="aviso" data-tipo="ok" role="status">
          {estado.ok}
        </p>
      )}
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="vt-nome">Vacina</label>
          <input id="vt-nome" name="nome" maxLength={60} placeholder="V10, Antirrábica, V4..." required autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="vt-especie">Espécie</label>
          <select id="vt-especie" name="especie" defaultValue="">
            <option value="">Escolha</option>
            <option value="cao">Cão</option>
            <option value="gato">Gato</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="vt-reforco">Reforço em dias</label>
          <input id="vt-reforco" name="reforco_dias" type="number" inputMode="numeric" min={1} max={3650} placeholder="365" />
        </div>
      </div>
      <div>
        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar vacina'}
        </button>
      </div>
    </form>
  );
}

export function LinhaVacinaTipo({ vacina, especie }: { vacina: VacinaTipo; especie: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(alterarVacinaTipo, {});
  return (
    <tr>
      <td>
        <b>{vacina.nome}</b>
        {estado.erro && (
          <p className="aviso" data-tipo="erro" role="alert">
            {estado.erro}
          </p>
        )}
      </td>
      <td>{especie}</td>
      <td>
        <form action={acao} className="linha">
          <input type="hidden" name="id" value={vacina.id} />
          <label htmlFor={`reforco-${vacina.id}`} className="visualmente-oculto">
            Reforço de {vacina.nome} em dias
          </label>
          <input
            id={`reforco-${vacina.id}`}
            name="reforco_dias"
            type="number"
            min={1}
            max={3650}
            defaultValue={vacina.reforco_dias ?? ''}
            style={{ width: 90 }}
            className="campo-tabela"
          />
          <button className="botao" type="submit" disabled={enviando}>
            Salvar
          </button>
        </form>
      </td>
      <td>
        <form action={acao}>
          <input type="hidden" name="id" value={vacina.id} />
          <input type="hidden" name="ativo" value={vacina.ativo ? 'nao' : 'sim'} />
          <button className="botao" data-tipo="texto" type="submit" disabled={enviando}>
            {vacina.ativo ? 'Ativa · desativar' : 'Desativada · reativar'}
          </button>
        </form>
      </td>
    </tr>
  );
}
