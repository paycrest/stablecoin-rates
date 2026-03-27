import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  validate,
} from 'class-validator';

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

  @IsNotEmpty()
  DATABASE_URL: string;

  /** PEM text for Postgres TLS (e.g. managed DB CA). Use DATABASE_SSL_CA_B64 on hosts that dislike multiline secrets. */
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString()
  DATABASE_SSL_CA?: string;

  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString()
  DATABASE_SSL_CA_B64?: string;
}

export let config: Config;

export const setupConfig = async () => {
  config = plainToInstance(Config, process.env);

  const [error] = await validate(config, { whitelist: true });
  if (error) return error;
};
