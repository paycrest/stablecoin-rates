import axios from 'axios';
import { logger } from 'src/common';
import {
  Monierate,
  parseMonierateProviders,
  parseProvidersFromPayload,
  parseProvidersFromTable,
} from './monierate.source';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

type Row = { name: string; buy?: string; sell?: string };

const cell = (value?: string) =>
  `<td class="px-4 py-3 text-right"><!--[--><div class="space-y-1"><div class="font-semibold">${
    value ?? '—'
  }</div> <div class="text-gray-400 text-xs">per ₮1</div></div><!--]--></td>`;

const tableHtml = (rows: Row[]) =>
  `<table><thead><tr><th>#</th><th>Provider</th><th>Buy</th><th>Sell</th></tr></thead><tbody>${rows
    .map(
      (r, i) =>
        `<tr class="border-t"><td>${i + 1}</td><td><a href="/x"><picture><img src="/i.png" alt="${r.name}" class="h-6"/></picture> <span>${r.name}</span></a></td>${cell(r.buy)}${cell(r.sell)}<td>Just now</td></tr>`,
    )
    .join('')}</tbody></table>`;

const payloadHtml = (
  providers: Array<{
    code: string;
    buy: number;
    sell: number;
    active?: boolean;
  }>,
) =>
  `<script>__NUXT__=(function(a,b){${providers
    .map(
      (p, i) =>
        `a${i}.changer_code="${p.code}";a${i}.is_active=${p.active ?? true};a${i}.trade_min=0;a${i}.price_buy=${p.buy};a${i}.price_sell=${p.sell};a${i}.price_1hr=0;a${i}.updated_at="2026-11-09T10:10:02.000Z";a${i}._id="id${i}";`,
    )
    .join('')}})</script>`;

const GOOD_ROWS: Row[] = [
  { name: 'Quidax', buy: '₦1,379', sell: '₦1,378' },
  { name: 'Gate', buy: '₦1,379', sell: '₦1,378' },
  { name: 'Bybit', buy: '₦1,380', sell: '₦1,377' },
  { name: 'Busha', buy: '₦1,384', sell: '₦1,368' },
];

const page = (html: string, status = 200, extra: object = {}) => ({
  status,
  statusText: status === 200 ? 'OK' : 'Forbidden',
  headers: { 'content-type': 'text/html; charset=utf-8' },
  data: html,
  config: { url: 'https://monierate.com/?base=USDT' },
  ...extra,
});

describe('Monierate parsing', () => {
  it('parses buy then sell from the rendered table', () => {
    const providers = parseProvidersFromTable(tableHtml(GOOD_ROWS));
    expect(providers).toEqual([
      { name: 'Quidax', buyRate: 1379, sellRate: 1378 },
      { name: 'Gate', buyRate: 1379, sellRate: 1378 },
      { name: 'Bybit', buyRate: 1380, sellRate: 1377 },
      { name: 'Busha', buyRate: 1384, sellRate: 1368 },
    ]);
  });

  it('skips rows that lack a buy or sell price instead of borrowing the next row', () => {
    const providers = parseProvidersFromTable(
      tableHtml([
        { name: 'Ridima', sell: '₦1,359' },
        { name: 'Quidax', buy: '₦1,379', sell: '₦1,378' },
      ]),
    );
    expect(providers).toEqual([
      { name: 'Quidax', buyRate: 1379, sellRate: 1378 },
    ]);
  });

  it('parses rows without an img alt and decimal amounts', () => {
    const html = `<table><tr><td>x</td><td>₦1,379.5</td><td>₦1,378.25</td></tr></table>`;
    expect(parseProvidersFromTable(html)).toEqual([
      { name: undefined, buyRate: 1379.5, sellRate: 1378.25 },
    ]);
  });

  it('parses the embedded payload, skipping inactive and one-sided providers', () => {
    const providers = parseProvidersFromPayload(
      payloadHtml([
        { code: 'bybit', buy: 1379.3656, sell: 1377.5675 },
        { code: 'ridima', buy: 0, sell: 1359 },
        { code: 'dead', buy: 1400, sell: 1300, active: false },
        { code: 'quidax', buy: 1379, sell: 1377.85 },
      ]),
    );
    expect(providers).toEqual([
      { name: 'bybit', buyRate: 1379.3656, sellRate: 1377.5675 },
      { name: 'quidax', buyRate: 1379, sellRate: 1377.85 },
    ]);
  });

  it('falls back to the payload when the table has no naira amounts', () => {
    const html = `<table><tr><td>Quidax</td><td>$1,379</td><td>$1,378</td></tr></table>${payloadHtml(
      [{ code: 'quidax', buy: 1379, sell: 1377.85 }],
    )}`;
    expect(parseMonierateProviders(html)).toEqual([
      { name: 'quidax', buyRate: 1379, sellRate: 1377.85 },
    ]);
  });

  it('returns nothing for a block page', () => {
    expect(
      parseMonierateProviders(
        '<html><title>Just a moment...</title><body>Checking your browser</body></html>',
      ),
    ).toEqual([]);
  });
});

