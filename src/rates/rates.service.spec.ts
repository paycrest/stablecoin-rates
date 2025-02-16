import { Test, TestingModule } from '@nestjs/testing';
import { RatesService } from './rates.service';

describe('RatesService', () => {
  let service: RatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RatesService],
    }).compile();

    service = module.get<RatesService>(RatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
