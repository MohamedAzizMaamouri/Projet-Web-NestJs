import { IsEnum } from 'class-validator';
import { EventStatus } from '../event.entity';

export class TransitionEventStatusDto {
    @IsEnum(EventStatus, {
        message: `status must be one of: ${Object.values(EventStatus).join(', ')}`,
    })
    status: EventStatus;
}