import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';

@Entity('ticket_tiers')
export class TicketTier {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    price: number;

    @Column()
    capacity: number;

    @ManyToOne(() => Event, (event) => event.id, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'eventId' })
    event: Event;
}