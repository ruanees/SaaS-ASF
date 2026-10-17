import type { Metadata, Viewport } from 'next';
import { Fredoka, Nunito_Sans } from 'next/font/google';
import '../styles/tokens.css';
import '../styles/components.css';

// Brandbook, seção 04: Fredoka nos títulos, nome do animal, número e
// indicadores; Nunito Sans no resto. O next/font baixa no build e serve do
// próprio domínio (a CSP só permite fontes de 'self').
const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--fonte-fredoka',
  display: 'swap',
});
const nunito = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
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
