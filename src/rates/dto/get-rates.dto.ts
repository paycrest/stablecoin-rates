import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsIn } from 'class-validator';

type Coin = 'USDT' | 'USDC';
const coin = ['USDT', 'USDC'];

type Fiat = 'KES' | 'NGN' | 'GHS' | 'TZS' | 'UGX' | 'XOF';
const fiat = ['KES', 'NGN', 'GHS', 'TZS', 'UGX', 'XOF'];

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
  coin: Coin[];

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
