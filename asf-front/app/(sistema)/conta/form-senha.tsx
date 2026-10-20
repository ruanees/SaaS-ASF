'use client';

import { useActionState } from 'react';
import { trocarMinhaSenha, type EstadoAcao } from '../acoes';

// Os campos de senha não ficam salvos em lugar nenhum; o React limpa o
// formulário depois de cada envio.
export function FormSenha() {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(trocarMinhaSenha, {});
  return (
    <form action={acao} className="pilha" style={{ maxWidth: 420 }}>
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
      <div className="campo">
        <label htmlFor="s-atual">Senha atual</label>
        <input id="s-atual" name="atual" type="password" autoComplete="current-password" required />
        <span className="ajuda">Se você recebeu uma senha provisória, é ela.</span>
      </div>
      <div className="campo">
        <label htmlFor="s-nova">Senha nova</label>
        <input id="s-nova" name="senha" type="password" autoComplete="new-password" minLength={10} required />
        <span className="ajuda">Ao menos 10 caracteres, com letras e números.</span>
      </div>
      <div className="campo">
        <label htmlFor="s-repeticao">Repita a senha nova</label>
        <input id="s-repeticao" name="repeticao" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <div>
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Trocando…' : 'Trocar senha'}
        </button>
      </div>
    </form>
  );
}
