import { YogaInitialContext } from 'graphql-yoga';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

import { User as UserEntity } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { Category } from '../categories/category.entity';
import { Ticket } from '../tickets/ticket.entity';

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [UserEntity, Event, Category, Ticket],
    synchronize: false,
    charset: 'utf8mb4',
});

export type GraphQLContext = {
    currentUser: User | null;
    db: DataSource['manager'];
};

export async function context(
    initialContext: YogaInitialContext,
): Promise<GraphQLContext> {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }

    const db = AppDataSource.manager;
    let currentUser: User | null = null;

    const authHeader = initialContext.request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET is missing');
            }
            const decoded = jwt.verify(token, secret);

            if (typeof decoded !== 'string' && decoded.sub) {
                currentUser = await db.findOne(User, {
                    where: {
                        id: Number(decoded.sub),
                    },
                });
            }
        } catch (err) {
            console.error(err);
        }
    }

    return { currentUser, db };
}