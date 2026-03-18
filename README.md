# Canvas Tools Workspace

Monorepo for two Cloudflare-hosted React apps:

- `apps/hang-time` at `hang-time.app`
- `apps/floor-plan` at `floor-plan.app`

Both apps deploy as separate Cloudflare Workers. Deploying one does not overwrite the other unless you intentionally point both at the same custom domain.

## Requirements

- Node `22.x` via `.nvmrc`
- Vite+ (`vp`) — installed via `npm install`
- Wrangler authentication for the target Cloudflare account

## Workspace Commands

```bash
npm install            # install dependencies (first time only)
vp check               # format, lint, type-check
vp run -r test         # run all tests
vp run -r build        # build all apps
vp check && vp run -r test && vp run -r build  # full CI check
```

App-specific commands:

```bash
vp run --filter @canvas-tools/hang-time dev
vp run --filter @canvas-tools/floor-plan dev
vp run --filter @canvas-tools/hang-time deploy
vp run --filter @canvas-tools/floor-plan deploy
vp run --filter @canvas-tools/hang-time deploy:dry-run
vp run --filter @canvas-tools/floor-plan deploy:dry-run
```

## Deployment Model

- `apps/hang-time` is the `hang-time` Worker configured in `apps/hang-time/wrangler.jsonc`.
- `apps/floor-plan` is the `floor-plan` Worker configured in `apps/floor-plan/wrangler.jsonc`.
- Each app serves a static Vite build through Cloudflare Workers assets with SPA fallback.
- There are currently no Cloudflare bindings or secrets required for either app.

See `DEPLOYMENT.md` for the release checklist, dry-run commands, and smoke tests.
