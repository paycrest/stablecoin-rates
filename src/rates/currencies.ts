import { CronExpression } from '@nestjs/schedule';
import { Cron } from 'croner';
import { logger } from 'src/common';
import { Binance, Quidax, Source } from './sources';

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
 * Represents the Czech Koruna (CZK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 * 4. Anycoin Direct (https://www.anycoin.direct/api/)
 * 5. Coinmate (https://www.coinmate.io/api/)
 */
export class CZK extends Currency {
  constructor() {
    super('CZK', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Hungarian Forint (HUF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. MrCoin (https://www.mrcoin.com/api/)
 * 4. BitPanda (https://api.bitpanda.com/)
 * 5. Coincash.eu (https://www.coincash.eu/api/)
 */
export class HUF extends Currency {
  constructor() {
    super('HUF', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Polish Złoty (PLN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitBay (https://bitbay.net/api/)
 * 2. Zonda (https://zonda.exchange/api/)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 4. Paxful (https://paxful.com/api)
 * 5. Kriptomat (https://www.kriptomat.io/api/)
 */
export class PLN extends Currency {
  constructor() {
    super('PLN', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Colombian Peso (COP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. Buda (https://www.buda.com/api/)
 * 4. Bitso (https://www.bitso.com/api/)
 * 5. Binance P2P (https://p2p.binance.com/api/)
 */
export class COP extends Currency {
  constructor() {
    super('COP', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Chilean Peso (CLP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Buda (https://www.buda.com/api/)
 * 2. OrionX (https://orionx.io/api/)
 * 3. CryptoMKT (https://www.cryptomkt.com/api/)
 * 4. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 5. Binance P2P (https://p2p.binance.com/api/)
 */
export class CLP extends Currency {
  constructor() {
    super('CLP', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
 */
