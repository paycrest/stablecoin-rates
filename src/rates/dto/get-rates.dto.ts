import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty } from 'class-validator';

export type Stablecoin = 'USDT' | 'USDC';
const coin = ['USDT', 'USDC'];

export type Fiat =
  'AED' |
  'ALL' |
  'ANG' |
  'AOA' |
  'ARS' |
  'AWG' |
  'AZN' |
  'BAM' |
  'BBD' |
  'BDT' |
  'BHD' |
  'BIF' |
  'BMD' |
  'BND' |
  'BOB' |
  'BRL' |
  'BSD' |
  'BWP' |
  'BZD' |
  'CAD' |
  'CDF' |
  'CHF' |
  'CLP' |
  'CNY' |
  'COP' |
  'CRC' |
  'CZK' |
  'CUP' |
  'CVE' |
  'DKK' |
  'DJF' |
  'EGP' |
  'ETB' |
  'FJD' |
  'FKP' |
  'GEL' |
  'GGP' |
  'GHS' |
  'GIP' |
  'GMD' |
  'GNF' |
  'GTQ' |
  'HKD' |
  'HNL' |
  'HTG' |
  'HUF' |
  'IDR' |
  'INR' |
  'IQD' |
  'IRR' |
  'ISK' |
  'JMD' |
  'JOD' |
  'JPY' |
  'KES' |
  'KGS' |
  'KHR' |
  'KMF' |
  'KPW' |
  'KRW' |
  'KWD' |
  'KYD' |
  'KZT' |
  'LAK' |
  'LBP' |
  'LRD' |
  'LSL' |
  'MAD' |
  'MDL' |
  'MKD' |
  'MMK' |
  'MNT' |
  'MOP' |
  'MRU' |
  'MUR' |
  'MWK' |
  'MXN' |
  'MYR' |
  'MZN' |
  'NAD' |
  'NGN' |
  'NIO' |
  'NOK' |
  'NPR' |
  'NZD' |
  'OMR' |
  'PAB' |
  'PEN' |
  'PGK' |
  'PHP' |
  'PKR' |
  'PLN' |
  'PYG' |
  'QAR' |
  'RON' |
  'RSD' |
  'RUB' |
  'RWF' |
  'SAR' |
  'SBD' |
  'SEK' |
  'SGD' |
  'SHP' |
  'SLE' |
  'SOS' |
  'SRD' |
  'STN' |
  'SVC' |
  'SYP' |
  'SZL' |
  'TJS' |
  'TMT' |
  'TND' |
  'TOP' |
  'TRY' |
  'TTD' |
  'TWD' |
  'TZS' |
  'UAH' |
  'UGX' |
  'USD' |
  'UYU' |
  'UZS' |
  'VES' |
  'VND' |
  'VUV' |
  'WST' |
  'XAF' |
  'XOF' |
  'YER' |
  'ZAR' |
  'ZMW' |
  'ZWL';

const fiat = ['AED', 'ALL', 'ANG', 'AOA', 'ARS', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF',
  'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BWP', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CZK', 'CUP', 'CVE', 'DKK', 'DJF', 'EGP', 'ETB', 'FJD', 'FKP', 'GEL',
  'GGP', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW',
  'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LRD', 'LSL', 'MAD', 'MDL', 'MKD', 'MMK', 'MNT',
  'MOP', 'MRU', 'MUR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD',
  'RUB', 'RWF', 'SAR', 'SBD', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'STN', 'SVC',
  'SYP', 'SZL', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX',
  'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XOF', 'YER', 'ZAR', 'ZMW',
  'ZWL'];

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
