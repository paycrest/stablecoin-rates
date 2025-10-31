import { Module, OnModuleInit } from '@nestjs/common';
import * as currencies from './currencies';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { Currency } from './currencies';

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
    // Instantiate all currency classes (they will auto-register with the scheduler)
    // Filter out the base Currency class and any non-currency exports
    const currencyClasses = Object.values(currencies).filter(
      (cls) => typeof cls === 'function' && cls !== Currency && cls.prototype instanceof Currency
    );

    // Instantiate each currency class
    currencyClasses.forEach((CurrencyClass: any) => {
      new CurrencyClass();
    });

    // Start the centralized scheduler
    Currency.startScheduler();
  }
}
