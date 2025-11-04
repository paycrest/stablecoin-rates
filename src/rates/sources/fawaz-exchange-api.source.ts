import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
import type { ServiceResponse } from '../../common/interfaces';

/**
 * Represents the Fawaz Exchange Api data source.
 * Extends the generic Source class with the unique source name 'fawaz-exchange-api'.
 */
export class FawazExchangeApi extends Source<'fawaz-exchange-api'> {
  /**
   * Unique name of the source.
   */
  static sourceName = 'fawaz-exchange-api' as const;

  /**
   * Supported stablecoins for Fawaz Exchange Api.
   */
  static stablecoins: Stablecoin[] = ['USDT', 'USDC'];

  /**
   * Returns the Fawaz Ahmed currency API endpoint URL for USDT.
   */
  private getEndpoint(stablecoin: Stablecoin): string {
    return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${stablecoin.toLowerCase()}.json`;
  }

  /**
   * Fetches rates from the Fawaz Ahmed currency API for the specified fiat currency.
   * Supports USDT and USDC stablecoins
   *
   * @param fiat - The fiat currency code to fetch the rate for (e.g., 'usd', 'eur').
   * @returns A promise that resolves to a ServiceResponse.
   */
  async fetchData(fiat: string): Promise<ServiceResponse> {
    try {
      const fiatCode = fiat.toLowerCase();
      const fiatCodeUpper = fiat.toUpperCase();
      const results = [];
      for (const stablecoin of FawazExchangeApi.stablecoins) {
        const endpoint = this.getEndpoint(stablecoin);
        try {
          const response = await axios.get(endpoint, { timeout: 10000 });

          if (!response.data || typeof response.data !== 'object') {
            logger.warn(
              `Invalid response structure from Fawaz Ahmed API for ${stablecoin}`,
            );
            continue;
          }

          const { date } = response.data;
          const ratesObj = response.data[stablecoin.toLowerCase()];

          if (!date) {
            logger.warn(
              `Missing date in response from Fawaz Ahmed API for ${stablecoin}`,
            );
            continue;
          }
          const rate = ratesObj ? ratesObj[fiatCode] : undefined;
          if (!rate) {
            logger.warn(
              `No rate found for ${stablecoin}/${fiatCode} from Fawaz Ahmed API`,
            );
            continue;
          }
          results.push({
            fiat: fiatCodeUpper,
            stablecoin,
            buyRate: rate,
            sellRate: rate,
            source: FawazExchangeApi.sourceName,
            date,
          });
        } catch (error) {
          logger.error(
            `Fawaz Ahmed API error for ${stablecoin}/${fiatCode}:`,
            error,
          );
        }
      }

      if (results.length === 0) {
        return {
          success: false,
          message: `No rates found for ${fiatCode} from Fawaz Ahmed API`,
          statusCode: HttpStatus.NO_CONTENT,
        };
      }

      // Save to database
      await this.saveRates(results);

      return {
        success: true,
        message: `Successfully fetched ${results.length} rates for ${fiatCode} from Fawaz Ahmed API`,
        statusCode: HttpStatus.OK,
        data: results,
      };
    } catch (error) {
      logger.error(`Fawaz Ahmed API fetchData error for ${fiat}:`, error);
      return {
        success: false,
        message: `Failed to fetch data for ${fiat} from Fawaz Ahmed API: ${error.message}`,
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
        logger.error(
          `Failed to save rate ${rate.stablecoin}/${rate.fiat}:`,
          error,
        );
      }
    }
  }
}
