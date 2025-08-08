import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { calculateMedian } from '../../../src/common';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
import type { ServiceResponse } from '../../common/interfaces';

/**
 * Represents the Binance data source.
 * Extends the generic Source class with the unique source name 'binance'.
 */
export class Binance extends Source<'binance'> {
  /**
   * Unique name of the source.
   */
  static sourceName = 'binance' as const;

  /**
   * Supported stablecoins for Binance.
   */
  static stablecoins: Stablecoin[] = ['USDT', 'USDC'];

  /**
   * Returns the Binance P2P API endpoint URL.
   *
   * @returns The endpoint URL.
   */
  private getEndpoint(): string {
    return 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  }

  /**
   * Fetches data from the Binance P2P API for the specified fiat currency.
   *
   * @param fiat - The fiat currency to fetch data for.
   * @returns A promise that resolves to a ServiceResponse indicating success or failure.
   */
  async fetchData(fiat: string): Promise<ServiceResponse> {
    try {
      // Use the request queue to prevent rate limiting
      const result = await this.queuedRequest(async () => {
        const promises = Binance.stablecoins.map(async (stablecoin) => {
          try {
            const [buyData, sellData] = await Promise.all([
              this.fetchMarketData(stablecoin, fiat, 'BUY'),
              this.fetchMarketData(stablecoin, fiat, 'SELL'),
            ]);

            const buyRates = buyData.map((item: any) => parseFloat(item.adv.price));
            const sellRates = sellData.map((item: any) => parseFloat(item.adv.price));

            if (buyRates.length === 0 || sellRates.length === 0) {
              logger.warn(`No rates found for ${stablecoin}/${fiat} on Binance`);
              return null;
            }

            const buyRate = calculateMedian(buyRates);
            const sellRate = calculateMedian(sellRates);

            return {
              fiat,
              stablecoin,
              buyRate,
              sellRate,
              source: Binance.sourceName,
            };
          } catch (error) {
            logger.error(`Error fetching ${stablecoin}/${fiat} from Binance:`, error.message);
            return null;
          }
        });

        return Promise.all(promises);
      });

      const validResults = result.filter(Boolean);
      
      if (validResults.length === 0) {
        return {
          success: false,
          message: `No data fetched for ${fiat} from Binance`,
          statusCode: HttpStatus.NO_CONTENT,
        };
      }

      // Save to database
      await this.saveRates(validResults);

      return {
        success: true,
        message: `Successfully fetched ${validResults.length} rates for ${fiat} from Binance`,
        statusCode: HttpStatus.OK,
        data: validResults,
      };

    } catch (error) {
      logger.error(`Binance fetchData error for ${fiat}:`, error);
      return {
        success: false,
        message: `Failed to fetch data for ${fiat} from Binance: ${error.message}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  /**
   * Fetches market data from Binance P2P API.
   */
  private async fetchMarketData(asset: string, fiat: string, tradeType: 'BUY' | 'SELL'): Promise<any[]> {
    const response = await axios.post(
      this.getEndpoint(),
      {
        asset,
        fiat,
        tradeType,
        page: 1,
        rows: 10,
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; StablecoinRates/1.0)',
        },
      }
    );

    return response.data?.data || [];
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
