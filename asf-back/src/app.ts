import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { FiltroErro } from './comum/filtro-erro.filter.js';

// Monta a aplicação do mesmo jeito para o servidor local, o Worker e o
// gerador do openapi.json.
export async function criarApp(): Promise<{
  app: INestApplication;
  openapi: OpenAPIObject;
}> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new FiltroErro());

  const openapi = gerarOpenapi(app);
  // Servido direto pelo adaptador HTTP: fica fora do guard e é público.
  // Sem Swagger UI: ela depende de __dirname e derruba o Worker no boot.
  app
    .getHttpAdapter()
    .get('/openapi.json', (_req: unknown, res: { json(b: unknown): void }) =>
      res.json(openapi),
    );

  return { app, openapi };
}

export function gerarOpenapi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('ASF — API interna')
    .setDescription('Back (BFF) do sistema da Associação São Francisco')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  return SwaggerModule.createDocument(app, config);
}
