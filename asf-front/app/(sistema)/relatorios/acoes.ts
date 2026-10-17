'use server';

import { api, chamar } from '@/lib/api';
import type { SecaoRelatorio } from '@/lib/tipos';
import type { paths } from '@/types/api';

type Filtro = NonNullable<paths['/relatorios/{secao}/csv']['get']['parameters']['query']>;

// O back registra a exportação na auditoria antes de devolver o CSV.
export async function baixarCsv(secao: SecaoRelatorio, filtro: Filtro): Promise<{ csv?: string; erro?: string }> {
  const cliente = await api();
  const r = await chamar(
    cliente.GET('/relatorios/{secao}/csv', { params: { path: { secao }, query: filtro }, parseAs: 'text' }),
  );
  return r.ok ? { csv: r.dados as unknown as string } : { erro: r.falha.mensagem };
}

export async function registrarImpressao(secao: SecaoRelatorio): Promise<{ erro?: string }> {
  const cliente = await api();
  const r = await chamar(cliente.POST('/relatorios/{secao}/impressao', { params: { path: { secao } } }));
  return r.ok ? {} : { erro: r.falha.mensagem };
}
