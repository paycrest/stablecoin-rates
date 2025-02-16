import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { StableCoin } from '../dto/get-rates.dto';
import { Source } from './source';

export class Quidax extends Source<'quidax'> {
  private getTickerEndpoint = (ticker: string) =>
    `https://www.quidax.com/api/v1/markets/tickers/${ticker}`;

  sourceName = 'quidax' as const;
  stablecoins: StableCoin[] = ['USDT'];

  async fetchData(fiat: string) {
    const pairs = this.stablecoins.map((stablecoin) =>
      `${stablecoin}${fiat}`.toLowerCase(),
    );

    const responses = await axios.all(
      pairs.map((pair) => axios.get(this.getTickerEndpoint(pair))),
    );

    const prices = [];

    for (const response of responses) {
      if (response.status === HttpStatus.OK && response.data) {
        const ticker: {
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
        } = response.data;

        if (ticker.status === 'success') {
          const stablecoin = ticker.data.market.replace(fiat.toLowerCase(), '');
          const rate = parseFloat(ticker.data.ticker.sell).toFixed(2);

          const price = {
            fiat,
            stablecoin,
            rate: parseFloat(rate),
            source: this.sourceName,
          };
          prices.push(price);
        }
      }
    }

    return this.logData(prices);
  }
}
