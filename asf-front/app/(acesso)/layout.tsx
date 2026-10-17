export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="acesso">
      <div className="cartao pilha" data-e="5">
        <p className="marca-nome">Associação São Francisco</p>
        {children}
      </div>
    </main>
  );
}
