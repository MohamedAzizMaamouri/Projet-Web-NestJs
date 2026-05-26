import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';


@Entity('user_follows_organizer')
@Unique(['follower', 'organizer'])
export class UserFollowsOrganizer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId' })
  follower: User;

  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizerId' })
  organizer: User;

  @CreateDateColumn()
  createdAt: Date;
}
