import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';

export enum TicketStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  SCANNED = 'scanned',
}

@Entity('tickets')
@Unique('UQ_ticket_event_seat', ['event', 'seat'])
@Unique('UQ_ticket_event_owner', ['event', 'owner'])
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, { eager: true, nullable: false })
  @JoinColumn({ name: 'eventId' })
  @Index('IDX_ticket_eventId') // dedicated index for the FK — keeps UQ_ticket_event_seat free
  event: Event;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ nullable: true })
  seat: string;

  @Column({ type: 'datetime' })
  purchasedAt: Date;

  /**
   * Price paid at the moment of purchase.
   * Stored on the ticket so the history is preserved even if event.price changes later.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pricePaid: number;

  @Column({ unique: true, nullable: true })
  qrToken: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.PENDING,
  })
  status: TicketStatus;

  @CreateDateColumn()
  createdAt: Date;
}
