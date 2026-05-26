import {
  Controller,
  MessageEvent,
  Param,
  ParseIntPipe,
  Sse,
} from '@nestjs/common';
import { from, merge, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * GET /realtime/events/:id/availability
   * Server-Sent Events stream for live ticket availability.
   */
  @Sse('events/:id/availability')
  streamAvailability(
    @Param('id', ParseIntPipe) eventId: number,
  ): Observable<MessageEvent> {
    const initialAvailability$ = from(
      this.realtimeService.getAvailability(eventId),
    );

    const updatesForEvent$ = this.realtimeService.availabilityUpdates$.pipe(
      filter((update) => update.eventId === eventId),
    );

    return merge(initialAvailability$, updatesForEvent$).pipe(
      map((update) => ({
        type: 'availability',
        data: update,
      })),
    );
  }
}
