import {BadRequestException, ForbiddenException, Injectable,} from '@nestjs/common';
import {InjectRepository, InjectRepository as InjectTicketRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {BaseService} from '../common/base.service';
import {Event, EventStatus} from './event.entity';
import {CreateEventDto} from './dto/create-event.dto';
import {UpdateEventDto} from './dto/update-event.dto';
import {User, UserRole} from '../users/user.entity';
import {CategoriesService} from '../categories/categories.service';
import {Ticket, TicketStatus} from '../tickets/ticket.entity';
import {transitionEvent} from "./event-status.machine";
import {transition} from '../tickets/ticket-status.machine';

@Injectable()
export class EventsService extends BaseService<Event> {
  constructor(
      @InjectRepository(Event)
      private readonly eventRepository: Repository<Event>,

      @InjectTicketRepository(Ticket)
      private readonly ticketRepository: Repository<Ticket>,

      private readonly categoriesService: CategoriesService,
  ) {
    super(eventRepository);
  }

  getAllEvents(): Promise<Event[]> {
    return this.findAll();
  }

  getEventById(id: number): Promise<Event> {
    return this.findOne({ where: { id } });
  }

  async createEvent(dto: CreateEventDto, organizer: User): Promise<Event> {
    const category = await this.categoriesService.findOne({
      where: { id: dto.categoryId },
    });

    const event = this.eventRepository.create({
      title: dto.title,
      description: dto.description,
      date: new Date(dto.date),
      location: dto.location,
      capacity: dto.capacity,
      price: dto.price ?? 0,
      category,
      organizer,
      status: EventStatus.PUBLISHED
    });

    return this.eventRepository.save(event);
  }

  async updateEvent(
      id: number,
      dto: UpdateEventDto,
      requestingUser: User,
  ): Promise<Event> {
    const event = await this.getEventById(id);

    if (
        requestingUser.role !== UserRole.ADMIN &&
        event.organizer.id !== requestingUser.id
    ) {
      throw new ForbiddenException(
          'Only the organizer or an admin can update this event',
      );
    }

    if (
        event.status === EventStatus.ENDED ||
        event.status === EventStatus.CANCELLED
    ) {
      throw new BadRequestException(
          `Cannot update an event that is already ${event.status}`,
      );
    }

    if ((dto as any).categoryId) {
      const category = await this.categoriesService.findOne({
        where: { id: (dto as any).categoryId },
      });
      event.category = category;
    }

    const { categoryId, ...rest } = dto as any;
    Object.assign(event, rest);

    if ((dto as any).date) {
      event.date = new Date((dto as any).date);
    }

    return this.eventRepository.save(event);
  }

  async deleteEvent(id: number, requestingUser: User): Promise<void> {
    const event = await this.getEventById(id);

    if (
        requestingUser.role !== UserRole.ADMIN &&
        event.organizer.id !== requestingUser.id
    ) {
      throw new ForbiddenException(
          'Only the organizer or an admin can delete this event',
      );
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
          `Cannot delete an event with status "${event.status}". Cancel it instead.`,
      );
    }
    
    await this.refundAllTicketsForEvent(id)

    await this.eventRepository.remove(event);
  }

  async cancelEvent(id: number, requestingUser: User): Promise<void> {
    const event = await this.getEventById(id);

    if (
        requestingUser.role !== UserRole.ADMIN &&
        event.organizer.id !== requestingUser.id
    ) {
      throw new ForbiddenException(
          'Only the organizer or an admin can cancel this event',
      );
    }

    if (event.status === EventStatus.ENDED) {
      throw new BadRequestException(
          `Cannot cancel an event with status "${event.status}".`,
      );
    }

    await this.refundAllTicketsForEvent(id)

    await this.transitionStatus(id, EventStatus.CANCELLED, requestingUser);
  }

  // ─── Revenue ─────────────────────────────────────────────────────────────────

  /**
   * Returns total revenue for an event: SUM of pricePaid across all CONFIRMED tickets.
   * Only the event's organizer or an admin can access this.
   */
  async getEventRevenue(
      eventId: number,
      requestingUser: User,
  ): Promise<{ eventId: number; eventTitle: string; revenue: number; ticketsSold: number }> {
    const event = await this.getEventById(eventId);

    if (
        requestingUser.role !== UserRole.ADMIN &&
        event.organizer.id !== requestingUser.id
    ) {
      throw new ForbiddenException(
          'Only the event organizer or an admin can view revenue.',
      );
    }

    const result = await this.ticketRepository
        .createQueryBuilder('ticket')
        .select('SUM(ticket.pricePaid)', 'revenue')
        .addSelect('COUNT(ticket.id)', 'ticketsSold')
        .where('ticket.eventId = :eventId', { eventId })
        .andWhere('ticket.status = :status', { status: TicketStatus.CONFIRMED })
        .getRawOne();

    return {
      eventId: event.id,
      eventTitle: event.title,
      revenue: Number(result.revenue) || 0,
      ticketsSold: Number(result.ticketsSold) || 0,
    };
  }

  async refundAllTicketsForEvent(eventId: number): Promise<void> {
    const tickets = await this.ticketRepository.find({
      where: {
        event: { id: eventId },
        status: TicketStatus.CONFIRMED,
      },
    });

    for (const ticket of tickets) {
      // State machine validates: CONFIRMED → REFUNDED
      ticket.status = transition(ticket.status, TicketStatus.REFUNDED);
    }

    await this.ticketRepository.save(tickets);
  }

  async transitionStatus(
      id: number,
      newStatus: EventStatus,
      requestingUser: User,
  ): Promise<Event> {
    const event = await this.getEventById(id);
    this.assertOwnerOrAdmin(event, requestingUser);
    
    event.status = transitionEvent(event.status, newStatus);
    return this.eventRepository.save(event);
  }
  

  private assertOwnerOrAdmin(event: Event, user: User): void {
    if (user.role !== UserRole.ADMIN && event.organizer.id !== user.id) {
      throw new ForbiddenException(
          'Only the organizer or an admin can perform this action',
      );
    }
  }
}