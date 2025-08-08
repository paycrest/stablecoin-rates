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

  public static db = async () => {
    const dialectModule = this.availableDialects[config.DATABASE_DIALECT];

    const sequelizeOptions: SequelizeOptions = {
      dialect: config.DATABASE_DIALECT,
      logging: config.ENABLE_DATABASE_LOGGING ? console.log : false,
      models: Object.values(models),
      dialectOptions: {
        ssl: config.ENABLE_DATABASE_SSL
          ? { require: true, rejectUnauthorized: true }
          : undefined,
      },
      dialectModule,
    };

    return new Sequelize(config.DATABASE_URL, sequelizeOptions);
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
