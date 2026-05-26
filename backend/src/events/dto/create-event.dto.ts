import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

function IsFutureDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDate',
      target: (object as any).constructor,
      propertyName,
      options: {
        message: 'Event date must be at least 24 hours in the future',
        ...options,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const date = new Date(value);
          const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          return !isNaN(date.getTime()) && date > minDate;
        },
      },
    });
  };
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  @IsFutureDate()
  date: string;

  @IsOptional()
  @IsDateString()
  salesClosedAt?: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  capacity: number;

  /**
   * Ticket price in the platform's currency unit (e.g. TND).
   * Defaults to 0 for free events.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsInt()
  @IsPositive()
  categoryId: number;
}
