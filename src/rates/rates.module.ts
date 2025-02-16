import { Module } from '@nestjs/common';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';
import * as c from './currencies';
import * as p from './currencies/providers';

const currrencies = Object.values(c);
const currProviders = Object.values(p);

@Module({
  imports: [],
  providers: [RatesService, ...currProviders, ...currrencies],
  controllers: [RatesController],
})
export class RatesModule {}
