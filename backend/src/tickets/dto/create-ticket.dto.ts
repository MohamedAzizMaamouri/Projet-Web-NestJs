import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTicketDto {
  @IsInt()
  @IsPositive()
  eventId: number;

  @IsInt()
  @IsPositive()
  tierId: number;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  seat?: string;
}