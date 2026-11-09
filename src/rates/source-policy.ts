/**
 * Sources that must never be saved or served for a fiat, even if someone adds
 * them back to the currency config.
 *
 * NGN/monierate: on 2026-11-09 the Monierate scrape returned ~0.89 from the
 * production server (a page priced in another currency) and halved the served
 * NGN rate. Keep it off for NGN until it is fixed and re-reviewed.
 */
export const DISABLED_SOURCES: Record<string, string[]> = {
  NGN: ['monierate'],
};

export function isSourceDisabled(fiat: string, source: string): boolean {
  return (DISABLED_SOURCES[fiat?.toUpperCase()] ?? []).includes(source);
}

/**
 * Fiats whose USDC rate is derived from USDT/<fiat> x USDC/USDT when no fresh,
 * in-bounds direct USDC source exists.
 */
export const DERIVE_USDC_FROM_USDT_FIATS: string[] = ['NGN'];
