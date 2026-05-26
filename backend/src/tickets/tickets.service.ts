import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../common/base.service';
import { Ticket, TicketStatus } from './ticket.entity';
import { TicketTier } from './ticket-tier.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { User, UserRole } from '../users/user.entity';
import { Event, EventStatus } from '../events/event.entity';
import { EventsService } from '../events/events.service';
import { transition } from './ticket-status.machine';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WaitlistService } from '../waitlist/waitlist.service';

@Injectable()
export class TicketsService extends BaseService<Ticket> {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly eventsService: EventsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly promoCodesService: PromoCodesService,
    private readonly realtimeService: RealtimeService,
    private readonly waitlistService: WaitlistService,
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

      const salesClosedAt =
        event.salesClosedAt ?? new Date(event.date.getTime() - 60 * 60 * 1000);

      if (salesClosedAt <= new Date()) {
        throw new BadRequestException('Ticket sales are closed for this event');
      }

      const existingTicket = await manager.getRepository(Ticket).findOne({
        where: {
          event: { id: event.id },
          owner: { id: buyer.id },
        },
      });

      if (existingTicket) {
        throw new ConflictException(
          'Vous possédez déjà un ticket pour cet événement',
        );
      }

      await this.waitlistService.assertUserCanPurchaseReservedSeat(
        event.id,
        buyer.id,
      );

      const tier = await manager.getRepository(TicketTier).findOne({
        where: { id: dto.tierId, event: { id: event.id } },
      });

      if (!tier) {
        throw new BadRequestException(
            `Tier #${dto.tierId} does not exist for event #${dto.eventId}`,
        );
      }

      const soldInTier = await manager.getRepository(Ticket).count({
        where: {
          event: { id: event.id },
          tier: { id: tier.id },
          status: TicketStatus.CONFIRMED,
        },
      });

      if (soldInTier >= tier.capacity) {
        throw new BadRequestException(
            `Tier "${tier.name}" is fully booked (capacity: ${tier.capacity})`,
        );
      }

      if (dto.seat) {
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
      }

      // Start at PENDING, immediately confirm (payment is synchronous for now)
      const initialStatus = TicketStatus.PENDING;
      const confirmedStatus = transition(initialStatus, TicketStatus.CONFIRMED);
      const originalPrice = Number(tier.price ?? 0);
      const promoResult = dto.promoCode
        ? await this.promoCodesService.applyPromoCode(
            manager,
            event.id,
            dto.promoCode,
            originalPrice,
          )
        : null;

      const ticket = manager.getRepository(Ticket).create({
        event,
        owner: buyer,
        tier,
        seat: dto.seat ?? null,
        purchasedAt: new Date(),
        status: confirmedStatus,
        pricePaid: promoResult?.pricePaid ?? originalPrice,
        qrToken: uuidv4(),
      });

      try {
        return await manager.getRepository(Ticket).save(ticket);
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          String((error as any).driverError?.code) === 'ER_DUP_ENTRY' &&
          String((error as any).driverError?.message).includes(
            'UQ_ticket_event_owner',
          )
        ) {
          throw new ConflictException(
            'Vous possédez déjà un ticket pour cet événement',
          );
        }

        throw error;
      }
    });

    const fullEvent = await this.eventsService.getEventById(dto.eventId);
    await this.waitlistService.markClaimed(dto.eventId, buyer.id);
    await this.realtimeService.publishAvailability(dto.eventId);
    this.realtimeService.publishMessage({
      eventId: dto.eventId,
      type: 'purchase-confirmation',
      text: `Ticket confirmed for ${fullEvent.title}`,
      sender: buyer.username,
    });
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

    const saved = await this.ticketRepository.save(ticket);
    await this.realtimeService.publishAvailability(ticket.event.id);
    await this.waitlistService.notifyNextWaitingUser(ticket.event.id);

    const eventTitle = saved.event?.title ?? `Event #${saved.event?.id}`;
    this.realtimeService.publishPersonalTicketUpdate(saved, eventTitle);

    return saved;
  }

  async refundTicket(ticketId: number, requestingUser: User): Promise<Ticket> {
    const ticket = await this.findTicketById(ticketId);

    const isTicketHolder = ticket.owner?.id === requestingUser.id;
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isTicketHolder && !isAdmin) {
      throw new ForbiddenException(
        'Only the ticket holder or an admin can refund tickets.',
      );
    }

    ticket.status = transition(ticket.status, TicketStatus.REFUNDED);

    const saved = await this.ticketRepository.save(ticket);
    await this.realtimeService.publishAvailability(ticket.event.id);
    await this.waitlistService.notifyNextWaitingUser(ticket.event.id);

    const eventTitle = saved.event?.title ?? `Event #${saved.event?.id}`;
    this.realtimeService.publishPersonalTicketUpdate(saved, eventTitle);

    return saved;
  }

  // ─── Scan (by organizer or admin at the venue entrance) ──────────────────────

  /**
   * Marks a ticket as SCANNED at the venue entrance.
   * Only organizers (of this event) and admins can scan.
   * A ticket can only be scanned once — the state machine blocks re-scanning.
   */
  async scanTicket(ticketId: number, requestingUser: User): Promise<Ticket> {
    const ticket = await this.findTicketById(ticketId);

    const isEventOrganizer = ticket.event.organizer?.id === requestingUser.id;
    const isAdmin = requestingUser.role === UserRole.ADMIN;

    if (!isEventOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'Only the event organizer or an admin can scan tickets.',
      );
    }

    // State machine validates: CONFIRMED → SCANNED
    // Throws if ticket is already SCANNED, CANCELLED, or REFUNDED
    ticket.status = transition(ticket.status, TicketStatus.SCANNED);

    const saved = await this.ticketRepository.save(ticket);

    const eventTitle = saved.event?.title ?? `Event #${saved.event?.id}`;
    this.realtimeService.publishPersonalTicketUpdate(saved, eventTitle);

    await this.fireTicketScannedWebhook(saved);

    return saved;
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

    const saved = await this.ticketRepository.save(ticket);

    const eventTitle = saved.event?.title ?? `Event #${saved.event?.id}`;
    this.realtimeService.publishPersonalTicketUpdate(saved, eventTitle);

    await this.fireTicketScannedWebhook(saved);

    return saved;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getMyTickets(owner: User): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { owner: { id: owner.id } },
    });
  }
  
  private async fireTicketScannedWebhook(ticket: Ticket): Promise<void> {
    const webhookUrl = this.configService.get<string>(
        'TICKET_SCANNED_WEBHOOK_URL',
    );
    if (!webhookUrl) return;

    const payload = {
      event_type:   'ticket.scanned',
      ticketId:     ticket.id,
      qrToken:      ticket.qrToken,
      eventId:      ticket.event?.id,
      eventTitle:   ticket.event?.title,
      ownerEmail:   ticket.owner?.email,
      ownerUsername: ticket.owner?.username,
      seat:         ticket.seat,
      scannedAt:    new Date().toISOString(),
    };

    try {
      await firstValueFrom(
          this.httpService.post(webhookUrl, payload, { timeout: 5_000 }),
      );
      this.logger.log(
          `Webhook ticket.scanned sent for ticket #${ticket.id}`,
      );
    } catch (err) {
      this.logger.warn(
          `Webhook ticket.scanned failed for ticket #${ticket.id}: ${(err as Error).message}`,
      );
    }
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