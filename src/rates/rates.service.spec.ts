import { Test, type TestingModule } from '@nestjs/testing';
import { Rate } from '../database/models';
import { logger } from '../common';
import * as appConfig from '../common/config';
import { Currency } from './currencies';
import { RatesService } from './rates.service';
import * as peg from './usdc-usdt-peg';

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
      .mockReturnValue(['binance', 'quidax']);

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
      row('binance', 1381, 1377, 8),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result).toEqual([
      {
        stablecoin: 'USDT',
        fiat: 'NGN',
        sources: ['binance', 'quidax'],
        buyRate: 1382,
        sellRate: 1377.2,
        timestamp: minutesAgo(3).toISOString(),
      },
    ]);
  });

  it('excludes a stale source instead of averaging it in or hiding it behind a fresh timestamp', async () => {
    const result = await serve([
      row('binance', 1100, 1090, 2 * 24 * 60),
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
      row('binance', 1381, 1377, 29),
      row('quidax', 1383, 1377.4, 31),
    ]);

    expect(result[0].sources).toEqual(['binance']);
  });

  it('serves only the freshest row, flagged stale with its real timestamp, when nothing is fresh', async () => {
    const result = await serve([
      row('binance', 1100, 1090, 3 * 60),
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
      row('binance', 1381, 1377, 90),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result[0].sources).toEqual(['binance', 'quidax']);
    expect(result[0].stale).toBeUndefined();
  });

  it('treats rows without updatedAt as stale', async () => {
    const result = await serve([
      row('binance', 1100, 1090, 0, { updatedAt: undefined }),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result[0].sources).toEqual(['quidax']);
  });

  it('ignores sources that are not configured for the fiat', async () => {
    const result = await serve([
      row('unconfigured', 1500, 1400, 1),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result[0].sources).toEqual(['quidax']);
  });

  it('keeps pairs independent', async () => {
    const result = await serve([
      row('binance', 1381, 1377, 5, { stablecoin: 'USDC' }),
      row('quidax', 1383, 1377.4, 3),
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.stablecoin === 'USDC')?.sources).toEqual([
      'binance',
    ]);
    expect(result.find((r) => r.stablecoin === 'USDT')?.sources).toEqual([
      'quidax',
    ]);
  });

  it('drops implausible NGN rows before computing the median', async () => {
    const result = await serve([
      row('binance', 0.89, 0.88, 1),
      row('quidax', 1385, 1379, 1),
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        sources: ['quidax'],
        buyRate: 1385,
        sellRate: 1379,
      }),
    ]);
  });

  it('never serves monierate for NGN even if configured', async () => {
    const result = await serve([
      row('monierate', 1381, 1377, 1),
      row('quidax', 1383, 1377.4, 3),
    ]);
    expect(result[0].sources).toEqual(['quidax']);
  });

  describe('derived USDC/NGN', () => {
    const pegFetchedAt = (minutes: number) => minutesAgo(minutes).getTime();
    let pegSpy: jest.SpyInstance;

    const serveUsdc = (rows: Rate[], fiats = 'NGN') => {
      jest.spyOn(Rate, 'findAll').mockImplementation((async (opts: any) =>
        rows.filter(
          (r) =>
            r.stablecoin === opts.where.stablecoin &&
            (!opts.where.fiat ||
              Object.getOwnPropertySymbols(opts.where.fiat)
                .flatMap((k) => opts.where.fiat[k])
                .includes(r.fiat)),
        )) as any);
      return fiats === '*'
        ? service.getRatesByStablecoin('USDC')
        : service.getRatesByStablecoinAndFiats('USDC', fiats);
    };

    beforeEach(() => {
      jest.spyOn(Currency, 'getConfiguredSources').mockReturnValue(['quidax']);
      pegSpy = jest.spyOn(peg, 'getUsdcUsdtPeg').mockResolvedValue({
        rate: 1.001,
        source: 'binance',
        fetchedAt: pegFetchedAt(1),
      });
    });

    it('derives USDC/NGN from fresh USDT/NGN x USDC/USDT', async () => {
      const result = await serveUsdc([row('quidax', 1385, 1379, 3)]);
      expect(result).toEqual([
        {
          stablecoin: 'USDC',
          fiat: 'NGN',
          sources: ['derived:quidax+binance'],
          buyRate: 1386.38,
          sellRate: 1380.38,
          timestamp: minutesAgo(3).toISOString(),
        },
      ]);
    });

    it('also derives for the all-fiats endpoint', async () => {
      const result = await serveUsdc([row('quidax', 1385, 1379, 3)], '*');
      expect(result.map((r) => r.sources)).toEqual([
        ['derived:quidax+binance'],
      ]);
    });

    it('uses the older input as the timestamp', async () => {
      pegSpy.mockResolvedValue({
        rate: 1,
        source: 'binance',
        fetchedAt: pegFetchedAt(10),
      });
      const result = await serveUsdc([row('quidax', 1385, 1379, 3)]);
      expect(result[0].timestamp).toBe(minutesAgo(10).toISOString());
    });

    it('does not derive from stale USDT/NGN', async () => {
      const result = await serveUsdc([row('quidax', 1385, 1379, 45)]);
      expect(result).toEqual([]);
    });

    it('does not derive without a peg', async () => {
      pegSpy.mockResolvedValue(null);
      const result = await serveUsdc([row('quidax', 1385, 1379, 3)]);
      expect(result).toEqual([]);
    });

    it('prefers a fresh direct USDC source', async () => {
      const result = await serveUsdc([
        row('quidax', 1390, 1380, 2, { stablecoin: 'USDC' }),
        row('quidax', 1385, 1379, 3),
      ]);
      expect(result[0].sources).toEqual(['quidax']);
      expect(pegSpy).not.toHaveBeenCalled();
    });

    it('replaces a stale direct USDC row with a fresh derived one', async () => {
      const result = await serveUsdc([
        row('quidax', 1300, 1290, 120, { stablecoin: 'USDC' }),
        row('quidax', 1385, 1379, 3),
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].sources).toEqual(['derived:quidax+binance']);
      expect(result[0].stale).toBeUndefined();
    });

    it('does not derive for USDT requests or non-listed fiats', async () => {
      const usdt = await serve([row('quidax', 1385, 1379, 3)]);
      expect(usdt[0].sources).toEqual(['quidax']);
      const kes = await serveUsdc(
        [row('quidax', 129, 128, 3, { fiat: 'KES' })],
        'KES',
      );
      expect(kes).toEqual([]);
      expect(pegSpy).not.toHaveBeenCalled();
    });
  });
});
