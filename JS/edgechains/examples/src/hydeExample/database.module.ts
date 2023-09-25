import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'node:path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const { host, port, username, password, database } = config.get('db');
        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          // NOTE don't use `synchronize` on production
          synchronize: process.env['NODE_ENV'] !== 'production',
          entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}