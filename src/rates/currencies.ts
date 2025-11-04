import { Cron } from 'croner';
import { Binance, FawazExchangeApi, Quidax, type Source } from './sources';
import { logger } from 'src/common';

type Sources = {
  source: Source<string>;
  pattern?: string; // Optional - if not provided, uses source-based random intervals
}[];

interface ScheduledTask {
  fiat: string;
  source: Source<string>;
  intervalMinutes: number;
  jitterSeconds: number; // Random offset to spread out tasks
  lastRun?: Date;
}

/**
 * Configuration for source-based random intervals
 */
interface SourceConfig {
  minInterval: number;  // Minimum interval in minutes
  maxInterval: number;  // Maximum interval in minutes
  maxJitter: number;    // Maximum jitter in seconds
}

/**
 * Default intervals and jitter for each API source
 * These are automatically applied when no pattern is specified
 */
const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  Binance: {
    minInterval: 3,
    maxInterval: 5,
    maxJitter: 60, // 0-60 seconds jitter
  },
  Quidax: {
    minInterval: 5,
    maxInterval: 10,
    maxJitter: 120, // 0-120 seconds jitter (2 minutes)
  },
  FawazExchangeApi: {
    minInterval: 4,
    maxInterval: 10,
    maxJitter: 120, // 0-120 seconds jitter (2 minutes)
  },
};

/**
 * Default configuration for sources not explicitly configured
 */
const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  minInterval: 5,
  maxInterval: 10,
  maxJitter: 60,
};

/**
 * Manages batched and staggered API requests for all currencies
 * Each currency/source combination maintains its own interval (3, 5, 10, 15 minutes, etc.)
 */
class CurrencyScheduler {
  private static instance: CurrencyScheduler;
  private tasks: ScheduledTask[] = [];
  private cronJob: any;
  private isRunning = false;

  private constructor() {}

  static getInstance(): CurrencyScheduler {
    if (!CurrencyScheduler.instance) {
      CurrencyScheduler.instance = new CurrencyScheduler();
    }
    return CurrencyScheduler.instance;
  }

