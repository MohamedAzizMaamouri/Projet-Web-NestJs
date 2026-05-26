import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsString,
    Min,
    MaxLength,
} from 'class-validator';

export class CreateTicketTierDto {
    @IsInt()
    @IsPositive()
    eventId: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    name: string; // "VIP", "Standard", "Early Bird" ...

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    price: number;

    @IsInt()
    @IsPositive()
    capacity: number;
}