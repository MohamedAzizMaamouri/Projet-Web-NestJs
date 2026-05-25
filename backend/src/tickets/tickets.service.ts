import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../common/base.service';
import { Ticket, TicketStatus } from './ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { User, UserRole } from '../users/user.entity';
import { EventsService } from '../events/events.service';
import { transition } from './ticket-status.machine';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TicketsService extends BaseService<Ticket> {
  constructor(
      @InjectRepository(Ticket)
      private readonly ticketRepository: Repository<Ticket>,
      private readonly eventsService: EventsService,
      private readonly httpService: HttpService,
      private readonly configService: ConfigService,
  ) {
    super(ticketRepository);
  }

  // ─── Purchase ────────────────────────────────────────────────────────────────

  async purchaseTicket(dto: CreateTicketDto, buyer: User): Promise<Ticket> {
    const event = await this.eventsService.getEventById(dto.eventId);

    const soldTickets = await this.ticketRepository.count({
      where: {event: {id: event.id}},
    });

    if (soldTickets >= event.capacity) {
      throw new BadRequestException(
          `This event is fully booked (capacity: ${event.capacity})`,
      );
    }

    // Start at PENDING, immediately confirm (payment is synchronous for now)
    const initialStatus = TicketStatus.PENDING;
    const confirmedStatus = transition(initialStatus, TicketStatus.CONFIRMED);

    const ticket = this.ticketRepository.create({
      event,
      owner: buyer,
      seat: dto.seat ?? null,
      purchasedAt: new Date(),
      status: confirmedStatus,
    });

    const saved = await this.ticketRepository.save(ticket);


    return saved;
  }

  // ─── Cancel (by attendee or admin) ───────────────────────────────────────────

  /**
   * An attendee can only cancel their own ticket.
   * An admin can cancel any ticket.
   * The state machine enforces that only CONFIRMED tickets can be cancelled.
   */
  async cancelTicket(ticketId: number, requestingUser: User): Promise<Ticket> {
    const ticket = await this.findTicketById(ticketId);

    const isOwner = ticket.owner.id === requestingUser.id;
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
          'You are not allowed to cancel this ticket.',
      );
    }

    // State machine validates: CONFIRMED → CANCELLED (throws if invalid)
    ticket.status = transition(ticket.status, TicketStatus.CANCELLED);

    return this.ticketRepository.save(ticket);
  }

  // ─── Refund (internal — triggered when an organizer cancels an event) ─────────

  /**
   * Bulk-refunds all CONFIRMED tickets for a given event.
   * This is called internally when an event is cancelled by its organizer.
   * Each ticket goes through the state machine: CONFIRMED → REFUNDED.
   */
  async refundAllTicketsForEvent(eventId: number): Promise<void> {
    const tickets = await this.ticketRepository.find({
      where: {
        event: {id: eventId},
        status: TicketStatus.CONFIRMED,
      },
    });

    for (const ticket of tickets) {
      // State machine validates: CONFIRMED → REFUNDED
      ticket.status = transition(ticket.status, TicketStatus.REFUNDED);
    }

    await this.ticketRepository.save(tickets);
  }

  // ─── Scan (by organizer or admin at the venue entrance) ──────────────────────

  /**
   * Marks a ticket as SCANNED at the venue entrance.
   * Only organizers (of this event) and admins can scan.
   * A ticket can only be scanned once — the state machine blocks re-scanning.
   */
  async scanTicket(ticketId: number, requestingUser: User): Promise<Ticket> {
    const ticket = await this.findTicketById(ticketId);

    const isEventOrganizer =
        ticket.event.organizer?.id === requestingUser.id;
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isEventOrganizer && !isAdmin) {
      throw new ForbiddenException(
          'Only the event organizer or an admin can scan tickets.',
      );
    }

    // State machine validates: CONFIRMED → SCANNED
    // Throws if ticket is already SCANNED, CANCELLED, or REFUNDED
    ticket.status = transition(ticket.status, TicketStatus.SCANNED);

    return this.ticketRepository.save(ticket);
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getMyTickets(owner: User): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: {owner: {id: owner.id}},
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async findTicketById(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({where: {id}});
    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} not found.`);
    }
    return ticket;
  }
}
