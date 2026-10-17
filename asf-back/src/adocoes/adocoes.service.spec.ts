import { paraAdocao } from './adocoes.service.js';

const base = {
  id: 'ad1',
  data_adocao: '2026-10-10',
  data_devolucao: null,
  motivo_devolucao: null,
  termo_caminho: null,
  animal: {
    id: 'an1',
    numero: '2026-0001',
    nome: 'Nina Fictícia',
    especie: 'cao' as const,
  },
  pessoa: { id: 'p1', nome: 'Pessoa Fictícia' },
};

describe('paraAdocao', () => {
  it('o caminho do termo nunca sai do back: só a indicação de que existe', () => {
    const a = paraAdocao({ ...base, termo_caminho: 'an1/x.pdf' });
    expect(a?.tem_termo).toBe(true);
    expect(a).not.toHaveProperty('termo_caminho');
  });

  it('sem termo anexado', () => {
    expect(paraAdocao(base)?.tem_termo).toBe(false);
  });

  it('animal excluído (sumido pela RLS) não entra na lista', () => {
    expect(paraAdocao({ ...base, animal: null })).toBeNull();
  });
});
