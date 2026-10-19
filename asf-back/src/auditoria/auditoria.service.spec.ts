import { diaSeguinte } from './auditoria.service.js';

describe('diaSeguinte', () => {
  it('fim do período inclui o dia inteiro', () => {
    expect(diaSeguinte('2026-10-19')).toBe('2026-10-20');
  });

  it('vira o mês e o ano', () => {
    expect(diaSeguinte('2026-02-28')).toBe('2026-03-01');
    expect(diaSeguinte('2026-12-31')).toBe('2027-01-01');
  });
});
