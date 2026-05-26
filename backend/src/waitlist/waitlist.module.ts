import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/event.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { Ticket } from '../tickets/ticket.entity';
import { WaitlistEntry } from './waitlist-entry.entity';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistEntry, Event, Ticket]),
    RealtimeModule,
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
