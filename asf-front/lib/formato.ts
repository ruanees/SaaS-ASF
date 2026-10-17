// Formatador central. Nenhuma tela escreve data à mão (regra 14 do plano).

const FUSO = 'America/Fortaleza';

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Data "pura" (AAAA-MM-DD) é um dia do calendário, não um instante: formata
// sem fuso, senão 2026-03-01 vira 28/02 no Brasil.
const DATA_PURA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data ISO (AAAA-MM-DD ou data-hora) para dd/mm/aaaa. Vazio vira "—". */
export function fd(iso: string | null | undefined): string {
  if (!iso) return '—';
  const pura = DATA_PURA.exec(iso);
  if (pura) return `${pura[3]}/${pura[2]}/${pura[1]}`;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '—' : formatoData.format(data);
}

/** Date do JavaScript para dd/mm/aaaa, no fuso da associação. */
export function fdDe(data: Date): string {
  return formatoData.format(data);
}

/** Hoje (AAAA-MM-DD) no fuso da associação. */
export function hojeIso(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
  return partes; // en-CA já sai como AAAA-MM-DD
}

/**
 * Idade a partir do nascimento estimado. A idade nunca é gravada (regra 3).
 * "3 semanas", "5 meses", "cerca de 2 anos" quando aproximada.
 */
export function idade(
  nascimento: string | null | undefined,
  precisao: 'exata' | 'aproximada' | null = 'aproximada',
  hoje: string = hojeIso(),
): string {
  const n = nascimento ? DATA_PURA.exec(nascimento) : null;
  const h = DATA_PURA.exec(hoje);
  if (!n || !h) return '—';

  const dias = Math.round(
    (Date.UTC(+h[1], +h[2] - 1, +h[3]) - Date.UTC(+n[1], +n[2] - 1, +n[3])) / 86_400_000,
  );
  if (dias < 0) return '—';

  let meses = (+h[1] - +n[1]) * 12 + (+h[2] - +n[2]);
  if (+h[3] < +n[3]) meses -= 1;
  const anos = Math.floor(meses / 12);
  const prefixo = precisao === 'exata' ? '' : 'cerca de ';

  if (meses < 2) {
    const semanas = Math.max(1, Math.floor(dias / 7));
    if (dias < 7) return dias === 1 ? '1 dia' : `${dias} dias`;
    return semanas === 1 ? '1 semana' : `${semanas} semanas`;
  }
  if (anos < 1) return `${prefixo}${meses} meses`;
  return `${prefixo}${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

/** Idade informada no cadastro ("2 anos", "3 meses") para data estimada. */
export function nascimentoEstimado(
  quantidade: number,
  unidade: 'dias' | 'semanas' | 'meses' | 'anos',
  hoje: string = hojeIso(),
): string {
  const h = DATA_PURA.exec(hoje);
  if (!h) throw new Error('data de hoje inválida');
  const data = new Date(Date.UTC(+h[1], +h[2] - 1, +h[3]));
  if (unidade === 'dias') data.setUTCDate(data.getUTCDate() - quantidade);
  if (unidade === 'semanas') data.setUTCDate(data.getUTCDate() - quantidade * 7);
  if (unidade === 'meses') data.setUTCMonth(data.getUTCMonth() - quantidade);
  if (unidade === 'anos') data.setUTCFullYear(data.getUTCFullYear() - quantidade);
  return data.toISOString().slice(0, 10);
}

const NOMES_PAPEL = {
  admin: 'Admin',
  coordenacao: 'Coordenação',
  veterinario: 'Veterinário(a)',
  voluntario: 'Voluntário(a)',
} as const;

export function nomePapel(papel: keyof typeof NOMES_PAPEL): string {
  return NOMES_PAPEL[papel] ?? papel;
}
