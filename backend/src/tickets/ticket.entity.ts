import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';

export enum TicketStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

@Entity('tickets')
@Unique('UQ_ticket_event_seat', ['event', 'seat'])
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, { eager: true, nullable: false })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ nullable: true })
  seat: string;

  @Column({ type: 'datetime' })
  purchasedAt: Date;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.CONFIRMED,
  })
  status: TicketStatus;

  @CreateDateColumn()
  createdAt: Date;
}
