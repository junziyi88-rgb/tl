import { index, sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  tokenHash: text('token_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const readings = sqliteTable(
  'readings',
  {
    id: text('id').primaryKey(),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    question: text('question').notNull(),
    mode: text('mode').notNull(),
    spread: text('spread').notNull(),
    cards: text('cards').notNull(),
    interpretation: text('interpretation').notNull(),
    tags: text('tags').notNull().default('[]'),
    feedback: text('feedback').notNull().default(''),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_readings_created_at').on(table.createdAt),
    index('idx_readings_member_id').on(table.memberId),
    uniqueIndex('idx_readings_idempotency_key').on(table.idempotencyKey),
  ],
);
