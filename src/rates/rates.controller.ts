import { Body, Controller, Inject, Post } from '@nestjs/common';
import { RatesService } from './rates.service';
import { GetRatesDTO } from './dto';

@Controller('rates')
export class RatesController {
  @Inject(RatesService) private readonly ratesService: RatesService;

  @Post()
  getRates(@Body() form: GetRatesDTO) {
    return this.ratesService.getRates(form);
  }
}
