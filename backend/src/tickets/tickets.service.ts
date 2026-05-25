import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../common/base.service';
import { Ticket, TicketStatus } from './ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { EventsService } from '../events/events.service';
import { firstValueFrom } from 'rxjs';

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

      const ticket = manager.getRepository(Ticket).create({
        event,
        owner: buyer,
        seat: dto.seat ?? null,
        purchasedAt: new Date(),
        status: TicketStatus.CONFIRMED,
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

  getMyTickets(owner: User): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { owner: { id: owner.id } },
    });
  }
}
