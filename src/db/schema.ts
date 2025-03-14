import { relations } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  pgEnum,
  json,
} from 'drizzle-orm/pg-core';
import { generate } from '../utils/random-string-gen';
import { primaryKey } from 'drizzle-orm/gel-core';

export const authorType = pgEnum('type', ['DEFAULT', 'MODERATOR', 'WEBMASTER']);

export const apiKeys = pgTable('apikeys', {
    key: varchar('id')
        .primaryKey()
        .$defaultFn(() => generate(64))
        .unique(),
    domain: varchar('domain').notNull(),
    type: authorType().default('DEFAULT').notNull(),
    createdAt: timestamp().notNull().$defaultFn(() => new Date(Date.now())),
})

export const comments = pgTable('comments', {
  /** The comment ID. This is also used to delete or edit comments. */
  id: varchar('id')
    .primaryKey()
    .$defaultFn(() => generate(12))
    .unique(),
  /** The author of that comment */
  author: varchar('author').notNull().default('Anonymous'),
  /** The comment content */
  content: varchar('content').notNull(),
  /** Additional info, specified by the client, and parsed by the client */
  additionalInfo: json(),
  /** The author's type */
  type: authorType().default('DEFAULT').notNull(),
  /** The comment creation timestamp */
  createdAt: timestamp().notNull().$defaultFn(() => new Date(Date.now())),
  /** The parent ID, if it's a reply comment */
  parentId: varchar('parent_id').references(() => comments.id, {
    onDelete: 'cascade',
  }),
  /** The site URL. This allows seperate comment boxes per page. */
  siteUrl: varchar('site_url').notNull(),
});

export const commentRelations = relations(comments, ({ one, many }) => ({
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'replies',
  }),
  replies: many(comments, {
    fields: [comments.id],
    references: [comments.parentId],
    relationName: 'replies',
  }),
}));

export const table = {
  comments, apiKeys,
};

export type Table = typeof table;