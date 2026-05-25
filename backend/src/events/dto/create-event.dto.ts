import {
  IsDateString,
  IsInt,
  IsNotEmpty,
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

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  capacity: number;

  @IsInt()
  @IsPositive()
  categoryId: number;
}
