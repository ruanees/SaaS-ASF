import {
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { UsuariosService } from './usuarios.service.js';

const EU = { id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d', token: 'jwt' };
const OUTRO = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

// Imita a cadeia do supabase-js: from().select().eq().maybeSingle() etc.
function consulta(resultado: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'order']) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(() => Promise.resolve(resultado));
  // A consulta do supabase-js é "thenable" (await sem maybeSingle); o mock imita.
  // oxlint-disable-next-line unicorn/no-thenable
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return q;
}

function servico(opcoes: {
  linhas?: Array<{ data: unknown; error: unknown }>;
  invoke?: { data: unknown; error: unknown };
}) {
  const linhas = [...(opcoes.linhas ?? [])];
  const cliente = {
    from: vi.fn(() => consulta(linhas.shift() ?? { data: null, error: null })),
    functions: { invoke: vi.fn(() => Promise.resolve(opcoes.invoke)) },
  };
  const supabase = { para: vi.fn(() => cliente) } as unknown as SupabaseService;
  return { service: new UsuariosService(supabase), cliente };
}

describe('UsuariosService.eu', () => {
  it('devolve nome e papel de quem entrou', async () => {
    const { service } = servico({
      linhas: [
        { data: { user_id: EU.id, nome: 'Ana', papel: 'admin' }, error: null },
      ],
    });
    await expect(service.eu(EU)).resolves.toEqual({
      id: EU.id,
      nome: 'Ana',
      papel: 'admin',
    });
  });

  it('conta sem linha ativa (RLS não devolve nada) recebe 403', async () => {
    const { service } = servico({ linhas: [{ data: null, error: null }] });
    await expect(service.eu(EU)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('erro do banco sobe para o FiltroErro', async () => {
    const { service } = servico({
      linhas: [{ data: null, error: { code: '', message: 'fetch failed' } }],
    });
    await expect(service.eu(EU)).rejects.toEqual({
      code: '',
      message: 'fetch failed',
    });
  });
});

describe('UsuariosService.alterar', () => {
  it('papel muda por update direto (RLS decide); sem linha afetada = 404', async () => {
    const { service } = servico({ linhas: [{ data: null, error: null }] });
    await expect(
      service.alterar(EU, OUTRO, { papel: 'coordenacao' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ativo passa pela Edge Function e devolve o usuário atualizado', async () => {
    const atual = {
      user_id: OUTRO,
      nome: 'Bia',
      papel: 'voluntario',
      ativo: false,
      criado_em: '2026-10-16T00:00:00Z',
    };
    const { service, cliente } = servico({
      invoke: { data: { user_id: OUTRO, ativo: false }, error: null },
      linhas: [{ data: atual, error: null }],
    });
    await expect(service.alterar(EU, OUTRO, { ativo: false })).resolves.toEqual(
      atual,
    );
    expect(cliente.functions.invoke).toHaveBeenCalledWith('admin-usuarios', {
      body: { acao: 'definir_ativo', user_id: OUTRO, ativo: false },
    });
  });

  it('erro da Edge Function chega com o status e a mensagem dela', async () => {
    const resposta = new Response(
      JSON.stringify({
        mensagem: 'A associação precisa de ao menos um admin ativo.',
      }),
      {
        status: 422,
      },
    );
    const { service } = servico({
      invoke: { data: null, error: new FunctionsHttpError(resposta) },
    });
    const erro = await service
      .alterar(EU, EU.id, { ativo: false })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(422);
    expect((erro as HttpException).getResponse()).toEqual({
      message: 'A associação precisa de ao menos um admin ativo.',
    });
  });

  it('Edge Function fora do ar vira 503', async () => {
    const { service } = servico({
      invoke: { data: null, error: new FunctionsFetchError('falhou') },
    });
    await expect(
      service.convidar(EU, {
        email: 'a@b.test',
        nome: 'A',
        papel: 'voluntario',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sem nenhum campo é recusado', async () => {
    const { service } = servico({});
    await expect(service.alterar(EU, OUTRO, {})).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
