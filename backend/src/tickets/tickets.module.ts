import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { Ticket } from './ticket.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { EventsModule } from '../events/events.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    EventsModule,
    HttpModule,
    PromoCodesModule,
    RealtimeModule,
    WaitlistModule,
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule {}
