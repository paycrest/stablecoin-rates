import axios from 'axios';
import { logger } from '../common';
import {
  getUsdcUsdtPeg,
  isPegInBand,
  resetUsdcUsdtPegCache,
} from './usdc-usdt-peg';

describe('usdc-usdt-peg', () => {
  let get: jest.SpyInstance;

  beforeEach(() => {
    resetUsdcUsdtPegCache();
    jest.spyOn(logger, 'warn').mockImplementation();
    get = jest.spyOn(axios, 'get');
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts only values near 1.0', () => {
    expect(isPegInBand(1.0011)).toBe(true);
    expect(isPegInBand(0.98)).toBe(false);
    expect(isPegInBand(1.02)).toBe(false);
    expect(isPegInBand(NaN)).toBe(false);
  });

  it('uses the Binance book mid and caches it', async () => {
    get.mockResolvedValue({ data: { bidPrice: '1.0010', askPrice: '1.0012' } });
    const peg = await getUsdcUsdtPeg();
    expect(peg).toEqual(expect.objectContaining({ source: 'binance' }));
    expect(peg?.rate).toBeCloseTo(1.0011, 6);
    await getUsdcUsdtPeg();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back to Fawaz when Binance fails', async () => {
    get
      .mockRejectedValueOnce(new Error('451'))
      .mockResolvedValueOnce({ data: { usdc: { usdt: 1.0012 } } });
    const peg = await getUsdcUsdtPeg();
    expect(peg).toEqual(
      expect.objectContaining({ source: 'fawaz-exchange-api', rate: 1.0012 }),
    );
  });

  it('returns null when every value is out of band', async () => {
    get
      .mockResolvedValueOnce({ data: { bidPrice: '0.95', askPrice: '0.96' } })
      .mockResolvedValueOnce({ data: { usdc: { usdt: 0.95 } } });
    expect(await getUsdcUsdtPeg()).toBeNull();
  });
});
