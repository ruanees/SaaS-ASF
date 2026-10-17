import { describe, expect, it } from 'vitest';
import { rotaPublica, voltaSegura } from './cookies';

describe('voltaSegura', () => {
  it.each([
    ['/animais?especie=cao', '/animais?especie=cao'],
    ['/', '/'],
    ['https://site-malicioso.test', '/'],
    ['//site-malicioso.test', '/'],
    ['/\\site-malicioso.test', '/'],
    ['/entrar', '/'],
    [undefined, '/'],
  ])('%s -> %s', (volta, esperado) => {
    expect(voltaSegura(volta)).toBe(esperado);
  });
});

describe('rotaPublica', () => {
  it('só acesso é público', () => {
    expect(rotaPublica('/entrar')).toBe(true);
    expect(rotaPublica('/nova-senha')).toBe(true);
    expect(rotaPublica('/')).toBe(false);
    expect(rotaPublica('/entrarx')).toBe(false);
    expect(rotaPublica('/configuracoes')).toBe(false);
  });
});
