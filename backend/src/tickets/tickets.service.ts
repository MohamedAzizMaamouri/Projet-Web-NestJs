import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../common/base.service';
import { Ticket, TicketStatus } from './ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { User, UserRole } from '../users/user.entity';
import {Event, EventStatus} from '../events/event.entity';
import { EventsService } from '../events/events.service';
import { transition } from './ticket-status.machine';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TicketsService extends BaseService<Ticket> {
  constructor(
      @InjectRepository(Ticket)
      private readonly ticketRepository: Repository<Ticket>,
      private readonly eventsService: EventsService,
      private readonly httpService: HttpService,
      private readonly configService: ConfigService,
      private readonly dataSource: DataSource,
  ) {
    super(ticketRepository);
  }

  // ─── Purchase ────────────────────────────────────────────────────────────────

  async purchaseTicket(dto: CreateTicketDto, buyer: User): Promise<Ticket> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const event = await manager
          .getRepository(Event)
          .createQueryBuilder('event')
          .setLock('pessimistic_write')
          .where('event.id = :id', { id: dto.eventId })
          .getOne();

      if (!event) {
        throw new BadRequestException(`Event #${dto.eventId} not found`);
      }

      if (event.status !== EventStatus.PUBLISHED) {
        throw new BadRequestException(
            `Tickets can only be purchased for published events (current status: ${event.status})`,
        );
      }

      if (event.date <= new Date()) {
        throw new BadRequestException(
            'Tickets can no longer be purchased: this event has already started or ended',
        );
      }

      const soldCount = await manager
          .getRepository(Ticket)
          .count({
            where:
                { event: { id: event.id },
                  status: TicketStatus.CONFIRMED,
                }
          });

      if (soldCount >= event.capacity) {
        throw new BadRequestException(
            `This event is fully booked (capacity: ${event.capacity})`,
        );
      }

      const numericPart = parseInt(dto.seat.replace(/^[A-Za-z\-]*/g, ''), 10);
      if (!isNaN(numericPart) && numericPart > event.capacity) {
        throw new BadRequestException(
            `Seat "${dto.seat}" exceeds event capacity (${event.capacity})`,
        );
      }

      const seatTaken = await manager.getRepository(Ticket).findOne({
        where: { event: { id: event.id }, seat: dto.seat },
      });
      if (seatTaken) {
        throw new ConflictException(
            `Seat "${dto.seat}" is already taken for this event`,
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
        // Stamp the price at purchase time — preserved even if event.price changes later
        pricePaid: event.price ?? 0,
        qrToken: uuidv4(),
      });

      return manager.getRepository(Ticket).save(ticket);
    });

    const fullEvent = await this.eventsService.getEventById(dto.eventId);
    await this.fireWebhook(saved, fullEvent, buyer);

    return saved;
  }

  private async fireWebhook(
      ticket: Ticket,
      event: any,
      owner: User,
  ): Promise<void> {
    try {
      const webhookUrl =
          this.configService.get<string>('WEBHOOK_URL') ??
          'https://webhook.site/your-uuid';

      const payload = {
        ticketId: ticket.id,
        eventTitle: event.title,
        ownerEmail: owner.email,
        seat: ticket.seat,
        purchasedAt: ticket.purchasedAt,
      };

      await firstValueFrom(
          this.httpService.post(webhookUrl, payload, {
            timeout: 5000,
          }),
      );
    } catch (_err) {
      // Webhook failure must not affect the ticket purchase
    }
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

  async refundTicket(ticketId: number, requestingUser: User): Promise<Ticket> {
    const ticket = await this.findTicketById(ticketId);

    const isTicketHolder =
        ticket.owner?.id === requestingUser.id;
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isTicketHolder && !isAdmin) {
      throw new ForbiddenException(
          'Only the ticket holder or an admin can refund tickets.',
      );
    }

    ticket.status = transition(ticket.status, TicketStatus.REFUNDED);

    return this.ticketRepository.save(ticket);
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

  // ─── Verify by QR token (organizer scans QR code at entrance) ───────────────

  async verifyTicket(qrToken: string, requestingUser: User): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { qrToken } });

    if (!ticket) {
      throw new NotFoundException('Invalid QR code — ticket not found.');
    }

    const isEventOrganizer = ticket.event.organizer?.id === requestingUser.id;
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isEventOrganizer && !isAdmin) {
      throw new ForbiddenException(
          'Only the event organizer or an admin can verify tickets.',
      );
    }

    ticket.status = transition(ticket.status, TicketStatus.SCANNED);

    return this.ticketRepository.save(ticket);
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getMyTickets(owner: User): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { owner: { id: owner.id } },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async findTicketById(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket #${id} not found.`);
    }
    return ticket;
  }


}