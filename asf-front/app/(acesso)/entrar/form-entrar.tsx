'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { entrar, type EstadoFormulario } from '../acoes';

export function FormEntrar({ volta }: { volta: string }) {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(entrar, {});

  return (
    <form action={acao} className="pilha" noValidate>
      <input type="hidden" name="volta" value={volta} />
      {estado.erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {estado.erro}
        </p>
      )}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={estado.email}
          aria-invalid={estado.erro ? true : undefined}
        />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <button className="botao" data-tipo="principal" data-largo type="submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
      <Link href="/recuperar">Esqueci minha senha</Link>
    </form>
  );
}
