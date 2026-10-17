import { NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AnimaisService, limparBusca } from './animais.service.js';

const EU = { id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d', token: 'jwt' };
const ANIMAL = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('limparBusca', () => {
  it.each([
    ['2026-0042', '2026-0042'],
    ['  Bolinha  ', 'Bolinha'],
    ['João', 'João'],
    ['a,b)or(numero', 'a b or numero'],
    ['%_*', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('%j -> %j', (entrada, esperado) => {
    expect(limparBusca(entrada)).toBe(esperado);
  });
});

// Cadeia do supabase-js: cada método devolve a própria consulta.
function consulta(resultado: Record<string, unknown>) {
  const q: Record<string, unknown> = {};
  for (const m of [
    'select',
    'eq',
    'or',
    'order',
    'range',
    'update',
    'insert',
  ]) {
    q[m] = vi.fn(() => q);
  }
  q.maybeSingle = vi.fn(() => Promise.resolve(resultado));
  q.single = vi.fn(() => Promise.resolve(resultado));
  // oxlint-disable-next-line unicorn/no-thenable
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return q;
}

function servico(opcoes: {
  from?: Record<string, unknown>[];
  rpc?: Record<string, unknown>[];
  urls?: { data: unknown; error: unknown };
}) {
  const froms = [...(opcoes.from ?? [])];
  const rpcs = [...(opcoes.rpc ?? [])];
  const consultas: ReturnType<typeof consulta>[] = [];
  const cliente = {
    from: vi.fn(() => {
      const c = consulta(froms.shift() ?? { data: null, error: null });
      consultas.push(c);
      return c;
    }),
    rpc: vi.fn(() => consulta(rpcs.shift() ?? { data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: vi.fn(() =>
          Promise.resolve(opcoes.urls ?? { data: [], error: null }),
        ),
        createSignedUploadUrl: vi.fn((caminho: string) =>
          Promise.resolve({
            data: {
              signedUrl: `https://exemplo.test/upload/${caminho}?token=t`,
            },
            error: null,
          }),
        ),
      })),
    },
  };
  const supabase = { para: vi.fn(() => cliente) } as unknown as SupabaseService;
  return { service: new AnimaisService(supabase), cliente, consultas };
}

const linha = (extra: Record<string, unknown> = {}) => ({
  id: ANIMAL,
  numero: '2026-0042',
  nome: null,
  especie: 'gato',
  sexo: 'nao_identificado',
  nascimento_estimado: null,
  idade_precisao: null,
  porte: null,
  situacao: 'em_acolhimento',
  local: 'sede',
  disponivel_adocao: false,
  data_entrada: '2026-10-01',
  animal_fotos: [],
  ...extra,
});

describe('AnimaisService.listar', () => {
  it('aplica filtros, pagina e junta a URL assinada da foto principal', async () => {
    const caminho = `${ANIMAL}/foto.webp`;
    const { service, consultas } = servico({
      from: [
        {
          data: [linha({ animal_fotos: [{ caminho }] })],
          error: null,
          count: 41,
        },
      ],
      urls: {
        data: [{ path: caminho, signedUrl: 'https://assinada', error: null }],
        error: null,
      },
    });
    const r = await service.listar(EU, {
      especie: 'gato',
      disponivel: 'nao',
      q: '2026-00',
      pagina: 3,
      por_pagina: 20,
    });
    expect(r.total).toBe(41);
    expect(r.itens[0].foto_url).toBe('https://assinada');
    expect(r.itens[0].nome).toBeNull(); // sem nome: a tela mostra o número
    const q = consultas[0];
    expect(q.eq).toHaveBeenCalledWith('especie', 'gato');
    expect(q.eq).toHaveBeenCalledWith('disponivel_adocao', false);
    expect(q.or).toHaveBeenCalledWith(
      'numero.ilike.%2026-00%,nome.ilike.%2026-00%',
    );
    expect(q.range).toHaveBeenCalledWith(40, 59);
  });

  it('falha ao assinar fotos não derruba a lista', async () => {
    const { service } = servico({
      from: [
        {
          data: [linha({ animal_fotos: [{ caminho: 'x' }] })],
          error: null,
          count: 1,
        },
      ],
      urls: { data: null, error: { message: 'fora do ar' } },
    });
    const r = await service.listar(EU, {});
    expect(r.itens[0].foto_url).toBeNull();
  });
});

describe('AnimaisService', () => {
  it('ficha de animal que não existe (ou que a RLS esconde) é 404', async () => {
    const { service } = servico({ from: [{ data: null, error: null }] });
    await expect(service.buscar(EU, ANIMAL)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('JPEG (Safari) recebe extensão .jpg', async () => {
    const { service } = servico({
      from: [{ data: { id: ANIMAL }, error: null }],
    });
    const r = await service.assinarFoto(EU, ANIMAL, 'image/jpeg');
    expect(r.caminho).toMatch(/.jpg$/);
  });

  it('assinar foto decide o caminho no servidor, dentro da pasta do animal', async () => {
    const { service } = servico({
      from: [{ data: { id: ANIMAL }, error: null }],
    });
    const r = await service.assinarFoto(EU, ANIMAL, 'image/webp');
    expect(r.caminho).toMatch(new RegExp(`^${ANIMAL}/[0-9a-f-]{36}\\.webp$`));
    expect(r.url).toContain(r.caminho);
  });

  it('limpar o nascimento limpa também a precisão (check no banco)', async () => {
    const { service, consultas } = servico({
      from: [
        { data: { id: ANIMAL }, error: null },
        { data: linha(), error: null },
      ],
    });
    await service.alterar(EU, ANIMAL, { nascimento_estimado: null });
    expect(consultas[0].update).toHaveBeenCalledWith({
      nascimento_estimado: null,
      idade_precisao: null,
    });
  });

  it('regra de negócio do banco (raise exception) sobe com o código para o FiltroErro', async () => {
    const erro = {
      code: 'P0001',
      message: 'Animal em óbito não pode ser movido.',
    };
    const { service } = servico({ rpc: [{ data: null, error: erro }] });
    await expect(
      service.mover(EU, ANIMAL, {
        situacao: 'em_acolhimento',
        local: 'sede',
        disponivel_adocao: false,
        data: '2026-10-17',
      }),
    ).rejects.toEqual(erro);
  });
});
