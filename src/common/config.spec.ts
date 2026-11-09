import { config, DEFAULT_RATE_MAX_AGE_MINUTES, setupConfig } from './config';

describe('config RATE_MAX_AGE_MINUTES', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = 'sqlite::memory:';
    delete process.env.RATE_MAX_AGE_MINUTES;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to 30 minutes', async () => {
    expect(await setupConfig()).toBeUndefined();
    expect(config.RATE_MAX_AGE_MINUTES).toBe(DEFAULT_RATE_MAX_AGE_MINUTES);
    expect(DEFAULT_RATE_MAX_AGE_MINUTES).toBe(30);
  });

  it('parses a numeric override', async () => {
    process.env.RATE_MAX_AGE_MINUTES = '45';
    expect(await setupConfig()).toBeUndefined();
    expect(config.RATE_MAX_AGE_MINUTES).toBe(45);
  });

  it('rejects invalid values', async () => {
    process.env.RATE_MAX_AGE_MINUTES = 'abc';
    expect(await setupConfig()).toBeDefined();
    process.env.RATE_MAX_AGE_MINUTES = '0';
    expect(await setupConfig()).toBeDefined();
  });
});
