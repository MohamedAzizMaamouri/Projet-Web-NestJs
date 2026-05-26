import { GraphQLContext } from '../context';
import { Ticket, TicketStatus } from '../../tickets/ticket.entity';
import { TicketTier } from '../../tickets/ticket-tier.entity';

export const Event = {
    ticketsLeft: async (
        parent: { id: number; capacity: number },
        _args: unknown,
        { db }: GraphQLContext,
    ) => {
        const sold = await db.count(Ticket, {
            where: { event: { id: parent.id }, status: TicketStatus.CONFIRMED },
        });
        return parent.capacity - sold;
    },

    tiers: async (
        parent: { id: number },
        _args: unknown,
        { db }: GraphQLContext,
    ) => {
        const tiers = await db.find(TicketTier, {
            where: { event: { id: parent.id } },
        });

        return Promise.all(
            tiers.map(async (tier) => {
                const sold = await db.count(Ticket, {
                    where: { tier: { id: tier.id }, status: TicketStatus.CONFIRMED },
                });
                return { ...tier, sold };
            }),
        );
    },

    date: (parent: { date: Date }) => {
        return parent.date.toISOString();
    },

    createdAt: (parent: { createdAt: Date }) => {
        return parent.createdAt.toISOString();
    },
};