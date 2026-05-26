import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/event.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { Ticket, TicketStatus } from '../tickets/ticket.entity';
import { User, UserRole } from '../users/user.entity';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistEntry, WaitlistStatus } from './waitlist-entry.entity';

const RESERVATION_MINUTES = 15;

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepository: Repository<WaitlistEntry>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly realtimeService: RealtimeService,
  ) {}

  async joinWaitlist(dto: JoinWaitlistDto, user: User): Promise<WaitlistEntry> {
    const event = await this.eventRepository.findOne({
      where: { id: dto.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event #${dto.eventId} not found`);
    }

    const existingTicket = await this.ticketRepository.findOne({
      where: {
        event: { id: event.id },
        owner: { id: user.id },
      },
    });

    if (existingTicket) {
      throw new ConflictException(
        'Vous possédez déjà un ticket pour cet événement',
      );
    }

    const existingEntry = await this.waitlistRepository.findOne({
      where: { event: { id: event.id }, user: { id: user.id } },
    });

    if (existingEntry) {
      throw new ConflictException('You are already on the waitlist');
    }

    const soldCount = await this.ticketRepository.count({
      where: { event: { id: event.id }, status: TicketStatus.CONFIRMED },
    });

    if (soldCount < event.capacity) {
      throw new BadRequestException(
        'This event still has available tickets; purchase directly instead',
      );
    }

    const position = await this.waitlistRepository.count({
      where: { event: { id: event.id } },
    });

    const entry = this.waitlistRepository.create({
      event,
      user,
      position: position + 1,
      status: WaitlistStatus.WAITING,
    });

    return this.waitlistRepository.save(entry);
  }

  getMyEntries(user: User): Promise<WaitlistEntry[]> {
    return this.waitlistRepository.find({
      where: { user: { id: user.id } },
      order: { joinedAt: 'DESC' },
    });
  }

  async getEventEntries(
    eventId: number,
    requestingUser: User,
  ): Promise<WaitlistEntry[]> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }

    this.assertOrganizerOrAdmin(event, requestingUser);

    return this.waitlistRepository.find({
      where: { event: { id: eventId } },
      order: { position: 'ASC' },
    });
  }

  async notifyNextWaitingUser(eventId: number): Promise<WaitlistEntry | null> {
    const existingReservation = await this.waitlistRepository.findOne({
      where: {
        event: { id: eventId },
        status: WaitlistStatus.NOTIFIED,
      },
      order: { position: 'ASC' },
    });

    if (
      existingReservation?.reservedUntil &&
      existingReservation.reservedUntil > new Date()
    ) {
      return existingReservation;
    }

    const nextEntry = await this.waitlistRepository.findOne({
      where: {
        event: { id: eventId },
        status: WaitlistStatus.WAITING,
      },
      order: { position: 'ASC' },
    });

    if (!nextEntry) {
      return null;
    }

    nextEntry.status = WaitlistStatus.NOTIFIED;
    nextEntry.reservedUntil = new Date(
      Date.now() + RESERVATION_MINUTES * 60 * 1000,
    );

    const saved = await this.waitlistRepository.save(nextEntry);

    this.realtimeService.publishMessage({
      eventId,
      type: 'waitlist',
      sender: 'system',
      text: `A ticket is reserved for ${saved.user.username} until ${saved.reservedUntil.toISOString()}`,
    });

    return saved;
  }

  async assertUserCanPurchaseReservedSeat(
    eventId: number,
    userId: number,
  ): Promise<void> {
    const activeReservation = await this.waitlistRepository.findOne({
      where: {
        event: { id: eventId },
        status: WaitlistStatus.NOTIFIED,
      },
      order: { position: 'ASC' },
    });

    if (!activeReservation) {
      return;
    }

    if (
      activeReservation.reservedUntil &&
      activeReservation.reservedUntil <= new Date()
    ) {
      activeReservation.status = WaitlistStatus.EXPIRED;
      await this.waitlistRepository.save(activeReservation);
      return;
    }

    if (activeReservation.user.id !== userId) {
      throw new ConflictException(
        'A released ticket is temporarily reserved for the first user on the waitlist',
      );
    }
  }

  async markClaimed(eventId: number, userId: number): Promise<void> {
    const entry = await this.waitlistRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    if (!entry) {
      return;
    }

    entry.status = WaitlistStatus.CLAIMED;
    await this.waitlistRepository.save(entry);
  }

  private assertOrganizerOrAdmin(event: Event, user: User): void {
    const isOrganizer = event.organizer?.id === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'Only the event organizer or an admin can view this waitlist',
      );
    }
  }
}
