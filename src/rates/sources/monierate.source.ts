import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
import type { ServiceResponse } from '../../common/interfaces';

/**
 * Represents the Monierate data source.
 * Monierate is an aggregator that collects rates from multiple providers.
 * This source returns the market consensus (median) rate from all providers on Monierate.
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
   * Calculate median of an array
   */
  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Find consensus rate (most common rate range)
   * Groups rates into buckets and finds the bucket with most providers
   */
  private findConsensus(
    rates: number[],
    bucketSize = 5,
  ): {
    median: number;
    count: number;
    range: { min: number; max: number };
  } {
    const buckets: Record<number, number> = {};
    rates.forEach((rate) => {
      const bucket = Math.floor(rate / bucketSize) * bucketSize;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    const maxBucket = Object.keys(buckets).reduce((a, b) =>
      buckets[parseInt(a)] > buckets[parseInt(b)] ? a : b,
    );
    const bucketStart = parseInt(maxBucket);
    const bucketEnd = bucketStart + bucketSize;
    const providersInBucket = rates.filter(
      (r) => r >= bucketStart && r < bucketEnd,
    );
    return {
      range: { min: bucketStart, max: bucketEnd },
      count: buckets[parseInt(maxBucket)],
      median: this.median(providersInBucket),
    };
  }

  /**
   * Analyze provider rates to get market consensus
   */
  private analyzeRates(
    providers: Array<{ buyRate: number; sellRate: number }>,
  ): {
    buy: { consensus: { median: number } };
    sell: { consensus: { median: number } };
  } {
    const buyRates = providers.map((p) => p.buyRate);
    const sellRates = providers.map((p) => p.sellRate);

    return {
      buy: {
        consensus: this.findConsensus(buyRates),
      },
      sell: {
        consensus: this.findConsensus(sellRates),
      },
    };
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
        `https://monierate.com/?currency=${stablecoin.toUpperCase()}`,
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
   * Returns the market consensus (median) rate from all providers on Monierate.
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

            // Analyze to get market consensus
            const analysis = this.analyzeRates(providers);

            const buyRate = analysis.buy.consensus.median;
            const sellRate = analysis.sell.consensus.median;

            if (isNaN(buyRate) || isNaN(sellRate)) {
              logger.warn(
                `Invalid consensus rates for ${stablecoin}/${fiat} on Monierate`,
              );
              return null;
            }

            logger.debug(
              `Monierate consensus for ${stablecoin}/${fiat}: Buy: ${buyRate}, Sell: ${sellRate} (from ${providers.length} providers)`,
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
