import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';
import { EventsService } from '../events/events.service';
import { TicketsService } from '../tickets/tickets.service';
import { TicketTiersService } from '../tickets/ticket-tiers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { UserRole } from '../users/user.entity';
import { EventStatus } from '../events/event.entity';
import * as bcrypt from 'bcryptjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Ticket } from '../tickets/ticket.entity';
import { TicketTier } from '../tickets/ticket-tier.entity';
import { PromoCode } from '../promo-codes/promo-code.entity';
import { WaitlistEntry } from '../waitlist/waitlist-entry.entity';
import { Event } from '../events/event.entity';
import { Repository, DataSource } from 'typeorm';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService        = app.get(UsersService);
  const categoriesService   = app.get(CategoriesService);
  const eventsService       = app.get(EventsService);
  const ticketsService      = app.get(TicketsService);
  const tiersService        = app.get(TicketTiersService);
  const promoCodesService   = app.get(PromoCodesService);
  const waitlistService     = app.get(WaitlistService);
  const userRepository      = app.get<Repository<User>>(getRepositoryToken(User));
  const ticketRepository    = app.get<Repository<Ticket>>(getRepositoryToken(Ticket));
  const tierRepository      = app.get<Repository<TicketTier>>(getRepositoryToken(TicketTier));
  const promoCodeRepository = app.get<Repository<PromoCode>>(getRepositoryToken(PromoCode));
  const waitlistRepository  = app.get<Repository<WaitlistEntry>>(getRepositoryToken(WaitlistEntry));
  const eventRepository     = app.get<Repository<Event>>(getRepositoryToken(Event));
  const dataSource          = app.get(DataSource);

  console.log('🌱 Starting database seed...');

  // ─── Wipe dependent tables to start fresh ──────────────────────────────────
  console.log('  Clearing waitlist, promo codes, tickets and tiers...');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  await waitlistRepository.clear();
  await promoCodeRepository.clear();
  await ticketRepository.clear();
  await tierRepository.clear();
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  Cleared.');

  // ─── Categories ────────────────────────────────────────────────────────────
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

  // ─── Users ─────────────────────────────────────────────────────────────────
  const adminPassword     = await bcrypt.hash('Admin1234!', 10);
  const organizerPassword = await bcrypt.hash('Organizer1234!', 10);
  const attendeePassword  = await bcrypt.hash('Attendee1234!', 10);
  const attendee2Password = await bcrypt.hash('Attendee2_1234!', 10);

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

  let attendeeUser: User;
  const existingAttendee = await usersService.findByEmail('jane@stagepass.io');
  if (existingAttendee) {
    attendeeUser = existingAttendee;
    console.log('  Attendee user already exists');
  } else {
    const rawAttendee = userRepository.create({
      username: 'jane_doe',
      email: 'jane@stagepass.io',
      password: attendeePassword,
      role: UserRole.ATTENDEE,
    });
    attendeeUser = await userRepository.save(rawAttendee);
    console.log('  Created attendee user: jane@stagepass.io / Attendee1234!');
  }

  let attendee2User: User;
  const existingAttendee2 = await usersService.findByEmail('bob@stagepass.io');
  if (existingAttendee2) {
    attendee2User = existingAttendee2;
    console.log('  Attendee2 user already exists');
  } else {
    const rawAttendee2 = userRepository.create({
      username: 'bob_smith',
      email: 'bob@stagepass.io',
      password: attendee2Password,
      role: UserRole.ATTENDEE,
    });
    attendee2User = await userRepository.save(rawAttendee2);
    console.log('  Created attendee2 user: bob@stagepass.io / Attendee2_1234!');
  }

  // ─── Events ────────────────────────────────────────────────────────────────
  // Tiers were wiped above so we always need events — fetch or create them.
  let event1: any;
  let event2: any;
  let event3: any;

  const existingEvent1 = await eventRepository.findOne({
    where: { title: 'Neon Horizons Music Festival' },
  });
  if (existingEvent1) {
    event1 = existingEvent1;
    console.log('  Event already exists: Neon Horizons Music Festival');
  } else {
    event1 = await eventsService.createEvent(
        {
          title: 'Neon Horizons Music Festival',
          description:
              'An electrifying outdoor music festival featuring top DJs and live bands across three stages.',
          date: '2026-08-15T18:00:00.000Z',
          location: "Parc de la Tête d'Or, Lyon, France",
          capacity: 500,
          categoryId: categories[0].id,
        },
        organizerUser,
    );
    console.log('  Created event: Neon Horizons Music Festival');
  }

  const existingEvent2 = await eventRepository.findOne({
    where: { title: 'Global Dev Summit 2026' },
  });
  if (existingEvent2) {
    event2 = existingEvent2;
    console.log('  Event already exists: Global Dev Summit 2026');
  } else {
    event2 = await eventsService.createEvent(
        {
          title: 'Global Dev Summit 2026',
          description:
              'A two-day developer conference covering cloud architecture, AI, and open-source innovation.',
          date: '2026-10-03T09:00:00.000Z',
          location: 'Palais des Congrès, Paris, France',
          capacity: 200,
          categoryId: categories[2].id,
        },
        adminUser,
    );
    console.log('  Created event: Global Dev Summit 2026');
  }

  const existingEvent3 = await eventRepository.findOne({
    where: { title: 'Champions League Final Watch Party' },
  });
  if (existingEvent3) {
    event3 = existingEvent3;
    console.log('  Event already exists: Champions League Final Watch Party');
  } else {
    event3 = await eventsService.createEvent(
        {
          title: 'Champions League Final Watch Party',
          description: 'Live screening of the UEFA Champions League Final with food, drinks and an incredible atmosphere.',
          date: '2026-05-31T20:00:00.000Z',
          location: 'Stade de France, Paris, France',
          capacity: 1000,
          categoryId: categories[1].id,
        },
        organizerUser,
    );
    console.log('  Created event: Champions League Final Watch Party');
  }

  // ─── Ticket Tiers ──────────────────────────────────────────────────────────
  // Tiers were wiped at the start, always recreate them.
  const standardTier = await tiersService.createTier(
      { eventId: event1.id, name: 'Standard', price: 30, capacity: 400 },
      organizerUser,
  );
  console.log('  Created tier: Standard (400 seats @ 30)');

  const vipTier = await tiersService.createTier(
      { eventId: event1.id, name: 'VIP', price: 120, capacity: 100 },
      organizerUser,
  );
  console.log('  Created tier: VIP (100 seats @ 120)');

  const devTier = await tiersService.createTier(
      { eventId: event2.id, name: 'General Admission', price: 80, capacity: 200 },
      adminUser,
  );
  console.log('  Created tier: General Admission (200 seats @ 80)');

  const sportsStandardTier = await tiersService.createTier(
      { eventId: event3.id, name: 'Standard', price: 20, capacity: 800 },
      organizerUser,
  );
  console.log('  Created tier: Sports Standard (800 seats @ 20)');

  const sportsPremiumTier = await tiersService.createTier(
      { eventId: event3.id, name: 'Premium', price: 60, capacity: 200 },
      organizerUser,
  );
  console.log('  Created tier: Sports Premium (200 seats @ 60)');

  // ─── Promo Codes ───────────────────────────────────────────────────────────
  const promoCode1 = await promoCodesService.createPromoCode(
      {
        eventId: event1.id,
        code: 'NEON20',
        discountPercent: 20,
        maxUses: 50,
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
      organizerUser,
  );
  console.log(`  Created promo code: ${promoCode1.code} (20% off, event1)`);

  const promoCode2 = await promoCodesService.createPromoCode(
      {
        eventId: event2.id,
        code: 'DEVEARLYBIRD',
        discountPercent: 15,
        maxUses: 30,
        expiresAt: '2026-09-01T00:00:00.000Z',
      },
      adminUser,
  );
  console.log(`  Created promo code: ${promoCode2.code} (15% off, event2)`);

  const promoCode3 = await promoCodesService.createPromoCode(
      {
        eventId: event3.id,
        code: 'SPORT10',
        discountPercent: 10,
        maxUses: 100,
        expiresAt: '2026-05-30T00:00:00.000Z',
      },
      organizerUser,
  );
  console.log(`  Created promo code: ${promoCode3.code} (10% off, event3)`);

  // ─── Tickets ───────────────────────────────────────────────────────────────
  await ticketsService.purchaseTicket(
      { eventId: event1.id, tierId: standardTier.id, seat: 'A-12' },
      attendeeUser,
  );
  await ticketsService.purchaseTicket(
      { eventId: event1.id, tierId: vipTier.id, seat: 'V-01' },
      adminUser,
  );

  // NOTE: UQ_ticket_event_owner prevents the same user from having two tickets
  // for the same event, so organizer buys for event1, attendee2 for event2 & event3.
  await ticketsService.purchaseTicket(
      { eventId: event1.id, tierId: standardTier.id, seat: 'B-01' },
      organizerUser,
  );
  await ticketsService.purchaseTicket(
      { eventId: event2.id, tierId: devTier.id, seat: null },
      attendee2User,
  );
  await ticketsService.purchaseTicket(
      { eventId: event3.id, tierId: sportsStandardTier.id, seat: 'S-10' },
      attendeeUser,
  );
  console.log('  Created 5 tickets across all events');

  // ─── Waitlist Entries ──────────────────────────────────────────────────────
  // To join the waitlist the event must be sold out. We simulate a sold-out
  // micro-event by temporarily lowering its capacity via the repository directly.
  // (WaitlistService checks soldCount >= event.capacity before allowing join.)
  //
  // For the seeder we bypass the sold-out check by inserting entries directly.
  const waitlistEntry1 = waitlistRepository.create({
    event: event2,
    user: attendeeUser,
    position: 1,
    status: (await import('../waitlist/waitlist-entry.entity')).WaitlistStatus.WAITING,
  });
  await waitlistRepository.save(waitlistEntry1);
  console.log('  Created waitlist entry: jane on event2 (Global Dev Summit)');

  const waitlistEntry2 = waitlistRepository.create({
    event: event3,
    user: attendee2User,
    position: 1,
    status: (await import('../waitlist/waitlist-entry.entity')).WaitlistStatus.WAITING,
  });
  await waitlistRepository.save(waitlistEntry2);
  console.log('  Created waitlist entry: bob on event3 (Champions League Watch Party)');

  console.log('\n✅ Seed complete!');
  console.log('────────────────────────────────────────────────────────');
  console.log('Admin:      admin@stagepass.io      / Admin1234!');
  console.log('Organizer:  organizer@stagepass.io  / Organizer1234!');
  console.log('Attendee:   jane@stagepass.io       / Attendee1234!');
  console.log('Attendee2:  bob@stagepass.io        / Attendee2_1234!');
  console.log('────────────────────────────────────────────────────────');
  console.log('Promo codes:');
  console.log('  NEON20       → 20% off Neon Horizons Music Festival');
  console.log('  DEVEARLYBIRD → 15% off Global Dev Summit 2026');
  console.log('  SPORT10      → 10% off Champions League Final Watch Party');

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
