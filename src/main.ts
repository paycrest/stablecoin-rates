import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { version } from '../package.json';
import { AppModule } from './app.module';
import { logger } from './common';
import { config, setupConfig } from './common/config';

async function bootstrap() {
  const error = await setupConfig();
  if (error) return logger.log(error);

  const app = await NestFactory.create(AppModule, { logger });

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(helmet());

  const doc = new DocumentBuilder()
    .setTitle('API Reference')
    .setVersion(version)
    .build();
  const swaggerDocLink = '/api-documentation';
  SwaggerModule.setup(
    swaggerDocLink,
    app,
    SwaggerModule.createDocument(app, doc),
    { customfavIcon: 'http://paycrest.io/favicon.ico' },
  );

  await app.listen(config.PORT);
  const serverUrl = `http://localhost:${config.PORT}`;

  logger.log(`Server running on ${serverUrl}`);
  logger.log(`Swagger docs link ${serverUrl}${swaggerDocLink}`);
}
bootstrap();
