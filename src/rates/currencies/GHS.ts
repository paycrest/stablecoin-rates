import { Inject, Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from 'croner';
import { Binance, Quidax } from './providers';

@Injectable()
export class GHS {
  @Inject(Binance) private readonly binance: Binance;
  @Inject(Quidax) private readonly quidax: Quidax;

  fiat = 'GHS' as const;

  constructor() {
    /**
     * Using croner instead of @nestjs/schedule
     * because of issue: https://github.com/kelektiv/node-cron/issues/805
     */
    new Cron(CronExpression.EVERY_5_MINUTES, () => {
      this.getQuidaxData();
      this.getBinanceData();
    });
  }

  async getBinanceData() {
    await this.binance.fetchData(this.fiat);
  }

  async getQuidaxData() {
    await this.quidax.fetchData(this.fiat);
  }
}
