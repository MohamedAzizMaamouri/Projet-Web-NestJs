import { IsInt, IsPositive } from 'class-validator';

export class JoinWaitlistDto {
  @IsInt()
  @IsPositive()
  eventId: number;
}
