import { Module, OnModuleInit } from '@nestjs/common';
import * as currencies from './currencies';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { Currency } from './currencies';
import { logger } from 'src/common';

@Module({
  imports: [],
  providers: [RatesService],
  controllers: [RatesController],
})
export class RatesModule implements OnModuleInit {
  /**
   * Initialize all currency instances and start the centralized scheduler
   */
  onModuleInit() {
    logger.log('Initializing currency scheduler...');
    // Instantiate all currency classes (they will auto-register with the scheduler)
    // Filter out the base Currency class and any non-currency exports
    const currencyClasses = Object.values(currencies).filter(
      (cls) => typeof cls === 'function' && cls !== Currency && cls.prototype instanceof Currency
    );

    let successCount = 0;
    let failureCount = 0;

    // Instantiate each currency class
    currencyClasses.forEach((CurrencyClass: any) => {
      try {
        new CurrencyClass();
        successCount++;
      } catch (error) {
        failureCount++;
        logger.error(`Failed to initialize ${CurrencyClass.name}:`, error);
      }
    });

    logger.log(`Initialized ${successCount} currencies (${failureCount} failed)`);

    // Start the centralized scheduler
    Currency.startScheduler();
    logger.log('Currency scheduler started');
  }
}
