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
    spreadData: text('spread_data').notNull().default('{}'),
    cards: text('cards').notNull(),
    interpretation: text('interpretation').notNull(),
    aiInterpretation: text('ai_interpretation').notNull().default(''),
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

export const customSpreads = sqliteTable(
  'custom_spreads',
  {
    id: text('id').primaryKey(),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    positions: text('positions').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_custom_spreads_member_id').on(table.memberId)],
);

export const aiGenerations = sqliteTable(
  'ai_generations',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id').notNull(),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    count: integer('count').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_ai_generations_draft_member').on(table.draftId, table.memberId)],
);
