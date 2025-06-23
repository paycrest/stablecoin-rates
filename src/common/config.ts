import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  validate,
} from 'class-validator';

class Config {
  @IsOptional()
  PORT: string = '8000';

  @IsOptional()
  DATABASE_DIALECT: 'postgres' | 'mysql' | 'oracle' = 'postgres';

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
}

export let config: Config;

export const setupConfig = async () => {
  config = plainToInstance(Config, process.env);

  const [error] = await validate(config, { whitelist: true });
  if (error) return error;
};
