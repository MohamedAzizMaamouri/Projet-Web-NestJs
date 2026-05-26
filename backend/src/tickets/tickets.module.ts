import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { Ticket } from './ticket.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { EventsModule } from '../events/events.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    EventsModule,
    HttpModule,
    RealtimeModule,
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule {}
