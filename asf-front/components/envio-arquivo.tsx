'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type Tipo = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
const TIPOS: Tipo[] = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const SEM_CONEXAO = 'Sem conexão. O arquivo não foi enviado; tente de novo.';

// Envio de arquivo (laudo, termo): pede URL assinada ao back, manda os bytes
// direto ao Storage e avisa o back que terminou. Abrir pede uma URL de 5 min.
export function EnvioArquivo({
  id,
  rotulo,
  existe,
  assinar,
  registrar,
  abrir,
}: {
  id: string;
  rotulo: string;
  existe: boolean;
  assinar: (tipo: Tipo, tamanho: number) => Promise<{ caminho?: string; url?: string; erro?: string }>;
  registrar: (caminho: string) => Promise<{ erro?: string }>;
  abrir: () => Promise<{ url?: string; erro?: string }>;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'abrindo'>('parado');
  const [erro, setErro] = useState<string>();

  async function enviar(arquivo: File) {
    setErro(undefined);
    const tipo = arquivo.type as Tipo;
    if (!TIPOS.includes(tipo)) {
      setErro('O arquivo precisa ser PDF ou imagem.');
      return;
    }
    setEstado('enviando');
    try {
      const assinada = await assinar(tipo, arquivo.size);
      if (assinada.erro || !assinada.url || !assinada.caminho) throw new Error(assinada.erro ?? 'Não foi possível enviar.');
      const r = await fetch(assinada.url, { method: 'PUT', headers: { 'Content-Type': tipo }, body: arquivo });
      if (!r.ok) throw new Error(SEM_CONEXAO);
      const registro = await registrar(assinada.caminho);
      if (registro.erro) throw new Error(registro.erro);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message === 'Failed to fetch' ? SEM_CONEXAO : (e as Error).message);
    } finally {
      setEstado('parado');
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function verArquivo() {
    setErro(undefined);
    setEstado('abrindo');
    const r = await abrir();
    setEstado('parado');
    if (r.url) window.open(r.url, '_blank', 'noopener');
    else setErro(r.erro);
  }

  return (
    <span className="linha" style={{ gap: 'var(--e-2)' }}>
      {existe && (
        <button type="button" className="botao" data-tipo="texto" onClick={verArquivo} disabled={estado !== 'parado'}>
          {estado === 'abrindo' ? 'Abrindo…' : `Abrir ${rotulo}`}
        </button>
      )}
      <input
        ref={entrada}
        id={`arquivo-${id}`}
        type="file"
        accept="application/pdf,image/*"
        className="visualmente-oculto"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />
      <label htmlFor={`arquivo-${id}`} className="botao" data-tipo="texto" aria-disabled={estado !== 'parado'}>
        {estado === 'enviando' ? 'Enviando…' : existe ? `Trocar ${rotulo}` : `Anexar ${rotulo}`}
      </label>
      {erro && (
        <span className="aviso" data-tipo="erro" role="alert">
          {erro}
        </span>
      )}
    </span>
  );
}
