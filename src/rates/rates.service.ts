import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Rate } from '../../src/database/models';
import { Currency } from './currencies';
import { logger } from '../common';
import { config, DEFAULT_RATE_MAX_AGE_MINUTES } from '../common/config';

const STALE_LOG_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Service for handling operations related to rate data.
 *
 * This service provides methods to fetch rate records from the database,
 * calculate median rates from multiple records, and group them by fiat-stablecoin pairs.
 */
@Injectable()
export class RatesService {
  private readonly lastStaleLog = new Map<string, number>();

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
   * The method groups the records by the combination of fiat and stablecoin and
   * keeps only configured sources. Rows not refreshed within the configured max
   * age (`RATE_MAX_AGE_MINUTES`) are excluded so a dead source can neither skew
   * the median nor sit behind a fresh timestamp from another source. If every
   * row for a pair is stale, only the freshest one is served, flagged with
   * `stale: true`, and carries its real (old) timestamp so consumers can reject
   * it. The timestamp always reflects the rows actually used.
   *
   * @param data - An array of Rate objects.
   * @param now - Current time in epoch milliseconds (injectable for tests).
   * @returns An array of objects each containing the trading pair, stablecoin, fiat, sources,
   *          median buy rate, median sell rate, and a timestamp.
   */
  private calculateMedianRates(data: Rate[], now: number = Date.now()) {
    const maxAgeMs = this.getMaxAgeMs();
    const grouped = data.reduce(
      (acc, item) => {
        const key = `${item.fiat}-${item.stablecoin}`;
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
      },
      {} as { [key: string]: Rate[] },
    );

    return Object.values(grouped)
      .map((items) => {
        const fiat = items[0].fiat;
        const configuredSources = Currency.getConfiguredSources(fiat);

        // Filter items to only include configured sources
        const filteredItems =
          configuredSources.length > 0
            ? items.filter((item) => configuredSources.includes(item.source))
            : items;

        // If no items remain after filtering, return empty or skip
        if (filteredItems.length === 0) {
          return null;
        }

        const pair = `${fiat}-${filteredItems[0].stablecoin}`;
        const updatedAtMs = (item: Rate) =>
          item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

        const freshItems = filteredItems.filter(
          (item) => now - updatedAtMs(item) <= maxAgeMs,
        );

        let usedItems = freshItems;
        let stale = false;

        if (freshItems.length === 0) {
          stale = true;
          usedItems = [
            filteredItems.reduce((latest, item) =>
              updatedAtMs(item) > updatedAtMs(latest) ? item : latest,
            ),
          ];
          this.logStaleOnce(
            pair,
            `All sources for ${pair} are older than ${maxAgeMs / 60000} min (${this.describeAges(filteredItems, now)}); serving the freshest with its original timestamp`,
          );
        } else if (freshItems.length < filteredItems.length) {
          const excluded = filteredItems.filter((i) => !freshItems.includes(i));
          this.logStaleOnce(
            pair,
            `Excluding stale sources for ${pair}: ${this.describeAges(excluded, now)}`,
          );
        }

        const timestamp = new Date(
          Math.max(...usedItems.map(updatedAtMs)),
        ).toISOString();

        if (usedItems.length === 1) {
          const item = usedItems[0];

          return {
            stablecoin: item.stablecoin,
            fiat: item.fiat,
            sources: [item.source],
            buyRate: Number.parseFloat(item.buyRate.toFixed(2)),
            sellRate: Number.parseFloat(item.sellRate.toFixed(2)),
            timestamp,
            ...(stale ? { stale: true } : {}),
          };
        } else {
          const [medianBuy, medianSell] = this.findMedianRate(usedItems);
          const sources = usedItems.map((item) => item.source);
          return {
            stablecoin: usedItems[0].stablecoin,
            fiat: usedItems[0].fiat,
            sources,
            buyRate: Number.parseFloat(medianBuy.toFixed(2)),
            sellRate: Number.parseFloat(medianSell.toFixed(2)),
            timestamp,
          };
        }
      })
      .filter((item) => item !== null);
  }

  private getMaxAgeMs(): number {
    const minutes = config?.RATE_MAX_AGE_MINUTES;
    return (
      (typeof minutes === 'number' && minutes > 0
        ? minutes
        : DEFAULT_RATE_MAX_AGE_MINUTES) *
      60 *
      1000
    );
  }

  private describeAges(items: Rate[], now: number): string {
    return items
      .map((item) => {
        const updated = item.updatedAt
          ? new Date(item.updatedAt).getTime()
          : NaN;
        return Number.isNaN(updated)
          ? `${item.source}: never updated`
          : `${item.source}: ${Math.round((now - updated) / 60000)} min old`;
      })
      .join(', ');
  }

  /**
   * Logs a staleness warning at most once every few minutes per pair, since
   * this runs on every API request.
   */
  private logStaleOnce(pair: string, message: string) {
    const nowMs = Date.now();
    const last = this.lastStaleLog.get(pair) ?? 0;
    if (nowMs - last < STALE_LOG_INTERVAL_MS) return;
    this.lastStaleLog.set(pair, nowMs);
    logger.warn(message);
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
