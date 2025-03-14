import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { trimSlashEnd } from '../utils/trim-slash-end';

export const db = drizzle(process.env.DATABASE_URL, { schema });

export async function getCommentsWithoutId(url: string) {
    const results = await db.query.comments.findMany({
        with: {
            replies: true
        },
        where: (fields, operators) => operators.and(operators.isNull(fields.parentId), operators.ilike(fields.siteUrl, `${encodeURIComponent(trimSlashEnd(url))}%`)),
    });

    return results.map((row) => {
        const { id, replies, ...rest } = row;

        const repliesWithoutId = replies?.map((reply) => {
            const { id, parentId, ...replyRest } = reply;
            return {
                ...replyRest
            };
        });

        return {
            replyId: String(id).substring(0, 6),
            ...rest,
            replies: repliesWithoutId || [],
        };
    });
}