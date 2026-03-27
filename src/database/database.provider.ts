import * as mysql2 from 'mysql2';
import * as oracledb from 'oracledb';
import * as pg from 'pg';
import * as sqlite3 from 'sqlite3';
import { SyncOptions } from 'sequelize';
import { Sequelize, SequelizeOptions } from 'sequelize-typescript';
import { logger } from '../common';
import { config } from '../common/config';
import * as models from './models';

export class DatabaseProvider {
  public static readonly provide = 'SEQUELIZE';
  private static readonly availableDialects = {
    postgres: pg,
    mysql: mysql2,
    oracle: oracledb,
    sqlite: sqlite3,
  };

  /** Query params that control TLS via URL; remove when using explicit `dialectOptions.ssl` to avoid conflicting with `pg`. */
  private static readonly PG_SSL_QUERY_PARAMS = [
    'sslmode',
    'sslrootcert',
    'sslcert',
    'sslkey',
    'sslcrl',
  ] as const;

  private static stripPgSslParamsFromConnectionString(
    connectionString: string,
  ): string {
    try {
      const url = new URL(connectionString);
      for (const p of DatabaseProvider.PG_SSL_QUERY_PARAMS) {
        url.searchParams.delete(p);
      }
      return url.toString();
    } catch {
      return connectionString;
    }
  }

  private static databaseSslCaPem(): string | undefined {
    const pem = config.DATABASE_SSL_CA?.trim();
    return pem || undefined;
  }

  public static db = async () => {
    const dialectModule = this.availableDialects[config.DATABASE_DIALECT];
    const ca = this.databaseSslCaPem();
    const useExplicitSsl =
      config.ENABLE_DATABASE_SSL ||
      (config.DATABASE_DIALECT === 'postgres' && !!ca);

    const ssl = useExplicitSsl
      ? {
          require: true,
          rejectUnauthorized: true,
          ...(ca ? { ca } : {}),
        }
      : undefined;

    let databaseUrl = config.DATABASE_URL;
    if (config.DATABASE_DIALECT === 'postgres' && ssl) {
      databaseUrl = this.stripPgSslParamsFromConnectionString(databaseUrl);
    }

    const sequelizeOptions: SequelizeOptions = {
      dialect: config.DATABASE_DIALECT,
      logging: config.ENABLE_DATABASE_LOGGING ? console.log : false,
      models: Object.values(models),
      dialectOptions: {
        ssl,
      },
      dialectModule,
    };

    return new Sequelize(databaseUrl, sequelizeOptions);
  };

  public static async useFactory(): Promise<Sequelize> {
    try {
      const syncOptions: SyncOptions = { alter: true };

      const db = await DatabaseProvider.db();
      await db.sync(syncOptions);

      return db;
    } catch (error) {
      logger.error('DB Error:', error.message);
    }
  }
}
