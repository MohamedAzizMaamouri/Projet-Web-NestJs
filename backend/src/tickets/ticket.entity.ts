import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';

export enum TicketStatus {
  PENDING    = 'pending',      // created but not yet confirmed (payment pending)
  CONFIRMED  = 'confirmed',    // purchase successful, ticket is valid
  CANCELLED  = 'cancelled',    // cancelled by the attendee
  REFUNDED   = 'refunded',     // cancelled by organizer (event cancelled) — refund triggered
  SCANNED    = 'scanned',      // used at the venue entrance — cannot be re-scanned
}

@Entity('tickets')
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
    default: TicketStatus.PENDING,
  })
  status: TicketStatus;

  @CreateDateColumn()
  createdAt: Date;
}