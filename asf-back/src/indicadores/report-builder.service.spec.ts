import { dataBr, mesPorExtenso, paraCsv } from './report-builder.service.js';

describe('paraCsv', () => {
  const colunas = [
    { chave: 'numero', rotulo: 'Número' },
    { chave: 'nome', rotulo: 'Nome' },
  ];

  it('separa por ponto e vírgula, com BOM e quebra de linha do Windows', () => {
    const csv = paraCsv({
      colunas,
      linhas: [{ numero: '2026-0001', nome: 'Rex Fictício' }],
    });
    expect(csv).toBe('﻿Número;Nome\r\n2026-0001;Rex Fictício\r\n');
  });

  it('aspas, ponto e vírgula e vazio', () => {
    const csv = paraCsv({
      colunas,
      linhas: [
        { numero: '1', nome: 'a;"b"' },
        { numero: '2', nome: null },
      ],
    });
    expect(csv.split('\r\n')[1]).toBe('1;"a;""b"""');
    expect(csv.split('\r\n')[2]).toBe('2;');
  });

  it('célula que começa como fórmula vira texto', () => {
    const csv = paraCsv({
      colunas,
      linhas: [{ numero: '=1+1', nome: '@soma' }],
    });
    expect(csv.split('\r\n')[1]).toBe("'=1+1;'@soma");
  });
});

describe('dataBr', () => {
  it('converte sem mexer no dia', () => {
    expect(dataBr('2026-01-31')).toBe('31/01/2026');
    expect(dataBr(null)).toBeNull();
  });
});

describe('mesPorExtenso', () => {
  it('mês e ano por extenso para o relatório social', () => {
    expect(mesPorExtenso('2026-03-01')).toBe('março/2026');
    expect(mesPorExtenso('2026-12-01')).toBe('dezembro/2026');
  });
});
