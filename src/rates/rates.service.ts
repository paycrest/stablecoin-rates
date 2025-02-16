import { Injectable } from '@nestjs/common';
import { GetRatesDTO } from './dto';

@Injectable()
export class RatesService {
  getRates(payload: GetRatesDTO) {
    try {
      const { coin, fiat } = payload;

      return [];
    } catch (error) {}
  }
}
