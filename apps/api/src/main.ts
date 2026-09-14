import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, //リクエストJSONをDTOクラスとして扱えるようにする
      whitelist: true, //DTOクラスに定義されていないプロパティは無視する
      forbidNonWhitelisted: true, //DTOクラスに定義されていないプロパティがある場合は400エラーを返す
    }),
  );
  await app.listen(process.env.API_PORT ?? 3001);
}
await bootstrap();
