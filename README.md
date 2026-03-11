# Canvas Tools Workspace

Monorepo for two Cloudflare-hosted React apps:

- `apps/hang-time` at `hang-time.app`
- `apps/room-plan` at `room-plan.app`

Both apps deploy as separate Cloudflare Workers. Deploying one does not overwrite the other unless you intentionally point both at the same custom domain.

## Requirements

- Node `22.x` via `.nvmrc`
- npm
- Wrangler authentication for the target Cloudflare account

## Workspace Commands

```bash
npm install
npm run lint
npm run test
npm run build
npm run ci
```

App-specific commands:

```bash
npm run dev:hang-time
npm run dev:room-plan
npm run deploy:hang-time
npm run deploy:room-plan
npm run deploy:dry-run:hang-time
npm run deploy:dry-run:room-plan
```

## Deployment Model

- `apps/hang-time` is the `hang-time` Worker configured in `apps/hang-time/wrangler.jsonc`.
- `apps/room-plan` is the `room-plan` Worker configured in `apps/room-plan/wrangler.jsonc`.
- Each app serves a static Vite build through Cloudflare Workers assets with SPA fallback.
- There are currently no Cloudflare bindings or secrets required for either app.

See `DEPLOYMENT.md` for the release checklist, dry-run commands, and smoke tests.
