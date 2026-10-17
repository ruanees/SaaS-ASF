// supabase-js devolve { data, error } em vez de lançar. Aqui o erro vira
// exceção para o FiltroErro traduzir (code do banco -> 4xx; sem code -> 503).
export function dados<T>(resultado: { data: T; error: unknown }): T {
  if (resultado.error) throw resultado.error;
  return resultado.data;
}

// Para .single() e funções que sempre devolvem uma linha.
export function um<T>(resultado: { data: T | null; error: unknown }): T {
  if (resultado.error) throw resultado.error;
  if (resultado.data === null || resultado.data === undefined) {
    throw new Error('Resposta vazia do banco');
  }
  return resultado.data;
}
