# Neon Function Backend Design

## Goal

Run the complete backend on Neon while continuing to host the browser application on Tencent Cloud. The production request path is:

`Tencent Cloud static frontend -> Neon Function -> Neon Postgres / DeepSeek API`

No production asset, request, redirect, or fallback may use a `chatgpt.site` URL. The DeepSeek API key must never be sent to the browser.

## Context and decision

The existing Tencent Cloud function is unavailable with `InsufficientBalance`. A temporary bridge hosted on `gongjian-tarot.junziyi88.chatgpt.site` currently handles database and DeepSeek traffic, but that host is outside the accepted architecture.

Three approaches were considered:

1. **Neon Function (selected).** Deploy a Node.js HTTP function on the same Neon branch as the database. Neon injects `DATABASE_URL`; the function owns the DeepSeek secret, validates requests, performs database operations, and calls DeepSeek.
2. **Tencent Cloud function connected to Neon.** This keeps compute on Tencent but retains the balance dependency that already made the service unavailable.
3. **Postgres extension making outbound HTTP requests.** This places external network calls and secret handling inside SQL, complicates timeout, JSON validation, observability, and abuse protection. It is not selected.

## Components

### Tencent Cloud frontend

The Vite browser bundle remains deployed at:

`https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com`

It calls a single configured Neon Function HTTPS endpoint for both database RPC operations and AI interpretation. The endpoint is supplied at build time through `VITE_API_ENDPOINT`; production builds must fail when this value is absent or is not an HTTPS Neon Function URL. No database password or DeepSeek credential is present in the bundle.

### Neon Function

The existing `functions/tarot-ai` handler becomes the single backend entry point. It uses the Neon Functions `fetch(request)` contract, a module-scoped `pg.Pool`, and the automatically injected `DATABASE_URL`.

The handler supports:

- `OPTIONS` requests for browser preflight.
- Database RPC requests identified by an `action` field.
- AI interpretation requests identified by the absence of `action` and validated against the existing tarot input contract.
- Structured JSON errors with appropriate HTTP status codes.

The only production CORS origin is the Tencent Cloud frontend origin. Localhost origins are allowed only for local development. Requests with another non-empty `Origin` are rejected. CORS is not treated as authentication.

### Neon Postgres

The existing `neon/migrations/001_tarot.sql` schema and security-definer RPC functions remain the data boundary. Write operations require the locally generated member ID and member token. Public feed reads expose the `reading_feed` view, which omits token hashes and idempotency keys.

### DeepSeek

The Neon Function reads `DEEPSEEK_API_KEY` from its server environment and sends the validated prompt to DeepSeek. Existing response validation remains responsible for enforcing the card-by-card JSON structure and length limits. Provider error bodies and credentials are never returned to the browser.

## Data flow

### Read and write operations

1. The Tencent frontend sends JSON to the Neon Function.
2. The function validates the action name and parameters.
3. The function calls a fixed, parameterized SQL query or stored procedure.
4. The function returns normalized JSON with `cache-control: no-store`.

Arbitrary SQL is never accepted from the browser.

### AI interpretation

1. The Tencent frontend sends the question, spread, and selected cards to the Neon Function.
2. The function validates question length, spread positions, card uniqueness, orientation, and card-to-position mapping.
3. The function reads `DEEPSEEK_API_KEY` from the Neon environment and calls DeepSeek with a 45-second timeout.
4. The function validates the model's JSON and returns only the normalized interpretation.

The first release preserves the current maximum of three generated versions in the browser. Server-side abuse protection is added by requiring a valid member ID/token pair and recording generation reservations in Neon before contacting DeepSeek. Failed provider calls release the reservation.

## Configuration and deployment

A root `neon.ts` declares the `tarot-ai` function source for the linked Neon project and branch. Deployment uses the current Neon CLI and `neon deploy`. `DATABASE_URL` is injected by Neon; `DEEPSEEK_API_KEY` is stored as a branch-scoped server secret.

After deployment, the returned Neon Function URL becomes the Tencent frontend's `VITE_API_ENDPOINT`. The Tencent static bundle is rebuilt and redeployed only after the Neon endpoint passes health, preflight, database read, and AI interpretation checks.

The old Tencent function URL and every `chatgpt.site` reference are removed from production source and generated assets.

## Error handling

- Invalid origin: `403` with `来源无效。`
- Unsupported method: `405`.
- Oversized body: `413`.
- Invalid request data: `400` with the existing user-facing validation message.
- Invalid member credentials: `401`.
- AI generation limit reached: `429`.
- Missing DeepSeek configuration: `503`.
- DeepSeek authentication or quota failure: `503` with a sanitized Chinese message.
- DeepSeek timeout or invalid response: `502` or `504` with a retry-safe Chinese message.
- Unexpected database error: `502` with no SQL details.

## Testing

Automated tests cover:

- Production configuration rejects absent, non-HTTPS, Tencent-function, and `chatgpt.site` endpoints.
- The Neon Function accepts the Tencent origin and rejects other origins.
- Preflight responses expose only the required methods and headers.
- Database action routing uses fixed action names and parameterized calls.
- AI validation, timeout, provider-error sanitization, and output parsing.
- Member authentication and the three-generation reservation limit.
- A repository-wide scan fails if a production source file contains `chatgpt.site`.

Deployment verification calls the deployed Neon Function with the Tencent origin, confirms database reads, performs one valid DeepSeek interpretation, inspects Neon Function logs, rebuilds the Tencent frontend, and verifies the published JavaScript references only the Neon Function endpoint.

## Non-goals

- Moving the frontend away from Tencent Cloud.
- Calling DeepSeek directly from the browser.
- Calling DeepSeek from a PostgreSQL extension or trigger.
- Retaining the Tencent Cloud function as a fallback.
- Using Neon AI Gateway instead of the existing DeepSeek account in this change.
