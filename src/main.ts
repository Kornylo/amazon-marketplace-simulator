import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { SpApiGuard } from './common/sp-api.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Serve static files (engineer UI)
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Amazon Marketplace Simulator')
    .setDescription('Simulates Amazon SP-API and Seller Central for Revnoxa testing')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);

  logger.log(`Amazon Marketplace Simulator running on http://localhost:${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api`);
  logger.log(`Engineer UI: http://localhost:${port}/`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
