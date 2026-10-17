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
    ]);
    expect(JSON.stringify(res.body)).not.toContain('exemplo.supabase.co');
  });

  it('GET /openapi.json é público e lista /saude', async () => {
    const res = await request(app.getHttpServer())
      .get('/openapi.json')
      .expect(200);
    expect(res.body.paths['/saude']).toBeDefined();
  });

  // A prova de que rota sem @Publico() exige sessão está em jwt.guard.spec.ts;
  // aqui ela entra junto com GET /eu.
});
