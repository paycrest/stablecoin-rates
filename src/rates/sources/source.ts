import { Rate } from 'src/database/models';
import type { Stablecoin } from '../dto/get-rates.dto';
import type { ServiceResponse } from '../../common/interfaces';

// Request queue to prevent rate limiting
class RequestQueue {
  private static instance: RequestQueue;
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelayBetweenRequests = 2000; // 2 seconds between requests

  static getInstance(): RequestQueue {
    if (!RequestQueue.instance) {
      RequestQueue.instance = new RequestQueue();
    }
    return RequestQueue.instance;
  }

  async addRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Wait if we need to delay
      if (timeSinceLastRequest < this.minDelayBetweenRequests) {
        const delayNeeded = this.minDelayBetweenRequests - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }

      const request = this.queue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('Request queue error:', error);
        }
        this.lastRequestTime = Date.now();
      }
    }

    this.processing = false;
  }
}

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
  static stablecoins: Stablecoin[];

  abstract fetchData(fiat: string): Promise<ServiceResponse>;

  protected async queuedRequest<R>(requestFn: () => Promise<R>): Promise<R> {
    const queue = RequestQueue.getInstance();
    return queue.addRequest(requestFn);
  }

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
