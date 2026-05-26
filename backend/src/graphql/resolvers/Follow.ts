import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../context';
import { FollowsService } from '../../follows/follows.service';
import { AppDataSource } from '../context';
import { UserFollowsOrganizer } from '../../follows/user-follows-organizer.entity';
import { User } from '../../users/user.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();


let _followsService: FollowsService | null = null;

function getFollowsService(): FollowsService {
  if (!_followsService) {
    const followsRepo =
      AppDataSource.getRepository(UserFollowsOrganizer);
    const usersRepo = AppDataSource.getRepository(User);

    const httpService = {
      post: (url: string, data: unknown, config: unknown) =>
        ({ toPromise: () => axios.post(url, data, config as object) } as any),
    } as unknown as HttpService;

    const configService = {
      get: (key: string) => process.env[key],
    } as unknown as ConfigService;

    _followsService = new FollowsService(
      followsRepo,
      usersRepo,
      httpService,
      configService,
    );
  }
  return _followsService;
}


function requireAuth({ currentUser }: GraphQLContext) {
  if (!currentUser) {
    throw new GraphQLError('You must be logged in.', {
      extensions: { http: { status: 401 } },
    });
  }
  return currentUser;
}


export const FollowMutation = {
  followOrganizer: async (
    _parent: unknown,
    args: { organizerId: number },
    ctx: GraphQLContext,
  ) => {
    const user = requireAuth(ctx);
    const svc = getFollowsService();

    try {
      const follow = await svc.followOrganizer(user, args.organizerId);
      return {
        id: follow.id,
        organizer: follow.organizer,
        follower: follow.follower,
        createdAt: follow.createdAt.toISOString(),
      };
    } catch (err: any) {
      throw new GraphQLError(err.message, {
        extensions: { http: { status: err.status ?? 400 } },
      });
    }
  },

  unfollowOrganizer: async (
    _parent: unknown,
    args: { organizerId: number },
    ctx: GraphQLContext,
  ) => {
    const user = requireAuth(ctx);
    const svc = getFollowsService();

    try {
      await svc.unfollowOrganizer(user, args.organizerId);
      return true;
    } catch (err: any) {
      throw new GraphQLError(err.message, {
        extensions: { http: { status: err.status ?? 400 } },
      });
    }
  },
};


export const FollowQuery = {
  myFollowedOrganizers: async (
    _parent: unknown,
    _args: unknown,
    ctx: GraphQLContext,
  ) => {
    const user = requireAuth(ctx);
    const svc = getFollowsService();
    return svc.getFollowedOrganizers(user);
  },

  organizerFollowers: async (
    _parent: unknown,
    args: { organizerId: number },
    ctx: GraphQLContext,
  ) => {
    const user = requireAuth(ctx);
    const svc = getFollowsService();

    try {
      return svc.getFollowers(args.organizerId, user);
    } catch (err: any) {
      throw new GraphQLError(err.message, {
        extensions: { http: { status: err.status ?? 403 } },
      });
    }
  },
};


export const UserResolver = {
  followerCount: async (
    parent: { id: number },
    _args: unknown,
    _ctx: GraphQLContext,
  ) => {
    const svc = getFollowsService();
    return svc.getFollowerCount(parent.id);
  },
};
