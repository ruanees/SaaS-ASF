import { CASTRACAO, VACINACAO, type StatusCastracao, type StatusVacinacao } from '@/lib/rotulos';

// Leishmaniose reagente: o único selo com ícone e borda (brandbook, seção 03).
// Aparece na lista e no topo da ficha, porque muda o cuidado com o animal.
export function SeloLeishmaniose() {
  return (
    <span className="selo" data-alerta>
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M8 1.5 15 14H1L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 6v3.6M8 11.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Leishmaniose reagente
    </span>
  );
}

// Selos de saúde (brandbook, seção 03). A cor nunca aparece sem o nome.
export function SelosSaude({
  vacinacao,
  castracao,
  emTratamento,
  leishmaniose,
}: {
  vacinacao: StatusVacinacao | null;
  castracao: StatusCastracao | null;
  emTratamento?: boolean | null;
  leishmaniose?: boolean | null;
}) {
  if (!vacinacao && !castracao && !emTratamento && !leishmaniose) return null;
  return (
    <span className="linha" style={{ gap: 'var(--e-2)' }}>
      {leishmaniose && <SeloLeishmaniose />}
      {emTratamento && (
        <span className="selo" data-cor="laranja">
          Em tratamento
        </span>
      )}
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
