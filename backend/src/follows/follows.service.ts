import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { UserFollowsOrganizer } from './user-follows-organizer.entity';
import { User, UserRole } from '../users/user.entity';
import { Event } from '../events/event.entity';

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(
    @InjectRepository(UserFollowsOrganizer)
    private readonly followsRepo: Repository<UserFollowsOrganizer>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  

  async followOrganizer(
    currentUser: User,
    organizerId: number,
  ): Promise<UserFollowsOrganizer> {
    if (currentUser.role !== UserRole.ATTENDEE) {
      throw new ForbiddenException('Only attendees can follow organizers.');
    }

    if (currentUser.id === organizerId) {
      throw new BadRequestException('You cannot follow yourself.');
    }

    const organizer = await this.usersRepo.findOne({
      where: { id: organizerId },
    });

    if (!organizer || organizer.role !== UserRole.ORGANIZER) {
      throw new NotFoundException(
        `Organizer with id ${organizerId} not found.`,
      );
    }

    const existing = await this.followsRepo.findOne({
      where: {
        follower: { id: currentUser.id },
        organizer: { id: organizerId },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You are already following this organizer.',
      );
    }

    const follow = this.followsRepo.create({
      follower: currentUser,
      organizer,
    });

    return this.followsRepo.save(follow);
  }


  async unfollowOrganizer(
    currentUser: User,
    organizerId: number,
  ): Promise<void> {
    const follow = await this.followsRepo.findOne({
      where: {
        follower: { id: currentUser.id },
        organizer: { id: organizerId },
      },
    });

    if (!follow) {
      throw new NotFoundException('You are not following this organizer.');
    }

    await this.followsRepo.remove(follow);
  }


  async getFollowedOrganizers(currentUser: User): Promise<User[]> {
    const rows = await this.followsRepo.find({
      where: { follower: { id: currentUser.id } },
      relations: ['organizer'],
    });
    return rows.map((r) => r.organizer);
  }

  async getFollowers(
    organizerId: number,
    currentUser: User,
  ): Promise<User[]> {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.id !== organizerId
    ) {
      throw new ForbiddenException(
        'Only the organizer or an admin can view their followers.',
      );
    }

    const rows = await this.followsRepo.find({
      where: { organizer: { id: organizerId } },
      relations: ['follower'],
    });
    return rows.map((r) => r.follower);
  }

  async getFollowerCount(organizerId: number): Promise<number> {
    return this.followsRepo.count({
      where: { organizer: { id: organizerId } },
    });
  }

  async notifyFollowersOfNewEvent(event: Event): Promise<void> {
    const webhookUrl = this.configService.get<string>(
      'NEW_EVENT_WEBHOOK_URL',
    );
    if (!webhookUrl) return;

    const followers = await this.followsRepo.find({
      where: { organizer: { id: event.organizer.id } },
      relations: ['follower'],
    });

    if (followers.length === 0) return;

    const payload = {
      event_type: 'organizer.new_event',
      eventId: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      date: event.date,
      organizerId: event.organizer.id,
      organizerUsername: event.organizer.username,
      publishedAt: new Date().toISOString(),
    };

    this.logger.log(
      `Notifying ${followers.length} follower(s) of new event #${event.id} by organizer #${event.organizer.id}`,
    );

    await Promise.allSettled(
      followers.map(async (row) => {
        try {
          await firstValueFrom(
            this.httpService.post(
              webhookUrl,
              { ...payload, subscriberEmail: row.follower.email },
              { timeout: 5_000 },
            ),
          );
          this.logger.log(
            `Webhook new_event sent to follower #${row.follower.id} for event #${event.id}`,
          );
        } catch (err) {
          this.logger.warn(
            `Webhook new_event failed for follower #${row.follower.id}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}
