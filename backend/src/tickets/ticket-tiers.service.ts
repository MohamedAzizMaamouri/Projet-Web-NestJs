import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketTier } from './ticket-tier.entity';
import { Ticket, TicketStatus } from '../tickets/ticket.entity';
import { CreateTicketTierDto } from './dto/create-ticket-tier.dto';
import { EventsService } from '../events/events.service';
import { User, UserRole } from '../users/user.entity';
import {BaseService} from "../common/base.service";

@Injectable()
export class TicketTiersService extends BaseService<TicketTier>{
  constructor(
      @InjectRepository(TicketTier)
      private readonly tierRepository: Repository<TicketTier>,
      @InjectRepository(Ticket)
      private readonly ticketRepository: Repository<Ticket>,
      private readonly eventsService: EventsService,
  ) {
    super(tierRepository);
  }

  async createTier(dto: CreateTicketTierDto, organizer: User): Promise<TicketTier> {
    const event = await this.eventsService.getEventById(dto.eventId);

    if (organizer.role !== UserRole.ADMIN && event.organizer.id !== organizer.id) {
      throw new ForbiddenException('Only the event organizer can add tiers');
    }

    // The sum of all tier capacities must not exceed event.capacity
    const existingTiers = await this.tierRepository.find({
      where: { event: { id: event.id } },
    });
    const usedCapacity = existingTiers.reduce((sum, t) => sum + t.capacity, 0);

    if (usedCapacity + dto.capacity > event.capacity) {
      throw new BadRequestException(
          `Total tier capacity (${usedCapacity + dto.capacity}) would exceed ` +
          `event capacity (${event.capacity}). ` +
          `Remaining: ${event.capacity - usedCapacity}`,
      );
    }

    const tier = this.tierRepository.create({
      name: dto.name,
      price: dto.price,
      capacity: dto.capacity,
      event,
    });

    return this.tierRepository.save(tier);
  }

  getTiersByEvent(eventId: number): Promise<TicketTier[]> {
    return this.tierRepository.find({
      where: { event: { id: eventId } },
    });
  }

  async deleteTier(id: number, requestingUser: User): Promise<void> {
    const tier = await this.tierRepository.findOne({
      where: { id },
      relations: ['event', 'event.organizer'],
    });

    if (!tier) {
      throw new NotFoundException(`Tier #${id} not found`);
    }

    if (
        requestingUser.role !== UserRole.ADMIN &&
        tier.event.organizer.id !== requestingUser.id
    ) {
      throw new ForbiddenException('Only the event organizer can delete tiers');
    }

    // Block deletion if tickets have already been sold in this tier
    const soldCount = await this.ticketRepository.count({
      where: { tier: { id }, status: TicketStatus.CONFIRMED },
    });

    if (soldCount > 0) {
      throw new BadRequestException(
          `Cannot delete tier "${tier.name}": ${soldCount} ticket(s) already sold`,
      );
    }

    await this.tierRepository.remove(tier);
  }
}