import { CurrencyScheduler } from './currencies';
import type { Source } from './sources';

class ScheduledSource {
  fetchData = jest.fn().mockResolvedValue({});
}

class FawazExchangeApi {
  fetchData = jest.fn().mockResolvedValue({});
}

type ScheduledTask = {
  intervalMinutes: number;
  jitterSeconds: number;
  lastRun?: Date;
};

type SchedulerInternals = {
  tasks: ScheduledTask[];
  checkAndExecuteTasks(): Promise<void>;
};

describe('CurrencyScheduler', () => {
  let scheduler: SchedulerInternals;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    (CurrencyScheduler as unknown as { instance?: unknown }).instance =
      undefined;
    scheduler =
      CurrencyScheduler.getInstance() as unknown as SchedulerInternals;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('runs an initial task with 59 seconds of jitter on a later scheduler tick', async () => {
    const source = new ScheduledSource();
    jest.spyOn(Math, 'random').mockReturnValue(0.999999);

    CurrencyScheduler.getInstance().registerTask(
      'KES',
      source as unknown as Source<string>,
      '0 */5 * * * *',
    );

    expect(scheduler.tasks[0].jitterSeconds).toBe(59);

    jest.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));
    await scheduler.checkAndExecuteTasks();

    expect(source.fetchData).toHaveBeenCalledWith('KES');
  });

  it('runs a 120-second-jitter task and preserves its subsequent interval', async () => {
    const source = new FawazExchangeApi();
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999999);

    CurrencyScheduler.getInstance().registerTask(
      'BRL',
      source as unknown as Source<string>,
    );

    expect(scheduler.tasks[0]).toMatchObject({
      intervalMinutes: 4,
      jitterSeconds: 120,
    });

    jest.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));
    await scheduler.checkAndExecuteTasks();

    expect(source.fetchData).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-01-01T00:07:59.999Z'));
    await scheduler.checkAndExecuteTasks();
    expect(source.fetchData).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-01-01T00:08:00.000Z'));
    await scheduler.checkAndExecuteTasks();
    expect(source.fetchData).toHaveBeenCalledTimes(2);
  });
});
