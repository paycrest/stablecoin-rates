import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { Source } from './Source';

export class Quidax extends Source<'quidax'> {
  private getTickerEndpoint = (ticker: string) =>
    `https://www.quidax.com/api/v1/markets/tickers/${ticker}`;

  sourceName = 'quidax' as const;

  async fetchData(fiat: string) {
    const coins = ['USDT'];
    const pairs = coins.map((coin) => `${coin}${fiat}`.toLowerCase());

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
          const coin = ticker.data.market.replace(fiat.toLowerCase(), '');
          const rate = parseFloat(ticker.data.ticker.sell).toFixed(2);

          const price = { fiat, coin, rate, source: this.sourceName };
          prices.push(price);
        }
      }
    }

    return this.logData(prices);
  }
}
