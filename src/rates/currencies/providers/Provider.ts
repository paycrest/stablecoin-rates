import { Rate } from 'src/database/models';

export abstract class Provider<P extends string> {
  abstract providerName: P;

  abstract fetchData(fiat: string): Promise<boolean>;

  async logData(
    data: { fiat: string; coin: string; rate: string; provider: P }[],
  ) {
    try {
      const records = data.map((record) => ({
        ...record,
        coin: record.coin.toUpperCase(),
      }));
      for (const record of records) {
        const { fiat, coin, provider, rate } = record;

        if (rate) {
          const rateRecord = await Rate.findOne({
            where: { fiat, coin, provider },
          });
          if (!rateRecord) {
            await Rate.create(record);
          } else {
            await rateRecord.update(record);
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}
