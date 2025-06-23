import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Rate } from '../../src/database/models';

/**
 * Service for handling operations related to rate data.
 *
 * This service provides methods to fetch rate records from the database,
 * calculate median rates from multiple records, and group them by fiat-stablecoin pairs.
 */
@Injectable()
export class RatesService {
  /**
   * Retrieves rate records for a given stablecoin filtered by a comma-separated list of fiat currencies,
   * then calculates and returns the median rates.
   *
   * @param stablecoin - The stablecoin identifier (e.g., 'USDT').
   * @param fiats - A comma-separated string of fiat currencies (e.g., 'USD,EUR').
   * @returns A promise resolving to an array of objects containing median rate data.
   */
  async getRatesByStablecoinAndFiats(stablecoin: string, fiats: string) {
    const fiatArray = fiats.split(',').map((fiat) => fiat.toUpperCase().trim());
    const rates = await Rate.findAll({
      where: {
        stablecoin: stablecoin.toUpperCase(),
        fiat: { [Op.in]: fiatArray },
      },
    });
    return this.calculateMedianRates(rates);
  }

  /**
   * Retrieves all rate records for a given stablecoin, then calculates and returns the median rates.
   *
   * @param stablecoin - The stablecoin identifier (e.g., 'USDT').
   * @returns A promise resolving to an array of objects containing median rate data.
   */
  async getRatesByStablecoin(stablecoin: string) {
    const rates = await Rate.findAll({
      where: { stablecoin: stablecoin.toUpperCase() },
    });
    return this.calculateMedianRates(rates);
  }

  /**
   * Calculates median buy and sell rates for each fiat-stablecoin pair from the provided rate records.
   *
   * The method groups the records by the combination of fiat and stablecoin.
   * If a group contains a single record, that record is used directly;
   * otherwise, the median buy and sell rates are calculated.
   *
   * @param data - An array of Rate objects.
   * @returns An array of objects each containing the trading pair, stablecoin, fiat, sources,
   *          median buy rate, median sell rate, and a timestamp.
   */
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

    return Object.values(grouped).map((items) => {
      if (items.length === 1) {
        const item = items[0];

        return {
          stablecoin: item.stablecoin,
          fiat: item.fiat,
          sources: [item.source],
          buyRate: Number.parseFloat(item.buyRate.toFixed(2)),
          sellRate: Number.parseFloat(item.sellRate.toFixed(2)),
          timestamp: new Date().toISOString(),
        };
      } else {
        const [medianBuy, medianSell] = this.findMedianRate(items);
        const sources = items.map((item) => item.source);
        return {
          stablecoin: items[0].stablecoin,
          fiat: items[0].fiat,
          sources,
          buyRate: Number.parseFloat(medianBuy.toFixed(2)),
          sellRate: Number.parseFloat(medianSell.toFixed(2)),
          timestamp: new Date().toISOString(),
        };
      }
    });
  }

  /**
   * Finds the median buy and sell rates from an array of Rate objects.
   *
   * @param data - An array of Rate objects.
   * @returns A tuple where the first element is the median buy rate and the second element is the median sell rate.
   */
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

  /**
   * Computes the median of an array of numbers.
   *
   * @param array - An array of numbers.
   * @returns The median value.
   */
  private median(array: number[]): number {
    const mid = Math.floor(array.length / 2);
    return array.length % 2 !== 0
      ? array[mid]
      : (array[mid - 1] + array[mid]) / 2;
  }
}
