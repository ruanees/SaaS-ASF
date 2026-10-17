import { CASTRACAO, VACINACAO, type StatusCastracao, type StatusVacinacao } from '@/lib/rotulos';

// Selos de saúde (brandbook, seção 03). A cor nunca aparece sem o nome.
export function SelosSaude({
  vacinacao,
  castracao,
}: {
  vacinacao: StatusVacinacao | null;
  castracao: StatusCastracao | null;
}) {
  if (!vacinacao && !castracao) return null;
  return (
    <span className="linha" style={{ gap: 'var(--e-2)' }}>
      {vacinacao && (
        <span className="selo" data-cor={VACINACAO[vacinacao].cor}>
          {VACINACAO[vacinacao].rotulo}
        </span>
      )}
      {castracao && (
        <span className="selo" data-cor={CASTRACAO[castracao].cor}>
          {CASTRACAO[castracao].rotulo}
        </span>
      )}
    </span>
  );
}
