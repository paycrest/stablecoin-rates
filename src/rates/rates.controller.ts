import { Controller, Get, Inject, Param } from '@nestjs/common';
import { RatesService } from './rates.service';

@Controller('rates')
export class RatesController {
  @Inject(RatesService) private readonly ratesService: RatesService;

  @Get('/:stablecoin/:fiats')
  getRatesForStablecoinAndFiats(
    @Param('stablecoin') stablecoin: string,
    @Param('fiats') fiats: string,
  ) {
    return this.ratesService.getRatesByStablecoinAndFiats(stablecoin, fiats);
  }

  @Get('/:stablecoin')
  getRatesForStablecoin(@Param('stablecoin') stablecoin: string) {
    return this.ratesService.getRatesByStablecoin(stablecoin);
  }
}
