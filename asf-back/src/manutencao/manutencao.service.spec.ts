import type { SupabaseService } from '../supabase/supabase.service.js';
import { ManutencaoService, porBalde } from './manutencao.service.js';

const EU = { id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d', token: 'jwt' };

describe('porBalde', () => {
  it('agrupa os caminhos por balde', () => {
    const g = porBalde([
      { balde: 'laudos', caminho: 'a/1.pdf', criado_em: '' },
      { balde: 'fotos-animais', caminho: 'a/2.webp', criado_em: '' },
      { balde: 'laudos', caminho: 'b/3.pdf', criado_em: '' },
    ]);
    expect(g.get('laudos')).toEqual(['a/1.pdf', 'b/3.pdf']);
    expect(g.get('fotos-animais')).toEqual(['a/2.webp']);
  });
});

describe('ManutencaoService.limpar', () => {
  it('apaga balde a balde e conta pelo que sobrou (não pelo que pediu)', async () => {
    const listas = [
      {
        data: [
          { balde: 'laudos', caminho: 'a/1.pdf', criado_em: '' },
          { balde: 'termos', caminho: 'a/2.pdf', criado_em: '' },
        ],
        error: null,
      },
      {
        data: [{ balde: 'termos', caminho: 'a/2.pdf', criado_em: '' }],
        error: null,
      },
    ];
    const remove = vi.fn(() => Promise.resolve({ data: [], error: null }));
    const cliente = {
      rpc: vi.fn(() => Promise.resolve(listas.shift())),
      storage: { from: vi.fn(() => ({ remove })) },
    };
    const supabase = {
      para: vi.fn(() => cliente),
    } as unknown as SupabaseService;
    const r = await new ManutencaoService(supabase).limpar(EU);
    expect(cliente.storage.from).toHaveBeenCalledWith('laudos');
    expect(cliente.storage.from).toHaveBeenCalledWith('termos');
    expect(r).toEqual({ apagados: 1, restantes: 1 });
  });
});
