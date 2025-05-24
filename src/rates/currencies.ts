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
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
 */

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
      { source: new Binance(), pattern: '15 */5 * * * *' }, // Every 5 minutes at 15 seconds
    ]);
  }
}

/**
 * Represents the Ghanaian Cedi (GHS) currency.
 */
export class GHS extends Currency {
  constructor() {
    super('GHS', [
      { source: new Quidax(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
    ]);
  }
}

/**
 * Represents the South African Rand (ZAR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Luno (https://www.luno.com/api/)
 * 2. VALR (https://www.valr.com/api/)
 * 3. AltcoinTrader (https://www.altcointrader.co.za/api/)
 * 4. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 5. Paxful (https://paxful.com/api)
 */
export class ZAR extends Currency {
  constructor() {
    super('ZAR', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

//  * Represents the Malaysian Ringgit (MYR) currency.
//  *
//  * Sources: Binance (P2P)
//  *
//  * Other reliable P2P MYR sources:
//  * - Luno: https://www.luno.com
//  * - Remitano: https://remitano.com
//  * - Binance P2P: https://p2p.binance.com (already integrated)
//  */
export class MYR extends Currency {
  constructor() {
    super('MYR', [
      { source: new Binance(), pattern: '15 */5 * * * *' }, // Every 5 minutes at 15 seconds
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
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
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
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
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
      { source: new Binance(), pattern: '15 */5 * * * *' }, // Every 5 minutes at 15 seconds
    ]);
  }
}

/**
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
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
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
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
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
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
 * Represents the Saudi Riyal (SAR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Rain (https://www.rain.bh/api/)
 * 2. BitOasis (https://www.bitoasis.net/api/)
 * 3. CoinMENA (https://www.coinmena.com/api/)
 * 4. Paxful (https://paxful.com/api)
 * 5. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class SAR extends Currency {
  constructor() {
    super('SAR', [
      { source: new Binance(), pattern: '15 */5 * * * *' }, // Every 5 minutes at 15 seconds
    ]);
  }
}

//  * Represents the Hong Kong Dollar (HKD) currency.
//  *
//  * Sources: Binance (P2P)
//  *
//  * Other reliable P2P HKD sources:
//  * - Binance P2P: https://p2p.binance.com (already integrated)
//  */
export class HKD extends Currency {
  constructor() {
    super('HKD', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
    ]);
  }
}

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
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
      { source: new Quidax(), pattern: CronExpression.EVERY_5_MINUTES },
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
      { source: new Binance(), pattern: '15 */5 * * * *' }, // Every 5 minutes at 15 seconds
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
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
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
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
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
      { source: new Binance(), pattern: '15 */5 * * * *' }, // Every 5 minutes at 15 seconds
    ]);
  }
}

/**
 * Represents the Turkish lira (TRY) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. OKX P2P (https://www.okx.com/p2p-markets)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class TRY extends Currency {
  constructor() {
    super('TRY', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the New Taiwan Dollar (TWD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. Remitano (https://remitano.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class TWD extends Currency {
  constructor() {
    super('TWD', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Serbian Dinar (RSD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. Kriptomat (https://www.kriptomat.io/api/)
 */
export class RSD extends Currency {
  constructor() {
    super('RSD', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the West African CFA Franc (
 ) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Yellow Card (https://yellowcard.io)
 * 2. Paxful (https://paxful.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class XOF extends Currency {
  constructor() {
    super('XOF', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}

/**
 * Represents the Mauritian Rupee (MUR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Remitano (https://remitano.com/api)
 * 2. Paxful (https://paxful.com/api)
 */
export class MUR extends Currency {
  constructor() {
    super('MUR', [
      { source: new Binance(), pattern: CronExpression.EVERY_5_MINUTES },
    ]);
  }
}
