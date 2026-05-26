import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { CategoriesModule } from './categories/categories.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { WaitlistModule } from './waitlist/waitlist.module';

import { User } from './users/user.entity';
import { Event } from './events/event.entity';
import { Category } from './categories/category.entity';
import { Ticket } from './tickets/ticket.entity';
import { PromoCode } from './promo-codes/promo-code.entity';
import { WaitlistEntry } from './waitlist/waitlist-entry.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [User, Event, Category, Ticket, PromoCode, WaitlistEntry],
        synchronize: true,
        charset: 'utf8mb4',
      }),
    }),
    HttpModule,
    AuthModule,
    UsersModule,
    EventsModule,
    TicketsModule,
    CategoriesModule,
    RealtimeModule,
    PromoCodesModule,
    WaitlistModule,
  ],
})
export class AppModule {}
