import { isSourceDisabled } from './source-policy';

describe('isSourceDisabled', () => {
  it('blocks monierate for NGN only', () => {
    expect(isSourceDisabled('NGN', 'monierate')).toBe(true);
    expect(isSourceDisabled('ngn', 'monierate')).toBe(true);
    expect(isSourceDisabled('NGN', 'quidax')).toBe(false);
    expect(isSourceDisabled('KES', 'monierate')).toBe(false);
  });
});
