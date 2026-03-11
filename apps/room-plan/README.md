# Room Plan

Furniture layout planner intended for deployment at `https://room-plan.app/`.

## Commands

```bash
npm run dev --workspace @canvas-tools/room-plan
npm run lint --workspace @canvas-tools/room-plan
npm run test --workspace @canvas-tools/room-plan
npm run build --workspace @canvas-tools/room-plan
npm run deploy --workspace @canvas-tools/room-plan
```

## Notes

- Hosted as the `room-plan` Cloudflare Worker.
- Serves a static Vite build through Workers assets.
- Uses browser `localStorage` for project persistence.
- Supports JSON export and import for local backup and transfer.
- No Cloudflare bindings or secrets are required right now.

See `../../DEPLOYMENT.md` for the shared release checklist.
