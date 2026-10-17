import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { traduzirErro } from './filtro-erro.filter.js';

describe('traduzirErro', () => {
  it('erro de RLS vira 403 em português', () => {
    expect(
      traduzirErro({
        code: '42501',
        message: 'new row violates row-level security policy',
      }),
    ).toEqual({
      status: 403,
      corpo: { mensagem: 'Você não tem permissão para esta ação.' },
    });
  });

  it('violação de unicidade vira 409', () => {
    expect(
      traduzirErro({ code: '23505', message: 'duplicate key' }).status,
    ).toBe(409);
  });

  it('raise exception de função nossa repassa a mensagem', () => {
    expect(
      traduzirErro({ code: 'P0001', message: 'Data de entrada no futuro.' }),
    ).toEqual({
      status: 422,
      corpo: { mensagem: 'Data de entrada no futuro.' },
    });
  });

  it('código desconhecido não vaza a mensagem do banco', () => {
    const r = traduzirErro({
      code: 'XX000',
      message: 'detalhe interno com dado',
    });
    expect(r.status).toBe(400);
    expect(r.corpo.mensagem).not.toContain('detalhe');
  });

  it('falha de rede do supabase-js (code vazio) vira 503, não permissão', () => {
    expect(
      traduzirErro({ code: '', message: 'TypeError: fetch failed' }).status,
    ).toBe(503);
  });

  it('TypeError de fetch vira 503', () => {
    expect(traduzirErro(new TypeError('fetch failed')).status).toBe(503);
  });

  it('HttpException passa com o status e junta mensagens do ValidationPipe', () => {
    expect(traduzirErro(new ForbiddenException('Proibido')).status).toBe(403);
    expect(
      traduzirErro(
        new BadRequestException(['nome é obrigatório', 'sexo inválido']),
      ),
    ).toEqual({
      status: 400,
      corpo: { mensagem: 'nome é obrigatório; sexo inválido' },
    });
  });

  it('erro qualquer vira 500 sem detalhe', () => {
    const r = traduzirErro(new Error('segredo'));
    expect(r.status).toBe(500);
    expect(r.corpo.mensagem).not.toContain('segredo');
  });
});
