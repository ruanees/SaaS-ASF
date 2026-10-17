import { CabecalhoAcesso } from '@/components/marca';

// Telas de acesso: fundo Creme, selo completo (brandbook, seção 02).
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="acesso">
      <div className="cartao pilha" data-e="5">
        <CabecalhoAcesso />
        {children}
      </div>
    </main>
  );
}
