import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import type { Stablecoin } from '../dto/get-rates.dto';
import { Source } from './source';
import { logger } from 'src/common';
import type { ServiceResponse } from '../../common/interfaces';
import { describeHttpResponse } from './http-diagnostics';

export interface MonierateProvider {
  name?: string;
  buyRate: number;
  sellRate: number;
}

const NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;

/**
 * Parses the rendered provider table. Tolerant of markup changes: it only needs
 * each `<tr>` to contain two naira amounts (buy first, then sell), and the
 * provider name from an `<img alt>` is optional.
 */
export function parseProvidersFromTable(html: string): MonierateProvider[] {
  const providers: MonierateProvider[] = [];
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const amounts = [
      ...row.matchAll(/(?:₦|&#8358;|&#x20A6;|NGN\s)\s*([\d,]+(?:\.\d+)?)/gi),
    ].map((m) => parseFloat(m[1].replace(/,/g, '')));

    if (amounts.length < 2) continue;

    const [buyRate, sellRate] = amounts;
    if (!(buyRate > 0) || !(sellRate > 0)) continue;

    const name = row.match(/<img[^>]*\balt="([^"]+)"/i)?.[1];
    providers.push({ name, buyRate, sellRate });
  }

  return providers;
}

/**
 * Parses the server-rendered Nuxt payload embedded in the page, which lists
 * every provider as `x.changer_code="..."; x.price_buy=...; x.price_sell=...`.
 * Used when the table cannot be parsed (e.g. different markup or currency
 * formatting served to some clients). Providers without both prices, or that
 * are flagged inactive, are skipped.
 */
export function parseProvidersFromPayload(html: string): MonierateProvider[] {
  const providers: MonierateProvider[] = [];
  const segments = html.split(/[\w$]+\.changer_code=/).slice(1);

  for (const segment of segments) {
    const block = segment.slice(0, segment.search(/[\w$]+\._id=/) + 1 || 4000);
    const name = block.match(/^"([^"]+)"/)?.[1];
    const active = block.match(/\.is_active=([^;]+);/)?.[1];
    const buy = block.match(new RegExp(`\\.price_buy=(${NUMBER});`))?.[1];
    const sell = block.match(new RegExp(`\\.price_sell=(${NUMBER});`))?.[1];

    if (active !== undefined && !['true', '!0'].includes(active.trim())) {
      continue;
    }
    if (buy === undefined || sell === undefined) continue;

    const buyRate = parseFloat(buy);
    const sellRate = parseFloat(sell);
    if (!(buyRate > 0) || !(sellRate > 0)) continue;

    providers.push({ name, buyRate, sellRate });
  }

  return providers;
}

/**
 * Extracts provider rates from a Monierate page: the rendered table first,
 * then the embedded payload as a fallback.
 */
export function parseMonierateProviders(html: string): MonierateProvider[] {
  const fromTable = parseProvidersFromTable(html);
  if (fromTable.length > 0) return fromTable;
  return parseProvidersFromPayload(html);
}

/**
 * Request header sets tried in order. The minimal set is what has been used
 * historically; the browser-like set is tried when the first yields no data.
 */
