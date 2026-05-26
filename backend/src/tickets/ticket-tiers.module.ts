import { Module } from '@nestjs/common';
import { TicketTiersService } from './ticket-tiers.service';
import { TicketTiersController } from './ticket-tiers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketTier } from './ticket-tier.entity';
import { Ticket } from './ticket.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketTier, Ticket]),
    EventsModule,
  ],
  controllers: [TicketTiersController],
  providers: [TicketTiersService],
  exports: [TicketTiersService],
})
export class TicketTiersModule {}