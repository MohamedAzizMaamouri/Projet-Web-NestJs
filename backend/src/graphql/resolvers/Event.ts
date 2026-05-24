import { GraphQLContext } from '../context';
import { Ticket } from '../../tickets/ticket.entity';

export const Event = {
    ticketsLeft: async (
        parent: { id: number; capacity: number },
        _args: unknown,
        { db }: GraphQLContext,
    ) => {
        const sold = await db.count(Ticket, {
            where: { event: { id: parent.id } },
        });
        return parent.capacity - sold;
    },

    date: (parent: { date: Date }) => {
        return parent.date.toISOString();
    },

    createdAt: (parent: { createdAt: Date }) => {
        return parent.createdAt.toISOString();
    },
};