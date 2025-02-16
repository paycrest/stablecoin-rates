import { Rate } from 'src/database/models';
import { StableCoin } from '../dto/get-rates.dto';

export abstract class Source<S extends string> {
  abstract sourceName: S;
  abstract stablecoins: StableCoin[];

  abstract fetchData(fiat: string): Promise<boolean>;

  async logData(
    data: { fiat: string; stablecoin: string; rate: string; source: S }[],
  ) {
    try {
      const records = data.map((record) => ({
        ...record,
        stablecoin: record.stablecoin.toUpperCase(),
      }));
      for (const record of records) {
        const { fiat, stablecoin, source, rate } = record;

        if (rate) {
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
