import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseService } from '../common/base.service';
import { Ticket, TicketStatus } from './ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { User } from '../users/user.entity';
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
  ) {
    super(ticketRepository);
  }

  async purchaseTicket(dto: CreateTicketDto, buyer: User): Promise<Ticket> {
    const event = await this.eventsService.getEventById(dto.eventId);

    const soldTickets = await this.ticketRepository.count({
      where: { event: { id: event.id } },
    });

    if (soldTickets >= event.capacity) {
      throw new BadRequestException(
        `This event is fully booked (capacity: ${event.capacity})`,
      );
    }

    const now = new Date();

    const ticket = this.ticketRepository.create({
      event,
      owner: buyer,
      seat: dto.seat ?? null,
      purchasedAt: now,
      status: TicketStatus.CONFIRMED,
    });

    const saved = await this.ticketRepository.save(ticket);

    await this.fireWebhook(saved, event, buyer);

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
