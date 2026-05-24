import { createSchema } from 'graphql-yoga';
import * as fs from 'fs';
import * as path from 'path';
import { Query } from './resolvers/Query';
import { Event } from './resolvers/Event';
import { Ticket } from './resolvers/Ticket';

export const schema = createSchema({
    typeDefs: fs.readFileSync(
        path.join(__dirname, 'schema/schema.graphql'),
        'utf-8',
    ),
    resolvers: {
        Query,
        Event,
        Ticket,
    },
});