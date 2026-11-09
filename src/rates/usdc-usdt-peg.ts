import axios from 'axios';
import { logger } from '../common';

/**
 * USDC priced in USDT (how many USDT one USDC is worth).
 *
 * Used to derive USDC/<fiat> from USDT/<fiat> when a fiat has no fresh direct
 * USDC source (for example NGN, where Quidax only lists USDT). The value is
 * only accepted inside a tight band around 1.0, so a depeg or a bad response
 * stops derivation instead of mispricing USDC.
 */
export interface Peg {
  rate: number;
  source: string;
  /** Epoch ms the peg was fetched. */
  fetchedAt: number;
}

export const PEG_BAND: [number, number] = [0.99, 1.01];
const CACHE_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 5000;

export function isPegInBand(rate: unknown): rate is number {
  return (
    typeof rate === 'number' &&
    Number.isFinite(rate) &&
    rate >= PEG_BAND[0] &&
    rate <= PEG_BAND[1]
  );
}

/**
 * Binance spot book ticker. Uses the market-data-only host because
 * api.binance.com refuses requests from restricted (e.g. US) locations.
 */
async function fromBinance(): Promise<number | null> {
  const res = await axios.get(
    'https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=USDCUSDT',
    { timeout: TIMEOUT_MS },
  );
  const bid = parseFloat(res.data?.bidPrice);
  const ask = parseFloat(res.data?.askPrice);
  if (!(bid > 0) || !(ask > 0) || ask < bid) return null;
  return (bid + ask) / 2;
}

/** Fawaz currency API (already a source for many fiats). Daily granularity. */
async function fromFawaz(): Promise<number | null> {
  const res = await axios.get(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usdc.json',
    { timeout: TIMEOUT_MS },
  );
  const rate = Number(res.data?.usdc?.usdt);
  return rate > 0 ? rate : null;
}

const PROVIDERS: { name: string; fetch: () => Promise<number | null> }[] = [
  { name: 'binance', fetch: fromBinance },
  { name: 'fawaz-exchange-api', fetch: fromFawaz },
];

let cached: Peg | null = null;
let inFlight: Promise<Peg | null> | null = null;

async function refresh(): Promise<Peg | null> {
  for (const provider of PROVIDERS) {
    try {
      const rate = await provider.fetch();
      if (isPegInBand(rate)) {
        cached = { rate, source: provider.name, fetchedAt: Date.now() };
        return cached;
      }
      logger.warn(
        `USDC/USDT peg from ${provider.name} rejected (rate=${rate}, allowed ${PEG_BAND[0]}-${PEG_BAND[1]})`,
      );
    } catch (error) {
      logger.warn(
        `USDC/USDT peg fetch from ${provider.name} failed: ${error?.message ?? error}`,
      );
    }
  }
  return null;
}

/**
 * Returns a recent in-band USDC/USDT peg, or null if none is available.
 * Cached for two minutes; concurrent callers share one fetch.
 */
export async function getUsdcUsdtPeg(): Promise<Peg | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached;
  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }
  const fresh = await inFlight;
  return fresh ?? null;
}

/** Test helper. */
export function resetUsdcUsdtPegCache() {
  cached = null;
  inFlight = null;
}
