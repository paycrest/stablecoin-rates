import { ConsoleLogger } from '@nestjs/common';
export * as config from './config';

export const logger = new ConsoleLogger();

export const calculateMedian = (numbers: number[]): number => {
  const adPrices = numbers.sort((a, b) => a - b);
  let median: number;
  const len = adPrices.length;
  const mid = Math.floor(len / 2);
  if (len % 2 === 0) {
    median = (adPrices[mid - 1] + adPrices[mid]) / 2;
  } else {
    median = adPrices[mid];
  }

  return median;
};
