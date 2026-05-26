import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTicketDto {
  @IsInt()
  @IsPositive()
  eventId: number;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
