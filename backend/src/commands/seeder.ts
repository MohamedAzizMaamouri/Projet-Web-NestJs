import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';
import { EventsService } from '../events/events.service';
import { TicketsService } from '../tickets/tickets.service';
import { UserRole } from '../users/user.entity';
import * as bcrypt from 'bcryptjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Repository } from 'typeorm';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const categoriesService = app.get(CategoriesService);
  const eventsService = app.get(EventsService);
  const ticketsService = app.get(TicketsService);
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  console.log('🌱 Starting database seed...');

  // --- Categories ---
  const categoryNames = ['Music', 'Sports', 'Tech'];
  const categories: any[] = [];

  for (const name of categoryNames) {
    const existing = await categoriesService
      .findAll({ where: { name } })
      .then((res) => res[0]);

    if (existing) {
      categories.push(existing);
      console.log(`  Category already exists: ${name}`);
    } else {
      const cat = await categoriesService.createCategory({ name });
      categories.push(cat);
      console.log(`  Created category: ${name}`);
    }
  }

  // --- Users ---
  const adminPassword = await bcrypt.hash('Admin1234!', 10);
  const organizerPassword = await bcrypt.hash('Organizer1234!', 10);

  let adminUser: User;
  const existingAdmin = await usersService.findByEmail('admin@stagepass.io');
  if (existingAdmin) {
    adminUser = existingAdmin;
    console.log('  Admin user already exists');
  } else {
    const rawAdmin = userRepository.create({
      username: 'admin_alex',
      email: 'admin@stagepass.io',
      password: adminPassword,
      role: UserRole.ADMIN,
    });
    adminUser = await userRepository.save(rawAdmin);
    console.log('  Created admin user: admin@stagepass.io / Admin1234!');
  }

  let organizerUser: User;
  const existingOrganizer = await usersService.findByEmail('organizer@stagepass.io');
  if (existingOrganizer) {
    organizerUser = existingOrganizer;
    console.log('  Organizer user already exists');
  } else {
    const rawOrganizer = userRepository.create({
      username: 'organizer_sam',
      email: 'organizer@stagepass.io',
      password: organizerPassword,
      role: UserRole.ORGANIZER,
    });
    organizerUser = await userRepository.save(rawOrganizer);
    console.log('  Created organizer user: organizer@stagepass.io / Organizer1234!');
  }

  // --- Events ---
  let event1: any;
  const existingEvents = await eventsService.getAllEvents();

  if (existingEvents.length > 0) {
    event1 = existingEvents[0];
    console.log('  Events already seeded, skipping.');
  } else {
    event1 = await eventsService.createEvent(
      {
        title: 'Neon Horizons Music Festival',
        description:
          'An electrifying outdoor music festival featuring top DJs and live bands across three stages.',
        date: '2025-08-15T18:00:00.000Z',
        location: 'Parc de la Tête d\'Or, Lyon, France',
        capacity: 500,
        categoryId: categories[0].id,
      },
      organizerUser,
    );
    console.log('  Created event: Neon Horizons Music Festival');

    await eventsService.createEvent(
      {
        title: 'Global Dev Summit 2025',
        description:
          'A two-day developer conference covering cloud architecture, AI, and open-source innovation.',
        date: '2025-10-03T09:00:00.000Z',
        location: 'Palais des Congrès, Paris, France',
        capacity: 200,
        categoryId: categories[2].id,
      },
      adminUser,
    );
    console.log('  Created event: Global Dev Summit 2025');
  }

  // --- Attendee user for tickets ---
  let attendeeUser: User;
  const existingAttendee = await usersService.findByEmail('jane@stagepass.io');
  if (existingAttendee) {
    attendeeUser = existingAttendee;
  } else {
    const attendeePassword = await bcrypt.hash('Attendee1234!', 10);
    const rawAttendee = userRepository.create({
      username: 'jane_doe',
      email: 'jane@stagepass.io',
      password: attendeePassword,
      role: UserRole.ATTENDEE,
    });
    attendeeUser = await userRepository.save(rawAttendee);
    console.log('  Created attendee user: jane@stagepass.io / Attendee1234!');
  }

  // --- Tickets ---
  const existingTickets = await ticketsService.getMyTickets(attendeeUser);
  if (existingTickets.length === 0) {
    await ticketsService.purchaseTicket(
      { eventId: event1.id, seat: 'A-12' },
      attendeeUser,
    );
    await ticketsService.purchaseTicket(
      { eventId: event1.id, seat: 'A-13' },
      attendeeUser,
    );
    await ticketsService.purchaseTicket(
      { eventId: event1.id, seat: 'B-01' },
      organizerUser,
    );
    console.log('  Created 3 tickets');
  } else {
    console.log('  Tickets already seeded, skipping.');
  }

  console.log('\n✅ Seed complete!');
  console.log('-----------------------------');
  console.log('Admin:     admin@stagepass.io     / Admin1234!');
  console.log('Organizer: organizer@stagepass.io / Organizer1234!');
  console.log('Attendee:  jane@stagepass.io      / Attendee1234!');

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
