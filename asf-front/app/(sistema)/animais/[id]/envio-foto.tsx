'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { assinarFoto, registrarFoto } from '../acoes';

const LADO_MAXIMO = 1280;
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

// Refaz a imagem num canvas: redimensiona e recodifica. O arquivo novo não
// leva o EXIF da câmera, onde fica o GPS (muitas vezes a casa de quem resgatou).
// WebP quando o navegador gera; JPEG no Safari, que não gera WebP.
async function prepararFoto(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('canvas');
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close();

  const gerar = (tipo: string, qualidade: number) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, qualidade));
  const webp = await gerar('image/webp', 0.82);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await gerar('image/jpeg', 0.85);
  if (jpeg && jpeg.type === 'image/jpeg') return jpeg;
  throw new Error('formato');
}

export function EnvioFoto({ animalId, fotoUrl, especie }: { animalId: string; fotoUrl: string | null; especie: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<'parado' | 'preparando' | 'enviando'>('parado');
  const [erro, setErro] = useState<string>();
  const [previa, setPrevia] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setErro(undefined);
    try {
      setEtapa('preparando');
      const foto = await prepararFoto(arquivo);
      if (foto.size > TAMANHO_MAXIMO) throw new Error('grande');
      setPrevia(URL.createObjectURL(foto));

      setEtapa('enviando');
      const tipo = foto.type as 'image/webp' | 'image/jpeg';
      const assinada = await assinarFoto(animalId, tipo, foto.size);
      if (assinada.erro || !assinada.url || !assinada.caminho) throw new Error(assinada.erro ?? 'assinar');

      // Os bytes vão do navegador direto ao Storage (plano, seção 02).
      const resposta = await fetch(assinada.url, { method: 'PUT', headers: { 'Content-Type': tipo }, body: foto });
      if (!resposta.ok) throw new Error('envio');

      const registro = await registrarFoto(animalId, assinada.caminho);
      if (registro.erro) throw new Error(registro.erro);
      router.refresh();
    } catch (e) {
      setPrevia(null);
      const m = (e as Error).message;
      setErro(
        m === 'formato'
          ? 'Este navegador não conseguiu preparar a foto. Tente pelo Chrome.'
          : m === 'grande'
            ? 'A foto ficou maior que 5 MB. Tente outra.'
            : m === 'envio' || m === 'Failed to fetch'
              ? 'Sem conexão. A foto não foi enviada; tente de novo.'
              : m.length > 12
                ? m
                : 'Não foi possível enviar a foto. Tente de novo.',
      );
    } finally {
      setEtapa('parado');
      if (entrada.current) entrada.current.value = '';
    }
  }

  const imagem = previa ?? fotoUrl;
  return (
    <div className="pilha" data-e="2" style={{ alignItems: 'flex-start' }}>
      {imagem ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage ou prévia local
        <img src={imagem} alt="Foto do animal" className="foto-ficha" />
      ) : (
        <span className="foto-ficha" data-vazia aria-hidden="true">
          {especie}
        </span>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="visualmente-oculto"
        id={`foto-${animalId}`}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />
      <label htmlFor={`foto-${animalId}`} className="botao" aria-disabled={etapa !== 'parado'}>
        {etapa === 'preparando' ? 'Preparando foto…' : etapa === 'enviando' ? 'Enviando foto…' : imagem ? 'Trocar foto' : 'Enviar foto'}
      </label>
      {erro && (
        <p className="aviso" data-tipo="erro" role="alert" style={{ maxWidth: 260 }}>
          {erro}
        </p>
      )}
    </div>
  );
}
