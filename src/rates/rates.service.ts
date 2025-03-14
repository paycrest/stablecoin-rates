import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Rate } from '../../src/database/models';

@Injectable()
export class RatesService {
  async getRatesByStablecoinAndFiats(stablecoin: string, fiats: string) {
    const fiatArray = fiats.split(',').map((fiat) => fiat.toUpperCase());
    const rates = await Rate.findAll({
      where: {
        stablecoin: stablecoin.toUpperCase(),
        fiat: { [Op.in]: fiatArray },
      },
    });
    return this.calculateMedianRates(rates);
  }

  async getRatesByStablecoin(stablecoin: string) {
    const rates = await Rate.findAll({
      where: { stablecoin: stablecoin.toUpperCase() },
    });
    return this.calculateMedianRates(rates);
  }

  private calculateMedianRates(data: Rate[]) {
    const grouped = data.reduce(
      (acc, item) => {
        const key = `${item.fiat}-${item.stablecoin}`;
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
      },
      {} as { [key: string]: Rate[] },
    );

    console.log({ pp: grouped });

    return Object.values(grouped).map((items) => {
      const pair = `${items[0].fiat.toLowerCase()}-${items[0].stablecoin.toLowerCase()}`;
      if (items.length === 1) {
        const item = items[0];

        return {
          pair,
          stablecoin: item.stablecoin,
          fiat: item.fiat,
          sources: [item.source],
          buyRate: item.buyRate,
          sellRate: item.sellRate,
          timestamp: new Date().toISOString(),
        };
      } else {
        const [medianBuy, medianSell] = this.findMedianRate(items);
        const sources = items.map((item) => item.source);
        return {
          pair,
          stablecoin: items[0].stablecoin,
          fiat: items[0].fiat,
          sources,
          buyRate: medianBuy,
          sellRate: medianSell,
          timestamp: new Date().toISOString(),
        };
      }
    });
  }

  private findMedianRate(data: Rate[]): [number, number] {
    const buyRates = data
      .map((item) => item.buyRate)
      .filter((rate): rate is number => typeof rate === 'number')
      .sort((a, b) => a - b);
    const sellRates = data
      .map((item) => item.sellRate)
      .filter((rate): rate is number => typeof rate === 'number')
      .sort((a, b) => a - b);

    return [this.median(buyRates), this.median(sellRates)];
  }

  private median(array: number[]): number {
    const mid = Math.floor(array.length / 2);
    return array.length % 2 !== 0
      ? array[mid]
      : (array[mid - 1] + array[mid]) / 2;
  }
}
