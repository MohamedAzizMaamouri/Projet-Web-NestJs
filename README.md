# StagePass API

A hybrid REST + GraphQL API for an event ticketing platform built with NestJS, TypeORM, GraphQL Yoga, and MySQL.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Architecture Patterns](#architecture-patterns)
- [Authentication & Authorization](#authentication--authorization)
- [REST API Reference](#rest-api-reference)
  - [Auth](#auth-routes)
  - [Categories](#categories-routes)
  - [Events](#events-routes)
  - [Tickets](#tickets-routes)
- [GraphQL API Reference](#graphql-api-reference)
  - [Why GraphQL](#why-graphql)
  - [Running the GraphQL Server](#running-the-graphql-server)
  - [Schema](#schema)
  - [Queries Reference](#queries-reference)
  - [GraphQL Authentication](#graphql-authentication)
  - [Advanced Query Techniques](#advanced-query-techniques)
- [Module Dependency Map](#module-dependency-map)
- [How the Request Lifecycle Works](#how-the-request-lifecycle-works)
- [Webhook Integration](#webhook-integration)
- [Seeder](#seeder)
- [How to Extend This Project](#how-to-extend-this-project)

---

## Tech Stack

| Concern | Library |
|---|---|
| Framework | NestJS 10 |
| ORM | TypeORM 0.3 |
| Database | MySQL (mysql2 driver) |
| Auth | Passport.js + passport-jwt + @nestjs/jwt |
| Password hashing | bcryptjs |
| Validation | class-validator + class-transformer |
| HTTP client | @nestjs/axios (used for webhook) |
| Config | @nestjs/config (.env via dotenv) |
| GraphQL server | GraphQL Yoga (standalone, SDL-first) |
| GraphQL schema | @graphql-tools/schema |

---

## Architecture Overview

StagePass exposes **two servers** running side by side, sharing the same MySQL database and TypeORM entities:

```
┌─────────────────────────────────────────────┐
│                   Clients                   │
│   Mobile App      │      Web Dashboard      │
└────────┬──────────┴──────────────┬──────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐     ┌──────────────────────┐
│  GraphQL Yoga   │     │   NestJS REST API    │
│  port 4001      │     │   port 3000          │
│                 │     │                      │
│  READ / BROWSE  │     │  WRITE / ACTIONS     │
│  - events       │     │  POST /auth/login    │
│  - event(id)    │     │  POST /tickets       │
│  - myTickets    │     │  POST /events        │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         └─────────────┬───────────┘
                       ▼
            ┌──────────────────┐
            │  MySQL Database  │
            │   (shared)       │
            └──────────────────┘
```

| Layer | Technology | Port | Responsibility |
|---|---|---|---|
| REST API | NestJS | 3000 | Auth, mutations (create/update/delete) |
| GraphQL | GraphQL Yoga | 4001 | Browsing, searching, reading data |

**Rule of thumb:** use REST to write, use GraphQL to read.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env and fill in your values
cp .env.example .env

# 3. Make sure your MySQL server is running and the database exists
# e.g. CREATE DATABASE stagepass CHARACTER SET utf8mb4;

# 4. Start NestJS REST in development (watch) mode — port 3000
npm run start:dev

# 5. Start GraphQL Yoga in development mode — port 4001
npm run graphql:dev

# 6. (Optional) Seed the database with sample data
npm run seed
```

REST API → `http://localhost:3000`  
GraphQL Playground → `http://localhost:4001/graphql`

---

## Environment Variables

All configuration lives in `.env`. Never commit this file.

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USERNAME` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `secret` |
| `DB_NAME` | Database name | `stagepass` |
| `JWT_SECRET` | Secret used to sign JWTs | `a-long-random-string` |
| `JWT_EXPIRES_IN` | JWT lifetime | `3600s` |
| `WEBHOOK_URL` | (Optional) URL to POST ticket events to | `https://webhook.site/your-uuid` |

`TypeORM` is configured with `synchronize: true`, meaning it will automatically create/alter tables to match your entities on every startup. **Turn this off and use migrations before going to production.**

---

## Database Schema

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Category   │        │     User     │        │    Ticket    │
│─────────────│        │─────────────│        │─────────────│
│ id (PK)      │        │ id (PK)      │◄───────│ ownerId (FK) │
│ name         │        │ username     │        │ eventId (FK) │
└──────┬───────┘        │ email        │        │ seat         │
       │                │ password*    │        │ purchasedAt  │
       │                │ role (enum)  │        │ status(enum) │
       │                └──────┬───────┘        └──────────────┘
       │                       │                       │
       │                ┌──────┴───────┐               │
       └────────────────│    Event     │───────────────┘
                        │─────────────│
                        │ id (PK)      │
                        │ title        │
                        │ description  │
                        │ date         │
                        │ location     │
                        │ capacity     │
                        │ categoryId   │
                        │ organizerId  │
                        └──────────────┘

* password has select: false — never returned in queries unless explicitly selected
```

### Enums

**UserRole** (`users.role`)
- `admin` — full platform access
- `organizer` — can create and manage their own events
- `attendee` — can purchase tickets (default)

**TicketStatus** (`tickets.status`)
- `confirmed` — set automatically on purchase
- `cancelled` — available for future use (not currently set by any route)

---

## Project Structure

```
src/
├── main.ts                        # App entry point; registers global ValidationPipe
├── app.module.ts                  # Root module; wires TypeORM, ConfigModule, all feature modules
│
├── common/                        # Shared utilities used across all modules
│   ├── base.service.ts            # Abstract generic service — all domain services extend this
│   ├── decorators/
│   │   └── roles.decorator.ts     # @Roles('admin', 'organizer') metadata decorator
│   └── guards/
│       ├── jwt-auth.guard.ts      # Validates Bearer token; attaches user to req.user
│       └── roles.guard.ts         # Checks req.user.role against @Roles() metadata
│
├── auth/                          # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts         # POST /auth/register, POST /auth/login
│   ├── auth.service.ts            # register() and login() logic
│   ├── jwt.strategy.ts            # Passport JWT strategy; validate() sets req.user
│   └── dto/
│       ├── register.dto.ts
│       └── login.dto.ts
│
├── users/                         # User persistence (no public controller)
│   ├── user.entity.ts
│   ├── users.service.ts           # Extends BaseService; adds findByEmail/findByUsername
│   └── users.module.ts            # Exported so AuthModule and JwtStrategy can inject it
│
├── categories/
│   ├── category.entity.ts
│   ├── categories.service.ts      # Extends BaseService
│   ├── categories.controller.ts   # GET /categories (public), POST /categories (admin)
│   ├── categories.module.ts       # Exported so EventsModule can inject CategoriesService
│   └── dto/
│       └── create-category.dto.ts
│
├── events/
│   ├── event.entity.ts            # ManyToOne: category, organizer (both eager-loaded)
│   ├── events.service.ts          # Extends BaseService; owns update/delete ownership checks
│   ├── events.controller.ts       # Full CRUD — see API Reference
│   ├── events.module.ts           # Exported so TicketsModule can inject EventsService
│   └── dto/
│       ├── create-event.dto.ts
│       └── update-event.dto.ts    # PartialType(CreateEventDto) — all fields optional
│
├── tickets/
│   ├── ticket.entity.ts           # ManyToOne: event, owner (both eager-loaded)
│   ├── tickets.service.ts         # purchaseTicket() with capacity check + webhook
│   ├── tickets.controller.ts      # POST /tickets, GET /tickets/my
│   ├── tickets.module.ts
│   └── dto/
│       └── create-ticket.dto.ts
│
├── commands/
│   └── seeder.ts                  # Standalone NestJS context; seeds DB with sample data
│
└── graphql/                       # GraphQL Yoga standalone server (port 4001)
    ├── main.ts                    # Yoga server entry point
    ├── schema.ts                  # Assembles typeDefs + resolvers
    ├── context.ts                 # Shared context: DB connection + JWT user
    ├── schema/
    │   └── schema.graphql         # SDL type definitions (the contract)
    └── resolvers/
        ├── Query.ts               # events, event(id), myTickets
        ├── Event.ts               # Computed field: ticketsLeft + date formatting
        └── Ticket.ts              # Field resolver: purchasedAt formatting
```

---

## Architecture Patterns

### BaseService\<T\>

`src/common/base.service.ts` is an abstract generic class that every domain service extends. It wraps a TypeORM `Repository<T>` and provides five standard methods:

| Method | Signature | Notes |
|---|---|---|
| `findAll` | `(options?) → Promise<T[]>` | Accepts full TypeORM `FindManyOptions` |
| `findOne` | `(options) → Promise<T>` | Throws `NotFoundException` if not found |
| `create` | `(dto) → Promise<T>` | Runs `repository.create()` then `.save()` |
| `update` | `(id, dto) → Promise<T>` | Patches by id, then re-fetches |
| `remove` | `(id) → Promise<void>` | Fetches first (throws if missing), then removes |

Domain services only override or add methods that need custom logic. For example `EventsService` adds ownership checks in `updateEvent` and `deleteEvent` rather than using the base `update`/`remove`.

### Module Exports

Modules that are consumed by other modules explicitly export their service:

- `UsersModule` exports `UsersService` → used by `AuthModule` (registration, login, JWT validation)
- `CategoriesModule` exports `CategoriesService` → used by `EventsModule` (category lookup on event create/update)
- `EventsModule` exports `EventsService` → used by `TicketsModule` (event lookup + capacity check)

### GraphQL SDL-first approach

The GraphQL layer follows the **SDL-first** pattern taught in the course (Aymen Sellaouti):

- **`schema.graphql`** — the contract, written in GraphQL SDL. Defines all types, enums, and the Query type.
- **Resolvers** — plain TypeScript objects, one file per type (`Query.ts`, `Event.ts`, `Ticket.ts`). Each resolver function receives `(parent, args, context, info)`.
- **Context** — a shared object injected into every resolver containing the DB manager and the currently authenticated user (decoded from the JWT).

---

## Authentication & Authorization

### How it works end-to-end

1. Client calls `POST /auth/login` with `{ email, password }`.
2. `AuthService.login()` looks up the user by email (fetching the normally-hidden `password` column), compares with `bcryptjs.compare`, and if valid signs a JWT with `{ sub: user.id, username, role }`.
3. Client stores the token and sends it as `Authorization: Bearer <token>` on subsequent requests.
4. **For REST:** `JwtAuthGuard` intercepts the request, verifies the token, calls `JwtStrategy.validate()`, and attaches the full `User` to `req.user`.
5. **For GraphQL:** the `context()` function in `src/graphql/context.ts` reads the `Authorization` header from each incoming request, verifies the JWT, and attaches the user to `context.currentUser`. No Passport involved — pure JWT verification.

### REST Guards

**`JwtAuthGuard`** — attach to any route or controller that requires a logged-in user.

```typescript
@UseGuards(JwtAuthGuard)
```

**`RolesGuard`** — always pair with `JwtAuthGuard`. Use together with the `@Roles()` decorator.

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
```

### GraphQL Auth

Protected GraphQL queries check `context.currentUser` at the start of the resolver and throw a `GraphQLError` with HTTP status `401` if the user is not authenticated:

```typescript
if (!currentUser) {
  throw new GraphQLError('You must be logged in.', {
    extensions: { http: { status: 401 } },
  });
}
```

### Password security

The `password` column on `User` is decorated with `select: false`. TypeORM will never include it in a standard `find()` or `findOne()` query. The only place it is explicitly fetched is in `UsersService.findByEmail()` and `findByUsername()`.

---

## REST API Reference

All request bodies must be `Content-Type: application/json`.  
Protected routes require `Authorization: Bearer <jwt>` header.  
Validation errors return HTTP `400` with a `message` array from `class-validator`.

---

### Auth Routes

#### `POST /auth/register`

Creates a new user account. Returns the created user without the password field.

**Body**
```json
{
  "username": "janedoe",
  "email": "jane@example.com",
  "password": "secret123",
  "role": "attendee"
}
```

- `role` is optional. Defaults to `attendee`. Accepted values: `admin`, `organizer`, `attendee`.
- `username` and `email` must be unique — returns `409 Conflict` otherwise.
- `password` minimum length: 6 characters.

**Response `201`**
```json
{
  "id": 1,
  "username": "janedoe",
  "email": "jane@example.com",
  "role": "attendee",
  "createdAt": "2025-06-01T10:00:00.000Z",
  "updatedAt": "2025-06-01T10:00:00.000Z"
}
```

---

#### `POST /auth/login`

Validates credentials and returns a signed JWT.

**Body**
```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Response `200`**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Returns `401 Unauthorized` if email not found or password does not match.

---

### Categories Routes

#### `GET /categories`

Public. Returns all categories.

**Response `200`**
```json
[
  { "id": 1, "name": "Music" },
  { "id": 2, "name": "Sports" },
  { "id": 3, "name": "Tech" }
]
```

---

#### `POST /categories`

**Protected:** `admin` role required.

**Headers:** `Authorization: Bearer <token>`

**Body**
```json
{ "name": "Comedy" }
```

**Response `201`**
```json
{ "id": 4, "name": "Comedy" }
```

---

### Events Routes

#### `GET /events`

Public. Returns all events with embedded `category` and `organizer`.

---

#### `GET /events/:id`

Public. Returns a single event by ID. Returns `404` if not found.

---

#### `POST /events`

**Protected:** `organizer` or `admin` role required.

**Headers:** `Authorization: Bearer <token>`

**Body**
```json
{
  "title": "Jazz Night",
  "description": "An intimate evening of live jazz.",
  "date": "2025-09-20T20:00:00.000Z",
  "location": "Blue Note, New York",
  "capacity": 80,
  "categoryId": 1
}
```

**Response `201`** — the newly created event.

---

#### `PATCH /events/:id`

**Protected:** authenticated user must be the event's organizer or an admin.

**Headers:** `Authorization: Bearer <token>`

**Body** (any subset of create fields)
```json
{
  "title": "Jazz Night — Sold Out Edition",
  "capacity": 100
}
```

**Response `200`** — the updated event.

---

#### `DELETE /events/:id`

**Protected:** same ownership check as PATCH. Returns `204 No Content`.

**Headers:** `Authorization: Bearer <token>`

---

### Tickets Routes

#### `POST /tickets`

**Protected:** any authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Body**
```json
{
  "eventId": 1,
  "seat": "A-14"
}
```

- `seat` is optional.
- Returns `404` if event does not exist.
- Returns `400` if event is at full capacity.

**Response `201`**
```json
{
  "id": 7,
  "seat": "A-14",
  "purchasedAt": "2025-06-01T14:32:00.000Z",
  "status": "confirmed",
  "event": { "id": 1, "title": "Neon Horizons Music Festival", "..." },
  "owner": { "id": 3, "username": "janedoe", "..." },
  "createdAt": "..."
}
```

---

#### `GET /tickets/my`

**Protected:** any authenticated user.

Returns all tickets belonging to the authenticated user.

**Headers:** `Authorization: Bearer <token>`

---

## GraphQL API Reference

### Why GraphQL

GraphQL is the **Discovery Layer** of StagePass. It solves two classic REST problems:

**Over-fetching** — `GET /events` always returns all fields even if the client only needs `title` and `date`.

**Under-fetching** — getting an event + its ticket count requires multiple REST calls. GraphQL does it in one:

```graphql
query {
  event(id: 1) {
    title
    ticketsLeft
    organizer { username }
    category  { name }
  }
}
```

GraphQL is used for: browsing and searching events, organizer dashboard data, and attendee profile with tickets.

---

### Running the GraphQL Server

Add these scripts to `package.json`:

```json
"scripts": {
"graphql:dev":   "cross-env NODE_ENV=development ts-node-dev --exit-child --respawn src/graphql/main.ts",
"graphql:start": "ts-node src/graphql/main.ts"
}
```

```bash
# Development (with hot reload)
npm run graphql:dev

# Production
npm run graphql:start
```

Access the **GraphQL Playground** at `http://localhost:4001/graphql`.

---

### Schema

Defined in `src/graphql/schema/schema.graphql` using SDL (Schema Definition Language):

```graphql
type Query {
  events(category: String, date: String): [Event!]!
  event(id: Int!):                         Event!
  myTickets:                               [Ticket!]!
}

type Event {
  id:          Int!
  title:       String!
  description: String!
  date:        String!
  location:    String!
  capacity:    Int!
  ticketsLeft: Int!        # computed — capacity minus sold tickets
  category:    Category!
  organizer:   User!
  createdAt:   String!
}

type Ticket {
  id:          Int!
  event:       Event!
  seat:        String
  purchasedAt: String!
  status:      TicketStatus!
}

type Category { id: Int!  name: String! }
type User     { id: Int!  username: String!  email: String!  role: UserRole! }

enum TicketStatus { confirmed  cancelled }
enum UserRole     { admin  organizer  attendee }
```

---

### Queries Reference

#### Get all events

```graphql
query {
  events {
    id
    title
    date
    location
    capacity
    ticketsLeft
    category  { name }
    organizer { username }
  }
}
```

#### Filter by category

```graphql
query {
  events(category: "Music") {
    title
    ticketsLeft
  }
}
```

#### Filter by date

```graphql
query {
  events(date: "2025-08-15") {
    title
    location
  }
}
```

#### Get one event by ID

```graphql
query {
  event(id: 1) {
    title
    description
    ticketsLeft
    organizer { username email }
    category  { name }
  }
}
```

#### My tickets *(JWT required — see GraphQL Authentication)*

```graphql
query {
  myTickets {
    seat
    status
    purchasedAt
    event { title date }
  }
}
```

---

### GraphQL Authentication

`myTickets` requires a valid JWT. The token is obtained from the REST API and passed in the GraphQL request headers.

**Step 1 — Get a token from NestJS REST:**

```bash
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "jane@stagepass.io",
  "password": "Attendee1234!"
}
```

**Step 2 — Add the token to the Playground HTTP Headers tab:**

```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

**Step 3 — Run the protected query:**

```graphql
query {
  myTickets {
    seat
    status
    event { title date }
  }
}
```

---

### Advanced Query Techniques

#### Variables

```graphql
query GetEvent($id: Int!) {
  event(id: $id) {
    title
    ticketsLeft
  }
}
```

Query Variables panel:
```json
{ "id": 1 }
```

#### Aliases — two events in one request

```graphql
query {
  festival: event(id: 1) { title ticketsLeft }
  summit:   event(id: 2) { title ticketsLeft }
}
```

#### Fragments — reusable field sets

```graphql
query {
  event1: event(id: 1) { ...eventInfos }
  event2: event(id: 2) { ...eventInfos }
}

fragment eventInfos on Event {
  title
  location
  ticketsLeft
  category { name }
}
```

---

## Module Dependency Map

```
AppModule
├── ConfigModule (global)          — provides ConfigService everywhere
├── TypeOrmModule (root)           — DB connection, reads config from ConfigService
├── HttpModule                     — makes HttpService available (used by TicketsModule)
├── AuthModule
│   └── imports UsersModule        — needs UsersService to look up users during login/register
│   └── imports JwtModule          — signs and verifies tokens
├── UsersModule                    — exported, no controller, pure data access layer
├── CategoriesModule               — exported so EventsModule can resolve categories
├── EventsModule
│   └── imports CategoriesModule   — needs CategoriesService to validate categoryId
│   └── exported so TicketsModule can resolve events
└── TicketsModule
    └── imports EventsModule       — needs EventsService to load event + check capacity
    └── imports HttpModule         — needs HttpService to fire webhook

GraphQL Yoga (standalone — port 4001)
└── context.ts                     — opens its own TypeORM DataSource (synchronize: false)
    └── resolvers/Query.ts         — reads from DB via context.db (EntityManager)
    └── resolvers/Event.ts         — computes ticketsLeft via Ticket count query
    └── resolvers/Ticket.ts        — formats purchasedAt as ISO string
```

---

## How the Request Lifecycle Works

### REST — `POST /tickets`

```
Client
  │  POST /tickets  { "eventId": 1, "seat": "B-5" }
  │  Authorization: Bearer eyJ...
  ▼
JwtAuthGuard → verifies token → attaches User to req.user
  ▼
TicketsController.purchase(dto, req.user)
  ▼
TicketsService.purchaseTicket()
  1. EventsService.getEventById(dto.eventId)   → 404 if not found
  2. ticketRepository.count(...)               → 400 if at capacity
  3. ticketRepository.create(...)
  4. ticketRepository.save(ticket)
  5. fireWebhook(...)                          → fire-and-forget
  ▼
Response 201 — saved ticket
```

### GraphQL — `query { myTickets }`

```
Client
  │  POST http://localhost:4001/graphql
  │  Authorization: Bearer eyJ...
  │  Body: { "query": "{ myTickets { seat event { title } } }" }
  ▼
GraphQL Yoga
  ▼
context() function
  │  reads Authorization header
  │  verifies JWT with JWT_SECRET
  │  fetches User from DB → sets context.currentUser
  ▼
Query.myTickets(parent, args, context)
  │  throws 401 if context.currentUser is null
  │  queries tickets WHERE owner.id = currentUser.id
  ▼
Ticket field resolvers (purchasedAt, event fields)
  ▼
Response — exactly the fields the client requested
```

---

## Webhook Integration

Every time a ticket is successfully purchased via REST, `TicketsService` fires a `POST` request to the configured `WEBHOOK_URL`.

**Payload sent:**
```json
{
  "ticketId": 7,
  "eventTitle": "Neon Horizons Music Festival",
  "ownerEmail": "jane@example.com",
  "seat": "A-14",
  "purchasedAt": "2025-06-01T14:32:00.000Z"
}
```

- Falls back to `https://webhook.site/your-uuid` if `WEBHOOK_URL` is not set.
- 5-second timeout. Errors are silently discarded — the ticket purchase is not affected.
- To test locally: create a free endpoint at [webhook.site](https://webhook.site) and set it as `WEBHOOK_URL`.

---

## Seeder

```bash
npm run seed
```

Idempotent — running multiple times will not create duplicates.

**What it seeds:**

| Type | Data |
|---|---|
| Categories | Music, Sports, Tech |
| Admin | `admin@stagepass.io` / `Admin1234!` |
| Organizer | `organizer@stagepass.io` / `Organizer1234!` |
| Attendee | `jane@stagepass.io` / `Attendee1234!` |
| Events | Neon Horizons Music Festival (Music, cap 500), Global Dev Summit 2025 (Tech, cap 200) |
| Tickets | A-12, A-13 owned by jane — B-01 owned by organizer (all on Neon Horizons) |

---

## How to Extend This Project

### Adding a new role

1. Add the value to `UserRole` enum in `src/users/user.entity.ts`.
2. Use `@Roles('your-new-role')` on REST routes.
3. Add a check in the GraphQL resolver's context guard if needed.

### Adding a new module (REST)

1. Create `src/your-module/` with `entity.ts`, `service.ts`, `controller.ts`, `module.ts`, and a `dto/` folder.
2. Extend `BaseService<YourEntity>`:

```typescript
@Injectable()
export class YourService extends BaseService<YourEntity> {
  constructor(
          @InjectRepository(YourEntity)
          private readonly yourRepo: Repository<YourEntity>,
  ) {
    super(yourRepo);
  }
}
```

3. Register the entity in `TypeOrmModule.forFeature([YourEntity])`.
4. Add `YourEntity` to the `entities` array in `AppModule`.
5. Import `YourModule` in `AppModule`.

### Adding a new GraphQL query

1. Add the query signature to `src/graphql/schema/schema.graphql`:

```graphql
type Query {
  yourQuery(arg: String): YourType!
}
```

2. Add the resolver function to `src/graphql/resolvers/Query.ts`:

```typescript
export const Query = {
  // ...existing resolvers
  yourQuery: async (_parent, args, { db }: GraphQLContext) => {
    return db.find(YourEntity, { where: { field: args.arg } });
  },
};
```

3. If you need computed fields on a type, create `src/graphql/resolvers/YourType.ts` and register it in `src/graphql/schema.ts`.

### Protecting a REST route

```typescript
@UseGuards(JwtAuthGuard)                    // any authenticated user
@UseGuards(JwtAuthGuard, RolesGuard)        // specific role
@Roles('admin')
@Roles('admin', 'organizer')               // multiple roles allowed
```

### Switching to migrations (production)

1. Set `synchronize: false` in `app.module.ts` and `src/graphql/context.ts`.
2. Add a `data-source.ts` file for the TypeORM CLI.
3. Run `npx typeorm migration:generate` and `migration:run`.

---

*NestJS documentation: https://docs.nestjs.com*  
*GraphQL Yoga documentation: https://the-guild.dev/graphql/yoga-server*  
*Course: GraphQL — Aymen Sellaouti*