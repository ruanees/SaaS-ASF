import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '../styles/tokens.css';
import '../styles/components.css';

// Brandbook, seção 04: Fredoka nos títulos, nome do animal, número e
// indicadores; Nunito Sans no resto. Arquivos no próprio repositório: o build
// não depende do Google Fonts e a CSP só permite fontes de 'self'.
const fredoka = localFont({
  src: [
    { path: './fontes/fredoka-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fontes/fredoka-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--fonte-fredoka',
  display: 'swap',
});
const nunito = localFont({
  src: [
    { path: './fontes/nunito-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fontes/nunito-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fontes/nunito-sans-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--fonte-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'São Francisco', template: '%s · São Francisco' },
  description: 'Sistema interno da Associação São Francisco Defensora dos Animais',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf6ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1c140e' },
  ],
};

// Aplica o tema escolhido antes da primeira pintura, para não piscar.
const scriptTema = `try{var t=localStorage.getItem('asf-tema');if(t==='claro'||t==='escuro')document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
