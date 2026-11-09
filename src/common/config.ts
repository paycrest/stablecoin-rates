import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validate,
} from 'class-validator';

export const DEFAULT_RATE_MAX_AGE_MINUTES = 30;

class Config {
  @IsOptional()
  PORT: string = '8000';

  @IsOptional()
  DATABASE_DIALECT: 'postgres' | 'mysql' | 'oracle' | 'sqlite' = 'postgres';

  @Transform(({ value }) => (value.toLowerCase() === 'true' ? true : false))
  @IsBoolean()
  @IsOptional()
  ENABLE_DATABASE_SSL: boolean = false;

  @Transform(({ value }) => (value.toLowerCase() === 'true' ? true : false))
  @IsBoolean()
  @IsOptional()
  ENABLE_DATABASE_LOGGING: boolean = true;

  /**
   * Source rates not refreshed within this many minutes are excluded from the
   * served (median) rate.
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || `${value}`.trim() === '') {
      return DEFAULT_RATE_MAX_AGE_MINUTES;
    }
    return Number(value);
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  RATE_MAX_AGE_MINUTES: number = DEFAULT_RATE_MAX_AGE_MINUTES;

  @IsNotEmpty()
  DATABASE_URL: string;

  /** PEM text for Postgres TLS (e.g. managed DB CA). */
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString()
  DATABASE_SSL_CA?: string;
}

export let config: Config;

export const setupConfig = async () => {
  config = plainToInstance(Config, process.env);

  const [error] = await validate(config, { whitelist: true });
  if (error) return error;
};
