import { Rate } from 'src/database/models';
import { Fiat, StableCoin } from '../dto/get-rates.dto';

/**
 * Abstract base class representing a data source for fetching and logging market rates.
 *
 * @template S - A string literal type representing the unique source name.
 */
export abstract class Source<S extends string> {
  /**
   * Unique name of the source.
   */
  static sourceName: string;

  /**
   * List of supported stablecoins for the source.
   */
  static stablecoins: StableCoin[];

  /**
   * Abstract method to fetch data for a given fiat currency.
   *
   * Implementations should fetch market data and return a promise that resolves to a boolean
   * indicating the success of the operation.
   *
   * @param fiat - The fiat currency for which data should be fetched.
   * @returns A promise that resolves to a boolean indicating success or failure.
   */
  abstract fetchData(fiat: string): Promise<boolean>;

  /**
   * Logs the provided market rate data to the database.
   *
   * The method iterates over the array of data objects, converts the stablecoin value to uppercase,
   * and then attempts to find an existing record in the database for the given fiat, stablecoin, and source.
   * If an existing record is found, it is updated; otherwise, a new record is created.
   *
   * @param data - An array of objects containing market rate information including fiat currency,
   * stablecoin, buy rate, sell rate, and source.
   * @returns A promise that resolves to true if logging was successful, otherwise false.
   */
  async logData(
    data: {
      fiat: string;
      stablecoin: string;
      buyRate: number;
      sellRate: number;
      source: S;
    }[],
  ): Promise<boolean> {
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
