import { exigir, lerConfiguracao } from './configuracao.js';

describe('configuracao', () => {
  it('lê as variáveis e trata vazio como ausente', () => {
    const c = lerConfiguracao({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: '  ',
    });
    expect(c.supabaseUrl).toBe('https://x.supabase.co');
    expect(c.supabaseChavePublica).toBeUndefined();
  });

  it('exigir diz qual variável falta, sem valor nenhum', () => {
    expect(() => exigir(lerConfiguracao({}), 'supabaseUrl')).toThrow(
      'SUPABASE_URL',
    );
  });
});