  /**
   * Register a currency/source for scheduled fetching
   * @param fiat - The fiat currency code
   * @param source - The data source
   * @param pattern - Optional cron pattern. If not provided, uses source-based random intervals
   */
  registerTask(fiat: string, source: Source<string>, pattern?: string) {
    let intervalMinutes: number;
    let jitterSeconds: number;

    if (pattern) {
      // Use provided pattern
      intervalMinutes = this.parseIntervalFromPattern(pattern);
      jitterSeconds = Math.floor(Math.random() * 60);
    } else {
      // Use source-based configuration with random intervals
      const sourceName = source.constructor.name;
      const config = SOURCE_CONFIGS[sourceName] || DEFAULT_SOURCE_CONFIG;

      // Generate random interval within configured range
      intervalMinutes = this.getRandomInt(config.minInterval, config.maxInterval);

      // Generate random jitter within configured range
      jitterSeconds = this.getRandomInt(0, config.maxJitter);
    }

    this.tasks.push({
      fiat,
      source,
      intervalMinutes,
      jitterSeconds,
      lastRun: undefined,
    });
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Parse interval in minutes from cron pattern
   * Handles various patterns including 5-part and 6-part cron expressions
   */
  private parseIntervalFromPattern(pattern: string): number {
    const parts = pattern.split(' ');

    // Handle 6-part cron patterns (with seconds)
    if (parts.length === 6) {
      // Pattern like '15 */5 * * * *' - check minute part (index 1)
      const minutePart = parts[1];
      const minuteMatch = minutePart.match(/\*\/(\d+)/);
      if (minuteMatch) {
        return parseInt(minuteMatch[1]);
      }

      // Pattern like '15 * * * * *' - runs every minute
      if (minutePart === '*') {
        return 1;
      }

      // Pattern like '0 1,6,11,16,21,26,31,36,41,46,51,56 * * * *'
      // Count the intervals between numbers
      if (minutePart.includes(',')) {
        const minutes = minutePart.split(',').map(m => parseInt(m));
        if (minutes.length > 1) {
          // Calculate interval from first two values
          return minutes[1] - minutes[0];
        }
      }
    }

    // Handle 5-part cron patterns (standard)
    if (parts.length === 5) {
      const minutePart = parts[0];
      const hourPart = parts[1];

      // Pattern like '*/5 * * * *'
      const minuteMatch = minutePart.match(/\*\/(\d+)/);
      if (minuteMatch) {
        return parseInt(minuteMatch[1]);
      }

      // Pattern like '15 */5 * * *'
      const hourMatch = hourPart.match(/\*\/(\d+)/);
      if (hourMatch) {
        return parseInt(hourMatch[1]);
      }

      // Pattern like '* * * * *' - every minute
      if (minutePart === '*') {
        return 1;
      }
    }

    // Default to 5 minutes if we can't parse
    logger.warn(`Could not parse interval from pattern: ${pattern}, defaulting to 5 minutes`);
    return 5;
  }

  /**
   * Start the scheduler - runs every 22 seconds and checks which tasks should execute
   */
  start() {
    if (this.cronJob) {
      logger.warn('Currency scheduler already started');
      return;
    }

    // Run every 22 seconds to check which tasks are due
    // This allows jitter-based spreading to work properly (tasks can run at any second offset)
    this.cronJob = new Cron('*/22 * * * * *', async () => {
      if (this.isRunning) {
        logger.debug('Previous scheduler run still in progress, skipping...');
        return;
      }

      await this.checkAndExecuteTasks();
    });
  }

  /**
   * Get distribution of tasks by interval
   */
  private getTaskDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const task of this.tasks) {
      const key = `${task.intervalMinutes}min`;
      dist[key] = (dist[key] || 0) + 1;
    }
    return dist;
  }

  /**
   * Check which tasks are due and execute them in batches
   */
  private async checkAndExecuteTasks() {
    this.isRunning = true;

    try {
      const now = new Date();
      const dueTasks: ScheduledTask[] = [];

      // Find all tasks that are due
      for (const task of this.tasks) {
        if (this.isTaskDue(task, now)) {
          dueTasks.push(task);
        }
      }

      if (dueTasks.length === 0) {
        logger.debug(`Scheduler check at ${now.toISOString()} - no tasks due yet`);
        return;
      }

      logger.log(`Found ${dueTasks.length} tasks due for execution`);

      // Group by source for efficient batching
      const sourceGroups = this.groupTasksBySource(dueTasks);

      // Process each source group with staggering
      const sourceNames = Object.keys(sourceGroups);

      for (let i = 0; i < sourceNames.length; i++) {
        const sourceName = sourceNames[i];
        const sourceTasks = sourceGroups[sourceName];

        // Stagger between different sources (500ms)
        if (i > 0) {
          await this.delay(500);
        }

        logger.debug(`Processing ${sourceTasks.length} tasks for ${sourceName}`);

        // Process tasks for this source in batches
        await this.executeBatch(sourceName, sourceTasks, now);
      }

      logger.log('Completed all due tasks');
    } catch (error) {
      logger.error('Error in checkAndExecuteTasks:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if a task is due for execution
   * Incorporates jitter to spread tasks across the minute
   */
  private isTaskDue(task: ScheduledTask, now: Date): boolean {
    if (!task.lastRun) {
      // First run - check if enough seconds have passed in the current minute
      // This spreads initial runs across 0-59 seconds instead of all at :00
      return now.getSeconds() >= task.jitterSeconds;
    }

    // Calculate total seconds since last run
    const secondsSinceLastRun = (now.getTime() - task.lastRun.getTime()) / 1000;

    // Target interval includes the jitter offset
    const targetSeconds = (task.intervalMinutes * 60) + task.jitterSeconds;

    return secondsSinceLastRun >= targetSeconds;
  }

  /**
   * Group tasks by source
   */
  private groupTasksBySource(tasks: ScheduledTask[]): Record<string, ScheduledTask[]> {
    const groups: Record<string, ScheduledTask[]> = {};

    for (const task of tasks) {
      const sourceName = task.source.constructor.name;

      if (!groups[sourceName]) {
        groups[sourceName] = [];
      }

      groups[sourceName].push(task);
    }

    return groups;
  }

  /**
   * Execute a batch of tasks for a single source with parallel processing
   * Uses Promise.all for better throughput while respecting rate limits
   */
  private async executeBatch(
    sourceName: string,
    tasks: ScheduledTask[],
    executionTime: Date
  ) {
    const batchSize = 10; // Process 10 currencies at a time (increased from 5)
    const staggerDelayMs = 100; // 100ms stagger between parallel requests

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);

      // Process batch in parallel with staggered start times
      await Promise.all(
        batch.map(async (task, index) => {
          try {
            // Stagger the start time of each parallel request
            // This prevents all requests from hitting the API at the exact same millisecond
            if (index > 0) {
              await this.delay(index * staggerDelayMs);
            }

            // Execute the fetch
            await task.source.fetchData(task.fiat);

            // Update last run time after successful execution
            task.lastRun = executionTime;

            logger.debug(`Successfully fetched ${task.fiat} from ${sourceName}`);
          } catch (error) {
            logger.error(`Error fetching ${task.fiat} from ${sourceName}:`, error);
            // Still update lastRun to avoid retry storms
            task.lastRun = executionTime;
          }
        })
      );

      // Delay between batches to respect rate limits
      if (i + batchSize < tasks.length) {
        await this.delay(500); // Reduced from 1000ms since we're already staggering
        logger.debug(`Completed batch ${Math.floor(i / batchSize) + 1} for ${sourceName}`);
      }
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.log('Currency scheduler stopped');
    }
  }

  /**
   * Get current task statistics (useful for monitoring)
   */
  getStats() {
    const now = new Date();
    const stats = {
      totalTasks: this.tasks.length,
      tasksByInterval: this.getTaskDistribution(),
      nextDueTasks: this.tasks
        .filter(task => this.isTaskDue(task, now))
        .length,
    };
    return stats;
  }
}

