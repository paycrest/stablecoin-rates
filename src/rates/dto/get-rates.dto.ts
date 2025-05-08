import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty } from 'class-validator';

export type Stablecoin = 'USDT' | 'USDC';
const coin = ['USDT', 'USDC'];

export type Fiat = 'KES' | 'NGN' | 'GHS' | 'TZS' | 'UGX' | 'XOF' | 'MYR' | 'IDR' | 'PKR' | 'INR' | 'THB' | 'VND' | 'PHP' | 'SGD' | 'HKD';
const fiat = ['KES', 'NGN', 'GHS', 'TZS', 'UGX', 'XOF', 'MYR', 'IDR', 'PKR', 'INR', 'THB', 'VND', 'PHP', 'SGD', 'HKD'];

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
