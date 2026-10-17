import type { Metadata, Viewport } from 'next';
import '../styles/tokens.css';
import '../styles/components.css';

export const metadata: Metadata = {
  title: { default: 'Associação São Francisco', template: '%s · ASF' },
  description: 'Sistema interno da Associação São Francisco',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5f2' },
    { media: '(prefers-color-scheme: dark)', color: '#141716' },
  ],
};

// Aplica o tema escolhido antes da primeira pintura, para não piscar.
const scriptTema = `try{var t=localStorage.getItem('asf-tema');if(t==='claro'||t==='escuro')document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
