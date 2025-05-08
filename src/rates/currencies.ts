import { CronExpression } from '@nestjs/schedule';
import { Cron } from 'croner';
import { Binance, Quidax, type Source } from './sources';
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
 * Represents the Malaysian Ringgit (MYR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P MYR sources:
 * - Luno: https://www.luno.com
 * - Remitano: https://remitano.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class MYR extends Currency {
  constructor() {
    super('MYR', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Indonesian Rupiah (IDR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P IDR sources:
 * - Tokocrypto: https://tokocrypto.com
 * - Pintu: https://pintu.co.id
 * - Rekeningku: https://www.rekeningku.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class IDR extends Currency {
  constructor() {
    super('IDR', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Pakistani Rupee (PKR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P PKR sources:
 * - Remitano: https://remitano.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class PKR extends Currency {
  constructor() {
    super('PKR', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Indian Rupee (INR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P INR sources:
 * - WazirX: https://wazirx.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class INR extends Currency {
  constructor() {
    super('INR', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Thai Baht (THB) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P THB sources:
 * - Bitkub: https://www.bitkub.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class THB extends Currency {
  constructor() {
    super('THB', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Vietnamese Dong (VND) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P VND sources:
 * - Remitano: https://remitano.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class VND extends Currency {
  constructor() {
    super('VND', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Philippine Peso (PHP) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P PHP sources:
 * - Coins.ph: https://coins.ph
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class PHP extends Currency {
  constructor() {
    super('PHP', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Singapore Dollar (SGD) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P SGD sources:
 * - Independent Reserve: https://www.independentreserve.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class SGD extends Currency {
  constructor() {
    super('SGD', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Hong Kong Dollar (HKD) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P HKD sources:
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class HKD extends Currency {
  constructor() {
    super('HKD', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
 */

/**
 * Represents the Mexican Peso (MXN) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P MXN sources:
 * - Paxful: https://paxful.com
 * - AirTM: https://www.airtm.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 * - Bitso: https://bitso.com
 */
export class MXN extends Currency {
  constructor() {
    super('MXN', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
      { source: new Quidax(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

