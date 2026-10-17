import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { criarApp } from '../src/app.js';

describe('asf-back (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    app = (await criarApp()).app as INestApplication<App>;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /saude é público e diz o que falta sem mostrar valor', async () => {
    const res = await request(app.getHttpServer()).get('/saude').expect(200);
    expect(res.body.situacao).toBe('incompleto');
    expect(res.body.configuracoes).toEqual([
      { variavel: 'SUPABASE_URL', existe: true },
      { variavel: 'SUPABASE_PUBLISHABLE_KEY', existe: false },
      { variavel: 'FRONT_URL', existe: false },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('exemplo.supabase.co');
  });

  it('GET /openapi.json é público e lista /saude', async () => {
    const res = await request(app.getHttpServer())
      .get('/openapi.json')
      .expect(200);
    expect(res.body.paths['/saude']).toBeDefined();
  });

  it.each([
    ['get', '/eu'],
    ['get', '/usuarios'],
    ['post', '/usuarios/convites'],
    ['patch', '/usuarios/6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d'],
    ['post', '/sessao/senha'],
    ['post', '/sessao/sair'],
  ] as const)('%s %s sem sessão responde 401', async (metodo, rota) => {
    const res = await request(app.getHttpServer())[metodo](rota).expect(401);
    expect(res.body.mensagem).toBe('Sessão ausente. Entre de novo.');
  });

  it('POST /sessao/entrar recusa corpo inválido e campo desconhecido', async () => {
    const res = await request(app.getHttpServer())
      .post('/sessao/entrar')
      .send({ email: 'não-é-email', senha: 'x', admin: true })
      .expect(400);
    expect(res.body.mensagem).toContain('E-mail inválido.');
    expect(res.body.mensagem).toContain('property admin should not exist');
  });

  it('openapi lista as rotas da Fase 0', async () => {
    const res = await request(app.getHttpServer()).get('/openapi.json');
    expect(Object.keys(res.body.paths).sort()).toEqual([
      '/eu',
      '/saude',
      '/sessao/entrar',
      '/sessao/recuperar',
      '/sessao/renovar',
      '/sessao/sair',
      '/sessao/senha',
      '/usuarios',
      '/usuarios/convites',
      '/usuarios/{id}',
    ]);
  });
});
