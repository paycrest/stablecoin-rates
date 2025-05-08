import { Injectable } from '@nestjs/common';
import type { ServiceResponse } from './common/interfaces';

@Injectable()
export class AppService {
  healthCheck(): ServiceResponse {
    return { success: true, message: 'Health OK!' };
  }
}
