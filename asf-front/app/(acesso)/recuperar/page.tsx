'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { recuperar, type EstadoFormulario } from '../acoes';

export default function PaginaRecuperar() {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(recuperar, {});

  return (
    <>
      <h1>Recuperar senha</h1>
      {estado.ok ? (
        <p className="aviso" data-tipo="ok" role="status">
          {estado.ok}
        </p>
      ) : (
        <form action={acao} className="pilha" noValidate>
          <p>Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
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
            />
          </div>
          <button className="botao" data-tipo="principal" data-largo type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
      )}
      <Link href="/entrar">Voltar para entrar</Link>
    </>
  );
}