describe('Monierate.fetchData', () => {
  let source: Monierate;
  let logData: jest.SpyInstance;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    mockedGet.mockReset();
    source = new Monierate();
    jest
      .spyOn(source as any, 'queuedRequest')
      .mockImplementation((fn: any) => fn());
    logData = jest.spyOn(source, 'logData').mockResolvedValue(true);
    errorLog = jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(logger, 'warn').mockImplementation();
    jest.spyOn(logger, 'debug').mockImplementation();
    jest.spyOn(logger, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('saves both pairs and reports a per-pair summary on success', async () => {
    mockedGet.mockResolvedValue(page(tableHtml(GOOD_ROWS)));

    const response = await source.fetchData('NGN');

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(2);
    expect(response.message).toContain('USDT/NGN=ok');
    expect(response.message).toContain('USDC/NGN=ok');
    expect(logData).toHaveBeenCalledTimes(1);
    expect(logData.mock.calls[0][0]).toEqual([
      expect.objectContaining({ stablecoin: 'USDT', source: 'monierate' }),
      expect.objectContaining({ stablecoin: 'USDC', source: 'monierate' }),
    ]);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('fails without saving and logs diagnostics when no providers are parsed', async () => {
    mockedGet.mockResolvedValue(
      page(
        '<html><head><title>Just a moment...</title></head><body>Checking your browser before accessing monierate.com</body></html>',
        200,
        {
          headers: {
            'content-type': 'text/html',
            server: 'cloudflare',
            'cf-ray': 'ray-1',
          },
          request: { res: { responseUrl: 'https://monierate.com/challenge' } },
        },
      ),
    );

    const response = await source.fetchData('NGN');

    expect(response.success).toBe(false);
    expect(response.message).toContain('USDT/NGN=failed');
    expect(response.message).toContain('USDC/NGN=failed');
    expect(logData).not.toHaveBeenCalled();

    const logged = errorLog.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('No providers found in HTML');
    expect(logged).toContain('"status":200');
    expect(logged).toContain('https://monierate.com/challenge');
    expect(logged).toContain('"contentType":"text/html"');
    expect(logged).toContain('"server":"cloudflare"');
    expect(logged).toContain('Just a moment...');
    expect(logged).toContain('"tableRows":0');
  });

  it('treats non-2xx responses as failures and logs the status', async () => {
    mockedGet.mockResolvedValue(page('<html>Access denied</html>', 403));

    const response = await source.fetchData('NGN');

    expect(response.success).toBe(false);
    expect(response.message).toContain('Unexpected HTTP status 403');
    const logged = errorLog.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('"status":403');
    expect(logged).toContain('Access denied');
  });

  it('retries with browser-like headers and remembers the profile that worked', async () => {
    mockedGet.mockImplementation(async (_url: string, options: any) =>
      options.headers.Accept
        ? page(tableHtml(GOOD_ROWS))
        : page('<html>blocked</html>'),
    );

    const first = await source.fetchData('NGN');
    expect(first.success).toBe(true);
    // 2 pairs x (minimal fails + browser succeeds)
    expect(mockedGet).toHaveBeenCalledTimes(4);
    const browserCall = mockedGet.mock.calls.find((c) => c[1].headers.Accept);
    expect(browserCall[1].headers['Accept-Language']).toBe('en-US,en;q=0.9');

    mockedGet.mockClear();
    await source.fetchData('NGN');
    // The browser profile is now tried first, so no wasted requests.
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(mockedGet.mock.calls[0][1].headers.Accept).toBeDefined();
  });

  it('reports partial success when only one pair is scraped', async () => {
    mockedGet.mockImplementation(async (url: string) =>
      url.includes('base=USDT')
        ? page(tableHtml(GOOD_ROWS))
        : page('<html>nothing</html>'),
    );

    const response = await source.fetchData('NGN');

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.message).toContain('Partially fetched 1/2');
    expect(response.message).toContain('USDT/NGN=ok');
    expect(response.message).toContain('USDC/NGN=failed');
    expect(logData.mock.calls[0][0]).toHaveLength(1);
  });

  it('reports failure when the rates could not be saved', async () => {
    mockedGet.mockResolvedValue(page(tableHtml(GOOD_ROWS)));
    logData.mockResolvedValue(false);

    const response = await source.fetchData('NGN');

    expect(response.success).toBe(false);
    expect(response.message).toContain('failed to save');
  });

  it('reports network errors per pair', async () => {
    mockedGet.mockRejectedValue(new Error('connect ETIMEDOUT'));

    const response = await source.fetchData('NGN');

    expect(response.success).toBe(false);
    expect(response.message).toContain('connect ETIMEDOUT');
  });
});