const HEADER_PROFILES: Array<{
  name: string;
  headers: Record<string, string>;
}> = [
  {
    name: 'minimal',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  {
    name: 'browser',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
  },
];

interface PairOutcome {
  stablecoin: string;
  result: {
    fiat: string;
    stablecoin: string;
    buyRate: number;
    sellRate: number;
    source: 'monierate';
  } | null;
  providerCount?: number;
  reason?: string;
}

/**
 * Represents the Monierate data source.
 * Monierate is an aggregator that lists exchange rates from multiple providers.
 * This source returns the best competitive rate: it anchors on the most
 * favourable rate that has market support (the lowest buy / highest sell that
 * at least a couple of providers agree on) and averages that cluster, ignoring
 * lone outliers that sit far from the rest of the market.
 */
export class Monierate extends Source<'monierate'> {
  /**
   * Unique name of the source.
   */
  static sourceName = 'monierate' as const;

  /**
   * Supported stablecoins for Monierate.
   */
  static stablecoins: Stablecoin[] = ['USDT', 'USDC'];

  /**
   * Index of the header profile that last produced data; tried first next time.
   */
  private preferredProfile = 0;

  /**
   * Calculate the average of an array, rounded to 2 decimal places.
   */
  private average(values: number[]): number {
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  /**
   * Compute the best competitive rate for one side of the book.
   *
   * The "best" rate is the most favourable to the user — the lowest for `buy`
   * (cheapest to acquire) and the highest for `sell` (most received). To avoid
   * a single rogue provider hijacking the result, we only anchor on a value
   * that has support: at least `minSupport` providers within `tolerance` of it.
   * If the most favourable value is a lone outlier we step inward to the next
   * one until a supported anchor is found, then average that cluster.
   *
   * An optional `floor` restricts the candidates to rates strictly above it.
   * This is used to keep the buy rate above the sell rate (a normal spread):
   * any buy quote at or below the chosen sell is ignored.
   *
   * @param rates - The list of provider rates for this side.
   * @param side - 'buy' (lower is better) or 'sell' (higher is better).
   * @param options.tolerance - Window width, in fiat units, around the anchor.
   * @param options.minSupport - Minimum providers required within the window.
   * @param options.floor - Exclusive lower bound; rates <= floor are dropped.
   */
  private bestRate(
    rates: number[],
    side: 'buy' | 'sell',
    {
      tolerance = 5,
      minSupport = 2,
      floor,
    }: { tolerance?: number; minSupport?: number; floor?: number } = {},
  ): number {
    // Restrict to rates above the floor (e.g. buy must exceed sell); if nothing
    // qualifies, fall back to the full set so we still return a rate.
    let pool = floor === undefined ? rates : rates.filter((r) => r > floor);
    if (pool.length === 0) pool = rates;

    // Order best-first: ascending for buy (lowest), descending for sell (highest).
    const ordered = [...pool].sort((a, b) => (side === 'buy' ? a - b : b - a));

    for (const anchor of ordered) {
      const cluster =
        side === 'buy'
          ? pool.filter((r) => r >= anchor && r <= anchor + tolerance)
          : pool.filter((r) => r <= anchor && r >= anchor - tolerance);

      if (cluster.length >= minSupport) {
        return this.average(cluster);
      }
    }

    // No supported cluster (e.g. very few providers) — fall back to the best value.
    return ordered[0];
  }

  /**
   * Requests the Monierate page for a stablecoin and extracts provider rates.
   * Tries each header profile in turn (starting with the one that last worked)
   * and, whenever a page yields no providers, logs what was actually received.
   */
  private async scrapeMonierate(
    fiat: string,
    stablecoin: string,
  ): Promise<MonierateProvider[]> {
    const url = `https://monierate.com/?base=${stablecoin.toUpperCase()}`;
    const failures: string[] = [];

    for (let attempt = 0; attempt < HEADER_PROFILES.length; attempt++) {
      const index = (this.preferredProfile + attempt) % HEADER_PROFILES.length;
      const profile = HEADER_PROFILES[index];

      const response = await axios.get<string>(url, {
        headers: profile.headers,
        timeout: 15000,
        maxRedirects: 5,
        responseType: 'text',
        transformResponse: [(data) => data],
        validateStatus: () => true,
      });

      const html = typeof response.data === 'string' ? response.data : '';
      const providers =
        response.status >= 200 && response.status < 300
          ? parseMonierateProviders(html)
          : [];

      if (providers.length > 0) {
        this.preferredProfile = index;
        if (attempt > 0) {
          logger.warn(
            `Monierate ${stablecoin}/${fiat} only parsed with the "${profile.name}" header profile after: ${failures.join('; ')}`,
          );
        }
        return providers;
      }

      const reason =
        response.status >= 200 && response.status < 300
          ? 'No providers found in HTML. HTML structure may have changed.'
          : `Unexpected HTTP status ${response.status}`;

      logger.error(
        `Monierate scrape for ${stablecoin}/${fiat} returned no providers (header profile "${profile.name}"): ${reason} ${JSON.stringify(
          {
            ...describeHttpResponse(response),
            markers: {
              tableRows: (html.match(/<tr\b/gi) ?? []).length,
              nairaAmounts: (html.match(/₦\s*[\d,]+/g) ?? []).length,
              payloadProviders: (html.match(/\.changer_code=/g) ?? []).length,
            },
          },
        )}`,
      );
      failures.push(`${profile.name}: ${reason}`);

      if (attempt === HEADER_PROFILES.length - 1) {
        throw new Error(`${reason} (tried ${failures.length} header profiles)`);
      }
    }

    throw new Error('No Monierate header profiles configured');
  }

  /**
   * Scrapes one stablecoin and reduces the providers to a single buy/sell pair.
   */
  private async fetchPair(
    fiat: string,
    stablecoin: string,
  ): Promise<PairOutcome> {
    try {
      const providers = await this.scrapeMonierate(fiat, stablecoin);

      // Take the best competitive rate on each side of the book.
      // Sell is computed first so buy can be floored above it (buy > sell).
      const sellRate = this.bestRate(
        providers.map((p) => p.sellRate),
        'sell',
      );
      const buyRate = this.bestRate(
        providers.map((p) => p.buyRate),
        'buy',
        { floor: sellRate },
      );

      if (isNaN(buyRate) || isNaN(sellRate)) {
        return {
          stablecoin,
          result: null,
          providerCount: providers.length,
          reason: 'invalid rates computed',
        };
      }

      return {
        stablecoin,
        providerCount: providers.length,
        result: {
          fiat: fiat.toUpperCase(),
          stablecoin,
          buyRate,
          sellRate,
          source: Monierate.sourceName,
        },
      };
    } catch (error) {
      return {
        stablecoin,
        result: null,
        reason: error?.message ?? String(error),
      };
    }
  }

  /**
   * Fetches data from Monierate for the specified fiat currency.
   * Returns the best competitive buy/sell rate across all providers on Monierate.
   * The response (and logs) report the outcome of every stablecoin pair, and the
   * call is only successful when at least one pair was scraped and saved.
   *
   * @param fiat - The fiat currency to fetch data for.
   * @returns A promise that resolves to a ServiceResponse indicating success or failure.
   */
  async fetchData(fiat: string): Promise<ServiceResponse> {
    try {
      // Use the request queue to prevent rate limiting
      const outcomes = await this.queuedRequest(() =>
        Promise.all(
          Monierate.stablecoins.map((stablecoin) =>
            this.fetchPair(fiat, stablecoin),
          ),
        ),
      );

      const summary = outcomes
        .map((o) =>
          o.result
            ? `${o.stablecoin}/${fiat}=ok (buy ${o.result.buyRate}, sell ${o.result.sellRate}, ${o.providerCount} providers)`
            : `${o.stablecoin}/${fiat}=failed (${o.reason})`,
        )
        .join('; ');

      const validResults = outcomes
        .map((o) => o.result)
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (validResults.length === 0) {
        const message = `No data fetched for ${fiat} from Monierate: ${summary}`;
        return {
          success: false,
          message,
          statusCode: HttpStatus.NO_CONTENT,
        };
      }

      const saved = await this.logData(validResults);
      if (!saved) {
        const message = `Fetched rates for ${fiat} from Monierate but failed to save them: ${summary}`;
        return {
          success: false,
          message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const partial = validResults.length < outcomes.length;
      const message = partial
        ? `Partially fetched ${validResults.length}/${outcomes.length} rates for ${fiat} from Monierate: ${summary}`
        : `Successfully fetched ${validResults.length} rates for ${fiat} from Monierate: ${summary}`;
      if (partial) logger.warn(message);
      else logger.debug(message);

      return {
        success: true,
        message,
        statusCode: HttpStatus.OK,
        data: validResults,
      };
    } catch (error) {
      logger.error(`Monierate fetchData error for ${fiat}:`, error);
      return {
        success: false,
        message: `Failed to fetch data for ${fiat} from Monierate: ${error.message}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
