import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../context';
import { Event } from '../../events/event.entity';

export const Query = {

    // query { events(category, date) { title, date, ticketsLeft } }
    events: async (
        _parent: unknown,
        args: { category?: string; date?: string },
        { db }: GraphQLContext,
    ) => {
        const qb = db
            .getRepository(Event)
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.category', 'category')
            .leftJoinAndSelect('event.organizer', 'organizer');

        if (args.category) {
            qb.andWhere('category.name = :category', { category: args.category });
        }
        if (args.date) {
            qb.andWhere('DATE(event.date) = :date', { date: args.date });
        }

        return qb.getMany();
    },

    // query { event(id) { ...fullDetails, organizer } }
    event: async (
        _parent: unknown,
        args: { id: number },
        { db }: GraphQLContext,
    ) => {
        const event = await db.findOne(Event, {
            where: { id: args.id },
            relations: ['category', 'organizer'],
        });

        if (!event) {
            throw new GraphQLError(`Event with id '${args.id}' not found.`, {
                extensions: { http: { status: 404 } },
            });
        }

        return event;
    },

    // query { myTickets { event { title, date }, seat } }
    myTickets: async (
        _parent: unknown,
        _args: unknown,
        { db, currentUser }: GraphQLContext,
    ) => {
        if (!currentUser) {
            throw new GraphQLError('You must be logged in.', {
                extensions: { http: { status: 401 } },
            });
        }

        return db.find(
            (await import('../../tickets/ticket.entity')).Ticket,
            {
                where: { owner: { id: currentUser.id } },
                relations: ['event', 'event.category', 'event.organizer'],
            },
        );
    },
};