import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itemAtivo, MENU, menuPara } from './menu';

// Rotas que existem em app/ (ignorando grupos entre parênteses).
function rotasExistentes(dir = 'app', prefixo = ''): Set<string> {
  const rotas = new Set<string>();
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) {
      if (nome === 'page.tsx') rotas.add(prefixo || '/');
      continue;
    }
    const segmento = /^\(.*\)$/.test(nome) ? '' : `/${nome}`;
    for (const r of rotasExistentes(caminho, prefixo + segmento)) rotas.add(r);
  }
  return rotas;
}

describe('menu', () => {
  const rotas = rotasExistentes();

  it('todo item que não é "em breve" tem tela (nada de link para 404)', () => {
    for (const item of MENU.filter((i) => !i.emBreve)) {
      expect(rotas, item.rota).toContain(item.rota);
    }
  });

  it('item "em breve" não tem tela ainda (senão deveria deixar de ser em breve)', () => {
    for (const item of MENU.filter((i) => i.emBreve)) {
      expect(rotas, item.rota).not.toContain(item.rota);
    }
  });

  it('barra do celular tem no máximo 3 itens (o 4º é "Mais")', () => {
    expect(MENU.filter((i) => i.celular).length).toBeLessThanOrEqual(3);
  });

  it('voluntário não vê Configurações', () => {
    expect(menuPara('voluntario').map((i) => i.rota)).not.toContain('/configuracoes');
    expect(menuPara('admin').map((i) => i.rota)).toContain('/configuracoes');
  });

  it('itemAtivo', () => {
    expect(itemAtivo('/', '/')).toBe(true);
    expect(itemAtivo('/', '/animais')).toBe(false);
    expect(itemAtivo('/animais', '/animais/123')).toBe(true);
    expect(itemAtivo('/animais', '/animaisx')).toBe(false);
  });
});
