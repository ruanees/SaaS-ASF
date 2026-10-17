import { NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { SaudeAnimalService } from './saude.service.js';

const EU = { id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d', token: 'jwt' };
const ANIMAL = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function consulta(resultado: Record<string, unknown>) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'update', 'insert'])
    q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(() => Promise.resolve(resultado));
  q.single = vi.fn(() => Promise.resolve(resultado));
  // oxlint-disable-next-line unicorn/no-thenable
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return q;
}

function servico(
  porTabela: Record<string, Record<string, unknown>>,
  rpc?: Record<string, unknown>,
) {
  const cliente = {
    from: vi.fn((tabela: string) =>
      consulta(porTabela[tabela] ?? { data: null, error: null }),
    ),
    rpc: vi.fn(() => consulta(rpc ?? { data: null, error: null })),
  };
  const supabase = { para: vi.fn(() => cliente) } as unknown as SupabaseService;
  return { service: new SaudeAnimalService(supabase), cliente };
}

const ESTADO = {
  vacinado: true,
  vacina_pendente: false,
  vacinacao_status: 'vence_em_breve',
  proxima_vacina: '2026-10-27',
  castracao_status: 'castrado',
  castracao_agendada_para: null,
  ultima_vermifugacao: null,
  proxima_vermifugacao: null,
  vermifugacao_vencida: false,
};

describe('SaudeAnimalService.daAnimal', () => {
  it('monta cartão de vacinação, vermifugação e castração (1:1 como objeto ou lista)', async () => {
    const { service } = servico({
      animal_saude: { data: ESTADO, error: null },
      atendimentos: {
        data: [
          {
            id: 'a1',
            tipo: 'vacina',
            data: '2026-10-17',
            veterinario: null,
            clinica: { nome: 'Clínica Fictícia' },
            vacinacoes: {
              lote: 'L1',
              proxima_dose: '2027-10-17',
              vacina: { nome: 'V10' },
            },
            vermifugacoes: null,
          },
          {
            id: 'a2',
            tipo: 'vermifugacao',
            data: '2026-09-01',
            veterinario: null,
            clinica: null,
            vacinacoes: [],
            vermifugacoes: [
              { produto: 'Vermífugo Fictício', proxima_dose: '2026-12-01' },
            ],
          },
        ],
        error: null,
      },
      castracoes: {
        data: [
          {
            id: 'c1',
            status: 'realizada',
            data_agendada: '2026-10-10',
            anterior_a_entrada: false,
            motivo_cancelamento: null,
            clinica: null,
            atendimento: [{ data: '2026-10-12' }],
          },
        ],
        error: null,
      },
    });
    const r = await service.daAnimal(EU, ANIMAL);
    expect(r.estado.vacinacao_status).toBe('vence_em_breve');
    expect(r.vacinacoes).toEqual([
      {
        atendimento_id: 'a1',
        vacina: 'V10',
        data: '2026-10-17',
        proxima_dose: '2027-10-17',
        lote: 'L1',
        clinica: 'Clínica Fictícia',
        veterinario: null,
      },
    ]);
    expect(r.vermifugacoes[0].produto).toBe('Vermífugo Fictício');
    expect(r.castracoes[0].data_realizada).toBe('2026-10-12');
  });

  it('animal que não existe (ou que a RLS esconde) é 404', async () => {
    const { service } = servico({ animal_saude: { data: null, error: null } });
    await expect(service.daAnimal(EU, ANIMAL)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('vacina de outra espécie: a mensagem do banco sobe para o FiltroErro', async () => {
    const erro = {
      code: 'P0001',
      message: 'A vacina V4 é para gatos, e o animal é um cão.',
    };
    const { service } = servico({}, { data: null, error: erro });
    await expect(
      service.registrarVacina(EU, ANIMAL, {
        vacina_tipo_id: ANIMAL,
        data: '2026-10-17',
      }),
    ).rejects.toEqual(erro);
  });

  it('estados em lote não derrubam a lista quando a view falha', async () => {
    const { service, cliente } = servico({
      animal_saude: { data: null, error: { message: 'x' } },
    });
    const m = await service.estados(cliente as never, [ANIMAL]);
    expect(m.size).toBe(0);
  });
});
