import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });
  await app.listen(process.env.API_PORT ?? 3001);
}
await bootstrap();
