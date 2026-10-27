import tarot from './index.cjs';
import pg from 'pg';
import { createFetchHandler } from './http.mjs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

async function handleDataRequest(action, params = {}) {
  switch (action) {
    case 'list_readings': {
      const { rows } = await pool.query(
        'select * from public.reading_feed order by created_at desc limit 300',
      );
      return rows;
    }
    case 'create_reading': {
      const { rows } = await pool.query(
        `select public.create_reading(
          $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text,
          $7::jsonb, $8::jsonb, $9::text, $10::jsonb, $11::text[], $12::uuid
        ) as value`,
        [
          params.p_owner_id,
          params.p_token,
          params.p_author_name,
          params.p_question,
          params.p_mode,
          params.p_spread,
          JSON.stringify(params.p_spread_data),
          JSON.stringify(params.p_cards),
          params.p_interpretation,
          params.p_ai_interpretation == null
            ? null
            : JSON.stringify(params.p_ai_interpretation),
          params.p_tags,
          params.p_idempotency_key,
        ],
      );
      return rows[0]?.value;
    }
    case 'update_reading_feedback': {
      const { rows } = await pool.query(
        'select public.update_reading_feedback($1::uuid, $2::uuid, $3::text, $4::text) as value',
        [params.p_id, params.p_owner_id, params.p_token, params.p_feedback],
      );
      return rows[0]?.value;
    }
    case 'delete_reading': {
      const { rows } = await pool.query(
        'select public.delete_reading($1::uuid, $2::uuid, $3::text) as value',
        [params.p_id, params.p_owner_id, params.p_token],
      );
      return Boolean(rows[0]?.value);
    }
    case 'update_member_nickname': {
      const { rows } = await pool.query(
        'select public.update_member_nickname($1::uuid, $2::text, $3::text) as value',
        [params.p_owner_id, params.p_token, params.p_nickname],
      );
      return Number(rows[0]?.value || 0);
    }
    case 'list_custom_spreads': {
      const { rows } = await pool.query(
        'select * from public.list_custom_spreads($1::uuid, $2::text)',
        [params.p_owner_id, params.p_token],
      );
      return rows;
    }
    case 'create_custom_spread': {
      const { rows } = await pool.query(
        'select public.create_custom_spread($1::text, $2::uuid, $3::text, $4::text, $5::jsonb) as value',
        [
          params.p_id,
          params.p_owner_id,
          params.p_token,
          params.p_name,
          JSON.stringify(params.p_positions),
        ],
      );
      return rows[0]?.value;
    }
    case 'update_custom_spread': {
      const { rows } = await pool.query(
        'select public.update_custom_spread($1::text, $2::uuid, $3::text, $4::text, $5::jsonb) as value',
        [
          params.p_id,
          params.p_owner_id,
          params.p_token,
          params.p_name,
          JSON.stringify(params.p_positions),
        ],
      );
      return rows[0]?.value;
    }
    case 'delete_custom_spread': {
      const { rows } = await pool.query(
        'select public.delete_custom_spread($1::text, $2::uuid, $3::text) as value',
        [params.p_id, params.p_owner_id, params.p_token],
      );
      return Boolean(rows[0]?.value);
    }
    default:
      throw new Error('UNKNOWN_ACTION');
  }
}

const handler = {
  fetch: createFetchHandler({
    handleDataRequest,
    handleAiRequest: tarot.main,
  }),
};

export default handler;
