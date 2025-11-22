Backend changes to support stream-scoped level & points

Overview

We changed the server so that "nivel" and "puntos" may be scoped to a specific stream (per-user per-stream). This uses the existing `stream_participants` table and the `StreamParticipant` model.

What changed

1. `routes/protected.js`
   - `GET /api/mi-perfil?stream_id=123` now returns the user's nivel/puntos for that stream (from `stream_participants`). If the participant doesn't exist it will be created with `level=1, puntos=0`.
   - `POST /api/mi-perfil/puntos` accepts an optional `stream_id` (in body or query). If provided, the server will update the participant's `puntos` and apply the same level-up rule (while puntos >= level*100 -> nivel++, puntos -= level*100) on the participant record. If `stream_id` is not provided, behavior falls back to updating the global `users` record (same semantics as before).

2. `routes/streams.js`
   - When registering a participant (`POST /api/streams/:id/participants`) the participant is now initialized with `level=1` and `puntos=0`, making per-stream progress independent from the global user progress.

3. `scripts/add_stream_participant_columns.sql`
   - A helper SQL script that safely adds `level`, `puntos`, `joined_at` and `left_at` columns to `stream_participants` if they are missing. Run this against your Postgres DB if your schema is out-of-date.

Database migration

Run the SQL script against your database (replace connection details accordingly):

psql "$DATABASE_URL" -f ./scripts/add_stream_participant_columns.sql

(Or copy the SQL block and run it in your DB admin tool.)

Frontend changes required

- When the frontend wants stream-scoped nivel/puntos (e.g., inside an expanded stream view), call `GET /api/mi-perfil?stream_id=<id>` and use the returned `nivel`/`puntos` values.
- When awarding points for actions that should affect the per-stream progress (chat messages inside a stream, sending gifts on a stream), POST to `/api/mi-perfil/puntos` with JSON `{ delta: <number>, stream_id: <id> }`.

Notes and considerations

- We kept the existing global user-level behavior intact for backwards compatibility: requests without `stream_id` continue to update the user's global `nivel`/`puntos`.
- You may want to adjust the level-up rules or thresholds for streams vs global; currently both use `level * 100` as threshold.
- If you want to broadcast participant level/puntos updates to other clients in real-time, integrate a WebSocket/SSE emit when participant records change.

If you want, I can now:
- Update the frontend to request stream-scoped profile when a stream is expanded and to POST puntos with `stream_id` when sending messages / buying gifts.
- Add a small endpoint to list participants for a stream (if needed by the UI).
- Add tests for the new behavior.
