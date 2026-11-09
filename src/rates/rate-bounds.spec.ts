import { isRateInBounds } from './rate-bounds';

describe('isRateInBounds', () => {
  it('rejects NGN rates outside 500-5000', () => {
    expect(isRateInBounds('NGN', 1383, 1377)).toBe(true);
    expect(isRateInBounds('NGN', 0.89, 0.88)).toBe(false);
    expect(isRateInBounds('NGN', 1383, 0.88)).toBe(false);
    expect(isRateInBounds('ngn', 6000, 1377)).toBe(false);
  });

  it('allows fiats without bounds', () => {
    expect(isRateInBounds('KES', 129, 128)).toBe(true);
  });
});
