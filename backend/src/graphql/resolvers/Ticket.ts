export const Ticket = {
    purchasedAt: (parent: { purchasedAt: Date }) => {
        return parent.purchasedAt.toISOString();
    },
};