import { Sequelize } from 'sequelize-typescript';
import { Rate } from 'src/database/models';
import { logger } from 'src/common';
import { Source } from './source';

class TestSource extends Source<'test'> {
  static sourceName = 'test' as const;
  async fetchData() {
    return { success: true, message: 'ok' };
  }
}

describe('Source.logData', () => {
  let sequelize: Sequelize;
  const source = new TestSource();

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      models: [Rate],
    });
    await sequelize.sync();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Rate.destroy({ where: {}, force: true });
  });

  const record = {
    fiat: 'NGN',
    stablecoin: 'usdt',
    buyRate: 1381,
    sellRate: 1377,
    source: 'test' as const,
  };

  it('creates then updates a single row per fiat/stablecoin/source', async () => {
    expect(await source.logData([record])).toBe(true);
    expect(await source.logData([{ ...record, buyRate: 1382 }])).toBe(true);

    const rows = await Rate.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].stablecoin).toBe('USDT');
    expect(rows[0].buyRate).toBe(1382);
  });

  it('refreshes updatedAt even when the rates are unchanged', async () => {
    await source.logData([record]);
    const before = (await Rate.findOne())!.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 20));
    await source.logData([record]);

    const after = (await Rate.findOne())!.updatedAt.getTime();
    expect(after).toBeGreaterThan(before);
  });

  it('returns false and logs when a record cannot be saved', async () => {
    const error = jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(Rate, 'findOne').mockRejectedValueOnce(new Error('db down'));

    expect(await source.logData([record])).toBe(false);
    expect(error).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
