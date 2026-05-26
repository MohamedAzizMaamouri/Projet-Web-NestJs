import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';

export enum WaitlistStatus {
  WAITING = 'waiting',
  NOTIFIED = 'notified',
  CLAIMED = 'claimed',
  EXPIRED = 'expired',
}

@Entity('waitlist_entries')
@Unique('UQ_waitlist_event_user', ['event', 'user'])
export class WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, { eager: true, nullable: false })
  @JoinColumn({ name: 'eventId' })
  @Index('IDX_waitlist_eventId')
  event: Event;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  position: number;

  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.WAITING,
  })
  status: WaitlistStatus;

  @Column({ type: 'datetime', nullable: true })
  reservedUntil: Date;

  @CreateDateColumn()
  joinedAt: Date;
}
