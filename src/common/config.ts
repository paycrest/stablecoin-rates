import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, validate } from 'class-validator';

class Config {
  @IsNotEmpty()
  @IsString()
  @IsOptional()
  PORT: string;
}

export let config: Config;

export const setupConfig = async () => {
  config = plainToInstance(Config, process.env);

  const [error] = await validate(config, { whitelist: true });
  if (error) return error;
};
