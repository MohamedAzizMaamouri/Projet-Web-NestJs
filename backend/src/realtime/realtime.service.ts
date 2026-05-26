import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '../events/event.entity';
import { Ticket, TicketStatus } from '../tickets/ticket.entity';

export interface AvailabilityUpdate {
  eventId: number;
  capacity: number;
  sold: number;
  ticketsLeft: number;
  updatedAt: string;
}

export interface RealtimeMessage {
  eventId: number;
  type:
    | 'announcement'
    | 'question'
    | 'message'
    | 'purchase-confirmation'
    | 'waitlist';
  text: string;
  sender?: string;
  sentAt: string;
}

// ── Point 1 ────────────────────────────────────────────────────────────────────
export interface EventStatusUpdate {
  eventId: number;
  title: string;
  previousStatus: EventStatus;
  newStatus: EventStatus;
  changedAt: string;
}

// ── Point 2 ────────────────────────────────────────────────────────────────────
export interface PersonalTicketUpdate {
  userId: number;
  ticketId: number;
  eventId: number;
  eventTitle: string;
  newStatus: TicketStatus;
  updatedAt: string;
}

@Injectable()
export class RealtimeService {
  private readonly availabilitySubject = new Subject<AvailabilityUpdate>();
  private readonly messageSubject = new Subject<RealtimeMessage>();

  private readonly eventStatusSubject = new Subject<EventStatusUpdate>();

  private readonly personalTicketSubject = new Subject<PersonalTicketUpdate>();

  readonly availabilityUpdates$ = this.availabilitySubject.asObservable();
  readonly messages$ = this.messageSubject.asObservable();
  readonly eventStatusUpdates$  = this.eventStatusSubject.asObservable();
  readonly personalTicketUpdates$ = this.personalTicketSubject.asObservable();

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async getAvailability(eventId: number): Promise<AvailabilityUpdate> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }

    const sold = await this.ticketRepository.count({
      where: {
        event: { id: eventId },
        status: TicketStatus.CONFIRMED,
      },
    });

    return {
      eventId,
      capacity: event.capacity,
      sold,
      ticketsLeft: Math.max(event.capacity - sold, 0),
      updatedAt: new Date().toISOString(),
    };
  }

  async publishAvailability(eventId: number): Promise<AvailabilityUpdate> {
    const update = await this.getAvailability(eventId);
    this.availabilitySubject.next(update);
    return update;
  }

  publishMessage(message: Omit<RealtimeMessage, 'sentAt'>): RealtimeMessage {
    const payload = {
      ...message,
      sentAt: new Date().toISOString(),
    };

    this.messageSubject.next(payload);
    return payload;
  }
  
  publishEventStatus(
      event: Event,
      previousStatus: EventStatus,
  ): EventStatusUpdate {
    const payload: EventStatusUpdate = {
      eventId:        event.id,
      title:          event.title,
      previousStatus,
      newStatus:      event.status,
      changedAt:      new Date().toISOString(),
    };
    this.eventStatusSubject.next(payload);
    return payload;
  }
  
  publishPersonalTicketUpdate(
      ticket: Ticket,
      eventTitle: string,
  ): PersonalTicketUpdate {
    const payload: PersonalTicketUpdate = {
      userId:     ticket.owner.id,
      ticketId:   ticket.id,
      eventId:    ticket.event.id,
      eventTitle,
      newStatus:  ticket.status,
      updatedAt:  new Date().toISOString(),
    };
    this.personalTicketSubject.next(payload);
    return payload;
  }
}
