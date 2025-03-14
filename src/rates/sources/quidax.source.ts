import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { Fiat, StableCoin } from '../dto/get-rates.dto';
import { Source } from './source';

/**
 * Represents the Quidax data source.
 * Extends the generic Source class with the unique source name 'quidax'.
 */
export class Quidax extends Source<'quidax'> {
  /**
   * Unique name of the source.
   */
  static sourceName = 'quidax' as const;

  /**
   * Supported stablecoins for this source.
   */
  static stablecoins: StableCoin[] = ['USDT'];

  /**
   * Supported fiat currencies for this source.
   */
  static fiats: Fiat[] = ['NGN', 'GHS'];

  /**
   * Constructs the URL endpoint for fetching the ticker data for a given market.
   *
   * @param ticker - The market ticker string (e.g., 'usdtngn').
   * @returns The URL endpoint for the provided ticker.
   */
  private getTickerEndpoint(ticker: string): string {
    return `https://www.quidax.com/api/v1/markets/tickers/${ticker}`;
  }

  /**
   * Fetches market data for the given fiat currency and logs the processed prices.
   *
   * This method creates trading pairs by combining supported stablecoins with the provided fiat,
   * fetches the corresponding ticker data from the Quidax API, and processes the response to extract
   * the sell and buy rates. The final processed data is then logged.
   *
   * @param fiat - The fiat currency for which to fetch data (e.g., 'NGN', 'GHS').
   * @returns A promise that resolves with the logged data containing market prices.
   */
  async fetchData(fiat: string) {
    const pairs = Quidax.stablecoins.map((stablecoin) =>
      `${stablecoin}${fiat}`.toLowerCase(),
    );

    const responses = await Promise.all(
      pairs.map((pair) => axios.get(this.getTickerEndpoint(pair))),
    );

    const prices = responses.reduce(
      (acc, response) => {
        if (response.status === HttpStatus.OK && response.data) {
          const { status, data } = response.data as {
            status: string;
            message: string;
            data: {
              at: number;
              ticker: {
                buy: string;
                sell: string;
                low: string;
                high: string;
                open: string;
                last: string;
                vol: string;
              };
              market: string;
            };
          };

          if (status === 'success') {
            const stablecoin = data.market.replace(fiat.toLowerCase(), '');
            const sellRate = Number(parseFloat(data.ticker.sell).toFixed(2));
            const buyRate = Number(parseFloat(data.ticker.buy).toFixed(2));

            acc.push({
              fiat,
              stablecoin,
              sellRate,
              buyRate,
              source: Quidax.sourceName,
            });
          }
        }
        return acc;
      },
      [] as Array<{
        fiat: string;
        stablecoin: string;
        sellRate: number;
        buyRate: number;
        source: 'quidax';
      }>,
    );

    return this.logData(prices);
  }
}
