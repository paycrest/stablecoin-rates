import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
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
            });

            if (response.status === HttpStatus.OK && response.data && response.data.status === 'success') {
              const ticker = response.data.data.ticker;
              
              // Extract buy and sell rates from Quidax response
              const buyRate = parseFloat(ticker.buy);
              const sellRate = parseFloat(ticker.sell);

              if (isNaN(buyRate) || isNaN(sellRate)) {
                logger.warn(`Invalid rates for ${stablecoin}/${fiat} on Quidax`);
                return null;
              }

              return {
                fiat,
                stablecoin,
                buyRate,
                sellRate,
                source: Quidax.sourceName,
              };
            }

            return null;
          } catch (error) {
            logger.error(`Error fetching ${stablecoin}/${fiat} from Quidax:`, error.message);
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
      await this.saveRates(validResults);

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

  /**
   * Saves the fetched rates to the database.
   */
  private async saveRates(rates: any[]): Promise<void> {
    const { Rate } = await import('../../database/models');
    
    for (const rate of rates) {
      try {
        // Check if rate already exists, if not create new one (let UUID auto-generate)
        const existingRate = await Rate.findOne({
          where: {
            source: rate.source,
            stablecoin: rate.stablecoin,
            fiat: rate.fiat,
          },
        });

        if (existingRate) {
          // Update existing rate
          await existingRate.update({
            buyRate: rate.buyRate,
            sellRate: rate.sellRate,
          });
        } else {
          // Create new rate (UUID will auto-generate)
          await Rate.create(rate);
        }
      } catch (error) {
        logger.error(`Failed to save rate ${rate.stablecoin}/${rate.fiat}:`, error);
      }
    }
  }
}
