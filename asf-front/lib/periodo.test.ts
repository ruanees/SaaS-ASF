import { describe, expect, it } from 'vitest';
import { atalhos, consulta, lerPeriodo } from './periodo';

describe('período', () => {
  const hoje = '2026-10-17';

  it('atalhos: este mês, este ano e últimos 12 meses (do 1º dia do mês)', () => {
    expect(atalhos(hoje).map((a) => a.periodo)).toEqual([
      { de: '2026-10-01', ate: hoje },
      { de: '2026-01-01', ate: hoje },
      { de: '2025-11-01', ate: hoje },
    ]);
  });

  it('últimos 12 meses em janeiro volta para o ano anterior', () => {
    expect(atalhos('2026-01-05')[2].periodo.de).toBe('2025-02-01');
  });

  it('lê o período da URL; inválido, invertido ou ausente vira "este ano"', () => {
    expect(lerPeriodo({ de: '2026-03-01', ate: '2026-03-31' }, hoje)).toEqual({ de: '2026-03-01', ate: '2026-03-31' });
    expect(lerPeriodo({ de: '2026-04-01', ate: '2026-03-01' }, hoje)).toEqual({ de: '2026-01-01', ate: hoje });
    expect(lerPeriodo({ de: '01/03/2026' }, hoje)).toEqual({ de: '2026-01-01', ate: hoje });
    expect(lerPeriodo({}, hoje)).toEqual({ de: '2026-01-01', ate: hoje });
  });

  it('consulta mantém o período e ignora extras vazios', () => {
    expect(consulta({ de: '2026-01-01', ate: hoje }, { secao: 'adocoes', evento: undefined })).toBe(
      'de=2026-01-01&ate=2026-10-17&secao=adocoes',
    );
  });
});
