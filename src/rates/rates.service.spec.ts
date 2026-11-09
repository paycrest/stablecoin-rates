import { Test, type TestingModule } from '@nestjs/testing';
import { Rate } from '../database/models';
import { logger } from '../common';
import * as appConfig from '../common/config';
import { Currency } from './currencies';
import { RatesService } from './rates.service';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60 * 1000);

const row = (
  source: string,
  buyRate: number,
  sellRate: number,
  updatedMinutesAgo: number,
  overrides: Partial<Rate> = {},
) =>
  ({
    fiat: 'NGN',
    stablecoin: 'USDT',
    source,
    buyRate,
    sellRate,
    updatedAt: minutesAgo(updatedMinutesAgo),
    ...overrides,
  }) as unknown as Rate;

describe('RatesService', () => {
  let service: RatesService;

  const serve = (rows: Rate[]) => {
    jest.spyOn(Rate, 'findAll').mockResolvedValue(rows);
    return service.getRatesByStablecoin('USDT');
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.spyOn(logger, 'warn').mockImplementation();
    jest
      .spyOn(Currency, 'getConfiguredSources')
      .mockReturnValue(['monierate', 'quidax']);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RatesService],
    }).compile();

    service = module.get<RatesService>(RatesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    (appConfig as { config: unknown }).config = undefined;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('takes the median of fresh sources and the newest timestamp among them', async () => {
    const result = await serve([
      row('monierate', 1381, 1377, 8),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result).toEqual([
      {
        stablecoin: 'USDT',
        fiat: 'NGN',
        sources: ['monierate', 'quidax'],
        buyRate: 1382,
        sellRate: 1377.2,
        timestamp: minutesAgo(3).toISOString(),
      },
    ]);
  });

  it('excludes a stale source instead of averaging it in or hiding it behind a fresh timestamp', async () => {
    const result = await serve([
      row('monierate', 1100, 1090, 2 * 24 * 60),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result).toEqual([
      {
        stablecoin: 'USDT',
        fiat: 'NGN',
        sources: ['quidax'],
        buyRate: 1383,
        sellRate: 1377.4,
        timestamp: minutesAgo(3).toISOString(),
      },
    ]);
  });

  it('defaults to a 30 minute max age', async () => {
    const result = await serve([
      row('monierate', 1381, 1377, 29),
      row('quidax', 1383, 1377.4, 31),
    ]);

    expect(result[0].sources).toEqual(['monierate']);
  });

  it('serves only the freshest row, flagged stale with its real timestamp, when nothing is fresh', async () => {
    const result = await serve([
      row('monierate', 1100, 1090, 3 * 60),
      row('quidax', 1383, 1377.4, 90),
    ]);

    expect(result).toEqual([
      {
        stablecoin: 'USDT',
        fiat: 'NGN',
        sources: ['quidax'],
        buyRate: 1383,
        sellRate: 1377.4,
        timestamp: minutesAgo(90).toISOString(),
        stale: true,
      },
    ]);
  });

  it('honours RATE_MAX_AGE_MINUTES from config', async () => {
    (appConfig as { config: unknown }).config = { RATE_MAX_AGE_MINUTES: 120 };

    const result = await serve([
      row('monierate', 1381, 1377, 90),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result[0].sources).toEqual(['monierate', 'quidax']);
    expect(result[0].stale).toBeUndefined();
  });

  it('treats rows without updatedAt as stale', async () => {
    const result = await serve([
      row('monierate', 1100, 1090, 0, { updatedAt: undefined }),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result[0].sources).toEqual(['quidax']);
  });

  it('ignores sources that are not configured for the fiat', async () => {
    const result = await serve([
      row('binance', 1500, 1400, 1),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result[0].sources).toEqual(['quidax']);
  });

  it('keeps pairs independent', async () => {
    const result = await serve([
      row('monierate', 1381, 1377, 5, { stablecoin: 'USDC' }),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.stablecoin === 'USDC')?.sources).toEqual([
      'monierate',
    ]);
    expect(result.find((r) => r.stablecoin === 'USDT')?.sources).toEqual([
      'quidax',
    ]);
  });
});
