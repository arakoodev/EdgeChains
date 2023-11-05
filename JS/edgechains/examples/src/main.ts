import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  await app.listen(8080);
}
bootstrap();
