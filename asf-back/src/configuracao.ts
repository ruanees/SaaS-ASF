// Configuração lida do ambiente. Em produção vem do `wrangler.toml` (vars) e dos
// Secrets do Worker; em desenvolvimento, do `.env` / `.dev.vars`.
// Nenhuma rota devolve o valor: `/saude` só diz se existe.

export const VARIAVEIS = {
  supabaseUrl: 'SUPABASE_URL',
  supabaseChavePublica: 'SUPABASE_PUBLISHABLE_KEY',
} as const;

export type NomeConfiguracao = keyof typeof VARIAVEIS;

export type Configuracao = Record<NomeConfiguracao, string | undefined>;

export function lerConfiguracao(
  env: Record<string, string | undefined> = process.env,
): Configuracao {
  const configuracao = {} as Configuracao;
  for (const nome of Object.keys(VARIAVEIS) as NomeConfiguracao[]) {
    const valor = env[VARIAVEIS[nome]]?.trim();
    configuracao[nome] = valor ? valor : undefined;
  }
  return configuracao;
}

export function exigir(
  configuracao: Configuracao,
  nome: NomeConfiguracao,
): string {
  const valor = configuracao[nome];
  if (!valor) {
    throw new Error(`Configuração ausente: ${VARIAVEIS[nome]}`);
  }
  return valor;
}
