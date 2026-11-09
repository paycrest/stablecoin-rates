import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
import { describeHttpResponse } from './http-diagnostics';
import type { ServiceResponse } from '../../common/interfaces';

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
   * Supported stablecoins for Quidax.
   */
  static stablecoins: Stablecoin[] = ['USDT'];

  /**
   * Converts a Quidax ticker into this service's buy/sell convention.
   *
   * Quidax's ticker follows exchange order-book naming: `buy` is the best bid
   * (what a buyer offers, i.e. what a user receives when selling the
   * stablecoin) and `sell` is the best ask (what a seller wants, i.e. what a
   * user pays when buying the stablecoin). This service, like Monierate and
   * Binance P2P, names rates from the user's side: `buyRate` is the fiat price
   * paid to buy the stablecoin (higher) and `sellRate` is the fiat received when
   * selling it (lower). The two columns are therefore swapped here.
   *
   * @returns The rates, or null if they are invalid or the book is crossed.
   */
  static toRates(ticker: {
    buy: string;
    sell: string;
  }): { buyRate: number; sellRate: number } | null {
    const bid = parseFloat(ticker?.buy);
    const ask = parseFloat(ticker?.sell);

    if (!(bid > 0) || !(ask > 0) || ask < bid) return null;

    return { buyRate: ask, sellRate: bid };
  }

  /**
   * Returns the Quidax API endpoint URL for a given fiat currency.
   *
   * @param fiat - The fiat currency code.
   * @returns The endpoint URL.
   */
  private getEndpoint(fiat: string): string {
    return `https://app.quidax.io/api/v1/markets/tickers/usdt${fiat.toLowerCase()}`;
  }

  /**
   * Fetches data from the Quidax API for the specified fiat currency.
   *
   * @param fiat - The fiat currency to fetch data for.
   * @returns A promise that resolves to a ServiceResponse indicating success or failure.
   */
  async fetchData(fiat: string): Promise<ServiceResponse> {
    try {
      // Use the request queue to prevent rate limiting
      const result = await this.queuedRequest(async () => {
        const promises = Quidax.stablecoins.map(async (stablecoin) => {
          try {
            const url = this.getEndpoint(fiat);
            const response = await axios.get(url, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; StablecoinRates/1.0)',
              },
              validateStatus: () => true,
            });

            if (
              response.status !== HttpStatus.OK ||
              response.data?.status !== 'success' ||
              !response.data?.data?.ticker
            ) {
              logger.warn(
                `Unexpected Quidax response for ${stablecoin}/${fiat}: ${JSON.stringify(
                  describeHttpResponse(response),
                )}`,
              );
              return null;
            }

            const { ticker } = response.data.data;
            const rates = Quidax.toRates(ticker);

            if (!rates) {
              logger.warn(
                `Invalid rates for ${stablecoin}/${fiat} on Quidax: buy=${ticker.buy} sell=${ticker.sell}`,
              );
              return null;
            }

            return {
              fiat,
              stablecoin,
              ...rates,
              source: Quidax.sourceName,
            };
          } catch (error) {
            logger.error(
              `Error fetching ${stablecoin}/${fiat} from Quidax:`,
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
          message: `No data fetched for ${fiat} from Quidax`,
          statusCode: HttpStatus.NO_CONTENT,
        };
      }

      // Save to database
      const saved = await this.logData(validResults);
      if (!saved) {
        return {
          success: false,
          message: `Fetched rates for ${fiat} from Quidax but failed to save them`,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        message: `Successfully fetched ${validResults.length} rates for ${fiat} from Quidax`,
        statusCode: HttpStatus.OK,
        data: validResults,
      };
    } catch (error) {
      logger.error(`Quidax fetchData error for ${fiat}:`, error);
      return {
        success: false,
        message: `Failed to fetch data for ${fiat} from Quidax: ${error.message}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
