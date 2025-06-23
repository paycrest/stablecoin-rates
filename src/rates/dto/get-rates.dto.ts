import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty } from 'class-validator';

export type Stablecoin = 'USDT' | 'USDC';
const coin = ['USDT', 'USDC'];

export type Fiat =
  'KES' |
  'NGN' |
  'GHS' |
  'TZS' |
  'UGX' |
  'XOF' |
  'MYR' |
  'IDR' |
  'PKR' |
  'INR' |
  'THB' |
  'VND' |
  'PHP' |
  'SGD' |
  'HKD' |
  'MXN' |
  'ZAR' |
  'SAR' |
  'CZK' |
  'HUF' |
  'PLN' |
  'COP' |
  'CLP' |
  'TRY' |
  'TWD' |
  'RSD' |
  'XOF' |
  'MUR' |
  'BHD' |
  'JOD' |
  'OMR' |
  'KZT' |
  'RON' |
  'PAB' |
  'PEN' |
  'ALL' |
  'AZN' |
  'BAM' |
  'BDT' |
  'BGN' |
  'BHD' |
  'BOB' |
  'BSD' |
  'BWP' |
  'BZD' |
  'CAD' |
  'CDF' |
  'CHF' |
  'CRC' |
  'GBP' |
  'DKK' |
  'ETB' |
  'EGP' |
  'GEL' |
  'GHS' |
  'GMD' |
  'GTQ' |
  'HNL' |
  'HTG' |
  'ISK' |
  'JMD' |
  'JOD' |
  'JPY' |
  'KGS' |
  'KHR' |
  'KWD' |
  'KYD' |
  'KZT' |
  'LAK' |
  'LBP' |
  'LRD' |
  'MAD' |
  'MDL' |
  'NAD' |
  'NIO' |
  'NOK' |
  'NZD' |
  'OMR' |
  'PAB' |
  'PEN' |
  'PGK' |
  'PHP' |
  'PKR' |
  'PYG' |
  'QAR' |
  'RON' |
  'RSD' |
  'SEK' |
  'SLE' |
  'SOS' |
  'TMT' |
  'TTD' |
  'VES' |
  'XAF';

const fiat = [
  'KES',
  'NGN',
  'GHS',
  'TZS',
  'UGX',
  'XOF',
  'MXN',
  'MYR',
  'IDR',
  'PKR',
  'INR',
  'THB',
  'VND',
  'PHP',
  'SGD',
  'HKD',
  'ZAR',
  'SAR',
  'CZK',
  'HUF',
  'PLN',
  'COP',
  'CLP',
  'TRY',
  'TWD',
  'RSD',
  'XOF',
  'MUR',
  'BHD',
  'JOD',
  'OMR',
  'KZT',
  'RON',
  'PAB',
  'PEN',
  'ALL',
  'AZN',
  'BAM',
  'BDT',
  'BGN',
  'BHD',
  'BOB',
  'BSD',
  'BWP',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CRC',
  'GBP',
  'DKK',
  'ETB',
  'EGP',
  'GEL',
  'GHS',
  'GMD',
  'GTQ',
  'HNL',
  'HTG',
  'ISK',
  'JMD',
  'JOD',
  'JPY',
  'KGS',
  'KHR',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LRD',
  'MAD',
  'MDL',
  'NAD',
  'NIO',
  'NOK',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'SEK',
  'SLE',
  'SOS',
  'TMT',
  'TTD',
  'VES',
  'XAF'];

export class GetRatesDTO {
  @ApiProperty({
    required: true,
    isArray: true,
    type: 'array',
    uniqueItems: true,
    enum: coin,
  })
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsIn(coin, { each: true })
  coin: Stablecoin[];

  @ApiProperty({
    required: true,
    isArray: true,
    type: 'array',
    uniqueItems: true,
    enum: fiat,
  })
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsIn(fiat, { each: true })
  fiat: Fiat[];
}
