import { Inject, Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from 'croner';
import { Quidax } from './providers';

@Injectable()
export class NGN {
  @Inject(Quidax) private readonly quidax: Quidax;

  fiat = 'NGN' as const;

  constructor() {
    /**
     * Using croner instead of @nestjs/schedule
     * because of issue: https://github.com/kelektiv/node-cron/issues/805
     */
    new Cron(CronExpression.EVERY_5_MINUTES, () => {
      this.getQuidaxData();
    });
  }

  async getQuidaxData() {
    await this.quidax.fetchData(this.fiat);
  }
}