export class Currency {
  private _fiat: string;
  private _sources: Sources;

  constructor(fiat: string, sources: Sources) {
    this._fiat = fiat;
    this._sources = sources;

    // Register each source with the centralized scheduler
    const scheduler = CurrencyScheduler.getInstance();
    for (const { source, pattern } of this._sources) {
      scheduler.registerTask(this._fiat, source, pattern);
    }
  }

  /**
   * Start the centralized scheduler (call this once after all currencies are initialized)
   */
  static startScheduler() {
    const scheduler = CurrencyScheduler.getInstance();
    scheduler.start();
  }

  /**
   * Stop the centralized scheduler
   */
  static stopScheduler() {
    const scheduler = CurrencyScheduler.getInstance();
    scheduler.stop();
  }

  /**
   * Get scheduler statistics
   */
  static getSchedulerStats() {
    const scheduler = CurrencyScheduler.getInstance();
    return scheduler.getStats();
  }
}

/**
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
 */

/**
 * Represents the Nigerian Naira (NGN) currency.
 */
export class NGN extends Currency {
  constructor() {
    super('NGN', [
      { source: new Quidax(), pattern: '0 */10 * * * *' }, // Every 10 minutes to reduce load
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Kenyan Shilling (KES) currency.
 */
export class KES extends Currency {
  constructor() {
    super('KES', [
      { source: new Binance() }, // Every 5 minutes at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Tanzania Shilling (TZS) currency.
 */
export class TZS extends Currency {
  constructor() {
    super('TZS', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
    ]);
  }
}

/**
 * Represents the Uganda Shilling (UGX) currency.
 */
export class UGX extends Currency {
  constructor() {
    super('UGX', [
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
    ]);
  }
}

/**
 * Represents the Ghanaian Cedi (GHS) currency.
 */
export class GHS extends Currency {
  constructor() {
    super('GHS', [
      { source: new Quidax(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the South African Rand (ZAR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Luno (https://www.luno.com/api/)
 * 2. VALR (https://www.valr.com/api/)
 * 3. AltcoinTrader (https://www.altcointrader.co.za/api/)
 * 4. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 5. Paxful (https://paxful.com/api)
 */
export class ZAR extends Currency {
  constructor() {
    super('ZAR', [
      {
        source: new Binance(),
        pattern: '0 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:00, 6:00, 11:00, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Malaysian Ringgit (MYR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P MYR sources:
 * - Luno: https://www.luno.com
 * - Remitano: https://remitano.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class MYR extends Currency {
  constructor() {
    super('MYR', [
      { source: new Binance() }, // Every 5 minutes at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Indonesian Rupiah (IDR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P IDR sources:
 * - Tokocrypto: https://tokocrypto.com
 * - Pintu: https://pintu.co.id
 * - Rekeningku: https://www.rekeningku.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class IDR extends Currency {
  constructor() {
    super('IDR', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Pakistani Rupee (PKR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P PKR sources:
 * - Remitano: https://remitano.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class PKR extends Currency {
  constructor() {
    super('PKR', [
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Indian Rupee (INR) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P INR sources:
 * - WazirX: https://wazirx.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class INR extends Currency {
  constructor() {
    super('INR', [
      {
        source: new Binance(),
        pattern: '15 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:15, 6:15, 11:15, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Thai Baht (THB) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P THB sources:
 * - Bitkub: https://www.bitkub.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class THB extends Currency {
  constructor() {
    super('THB', [
      { source: new Binance() }, // Every 5 minutes at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * @remarks
 * When adding more fiat currencies, use the ISO 4217 currency code in uppercase as the symbol.
 * Represents the Vietnamese Dong (VND) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P VND sources:
 * - Remitano: https://remitano.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class VND extends Currency {
  constructor() {
    super('VND', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Philippine Peso (PHP) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P PHP sources:
 * - Coins.ph: https://coins.ph
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class PHP extends Currency {
  constructor() {
    super('PHP', [
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Singapore Dollar (SGD) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P SGD sources:
 * - Independent Reserve: https://www.independentreserve.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class SGD extends Currency {
  constructor() {
    super('SGD', [
      {
        source: new Binance(),
        pattern: '30 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:30, 6:30, 11:30, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Saudi Riyal (SAR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Rain (https://www.rain.bh/api/)
 * 2. BitOasis (https://www.bitoasis.net/api/)
 * 3. CoinMENA (https://www.coinmena.com/api/)
 * 4. Paxful (https://paxful.com/api)
 * 5. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class SAR extends Currency {
  constructor() {
    super('SAR', [
      { source: new Binance() }, // Every 5 minutes at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Hong Kong Dollar (HKD) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P HKD sources:
 * - Binance P2P: https://p2p.binance.com (already integrated)
 */
export class HKD extends Currency {
  constructor() {
    super('HKD', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Mexican Peso (MXN) currency.
 *
 * Sources: Binance (P2P)
 *
 * Other reliable P2P MXN sources:
 * - Paxful: https://paxful.com
 * - AirTM: https://www.airtm.com
 * - Binance P2P: https://p2p.binance.com (already integrated)
 * - Bitso: https://bitso.com
 */
export class MXN extends Currency {
  constructor() {
    super('MXN', [
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
      {
        source: new Quidax(),
        pattern: '45 1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
      }, // Every 5 minutes at 1:45, 6:45, 11:45, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Czech Koruna (CZK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 * 4. Anycoin Direct (https://www.anycoin.direct/api/)
 * 5. Coinmate (https://www.coinmate.io/api/)
 */
export class CZK extends Currency {
  constructor() {
    super('CZK', [
      { source: new Binance() }, // Every 5 minutes at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Hungarian Forint (HUF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. MrCoin (https://www.mrcoin.com/api/)
 * 4. BitPanda (https://api.bitpanda.com/)
 * 5. Coincash.eu (https://www.coincash.eu/api/)
 */
export class HUF extends Currency {
  constructor() {
    super('HUF', [
      { source: new Binance(), pattern: '30 */5 * * * *' }, // Every 5 minutes at 30 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Polish Złoty (PLN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitBay (https://bitbay.net/api/)
 * 2. Zonda (https://zonda.exchange/api/)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 4. Paxful (https://paxful.com/api)
 * 5. Kriptomat (https://www.kriptomat.io/api/)
 */
export class PLN extends Currency {
  constructor() {
    super('PLN', [
      { source: new Binance(), pattern: '45 */5 * * * *' }, // Every 5 minutes at 45 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Colombian Peso (COP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. Buda (https://www.buda.com/api/)
 * 4. Bitso (https://www.bitso.com/api/)
 * 5. Binance P2P (https://p2p.binance.com/api/)
 */
export class COP extends Currency {
  constructor() {
    super('COP', [
      {
        source: new Binance(),
        pattern: '0 2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      }, // Every 5 minutes at 2:00, 7:00, 12:00, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Chilean Peso (CLP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Buda (https://www.buda.com/api/)
 * 2. OrionX (https://orionx.io/api/)
 * 3. CryptoMKT (https://www.cryptomkt.com/api/)
 * 4. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 5. Binance P2P (https://p2p.binance.com/api/)
 */
export class CLP extends Currency {
  constructor() {
    super('CLP', [
      { source: new Binance() }, // Every 5 minutes at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Turkish lira (TRY) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. OKX P2P (https://www.okx.com/p2p-markets)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class TRY extends Currency {
  constructor() {
    super('TRY', [
      {
        source: new Binance(),
        pattern: '30 2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      }, // Every 5 minutes at 2:30, 7:30, 12:30, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the New Taiwan Dollar (TWD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. Remitano (https://remitano.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class TWD extends Currency {
  constructor() {
    super('TWD', [
      {
        source: new Binance(),
        pattern: '45 2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      }, // Every 5 minutes at 2:45, 7:45, 12:45, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Serbian Dinar (RSD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. Kriptomat (https://www.kriptomat.io/api/)
 */
export class RSD extends Currency {
  constructor() {
    super('RSD', [
      {
        source: new Binance(),
        pattern: '0 3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
      }, // Every 5 minutes at 3:00, 8:00, 13:00, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the West African CFA Franc (XOF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Yellow Card (https://yellowcard.io)
 * 2. Paxful (https://paxful.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class XOF extends Currency {
  constructor() {
    super('XOF', [
      {
        source: new Binance(),
        pattern: '15 3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
      }, // Every 5 minutes at 3:15, 8:15, 13:15, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Mauritian Rupee (MUR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Remitano (https://remitano.com/api)
 * 2. Paxful (https://paxful.com/api)
 */
export class MUR extends Currency {
  constructor() {
    super('MUR', [
      {
        source: new Binance(),
        pattern: '30 3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
      }, // Every 5 minutes at 3:30, 8:30, 13:30, etc.
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Bahraini Dinar (BHD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Rain (https://www.rain.bh/api/)
 * 2. BitOasis (https://www.bitoasis.net/api/)
 * 3. Paxful (https://paxful.com/api)
 */
export class BHD extends Currency {
  constructor() {
    super('BHD', [
      { source: new Binance(), pattern: '0 */5 * * * *' }, // Every 5 minutes at 0 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Jordanian Dinar (JOD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class JOD extends Currency {
  constructor() {
    super('JOD', [
      { source: new Binance(), pattern: '5 */5 * * * *' }, // Every 5 minutes at 5 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Omani Rial (OMR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. Rain (https://www.rain.bh/api/)
 */
export class OMR extends Currency {
  constructor() {
    super('OMR', [
      { source: new Binance(), pattern: '10 */5 * * * *' }, // Every 5 minutes at 10 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Kazakhstani Tenge (KZT) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KZT extends Currency {
  constructor() {
    super('KZT', [
      { source: new Binance(), pattern: '20 */5 * * * *' }, // Every 5 minutes at 20 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Romanian Leu (RON) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class RON extends Currency {
  constructor() {
    super('RON', [
      { source: new Binance(), pattern: '25 */5 * * * *' }, // Every 5 minutes at 25 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Panamanian Balboa (PAB) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class PAB extends Currency {
  constructor() {
    super('PAB', [
      { source: new Binance(), pattern: '35 */5 * * * *' }, // Every 5 minutes at 35 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Peruvian Sol (PEN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Buda (https://www.buda.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class PEN extends Currency {
  constructor() {
    super('PEN', [
      { source: new Binance(), pattern: '40 */5 * * * *' }, // Every 5 minutes at 40 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Albanian Lek (ALL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class ALL extends Currency {
  constructor() {
    super('ALL', [
      { source: new Binance(), pattern: '50 */5 * * * *' }, // Every 5 minutes at 50 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Azerbaijani Manat (AZN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class AZN extends Currency {
  constructor() {
    super('AZN', [
      { source: new Binance(), pattern: '55 */5 * * * *' }, // Every 5 minutes at 55 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Bosnia and Herzegovina Convertible Mark (BAM) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class BAM extends Currency {
  constructor() {
    super('BAM', [
      { source: new Binance(), pattern: '0 */1 * * * *' }, // Every minute at 0 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Bangladeshi Taka (BDT) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BDT extends Currency {
  constructor() {
    super('BDT', [
      { source: new Binance(), pattern: '5 */1 * * * *' }, // Every minute at 5 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Bulgarian Lev (BGN) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class BGN extends Currency {
  constructor() {
    super('BGN', [
      { source: new Binance(), pattern: '10 */1 * * * *' }, // Every minute at 10 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Bolivian Boliviano (BOB) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BOB extends Currency {
  constructor() {
    super('BOB', [
      { source: new Binance(), pattern: '15 */1 * * * *' }, // Every minute at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Bahamian Dollar (BSD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BSD extends Currency {
  constructor() {
    super('BSD', [
      { source: new Binance(), pattern: '20 */1 * * * *' }, // Every minute at 20 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Botswanan Pula (BWP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BWP extends Currency {
  constructor() {
    super('BWP', [
      { source: new Binance(), pattern: '25 */1 * * * *' }, // Every minute at 25 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Belize Dollar (BZD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class BZD extends Currency {
  constructor() {
    super('BZD', [
      { source: new Binance(), pattern: '30 */1 * * * *' }, // Every minute at 30 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Canadian Dollar (CAD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Coinsquare (https://coinsquare.com/api/)
 * 2. Bitbuy (https://bitbuy.ca/api/)
 * 3. Paxful (https://paxful.com/api)
 */
export class CAD extends Currency {
  constructor() {
    super('CAD', [
      { source: new Binance(), pattern: '35 */1 * * * *' }, // Every minute at 35 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Congolese Franc (CDF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class CDF extends Currency {
  constructor() {
    super('CDF', [
      { source: new Binance(), pattern: '40 */1 * * * *' }, // Every minute at 40 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Swiss Franc (CHF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Bitcoin Suisse (https://www.bitcoinsuisse.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class CHF extends Currency {
  constructor() {
    super('CHF', [
      { source: new Binance(), pattern: '45 */1 * * * *' }, // Every minute at 45 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Costa Rican Colón (CRC) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class CRC extends Currency {
  constructor() {
    super('CRC', [
      { source: new Binance(), pattern: '50 */1 * * * *' }, // Every minute at 50 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the British Pound (GBP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Coinbase Pro (https://pro.coinbase.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class GBP extends Currency {
  constructor() {
    super('GBP', [
      { source: new Binance(), pattern: '55 */1 * * * *' }, // Every minute at 55 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Danish Krone (DKK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Kriptomat (https://www.kriptomat.io/api/)
 */
export class DKK extends Currency {
  constructor() {
    super('DKK', [
      { source: new Binance(), pattern: '0 * * * * *' }, // Every minute at 0 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Ethiopian Birr (ETB) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class ETB extends Currency {
  constructor() {
    super('ETB', [
      { source: new Binance(), pattern: '5 * * * * *' }, // Every minute at 5 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Egyptian Pound (EGP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class EGP extends Currency {
  constructor() {
    super('EGP', [
      { source: new Binance(), pattern: '10 * * * * *' }, // Every minute at 10 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Georgian Lari (GEL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class GEL extends Currency {
  constructor() {
    super('GEL', [
      { source: new Binance(), pattern: '15 * * * * *' }, // Every minute at 15 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Gambian Dalasi (GMD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class GMD extends Currency {
  constructor() {
    super('GMD', [
      { source: new Binance(), pattern: '20 * * * * *' }, // Every minute at 20 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Guatemalan Quetzal (GTQ) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class GTQ extends Currency {
  constructor() {
    super('GTQ', [
      { source: new Binance(), pattern: '25 * * * * *' }, // Every minute at 25 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Honduran Lempira (HNL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class HNL extends Currency {
  constructor() {
    super('HNL', [
      { source: new Binance(), pattern: '30 * * * * *' }, // Every minute at 30 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Haitian Gourde (HTG) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class HTG extends Currency {
  constructor() {
    super('HTG', [
      { source: new Binance(), pattern: '35 * * * * *' }, // Every minute at 35 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Icelandic Króna (ISK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class ISK extends Currency {
  constructor() {
    super('ISK', [
      { source: new Binance(), pattern: '40 * * * * *' }, // Every minute at 40 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Jamaican Dollar (JMD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class JMD extends Currency {
  constructor() {
    super('JMD', [
      { source: new Binance(), pattern: '45 * * * * *' }, // Every minute at 45 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Japanese Yen (JPY) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. bitFlyer (https://bitflyer.com/api/)
 * 2. Coincheck (https://coincheck.com/api/)
 * 3. Paxful (https://paxful.com/api)
 */
export class JPY extends Currency {
  constructor() {
    super('JPY', [
      { source: new Binance(), pattern: '50 * * * * *' }, // Every minute at 50 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Kyrgyzstani Som (KGS) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KGS extends Currency {
  constructor() {
    super('KGS', [
      { source: new Binance(), pattern: '55 * * * * *' }, // Every minute at 55 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Cambodian Riel (KHR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KHR extends Currency {
  constructor() {
    super('KHR', [
      { source: new Binance(), pattern: '2 * * * * *' }, // Every minute at 2 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Kuwaiti Dinar (KWD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class KWD extends Currency {
  constructor() {
    super('KWD', [
      { source: new Binance(), pattern: '7 * * * * *' }, // Every minute at 7 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Cayman Islands Dollar (KYD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class KYD extends Currency {
  constructor() {
    super('KYD', [
      { source: new Binance(), pattern: '12 * * * * *' }, // Every minute at 12 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Lao Kip (LAK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class LAK extends Currency {
  constructor() {
    super('LAK', [
      { source: new Binance(), pattern: '17 * * * * *' }, // Every minute at 17 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Lebanese Pound (LBP) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class LBP extends Currency {
  constructor() {
    super('LBP', [
      { source: new Binance(), pattern: '22 * * * * *' }, // Every minute at 22 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Liberian Dollar (LRD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class LRD extends Currency {
  constructor() {
    super('LRD', [
      { source: new Binance(), pattern: '27 * * * * *' }, // Every minute at 27 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Moroccan Dirham (MAD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class MAD extends Currency {
  constructor() {
    super('MAD', [
      { source: new Binance(), pattern: '32 * * * * *' }, // Every minute at 32 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Moldovan Leu (MDL) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class MDL extends Currency {
  constructor() {
    super('MDL', [
      { source: new Binance(), pattern: '37 * * * * *' }, // Every minute at 37 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Namibian Dollar (NAD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class NAD extends Currency {
  constructor() {
    super('NAD', [
      { source: new Binance(), pattern: '42 * * * * *' }, // Every minute at 42 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Nicaraguan Córdoba (NIO) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class NIO extends Currency {
  constructor() {
    super('NIO', [
      { source: new Binance(), pattern: '47 * * * * *' }, // Every minute at 47 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Norwegian Krone (NOK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. NBX (https://nbx.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class NOK extends Currency {
  constructor() {
    super('NOK', [
      { source: new Binance(), pattern: '52 * * * * *' }, // Every minute at 52 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the New Zealand Dollar (NZD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Independent Reserve (https://www.independentreserve.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class NZD extends Currency {
  constructor() {
    super('NZD', [
      { source: new Binance(), pattern: '57 * * * * *' }, // Every minute at 57 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Papua New Guinean Kina (PGK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class PGK extends Currency {
  constructor() {
    super('PGK', [
      { source: new Binance(), pattern: '3 * * * * *' }, // Every minute at 3 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Paraguayan Guaraní (PYG) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class PYG extends Currency {
  constructor() {
    super('PYG', [
      { source: new Binance(), pattern: '8 * * * * *' }, // Every minute at 8 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Qatari Riyal (QAR) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. BitOasis (https://www.bitoasis.net/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class QAR extends Currency {
  constructor() {
    super('QAR', [
      { source: new Binance(), pattern: '13 * * * * *' }, // Every minute at 13 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Swedish Krona (SEK) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Safello (https://safello.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class SEK extends Currency {
  constructor() {
    super('SEK', [
      { source: new Binance(), pattern: '18 * * * * *' }, // Every minute at 18 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Sierra Leonean Leone (SLE) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class SLE extends Currency {
  constructor() {
    super('SLE', [
      { source: new Binance(), pattern: '23 * * * * *' }, // Every minute at 23 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Somali Shilling (SOS) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class SOS extends Currency {
  constructor() {
    super('SOS', [
      { source: new Binance(), pattern: '28 * * * * *' }, // Every minute at 28 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Turkmenistani Manat (TMT) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class TMT extends Currency {
  constructor() {
    super('TMT', [
      { source: new Binance(), pattern: '33 * * * * *' }, // Every minute at 33 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Trinidad and Tobago Dollar (TTD) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Paxful (https://paxful.com/api)
 * 2. LocalBitcoins (https://www.localbitcoins.com/api/)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class TTD extends Currency {
  constructor() {
    super('TTD', [
      { source: new Binance(), pattern: '38 * * * * *' }, // Every minute at 38 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Venezuelan Bolívar Soberano (VES) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. AirTM (https://www.airtm.com/api/)
 * 2. Paxful (https://paxful.com/api)
 * 3. LocalBitcoins (https://www.localbitcoins.com/api/)
 */
export class VES extends Currency {
  constructor() {
    super('VES', [
      { source: new Binance(), pattern: '43 * * * * *' }, // Every minute at 43 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Central African CFA Franc (XAF) currency.
 *
 * Alternative P2P Exchange Sources:
 * 1. Yellow Card (https://yellowcard.io)
 * 2. Paxful (https://paxful.com/api)
 * 3. Binance P2P (https://p2p.binance.com)
 */
export class XAF extends Currency {
  constructor() {
    super('XAF', [
      { source: new Binance(), pattern: '48 * * * * *' }, // Every minute at 48 seconds
      { source: new FawazExchangeApi() },
    ]);
  }
}

/**
 * Represents the Malawian Kwacha (MWK) currency.
 */
export class MWK extends Currency {
  constructor() {
    super('MWK', [
      { source: new FawazExchangeApi() }, // Every 5 minutes at 15 seconds
      { source: new Binance() },
    ]);
  }
}

/**
 * Represents the Argentinian Peso (ARS) currency.
 */
export class ARS extends Currency {
  constructor() {
    super('ARS', [
      { source: new FawazExchangeApi() }, // Every 5 minutes at 15 seconds
      { source: new Binance() },
    ]);
  }
}

/**
 * Represents the United Arab Emirates Dirham (AED) currency.
 */
export class AED extends Currency {
  constructor() {
    super('AED', [
      { source: new FawazExchangeApi() },
      { source: new Binance() },
    ]);
  }
}

/**
 * Represents the Brazilian Real (BRL) currency.
 */
export class BRL extends Currency { constructor() { super('BRL', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Chinese Yuan Renminbi (CNY) currency.
 */
export class CNY extends Currency {
  constructor() {
    super('CNY', [
      { source: new FawazExchangeApi() },
      { source: new Binance() },
    ]);
  }
}

/**
 * Represents the South Korean Won (KRW) currency.
 */
export class KRW extends Currency { constructor() { super('KRW', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Russian Ruble (RUB) currency.
 */
export class RUB extends Currency { constructor() { super('RUB', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Ukrainian Hryvnia (UAH) currency.
 */
export class UAH extends Currency {
  constructor() {
    super('UAH', [
      { source: new FawazExchangeApi() },
      { source: new Binance() },
    ]);
  }
}

/**
 * Represents the Uruguayan Peso (UYU) currency.
 */
export class UYU extends Currency {
  constructor() {
    super('UYU', [
      { source: new FawazExchangeApi() },
      { source: new Binance() },
    ]);
  }
}

/**
 * Represents the Angolan Kwanza (AOA) currency.
 */
export class AOA extends Currency {
  constructor() {
    super('AOA', [
      { source: new FawazExchangeApi() },
      { source: new Binance() },]);
  }
}

/**
 * Represents the Guinean Franc (GNF) currency.
 */
export class GNF extends Currency {
  constructor() {
    super('GNF', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Lesotho Loti (LSL) currency.
 */
export class LSL extends Currency { constructor() { super('LSL', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Mozambican Metical (MZN) currency.
 */
export class MZN extends Currency {
  constructor() {
    super('MZN', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Rwandan Franc (RWF) currency.
 */
export class RWF extends Currency {
  constructor() {
    super('RWF', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Sudanese Pound (SDG) currency.
 */
export class SDG extends Currency {
  constructor() {
    super('SDG', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Eswatini Lilangeni (SZL) currency.
 */
export class SZL extends Currency { constructor() { super('SZL', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the São Tomé and Príncipe Dobra (STN) currency.
 */
export class STN extends Currency { constructor() { super('STN', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Zambian Kwacha (ZMW) currency.
 */
export class ZMW extends Currency {
  constructor() {
    super('ZMW', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Zimbabwean Dollar (ZWL) currency.
 */
export class ZWL extends Currency { constructor() { super('ZWL', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Iraqi Dinar (IQD) currency.
 */
export class IQD extends Currency {
  constructor() {
    super('IQD', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Iranian Rial (IRR) currency.
 */
export class IRR extends Currency { constructor() { super('IRR', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Syrian Pound (SYP) currency.
 */
export class SYP extends Currency {
  constructor() {
    super('SYP', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Tunisian Dinar (TND) currency.
 */
export class TND extends Currency {
  constructor() {
    super('TND', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Yemeni Rial (YER) currency.
 */
export class YER extends Currency {
  constructor() {
    super('YER', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Sri Lankan Rupee (LKR) currency.
 */
export class LKR extends Currency {
  constructor() {
    super('LKR', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Myanmar Kyat (MMK) currency.
 */
export class MMK extends Currency { constructor() { super('MMK', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Mongolian Tögrög (MNT) currency.
 */
export class MNT extends Currency {
  constructor() {
    super('MNT', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Nepalese Rupee (NPR) currency.
 */
export class NPR extends Currency {
  constructor() {
    super('NPR', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Tajikistani Somoni (TJS) currency.
 */
export class TJS extends Currency {
  constructor() {
    super('TJS', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Uzbekistani Som (UZS) currency.
 */
export class UZS extends Currency { constructor() { super('UZS', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Surinamese Dollar (SRD) currency.
 */
export class SRD extends Currency { constructor() { super('SRD', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Salvadoran Colón (SVC) currency.
 */
export class SVC extends Currency { constructor() { super('SVC', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Fijian Dollar (FJD) currency.
 */
export class FJD extends Currency { constructor() { super('FJD', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Solomon Islands Dollar (SBD) currency.
 */
export class SBD extends Currency { constructor() { super('SBD', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Tongan Paʻanga (TOP) currency.
 */
export class TOP extends Currency { constructor() { super('TOP', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Vanuatu Vatu (VUV) currency.
 */
export class VUV extends Currency { constructor() { super('VUV', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Samoan Tala (WST) currency.
 */
export class WST extends Currency { constructor() { super('WST', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Macedonian Denar (MKD) currency.
 */
export class MKD extends Currency { constructor() { super('MKD', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Netherlands Antillean Guilder (ANG) currency.
 */
export class ANG extends Currency { constructor() { super('ANG', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Aruban Florin (AWG) currency.
 */
export class AWG extends Currency { constructor() { super('AWG', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Barbadian Dollar (BBD) currency.
 */
export class BBD extends Currency { constructor() { super('BBD', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Burundian Franc (BIF) currency.
 */
export class BIF extends Currency {
  constructor() {
    super('BIF', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Bermudian Dollar (BMD) currency.
 */
export class BMD extends Currency { constructor() { super('BMD', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Brunei Dollar (BND) currency.
 */
export class BND extends Currency {
  constructor() {
    super('BND', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }]);
  }
}

/**
 * Represents the Cuban Peso (CUP) currency.
 */
export class CUP extends Currency { constructor() { super('CUP', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Cape Verdean Escudo (CVE) currency.
 */
export class CVE extends Currency { constructor() { super('CVE', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Djiboutian Franc (DJF) currency.
 */
export class DJF extends Currency { constructor() { super('DJF', [{ source: new FawazExchangeApi() }]); } }
/**
 * Represents the Falkland Islands Pound (FKP) currency.
 */
export class FKP extends Currency { constructor() { super('FKP', [{ source: new FawazExchangeApi() }]); } }
/**
 * Represents the Gibraltar Pound (GIP) currency.
 */
export class GIP extends Currency { constructor() { super('GIP', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Comorian Franc (KMF) currency.
 */
export class KMF extends Currency { constructor() { super('KMF', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the North Korean Won (KPW) currency.
 */
export class KPW extends Currency { constructor() { super('KPW', [{ source: new FawazExchangeApi() }]); } }

/**
 * Represents the Macanese Pataca (MOP) currency.
 */
export class MOP extends Currency {
  constructor() {
    super('MOP', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Mauritanian Ouguiya (MRU) currency.
 */
export class MRU extends Currency {
  constructor() {
    super('MRU', [
      { source: new Binance() },
      { source: new FawazExchangeApi() }
    ]);
  }
}

/**
 * Represents the Saint Helena Pound (SHP) currency.
 */
export class SHP extends Currency { constructor() { super('SHP', [{ source: new FawazExchangeApi() }]); } }
