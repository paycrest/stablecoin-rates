import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { calculateMedian } from '../../../src/common';
import { Fiat, StableCoin } from '../dto/get-rates.dto';
import { Source } from './source';

/**
 * Represents the Binance data source.
 * Extends the generic Source class with the unique source name 'binance'.
 */
export class Binance extends Source<'binance'> {
  /**
   * Unique name of the source.
   */
  static sourceName = 'binance' as const;

  /**
   * Supported stablecoins for Binance.
   */
  static stablecoins: StableCoin[] = ['USDT', 'USDC'];

  /**
   * Returns the Binance P2P API endpoint URL.
   *
   * @returns The endpoint URL.
   */
  private getEndpoint(): string {
    return 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  }

  /**
   * Fetches and processes market data from Binance for a given fiat currency.
   *
   * This method sends separate POST requests for SELL and BUY orders for each supported stablecoin,
   * processes the returned data to calculate the median price, and then merges the results into a final
   * array containing both buy and sell rates. The final data is logged using the inherited logData method.
   *
   * @param fiat - The fiat currency to fetch data for (e.g., 'GHS').
   * @returns A promise that resolves with the logged data containing market prices.
   */
  async fetchData(fiat: string) {
    const url = this.getEndpoint();
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'insomnia/10.3.1',
    };

    /**
     * Creates payloads for the specified trade type for each stablecoin.
     *
     * @param tradeType - The trade type, either 'SELL' or 'BUY'.
     * @returns An array of payload objects.
     */
    const createPayloads = (tradeType: 'SELL' | 'BUY') =>
      Binance.stablecoins.map((stablecoin) => ({
        rows: 20,
        page: 1,
        tradeType,
        fiat,
        asset: stablecoin,
      }));

    const sellPayloads = createPayloads('SELL');
    const buyPayloads = createPayloads('BUY');

    // Send parallel POST requests for SELL and BUY payloads.
    const sellResponses = await Promise.all(
      sellPayloads.map((data) => axios.post(url, data, { headers })),
    );
    const buyResponses = await Promise.all(
      buyPayloads.map((data) => axios.post(url, data, { headers })),
    );

    /**
     * Processes the array of responses from the Binance API.
     *
     * Iterates over the responses to extract the asset and its median price from the advertisements.
     *
     * @param responses - An array of responses from axios.
     * @returns An array of objects containing the fiat, stablecoin, rate, and source.
     */
    const processResponses = (responses: any[]) => {
      const results: Array<{
        fiat: string;
        stablecoin: string;
        rate: number;
        source: 'binance';
      }> = [];
      for (const response of responses) {
        if (
          response.status === HttpStatus.OK &&
          response.data &&
          response.data.success
        ) {
          const adPrices: number[] = [];
          let stablecoin = '';
          for (const ad of response.data.data) {
            stablecoin = ad.adv.asset.toLowerCase();
            const price = parseFloat(ad.adv.price);
            if (!isNaN(price)) adPrices.push(price);
          }
          if (adPrices.length) {
            const median = calculateMedian(adPrices);
            results.push({
              fiat,
              stablecoin,
              rate: parseFloat(median.toFixed(2)),
              source: Binance.sourceName,
            });
          }
        }
      }
      return results;
    };

    const sellPrices = processResponses(sellResponses);
    const buyPrices = processResponses(buyResponses);

    // Merge buy and sell prices for each stablecoin.
    const merged = Binance.stablecoins.reduce(
      (acc, stablecoin) => {
        const buy = buyPrices.find(
          (price) =>
            price.stablecoin.toLowerCase() === stablecoin.toLowerCase(),
        );
        const sell = sellPrices.find(
          (price) =>
            price.stablecoin.toLowerCase() === stablecoin.toLowerCase(),
        );
        if (buy && sell) {
          acc.push({
            fiat: buy.fiat,
            stablecoin: buy.stablecoin,
            source: buy.source,
            buyRate: buy.rate,
            sellRate: sell.rate,
          });
        }
        return acc;
      },
      [] as Array<{
        fiat: string;
        stablecoin: string;
        source: 'binance';
        buyRate: number;
        sellRate: number;
      }>,
    );

    return this.logData(merged);
  }
}
