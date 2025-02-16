import { Module } from '@nestjs/common';
import { DatabaseProvider } from './database.provider';

@Module({
  providers: [DatabaseProvider],
  imports: [],
})
export class DatabaseModule {}
