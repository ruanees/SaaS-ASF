import { LOCAL, SITUACAO, type Local, type Situacao } from '@/lib/rotulos';

// Selo preenchido é situação; selo de contorno é local (brandbook, seção 03).
export function SelosAnimal({
  situacao,
  local,
  disponivel,
}: {
  situacao: Situacao;
  local: Local | null;
  disponivel: boolean;
}) {
  const s = SITUACAO[situacao];
  return (
    <span className="linha" style={{ gap: 'var(--e-2)' }}>
      <span className="selo" data-cor={s.cor === 'neutro' ? undefined : s.cor}>
        {s.rotulo}
      </span>
      {local && (
        <span className="selo" data-contorno>
          {LOCAL[local]}
        </span>
      )}
      {disponivel && (
        <span className="selo" data-cor="amarelo">
          Para adoção
        </span>
      )}
    </span>
  );
}
