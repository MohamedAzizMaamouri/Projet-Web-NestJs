import { PartialType } from '@nestjs/swagger';
import { CreateTicketTierDto } from './create-ticket-tier.dto';

export class UpdateTicketTierDto extends PartialType(CreateTicketTierDto) {}
