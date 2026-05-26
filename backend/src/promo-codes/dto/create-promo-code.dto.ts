import {
  IsDateString,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsInt()
  @IsPositive()
  eventId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  discountPercent: number;

  @IsInt()
  @IsPositive()
  maxUses: number;

  @IsDateString()
  expiresAt: string;
}
