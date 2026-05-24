import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';
import { context } from './context';
import { AppDataSource } from './context';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    await AppDataSource.initialize();
    console.log('Database connected');

    const yoga = createYoga({ schema, context });
    const server = createServer(yoga);

    server.listen(4001, () => {
        console.info('GraphQL server running on http://localhost:4001/graphql');
    });
}

main().catch(console.error);