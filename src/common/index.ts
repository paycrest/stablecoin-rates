import { ConsoleLogger } from '@nestjs/common';
export * as config from './config';

export const logger = new ConsoleLogger();
