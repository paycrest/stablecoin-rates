import { logger } from '../common';

/**
 * Plausible [min, max] range for a stablecoin rate quoted in each fiat.
 * A source returning a value outside this range is treated as broken (for
 * example a scrape that parsed a page in another currency) and its rate is
 * neither saved nor served.
 */
export const FIAT_RATE_BOUNDS: Record<string, [number, number]> = {
  NGN: [500, 5000],
};

export function isRateInBounds(
  fiat: string,
  buyRate: number | null | undefined,
  sellRate: number | null | undefined,
): boolean {
  const bounds = FIAT_RATE_BOUNDS[fiat?.toUpperCase()];
  if (!bounds) return true;
  const [min, max] = bounds;
  const ok = (rate: number | null | undefined) =>
    typeof rate === 'number' &&
    Number.isFinite(rate) &&
    rate >= min &&
    rate <= max;
  return ok(buyRate) && ok(sellRate);
}

export function warnOutOfBounds(
  context: string,
  fiat: string,
  stablecoin: string,
  source: string,
  buyRate: unknown,
  sellRate: unknown,
) {
  const [min, max] = FIAT_RATE_BOUNDS[fiat.toUpperCase()] ?? [];
  logger.warn(
    `${context}: rejecting implausible ${stablecoin}/${fiat} rate from ${source} (buy=${buyRate} sell=${sellRate}, allowed ${min}-${max})`,
  );
}
