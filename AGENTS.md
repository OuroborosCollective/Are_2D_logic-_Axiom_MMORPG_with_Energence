## Cursor Cloud specific instructions

### Project overview
AreAxiomian is an open-source 2D MMORPG (Yarn v4 monorepo). Key packages: `@kaetram/server` (game server, port 9001), `@kaetram/client` (Astro dev server, port 9000), `@kaetram/hub` (optional gateway), `@kaetram/admin` (admin UI), `@kaetram/common` (shared types).

### Environment setup
- Requires Node.js 20 (use `nvm use 20`). Node 22+ is **not** compatible with the engine constraints.
- Corepack must be enabled (`corepack enable`) before `yarn install`.
- Copy `.env.defaults` to `.env` and set `ACCEPT_LICENSE=true` before running.
- MongoDB is optional; `SKIP_DATABASE=true` (default) allows running without it.

### Running
- `yarn dev` starts both client (port 9000) and server (port 9001) concurrently.
- The admin API is available at `http://localhost:9002/admin/` when the server is running.
- Admin login is restricted to user "thosu" only.

### Linting
- ESLint may OOM with default heap size. Use `NODE_OPTIONS="--max-old-space-size=8192" yarn lint:script` if needed.
- Stylelint: `yarn lint:style` runs separately.

### Building
- `yarn build` compiles all packages. The client (Astro) build may show a non-fatal compression warning for one JS file — this is benign.

### Are Logic (Heuristic Systems)
- Located in `packages/server/src/game/arelogic/`. The heuristic engine (13 nodes, 6 axioms, 1 watchdog) ticks every 5 seconds in the server world loop.
- Nations, villages, social bonds, and NPC memories are seeded at server startup.
- The narrative engine at `packages/server/src/game/narrative.engine.ts` generates probabilistic world events.
