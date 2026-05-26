import {
  Controller,
  MessageEvent,
  Param,
  ParseIntPipe,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { from, merge, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RealtimeService } from './realtime.service';
import { User } from '../users/user.entity';

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

  /**
   * GET /realtime/events/:id/messages
   * Server-Sent Events stream for announcements, Q&A, and waitlist notices.
   */
  @Sse('events/:id/messages')
  streamMessages(
    @Param('id', ParseIntPipe) eventId: number,
  ): Observable<MessageEvent> {
    return this.realtimeService.messages$.pipe(
      filter((message) => message.eventId === eventId),
      map((message) => ({
        type: message.type,
        data: message,
      })),
    );
  }

  /**
   * GET /realtime/events/:id/status          ← Point 1
   * SSE — changements de statut de l'événement (published → cancelled, ended…).
   * Public : utile pour tout client qui affiche la page de l'événement.
   */
  @Sse('events/:id/status')
  streamEventStatus(
      @Param('id', ParseIntPipe) eventId: number,
  ): Observable<MessageEvent> {
    return this.realtimeService.eventStatusUpdates$.pipe(
        filter((update) => update.eventId === eventId),
        map((update) => ({
          type: 'event-status',
          data: update,
        })),
    );
  }

  /**
   * GET /realtime/me/tickets                 ← Point 2
   * SSE — notifications personnelles : ticket scanné, remboursé, annulé.
   * Nécessite un JWT valide (Authorization: Bearer <token>).
   */
  @UseGuards(JwtAuthGuard)
  @Sse('me/tickets')
  streamMyTickets(@Req() req: { user: User }): Observable<MessageEvent> {
    const userId = req.user.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return this.realtimeService.personalTicketUpdates$.pipe(
        filter((update) => update.userId === userId),
        map((update) => ({
          type: 'ticket-update',
          data: update,
        })),
    );
  }
}
