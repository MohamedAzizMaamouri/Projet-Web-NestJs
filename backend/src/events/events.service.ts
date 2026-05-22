import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/base.service';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { User, UserRole } from '../users/user.entity';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class EventsService extends BaseService<Event> {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
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
      category,
      organizer,
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

    await this.eventRepository.remove(event);
  }
}
