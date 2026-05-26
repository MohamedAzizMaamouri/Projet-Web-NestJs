import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Event } from './event.entity';
import { Ticket } from '../tickets/ticket.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { CategoriesModule } from '../categories/categories.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Ticket]),
    CategoriesModule,
    RealtimeModule,
    HttpModule,
  ],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}