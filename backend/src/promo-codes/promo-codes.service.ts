import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Event } from '../events/event.entity';
import { User, UserRole } from '../users/user.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PromoCode } from './promo-code.entity';

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async createPromoCode(
    dto: CreatePromoCodeDto,
    requestingUser: User,
  ): Promise<PromoCode> {
    const event = await this.eventRepository.findOne({
      where: { id: dto.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event #${dto.eventId} not found`);
    }

    this.assertOrganizerOrAdmin(event, requestingUser);

    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException(
        'Promo code expiration must be in the future',
      );
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    const existing = await this.promoCodeRepository.findOne({
      where: { event: { id: event.id }, code: normalizedCode },
    });

    if (existing) {
      throw new ConflictException(
        'This promo code already exists for this event',
      );
    }

    const promoCode = this.promoCodeRepository.create({
      code: normalizedCode,
      event,
      discountPercent: dto.discountPercent,
      maxUses: dto.maxUses,
      usedCount: 0,
      expiresAt,
    });

    return this.promoCodeRepository.save(promoCode);
  }

  getEventPromoCodes(
    eventId: number,
    requestingUser: User,
  ): Promise<PromoCode[]> {
    return this.eventRepository
      .findOne({ where: { id: eventId } })
      .then((event) => {
        if (!event) {
          throw new NotFoundException(`Event #${eventId} not found`);
        }

        this.assertOrganizerOrAdmin(event, requestingUser);
        return this.promoCodeRepository.find({
          where: { event: { id: eventId } },
          order: { createdAt: 'DESC' },
        });
      });
  }

  async applyPromoCode(
    manager: EntityManager,
    eventId: number,
    code: string,
    originalPrice: number,
  ): Promise<{
    pricePaid: number;
    discountAmount: number;
    promoCode: PromoCode;
  }> {
    const normalizedCode = code.trim().toUpperCase();
    const promoCode = await manager
      .getRepository(PromoCode)
      .createQueryBuilder('promoCode')
      .setLock('pessimistic_write')
      .where('promoCode.eventId = :eventId', { eventId })
      .andWhere('promoCode.code = :code', { code: normalizedCode })
      .getOne();

    if (!promoCode) {
      throw new BadRequestException('Invalid promo code for this event');
    }

    if (promoCode.expiresAt <= new Date()) {
      throw new BadRequestException('Promo code has expired');
    }

    if (promoCode.usedCount >= promoCode.maxUses) {
      throw new BadRequestException('Promo code usage limit has been reached');
    }

    const discountAmount =
      Number(originalPrice) * (Number(promoCode.discountPercent) / 100);
    const pricePaid = Math.max(Number(originalPrice) - discountAmount, 0);

    promoCode.usedCount += 1;
    await manager.getRepository(PromoCode).save(promoCode);

    return {
      pricePaid: Number(pricePaid.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      promoCode,
    };
  }

  private assertOrganizerOrAdmin(event: Event, user: User): void {
    const isOrganizer = event.organizer?.id === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'Only the event organizer or an admin can manage promo codes',
      );
    }
  }
}
