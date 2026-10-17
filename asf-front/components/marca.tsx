// Assinaturas da marca (brandbook, seção 02). O selo não se redesenha nem se
// recorta: sempre a imagem inteira, sem contorno nem sombra.
/* eslint-disable @next/next/no-img-element -- imagens estáticas pequenas, já no tamanho certo */

/** Selo completo: tela de entrar. Mínimo 120 px para o anel ser legível. */
export function SeloCompleto() {
  return (
    <img
      className="selo-completo"
      src="/marca/selo-288.png"
      width={120}
      height={120}
      alt="Selo da Associação São Francisco Defensora dos Animais, Granja-CE"
    />
  );
}

/** Assinatura horizontal: selo reduzido + nome em Fredoka (menu, relatórios). */
export function Assinatura({ subtitulo = true }: { subtitulo?: boolean }) {
  return (
    <span className="assinatura">
      <img src="/marca/selo-96.png" width={40} height={40} alt="" />
      <span>
        <strong>São Francisco</strong>
        {subtitulo && <span>Defensora dos Animais</span>}
      </span>
    </span>
  );
}

/** Cabeçalho das telas de acesso: selo completo e lema. */
export function CabecalhoAcesso() {
  return (
    <div className="acesso-cabecalho">
      <SeloCompleto />
      <p className="lema">Cada animal tem uma história.</p>
    </div>
  );
}
