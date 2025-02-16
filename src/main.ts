import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { logger } from './common';
import { config, setupConfig } from './common/config';

async function bootstrap() {
  const error = await setupConfig();
  if (error) return logger.log(error);

  const app = await NestFactory.create(AppModule, { logger });
  await app.listen(config.PORT);
}
bootstrap();
