import { paraAtendimento } from './prontuario.service.js';

const base = {
  id: 'a1',
  data: '2026-10-17',
  veterinario: null,
  diagnostico: null,
  observacoes: null,
  criado_em: '2026-10-17T12:00:00Z',
  clinica: null,
  autor: { nome: 'Veterinária Fictícia' },
  exames: null,
  tratamentos: null,
  internacoes: null,
  vacinacoes: null,
  vermifugacoes: null,
  antiparasitarios: null,
};

describe('paraAtendimento', () => {
  it('teste com resultado aguardando e sem laudo', () => {
    const a = paraAtendimento({
      ...base,
      tipo: 'teste',
      exames: [
        {
          nome: 'Leishmaniose (calazar)',
          metodo: 'Teste rápido',
          resultado: 'aguardando',
          resultado_detalhe: null,
          resultado_em: null,
          laudo_caminho: null,
        },
      ],
    } as never);
    expect(a.exame).toEqual({
      nome: 'Leishmaniose (calazar)',
      metodo: 'Teste rápido',
      resultado: 'aguardando',
      resultado_detalhe: null,
      resultado_em: null,
      tem_laudo: false,
    });
    expect(a.autor).toBe('Veterinária Fictícia');
  });

  it('o caminho do laudo nunca sai do back: só a indicação de que existe', () => {
    const a = paraAtendimento({
      ...base,
      tipo: 'exame',
      exames: {
        nome: 'Hemograma',
        metodo: null,
        resultado: 'alterado',
        resultado_detalhe: 'Anemia leve',
        resultado_em: '2026-10-18',
        laudo_caminho: 'x/y.pdf',
      },
    } as never);
    expect(a.exame?.tem_laudo).toBe(true);
    expect(JSON.stringify(a)).not.toContain('x/y.pdf');
  });

  it('vacina, vermífugo e antipulgas viram "dose" na linha do tempo', () => {
    const v = paraAtendimento({
      ...base,
      tipo: 'vacina',
      vacinacoes: {
        proxima_dose: '2026-11-07',
        lote: 'L1',
        vacina: { nome: 'V10' },
      },
    } as never);
    expect(v.dose).toEqual({
      nome: 'V10',
      proxima_dose: '2026-11-07',
      lote: 'L1',
    });
    const s = paraAtendimento({
      ...base,
      tipo: 'antiparasitario',
      antiparasitarios: [{ produto: 'Simparic', proxima_dose: '2027-04-17' }],
    } as never);
    expect(s.dose?.nome).toBe('Simparic');
  });

  it('tratamento em andamento e internação sem alta', () => {
    const t = paraAtendimento({
      ...base,
      tipo: 'tratamento',
      tratamentos: [
        {
          medicamento: 'Ivermectina',
          dose: null,
          frequencia: null,
          inicio: '2026-10-17',
          fim: null,
        },
      ],
    } as never);
    expect(t.tratamento?.fim).toBeNull();
    const i = paraAtendimento({
      ...base,
      tipo: 'internacao',
      internacoes: { entrada: '2026-10-17', alta: null },
    } as never);
    expect(i.internacao?.alta).toBeNull();
  });
});
