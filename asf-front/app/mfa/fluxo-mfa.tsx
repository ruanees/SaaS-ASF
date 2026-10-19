'use client';

import { useActionState } from 'react';
import { inscrever, verificar, type EstadoMfa } from './acoes';

// O Auth devolve o QR como "data:image/svg+xml;utf-8,<svg ...>" sem
// codificar; caracteres como # quebram o data URI. Recodifica.
function srcDoQr(qr: string): string {
  const virgula = qr.indexOf(',');
  if (!qr.startsWith('data:image/svg+xml') || virgula < 0) return qr;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.slice(virgula + 1))}`;
}

function CampoCodigo({ estado, fatorId }: { estado: EstadoMfa; fatorId: string }) {
  return (
    <>
      <input type="hidden" name="fator_id" value={fatorId} />
      {estado.erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {estado.erro}
        </p>
      )}
      <div className="campo">
        <label htmlFor="codigo">Código de 6 números</label>
        <input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </div>
    </>
  );
}

export function FluxoMfa({ fatorVerificado }: { fatorVerificado?: string }) {
  const [inscricao, iniciar, iniciando] = useActionState<EstadoMfa>(inscrever, {});
  const [conferencia, conferir, conferindo] = useActionState<EstadoMfa, FormData>(verificar, {});

  // Já tem autenticador: só pede o código.
  if (fatorVerificado) {
    return (
      <form action={conferir} className="pilha" noValidate>
        <p>Abra o aplicativo autenticador no celular e digite o código da Associação São Francisco.</p>
        <CampoCodigo estado={conferencia} fatorId={fatorVerificado} />
        <button className="botao" data-tipo="principal" data-largo type="submit" disabled={conferindo}>
          {conferindo ? 'Conferindo…' : 'Confirmar código'}
        </button>
      </form>
    );
  }

  // Primeira vez: configurar.
  if (!inscricao.fatorId) {
    return (
      <form action={iniciar} className="pilha">
        <p>
          Quem administra ou coordena o sistema precisa de uma segunda confirmação ao entrar. Instale um
          aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator ou outro) e
          continue.
        </p>
        {inscricao.erro && (
          <p className="aviso" data-tipo="erro" role="alert">
            {inscricao.erro}
          </p>
        )}
        <button className="botao" data-tipo="principal" data-largo type="submit" disabled={iniciando}>
          {iniciando ? 'Preparando…' : 'Configurar aplicativo autenticador'}
        </button>
      </form>
    );
  }

  return (
    <form action={conferir} className="pilha" noValidate>
      <p>No aplicativo, escolha adicionar conta e leia o QR code abaixo.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI do Auth, sem otimização */}
      <img
        src={srcDoQr(inscricao.qrCode ?? '')}
        alt="QR code para o aplicativo autenticador"
        width={200}
        height={200}
        style={{ alignSelf: 'center', background: '#fff', padding: 'var(--e-2)', borderRadius: 'var(--raio-p)' }}
      />
      <details>
        <summary>Não consigo ler o QR code</summary>
        <p className="ajuda">Digite este código no aplicativo:</p>
        <code style={{ wordBreak: 'break-all', fontFamily: 'var(--fonte-mono)' }}>{inscricao.segredo}</code>
      </details>
      <CampoCodigo estado={conferencia} fatorId={inscricao.fatorId} />
      <button className="botao" data-tipo="principal" data-largo type="submit" disabled={conferindo}>
        {conferindo ? 'Conferindo…' : 'Confirmar e entrar'}
      </button>
    </form>
  );
}
