import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Ticket } from './ticket.entity';
import { TicketTier } from './ticket-tier.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketTiersService } from './ticket-tiers.service';
import { TicketTiersController } from './ticket-tiers.controller';
import { EventsModule } from '../events/events.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketTier]),
    EventsModule,
    HttpModule,
    PromoCodesModule,
    RealtimeModule,
    WaitlistModule,
  ],
  providers: [TicketsService, TicketTiersService],
  controllers: [TicketsController, TicketTiersController],
  exports: [TicketsService, TicketTiersService, TypeOrmModule],
})
export class TicketsModule {}
