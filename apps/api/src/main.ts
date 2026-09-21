import { ValidationPipe } from '@nestjs/common';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Redmine Next Nest API')
    .setDescription('Redmine Next Nest の REST API 仕様')
    .setVersion('1.0')
    .addTag('Health')
    .addTag('Projects')
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);

  // useGlobalPrefix により Swagger UI は /api/docs で公開される。
  SwaggerModule.setup('docs', app, documentFactory, {
    useGlobalPrefix: true,
  });

  await app.listen(process.env.API_PORT ?? 3001);
}
await bootstrap();
