# Canvas Tools Workspace

Monorepo for the `Hang Time` and `Room Plan` apps.

## Workspaces

- `apps/hang-time`
- `apps/room-plan`
- `packages/ui`
- `packages/theme`
- `packages/viewport`

## Commands

```bash
npm install
npm run dev:hang-time
npm run dev:room-plan
npm run test
npm run build
npm run deploy:hang-time
npm run deploy:room-plan
```

## Deployment

- `apps/hang-time` deploys to `hang-time.app`
- `apps/room-plan` deploys to `room-plan.app`
- Both apps are configured as Cloudflare Workers serving static Vite assets with SPA fallback
