import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
import type { ServiceResponse } from '../../common/interfaces';

/**
 * Represents the Monierate data source.
 * Monierate is an aggregator that lists exchange rates from multiple providers.
 * This source returns the best competitive rate: it anchors on the most
 * favourable rate that has market support (the lowest buy / highest sell that
 * at least a couple of providers agree on) and averages that cluster, ignoring
 * lone outliers that sit far from the rest of the market.
 */
export class Monierate extends Source<'monierate'> {
  /**
   * Unique name of the source.
   */
  static sourceName = 'monierate' as const;

  /**
   * Supported stablecoins for Monierate.
   */
  static stablecoins: Stablecoin[] = ['USDT', 'USDC'];

  /**
   * Calculate the average of an array, rounded to 2 decimal places.
   */
  private average(values: number[]): number {
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  /**
   * Compute the best competitive rate for one side of the book.
   *
   * The "best" rate is the most favourable to the user — the lowest for `buy`
   * (cheapest to acquire) and the highest for `sell` (most received). To avoid
   * a single rogue provider hijacking the result, we only anchor on a value
   * that has support: at least `minSupport` providers within `tolerance` of it.
   * If the most favourable value is a lone outlier we step inward to the next
   * one until a supported anchor is found, then average that cluster.
   *
   * An optional `floor` restricts the candidates to rates strictly above it.
   * This is used to keep the buy rate above the sell rate (a normal spread):
   * any buy quote at or below the chosen sell is ignored.
   *
   * @param rates - The list of provider rates for this side.
   * @param side - 'buy' (lower is better) or 'sell' (higher is better).
   * @param options.tolerance - Window width, in fiat units, around the anchor.
   * @param options.minSupport - Minimum providers required within the window.
   * @param options.floor - Exclusive lower bound; rates <= floor are dropped.
   */
  private bestRate(
    rates: number[],
    side: 'buy' | 'sell',
    {
      tolerance = 5,
      minSupport = 2,
      floor,
    }: { tolerance?: number; minSupport?: number; floor?: number } = {},
  ): number {
    // Restrict to rates above the floor (e.g. buy must exceed sell); if nothing
    // qualifies, fall back to the full set so we still return a rate.
    let pool = floor === undefined ? rates : rates.filter((r) => r > floor);
    if (pool.length === 0) pool = rates;

    // Order best-first: ascending for buy (lowest), descending for sell (highest).
    const ordered = [...pool].sort((a, b) => (side === 'buy' ? a - b : b - a));

    for (const anchor of ordered) {
      const cluster =
        side === 'buy'
          ? pool.filter((r) => r >= anchor && r <= anchor + tolerance)
          : pool.filter((r) => r <= anchor && r >= anchor - tolerance);

      if (cluster.length >= minSupport) {
        return this.average(cluster);
      }
    }

    // No supported cluster (e.g. very few providers) — fall back to the best value.
    return ordered[0];
  }

  /**
   * Scrapes Monierate website for stablecoin rates
   */
  private async scrapeMonierate(
    fiat: string,
    stablecoin: string,
  ): Promise<Array<{ buyRate: number; sellRate: number }>> {
    try {
      const response = await axios.get(
        `https://monierate.com/?base=${stablecoin.toUpperCase()}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15000,
        },
      );

      const html = response.data;
      const providers: Array<{ buyRate: number; sellRate: number }> = [];

      // Extract table rows - pattern matches: provider name from img alt, buy rate, sell rate
      const rowPattern =
        /<tr[^>]*>[\s\S]*?<img[^>]*alt="([^"]+)"[^>]*>[\s\S]*?<td[^>]*>.*?₦([\d,]+)[\s\S]*?<td[^>]*>.*?₦([\d,]+)/g;

      let match;
      while ((match = rowPattern.exec(html)) !== null) {
        const buyText = match[2];
        const sellText = match[3];

        const buyRate = buyText ? parseFloat(buyText.replace(/,/g, '')) : null;
        const sellRate = sellText
          ? parseFloat(sellText.replace(/,/g, ''))
          : null;

        // Only include providers with both buy and sell rates
        if (buyRate && !isNaN(buyRate) && sellRate && !isNaN(sellRate)) {
          providers.push({ buyRate, sellRate });
        }
      }

      if (providers.length === 0) {
        throw new Error(
          'No providers found in HTML. HTML structure may have changed.',
        );
      }

      return providers;
    } catch (error) {
      logger.error(`Error scraping Monierate for ${fiat}:`, error);
      throw error;
    }
  }

  /**
   * Fetches data from Monierate for the specified fiat currency.
   * Returns the best competitive buy/sell rate across all providers on Monierate.
   *
   * @param fiat - The fiat currency to fetch data for.
   * @returns A promise that resolves to a ServiceResponse indicating success or failure.
   */
  async fetchData(fiat: string): Promise<ServiceResponse> {
    try {
      // Use the request queue to prevent rate limiting
      const result = await this.queuedRequest(async () => {
        const promises = Monierate.stablecoins.map(async (stablecoin) => {
          try {
            // Scrape Monierate for all providers
            const providers = await this.scrapeMonierate(fiat, stablecoin);

            // Take the best competitive rate on each side of the book.
            // Sell is computed first so buy can be floored above it (buy > sell).
            const sellRate = this.bestRate(
              providers.map((p) => p.sellRate),
              'sell',
            );
            const buyRate = this.bestRate(
              providers.map((p) => p.buyRate),
              'buy',
              { floor: sellRate },
            );

            if (isNaN(buyRate) || isNaN(sellRate)) {
              logger.warn(
                `Invalid rates for ${stablecoin}/${fiat} on Monierate`,
              );
              return null;
            }

            logger.debug(
              `Monierate best rate for ${stablecoin}/${fiat}: Buy: ${buyRate}, Sell: ${sellRate} (from ${providers.length} providers)`,
            );

            return {
              fiat: fiat.toUpperCase(),
              stablecoin,
              buyRate,
              sellRate,
              source: Monierate.sourceName,
            };
          } catch (error) {
            logger.error(
              `Error fetching ${stablecoin}/${fiat} from Monierate:`,
              error.message,
            );
            return null;
          }
        });

        return Promise.all(promises);
      });

      const validResults = result.filter(Boolean);

      if (validResults.length === 0) {
        return {
          success: false,
          message: `No data fetched for ${fiat} from Monierate`,
          statusCode: HttpStatus.NO_CONTENT,
        };
      }

      // Save to database using the parent class method
      await this.logData(validResults);

      return {
        success: true,
        message: `Successfully fetched ${validResults.length} rates for ${fiat} from Monierate`,
        statusCode: HttpStatus.OK,
        data: validResults,
      };
    } catch (error) {
      logger.error(`Monierate fetchData error for ${fiat}:`, error);
      return {
        success: false,
        message: `Failed to fetch data for ${fiat} from Monierate: ${error.message}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
