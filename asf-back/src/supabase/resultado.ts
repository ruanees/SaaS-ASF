// supabase-js devolve { data, error } em vez de lançar. Aqui o erro vira
// exceção para o FiltroErro traduzir (code do banco -> 4xx; sem code -> 503).
export function dados<T>(resultado: { data: T; error: unknown }): T {
  if (resultado.error) throw resultado.error;
  return resultado.data;
}
