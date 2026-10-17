'use client';

import Link from 'next/link';
import { useActionState, useSyncExternalStore } from 'react';
import { definirSenha, type EstadoFormulario } from '../acoes';

// O link do e-mail (convite ou recuperação) volta com a sessão no fragmento
// da URL (#access_token=...&type=recovery), que nunca vai ao servidor.
// Link vencido volta com #error_code=otp_expired.
interface Fragmento {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  type?: string;
  error_code?: string;
}

const semAssinatura = () => () => {};
const lerFragmento = (): string | null => window.location.hash;
const noServidor = (): string | null => null; // o servidor não vê o fragmento

export default function PaginaNovaSenha() {
  const hash = useSyncExternalStore(semAssinatura, lerFragmento, noServidor);
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(definirSenha, {});
  const f = Object.fromEntries(new URLSearchParams((hash ?? '').replace(/^#/, ''))) as Fragmento;

  if (hash === null) {
    return <p className="esqueleto" style={{ height: '8rem' }} aria-busy="true" aria-label="Carregando" />;
  }

  if (f.error_code || !f.access_token || !f.refresh_token) {
    const expirou = f.error_code === 'otp_expired';
    return (
      <>
        <h1>{expirou ? 'Link expirado' : 'Link inválido'}</h1>
        <p className="aviso" data-tipo="erro" role="alert">
          {expirou
            ? 'Este link já expirou. Peça um novo link para criar sua senha.'
            : 'Este link não é válido. Peça um novo link para criar sua senha.'}
        </p>
        <Link className="botao" data-tipo="principal" href="/recuperar">
          Pedir novo link
        </Link>
      </>
    );
  }

  const convite = f.type === 'invite';
  return (
    <>
      <h1>{convite ? 'Criar sua senha' : 'Nova senha'}</h1>
      <form action={acao} className="pilha" noValidate>
        <input type="hidden" name="access_token" value={f.access_token} />
        <input type="hidden" name="refresh_token" value={f.refresh_token} />
        <input type="hidden" name="expires_at" value={f.expires_at ?? ''} />
        {estado.erro && (
          <p className="aviso" data-tipo="erro" role="alert">
            {estado.erro}
          </p>
        )}
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={10} required />
          <span className="ajuda">Ao menos 10 caracteres, com letras e números.</span>
        </div>
        <div className="campo">
          <label htmlFor="repeticao">Repita a senha</label>
          <input id="repeticao" name="repeticao" type="password" autoComplete="new-password" required />
        </div>
        <button className="botao" data-tipo="principal" data-largo type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : convite ? 'Criar senha e entrar' : 'Salvar nova senha'}
        </button>
      </form>
    </>
  );
}
