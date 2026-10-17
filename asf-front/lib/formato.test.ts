import { describe, expect, it } from 'vitest';
import { fd, fdCurta, hojeIso, idade, nascimentoEstimado, somarDias } from './formato';

describe('fd', () => {
  it('data pura não sofre fuso', () => {
    expect(fd('2026-03-01')).toBe('01/03/2026');
  });
  it('data-hora usa o fuso de Fortaleza (23h UTC ainda é o mesmo dia lá)', () => {
    expect(fd('2026-10-16T23:30:00Z')).toBe('16/10/2026');
    expect(fd('2026-10-17T02:30:00Z')).toBe('16/10/2026');
  });
  it('vazio e inválido viram travessão', () => {
    expect(fd(null)).toBe('—');
    expect(fd('lixo')).toBe('—');
  });
});

describe('hojeIso', () => {
  it('às 22h em Fortaleza ainda é o mesmo dia, mesmo com o UTC no dia seguinte', () => {
    expect(hojeIso(new Date('2026-10-17T01:00:00Z'))).toBe('2026-10-16');
  });
});

describe('idade', () => {
  const hoje = '2026-10-16';
  it.each([
    ['2026-10-14', 'aproximada', '2 dias'],
    ['2026-09-25', 'aproximada', '3 semanas'],
    ['2026-05-16', 'aproximada', 'cerca de 5 meses'],
    ['2024-10-16', 'aproximada', 'cerca de 2 anos'],
    ['2024-10-16', 'exata', '2 anos'],
    ['2025-10-17', 'exata', '11 meses'],
  ] as const)('%s (%s) -> %s', (nasc, precisao, esperado) => {
    expect(idade(nasc, precisao, hoje)).toBe(esperado);
  });
  it('sem data ou no futuro: travessão', () => {
    expect(idade(null, 'aproximada', hoje)).toBe('—');
    expect(idade('2027-01-01', 'aproximada', hoje)).toBe('—');
  });
});

describe('nascimentoEstimado', () => {
  it('"uns 2 anos" e "3 semanas" viram data estimada', () => {
    expect(nascimentoEstimado(2, 'anos', '2026-10-16')).toBe('2024-10-16');
    expect(nascimentoEstimado(3, 'semanas', '2026-10-16')).toBe('2026-09-25');
  });
  it('ida e volta com idade()', () => {
    expect(idade(nascimentoEstimado(3, 'semanas', '2026-10-16'), 'aproximada', '2026-10-16')).toBe('3 semanas');
  });
});

describe('somarDias e fdCurta', () => {
  it('reforço de 365 dias sugere a mesma data no ano seguinte', () => {
    expect(somarDias('2026-10-17', 365)).toBe('2027-10-17');
  });
  it('vira o mês e o ano', () => {
    expect(somarDias('2026-12-20', 21)).toBe('2027-01-10');
  });
  it('fdCurta para a frase de confirmação', () => {
    expect(fdCurta('2026-11-12')).toBe('12/11');
    expect(fdCurta(null)).toBe('—');
  });
});
