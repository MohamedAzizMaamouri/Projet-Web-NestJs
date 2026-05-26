import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { UserFollowsOrganizer } from './user-follows-organizer.entity';
import { User } from '../users/user.entity';
import { FollowsService } from './follows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserFollowsOrganizer, User]),
    HttpModule,
  ],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
