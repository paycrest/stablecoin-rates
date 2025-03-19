import { CronExpression } from '@nestjs/schedule';
import { Cron } from 'croner';
import { Binance, Quidax, Source } from './sources';
import { logger } from 'src/common';

type Sources = {
  source: Source<string>;
  pattern: string;
}[];

class Currency {
  private _fiat: string;
  private _sources: Sources;

  constructor(fiat: string, sources: Sources) {
    this._fiat = fiat;
    this._sources = sources;

    for (const param of this._sources) {
      /**
       * Using croner instead of @nestjs/schedule
       * because of issue: https://github.com/kelektiv/node-cron/issues/805
       */
      new Cron(param.pattern, () => {
        try {
          param.source.fetchData(this._fiat);
        } catch (error) {
          logger.error(error);
        }
      });
    }
  }
}

/**
 * Represents the Nigerian Naira (NGN) currency.
 */
export class NGN extends Currency {
  constructor() {
    super('NGN', [
      { source: new Quidax(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Kenyan Shilling (KES) currency.
 */
export class KES extends Currency {
  constructor() {
    super('KES', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Ghanaian Cedi (GHS) currency.
 */
export class GHS extends Currency {
  constructor() {
    super('GHS', [
      { source: new Quidax(), pattern: CronExpression.EVERY_5_MINUTES },
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
 */
