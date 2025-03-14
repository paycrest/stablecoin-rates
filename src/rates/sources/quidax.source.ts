import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { Fiat, StableCoin } from '../dto/get-rates.dto';
import { Source } from './source';

export class Quidax extends Source<'quidax'> {
  static sourceName = 'quidax' as const;
  static stablecoins: StableCoin[] = ['USDT'];
  static fiats: Fiat[] = ['NGN', 'GHS'];

  private getTickerEndpoint(ticker: string): string {
    return `https://www.quidax.com/api/v1/markets/tickers/${ticker}`;
  }

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
