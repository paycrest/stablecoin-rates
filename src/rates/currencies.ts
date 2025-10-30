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
      { source: new Quidax(), pattern: '0 */10 * * * *' }, // Every 10 minutes to reduce load
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
 * Represents the Tanzania Shilling (TZS) currency.
 */
export class TZS extends Currency {
  constructor() {
    super('TZS', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
    ]);
  }
}

/**
 * Represents the Uganda Shilling (UGX) currency.
 */
export class UGX extends Currency {
  constructor() {
    super('UGX', [
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
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
      {
        source: new Binance(),
        pattern: '0 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:00, 6:00, 11:00, etc.
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
      {
        source: new Binance(),
        pattern: '15 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:15, 6:15, 11:15, etc.
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
      {
        source: new Binance(),
        pattern: '30 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:30, 6:30, 11:30, etc.
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
      {
        source: new Quidax(),
        pattern: '45 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:45, 6:45, 11:45, etc.
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
      {
        source: new Binance(),
        pattern: '0 2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      }, // Every 5 minutes at 2:00, 7:00, 12:00, etc.
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
      {
        source: new Binance(),
        pattern: '30 2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      }, // Every 5 minutes at 2:30, 7:30, 12:30, etc.
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
      {
        source: new Binance(),
        pattern: '45 2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      }, // Every 5 minutes at 2:45, 7:45, 12:45, etc.
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
      {
        source: new Binance(),
        pattern: '0 3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
      }, // Every 5 minutes at 3:00, 8:00, 13:00, etc.
    ]);
  }
}

/**
 * Represents the West African CFA Franc (XOF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Yellow Card (https://yellowcard.io)
 * 2. Paxful (https://paxful.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class XOF extends Currency {
  constructor() {
    super('XOF', [
      {
        source: new Binance(),
        pattern: '15 3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
      }, // Every 5 minutes at 3:15, 8:15, 13:15, etc.
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
      {
        source: new Binance(),
        pattern: '30 3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
      }, // Every 5 minutes at 3:30, 8:30, 13:30, etc.
    ]);
  }
}

/**
 * Represents the Bahraini Dinar (BHD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Rain (https://www.rain.bh/api/)
 * 2. BitOasis (https://www.bitoasis.net/api/)
 * 3. Paxful (https://paxful.com/api)
 */
export class BHD extends Currency {
  constructor() {
    super('BHD', [
      { source: new Binance(), pattern: '0 */5 * * * *' }, // Every 5 minutes at 0 seconds
    ]);
  }
}

/**
 * Represents the Jordanian Dinar (JOD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class JOD extends Currency {
  constructor() {
    super('JOD', [
      { source: new Binance(), pattern: '5 */5 * * * *' }, // Every 5 minutes at 5 seconds
    ]);
  }
}

/**
 * Represents the Omani Rial (OMR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. Rain (https://www.rain.bh/api/)
 */
export class OMR extends Currency {
  constructor() {
    super('OMR', [
      { source: new Binance(), pattern: '10 */5 * * * *' }, // Every 5 minutes at 10 seconds
    ]);
  }
}

/**
 * Represents the Kazakhstani Tenge (KZT) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KZT extends Currency {
  constructor() {
    super('KZT', [
      { source: new Binance(), pattern: '20 */5 * * * *' }, // Every 5 minutes at 20 seconds
    ]);
  }
}

/**
 * Represents the Romanian Leu (RON) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class RON extends Currency {
  constructor() {
    super('RON', [
      { source: new Binance(), pattern: '25 */5 * * * *' }, // Every 5 minutes at 25 seconds
    ]);
  }
}

/**
 * Represents the Panamanian Balboa (PAB) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class PAB extends Currency {
  constructor() {
    super('PAB', [
      { source: new Binance(), pattern: '35 */5 * * * *' }, // Every 5 minutes at 35 seconds
    ]);
  }
}

/**
 * Represents the Peruvian Sol (PEN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Buda (https://www.buda.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class PEN extends Currency {
  constructor() {
    super('PEN', [
      { source: new Binance(), pattern: '40 */5 * * * *' }, // Every 5 minutes at 40 seconds
    ]);
  }
}

