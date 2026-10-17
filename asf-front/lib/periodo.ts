// Período dos indicadores e relatórios, sempre na URL (?de=&ate=).
import { hojeIso } from './formato';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface Periodo {
  de: string;
  ate: string;
}

export function atalhos(hoje: string = hojeIso()): { chave: string; rotulo: string; periodo: Periodo }[] {
  const [a, m] = hoje.split('-').map(Number);
  const inicio12 = new Date(Date.UTC(a, m - 12, 1)).toISOString().slice(0, 10);
  return [
    { chave: 'mes', rotulo: 'Este mês', periodo: { de: `${hoje.slice(0, 7)}-01`, ate: hoje } },
    { chave: 'ano', rotulo: 'Este ano', periodo: { de: `${a}-01-01`, ate: hoje } },
    { chave: '12m', rotulo: 'Últimos 12 meses', periodo: { de: inicio12, ate: hoje } },
  ];
}

/** Lê o período da URL; inválido ou ausente vira "este ano". */
export function lerPeriodo(params: Record<string, string | string[] | undefined>, hoje: string = hojeIso()): Periodo {
  const de = typeof params.de === 'string' && DATA.test(params.de) ? params.de : undefined;
  const ate = typeof params.ate === 'string' && DATA.test(params.ate) ? params.ate : undefined;
  if (de && ate && de <= ate) return { de, ate };
  return atalhos(hoje)[1].periodo;
}

export function consulta(p: Periodo, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams({ de: p.de, ate: p.ate });
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return q.toString();
}
