import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { calculateMedian } from '../../../src/common';
import { Fiat, StableCoin } from '../dto/get-rates.dto';
import { Source } from './source';

export class Binance extends Source<'binance'> {
  static sourceName = 'binance' as const;
  static stablecoins: StableCoin[] = ['USDT', 'USDC'];
  static fiats: Fiat[] = ['GHS'];

  private getEndpoint(): string {
    return 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  }

  async fetchData(fiat: string) {
    const url = this.getEndpoint();
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'insomnia/10.3.1',
    };

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

    const sellResponses = await Promise.all(
      sellPayloads.map((data) => axios.post(url, data, { headers })),
    );
    const buyResponses = await Promise.all(
      buyPayloads.map((data) => axios.post(url, data, { headers })),
    );

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