/**
 * Represents the Albanian Lek (ALL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class ALL extends Currency {
  constructor() {
    super('ALL', [
      { source: new Binance(), pattern: '50 */5 * * * *' }, // Every 5 minutes at 50 seconds
    ]);
  }
}

/**
 * Represents the Azerbaijani Manat (AZN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class AZN extends Currency {
  constructor() {
    super('AZN', [
      { source: new Binance(), pattern: '55 */5 * * * *' }, // Every 5 minutes at 55 seconds
    ]);
  }
}

/**
 * Represents the Bosnia and Herzegovina Convertible Mark (BAM) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class BAM extends Currency {
  constructor() {
    super('BAM', [
      { source: new Binance(), pattern: '0 */1 * * * *' }, // Every minute at 0 seconds
    ]);
  }
}

/**
 * Represents the Bangladeshi Taka (BDT) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BDT extends Currency {
  constructor() {
    super('BDT', [
      { source: new Binance(), pattern: '5 */1 * * * *' }, // Every minute at 5 seconds
    ]);
  }
}

/**
 * Represents the Bulgarian Lev (BGN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class BGN extends Currency {
  constructor() {
    super('BGN', [
      { source: new Binance(), pattern: '10 */1 * * * *' }, // Every minute at 10 seconds
    ]);
  }
}

/**
 * Represents the Bolivian Boliviano (BOB) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BOB extends Currency {
  constructor() {
    super('BOB', [
      { source: new Binance(), pattern: '15 */1 * * * *' }, // Every minute at 15 seconds
    ]);
  }
}

/**
 * Represents the Bahamian Dollar (BSD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BSD extends Currency {
  constructor() {
    super('BSD', [
      { source: new Binance(), pattern: '20 */1 * * * *' }, // Every minute at 20 seconds
    ]);
  }
}

/**
 * Represents the Botswanan Pula (BWP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BWP extends Currency {
  constructor() {
    super('BWP', [
      { source: new Binance(), pattern: '25 */1 * * * *' }, // Every minute at 25 seconds
    ]);
  }
}

/**
 * Represents the Belize Dollar (BZD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BZD extends Currency {
  constructor() {
    super('BZD', [
      { source: new Binance(), pattern: '30 */1 * * * *' }, // Every minute at 30 seconds
    ]);
  }
}

/**
 * Represents the Canadian Dollar (CAD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Coinsquare (https://coinsquare.com/api/)
 * 2. Bitbuy (https://bitbuy.ca/api/)
 * 3. Paxful (https://paxful.com/api)
 */
export class CAD extends Currency {
  constructor() {
    super('CAD', [
      { source: new Binance(), pattern: '35 */1 * * * *' }, // Every minute at 35 seconds
    ]);
  }
}

/**
 * Represents the Congolese Franc (CDF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class CDF extends Currency {
  constructor() {
    super('CDF', [
      { source: new Binance(), pattern: '40 */1 * * * *' }, // Every minute at 40 seconds
    ]);
  }
}

/**
 * Represents the Swiss Franc (CHF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Bitcoin Suisse (https://www.bitcoinsuisse.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class CHF extends Currency {
  constructor() {
    super('CHF', [
      { source: new Binance(), pattern: '45 */1 * * * *' }, // Every minute at 45 seconds
    ]);
  }
}

/**
 * Represents the Costa Rican Colón (CRC) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class CRC extends Currency {
  constructor() {
    super('CRC', [
      { source: new Binance(), pattern: '50 */1 * * * *' }, // Every minute at 50 seconds
    ]);
  }
}

/**
 * Represents the British Pound (GBP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Coinbase Pro (https://pro.coinbase.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class GBP extends Currency {
  constructor() {
    super('GBP', [
      { source: new Binance(), pattern: '55 */1 * * * *' }, // Every minute at 55 seconds
    ]);
  }
}

