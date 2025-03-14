import { Rate } from 'src/database/models';
import { Fiat, StableCoin } from '../dto/get-rates.dto';

export abstract class Source<S extends string> {
  static sourceName: string;
  static stablecoins: StableCoin[];
  static fiats: Fiat[];

  abstract fetchData(fiat: string): Promise<boolean>;

  async logData(
    data: {
      fiat: string;
      stablecoin: string;
      buyRate: number;
      sellRate: number;
      source: S;
    }[],
  ) {
    try {
      const records = data.map((record) => ({
        ...record,
        stablecoin: record.stablecoin.toUpperCase(),
      }));
      for (const record of records) {
        const { fiat, stablecoin, source, buyRate, sellRate } = record;

        if (buyRate || sellRate) {
          const rateRecord = await Rate.findOne({
            where: { fiat, stablecoin, source },
          });
          if (!rateRecord) {
            await Rate.create(record);
          } else {
            await rateRecord.update(record);
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
