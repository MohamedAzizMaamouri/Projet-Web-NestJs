import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';

@Entity('promo_codes')
@Unique('UQ_promo_code_event_code', ['event', 'code'])
export class PromoCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index('IDX_promo_code_code')
  code: string;

  @ManyToOne(() => Event, { eager: true, nullable: false })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discountPercent: number;

  @Column()
  maxUses: number;

  @Column({ default: 0 })
  usedCount: number;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