/**
 * Represents the Danish Krone (DKK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class DKK extends Currency {
  constructor() {
    super('DKK', [
      { source: new Binance(), pattern: '0 * * * * *' }, // Every minute at 0 seconds
    ]);
  }
}

/**
 * Represents the Ethiopian Birr (ETB) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class ETB extends Currency {
  constructor() {
    super('ETB', [
      { source: new Binance(), pattern: '5 * * * * *' }, // Every minute at 5 seconds
    ]);
  }
}

/**
 * Represents the Egyptian Pound (EGP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class EGP extends Currency {
  constructor() {
    super('EGP', [
      { source: new Binance(), pattern: '10 * * * * *' }, // Every minute at 10 seconds
    ]);
  }
}

/**
 * Represents the Georgian Lari (GEL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class GEL extends Currency {
  constructor() {
    super('GEL', [
      { source: new Binance(), pattern: '15 * * * * *' }, // Every minute at 15 seconds
    ]);
  }
}

/**
 * Represents the Gambian Dalasi (GMD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class GMD extends Currency {
  constructor() {
    super('GMD', [
      { source: new Binance(), pattern: '20 * * * * *' }, // Every minute at 20 seconds
    ]);
  }
}

/**
 * Represents the Guatemalan Quetzal (GTQ) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class GTQ extends Currency {
  constructor() {
    super('GTQ', [
      { source: new Binance(), pattern: '25 * * * * *' }, // Every minute at 25 seconds
    ]);
  }
}

/**
 * Represents the Honduran Lempira (HNL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class HNL extends Currency {
  constructor() {
    super('HNL', [
      { source: new Binance(), pattern: '30 * * * * *' }, // Every minute at 30 seconds
    ]);
  }
}

/**
 * Represents the Haitian Gourde (HTG) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class HTG extends Currency {
  constructor() {
    super('HTG', [
      { source: new Binance(), pattern: '35 * * * * *' }, // Every minute at 35 seconds
    ]);
  }
}

/**
 * Represents the Icelandic Króna (ISK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class ISK extends Currency {
  constructor() {
    super('ISK', [
      { source: new Binance(), pattern: '40 * * * * *' }, // Every minute at 40 seconds
    ]);
  }
}

/**
 * Represents the Jamaican Dollar (JMD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class JMD extends Currency {
  constructor() {
    super('JMD', [
      { source: new Binance(), pattern: '45 * * * * *' }, // Every minute at 45 seconds
    ]);
  }
}

/**
 * Represents the Japanese Yen (JPY) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. bitFlyer (https://bitflyer.com/api/)
 * 2. Coincheck (https://coincheck.com/api/)
 * 3. Paxful (https://paxful.com/api)
 */
export class JPY extends Currency {
  constructor() {
    super('JPY', [
      { source: new Binance(), pattern: '50 * * * * *' }, // Every minute at 50 seconds
    ]);
  }
}

