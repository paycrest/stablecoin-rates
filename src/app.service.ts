import { Injectable } from '@nestjs/common';
import { ServiceResponse } from './common/interfaces';

@Injectable()
export class AppService {
  healthCheck(): ServiceResponse {
    return { success: true, message: 'Health OK!' };
  }
}
