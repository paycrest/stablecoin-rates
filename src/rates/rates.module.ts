import { Module } from '@nestjs/common';
import * as currencies from './currencies';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';

@Module({
  imports: [],
  providers: [RatesService, ...Object.values(currencies)],
  controllers: [RatesController],
})
export class RatesModule {}
