import axios from 'axios';
import { logger } from 'src/common';
import { Quidax } from './quidax.source';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

// Real ticker captured from app.quidax.io on 2026-11-09. Monierate listed the
// same quotes for Quidax-backed provider "Doux" as buy 1383.01 / sell 1377.48.
const TICKER = { buy: '1377.48', sell: '1383.01' };

describe('Quidax', () => {
  describe('toRates', () => {
    it('maps the order-book bid/ask onto the buyRate > sellRate convention', () => {
      // buyRate is what a user pays to buy USDT (the ask), sellRate is what
      // they receive selling it (the bid), matching Monierate and Binance P2P.
      expect(Quidax.toRates(TICKER)).toEqual({
        buyRate: 1383.01,
        sellRate: 1377.48,
      });
    });

    it('rejects crossed or invalid tickers', () => {
      expect(Quidax.toRates({ buy: '1400', sell: '1380' })).toBeNull();
      expect(Quidax.toRates({ buy: 'abc', sell: '1380' })).toBeNull();
      expect(Quidax.toRates({ buy: '0', sell: '0' })).toBeNull();
    });
  });

  describe('fetchData', () => {
    let source: Quidax;
    let logData: jest.SpyInstance;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      mockedGet.mockReset();
      source = new Quidax();
      jest
        .spyOn(source as any, 'queuedRequest')
        .mockImplementation((fn: any) => fn());
      logData = jest.spyOn(source, 'logData').mockResolvedValue(true);
      warn = jest.spyOn(logger, 'warn').mockImplementation();
      jest.spyOn(logger, 'error').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    it('saves the ticker in buy > sell order', async () => {
      mockedGet.mockResolvedValue({
        status: 200,
        data: {
          status: 'success',
          data: { at: 1794219610, ticker: TICKER, market: 'usdtngn' },
        },
      });

      const response = await source.fetchData('NGN');

      expect(response.success).toBe(true);
      expect(mockedGet.mock.calls[0][0]).toBe(
        'https://app.quidax.io/api/v1/markets/tickers/usdtngn',
      );
      expect(logData).toHaveBeenCalledWith([
        {
          fiat: 'NGN',
          stablecoin: 'USDT',
          buyRate: 1383.01,
          sellRate: 1377.48,
          source: 'quidax',
        },
      ]);
    });

    it('fails and logs diagnostics on a block page', async () => {
      mockedGet.mockResolvedValue({
        status: 403,
        statusText: 'Forbidden',
        headers: { 'content-type': 'text/html', server: 'cloudflare' },
        data: '<html><title>Attention Required! | Cloudflare</title></html>',
        config: { url: 'https://app.quidax.io/x' },
      });

      const response = await source.fetchData('NGN');

      expect(response.success).toBe(false);
      expect(logData).not.toHaveBeenCalled();
      const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('"status":403');
      expect(logged).toContain('Attention Required');
    });

    it('fails when saving fails', async () => {
      mockedGet.mockResolvedValue({
        status: 200,
        data: { status: 'success', data: { ticker: TICKER } },
      });
      logData.mockResolvedValue(false);

      const response = await source.fetchData('NGN');

      expect(response.success).toBe(false);
    });
  });
});