/**
 * Represents the Kyrgyzstani Som (KGS) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KGS extends Currency {
  constructor() {
    super('KGS', [
      { source: new Binance(), pattern: '55 * * * * *' }, // Every minute at 55 seconds
    ]);
  }
}

/**
 * Represents the Cambodian Riel (KHR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KHR extends Currency {
  constructor() {
    super('KHR', [
      { source: new Binance(), pattern: '2 * * * * *' }, // Every minute at 2 seconds
    ]);
  }
}

/**
 * Represents the Kuwaiti Dinar (KWD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class KWD extends Currency {
  constructor() {
    super('KWD', [
      { source: new Binance(), pattern: '7 * * * * *' }, // Every minute at 7 seconds
    ]);
  }
}

/**
 * Represents the Cayman Islands Dollar (KYD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KYD extends Currency {
  constructor() {
    super('KYD', [
      { source: new Binance(), pattern: '12 * * * * *' }, // Every minute at 12 seconds
    ]);
  }
}

/**
 * Represents the Lao Kip (LAK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class LAK extends Currency {
  constructor() {
    super('LAK', [
      { source: new Binance(), pattern: '17 * * * * *' }, // Every minute at 17 seconds
    ]);
  }
}

/**
 * Represents the Lebanese Pound (LBP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class LBP extends Currency {
  constructor() {
    super('LBP', [
      { source: new Binance(), pattern: '22 * * * * *' }, // Every minute at 22 seconds
    ]);
  }
}

/**
 * Represents the Liberian Dollar (LRD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class LRD extends Currency {
  constructor() {
    super('LRD', [
      { source: new Binance(), pattern: '27 * * * * *' }, // Every minute at 27 seconds
    ]);
  }
}

/**
 * Represents the Moroccan Dirham (MAD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class MAD extends Currency {
  constructor() {
    super('MAD', [
      { source: new Binance(), pattern: '32 * * * * *' }, // Every minute at 32 seconds
    ]);
  }
}

/**
 * Represents the Moldovan Leu (MDL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class MDL extends Currency {
  constructor() {
    super('MDL', [
      { source: new Binance(), pattern: '37 * * * * *' }, // Every minute at 37 seconds
    ]);
  }
}

/**
 * Represents the Namibian Dollar (NAD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class NAD extends Currency {
  constructor() {
    super('NAD', [
      { source: new Binance(), pattern: '42 * * * * *' }, // Every minute at 42 seconds
    ]);
  }
}

/**
 * Represents the Nicaraguan Córdoba (NIO) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class NIO extends Currency {
  constructor() {
    super('NIO', [
      { source: new Binance(), pattern: '47 * * * * *' }, // Every minute at 47 seconds
    ]);
  }
}

/**
 * Represents the Norwegian Krone (NOK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. NBX (https://nbx.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class NOK extends Currency {
  constructor() {
    super('NOK', [
      { source: new Binance(), pattern: '52 * * * * *' }, // Every minute at 52 seconds
    ]);
  }
}

/**
 * Represents the New Zealand Dollar (NZD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Independent Reserve (https://www.independentreserve.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class NZD extends Currency {
  constructor() {
    super('NZD', [
      { source: new Binance(), pattern: '57 * * * * *' }, // Every minute at 57 seconds
    ]);
  }
}

/**
 * Represents the Papua New Guinean Kina (PGK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class PGK extends Currency {
  constructor() {
    super('PGK', [
      { source: new Binance(), pattern: '3 * * * * *' }, // Every minute at 3 seconds
    ]);
  }
}

/**
 * Represents the Paraguayan Guaraní (PYG) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class PYG extends Currency {
  constructor() {
    super('PYG', [
      { source: new Binance(), pattern: '8 * * * * *' }, // Every minute at 8 seconds
    ]);
  }
}

/**
 * Represents the Qatari Riyal (QAR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class QAR extends Currency {
  constructor() {
    super('QAR', [
      { source: new Binance(), pattern: '13 * * * * *' }, // Every minute at 13 seconds
    ]);
  }
}

/**
 * Represents the Swedish Krona (SEK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Safello (https://safello.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class SEK extends Currency {
  constructor() {
    super('SEK', [
      { source: new Binance(), pattern: '18 * * * * *' }, // Every minute at 18 seconds
    ]);
  }
}

/**
 * Represents the Sierra Leonean Leone (SLE) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class SLE extends Currency {
  constructor() {
    super('SLE', [
      { source: new Binance(), pattern: '23 * * * * *' }, // Every minute at 23 seconds
    ]);
  }
}

/**
 * Represents the Somali Shilling (SOS) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class SOS extends Currency {
  constructor() {
    super('SOS', [
      { source: new Binance(), pattern: '28 * * * * *' }, // Every minute at 28 seconds
    ]);
  }
}

/**
 * Represents the Turkmenistani Manat (TMT) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class TMT extends Currency {
  constructor() {
    super('TMT', [
      { source: new Binance(), pattern: '33 * * * * *' }, // Every minute at 33 seconds
    ]);
  }
}

/**
 * Represents the Trinidad and Tobago Dollar (TTD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class TTD extends Currency {
  constructor() {
    super('TTD', [
      { source: new Binance(), pattern: '38 * * * * *' }, // Every minute at 38 seconds
    ]);
  }
}

/**
 * Represents the Venezuelan Bolívar Soberano (VES) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. AirTM (https://www.airtm.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class VES extends Currency {
  constructor() {
    super('VES', [
      { source: new Binance(), pattern: '43 * * * * *' }, // Every minute at 43 seconds
    ]);
  }
}

/**
 * Represents the Central African CFA Franc (XAF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Yellow Card (https://yellowcard.io)
 * 2. Paxful (https://paxful.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class XAF extends Currency {
  constructor() {
    super('XAF', [
      { source: new Binance(), pattern: '48 * * * * *' }, // Every minute at 48 seconds
    ]);
  }
}
