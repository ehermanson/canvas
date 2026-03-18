# Floor Plan

Furniture layout planner intended for deployment at `https://floor-plan.app/`.

## Commands

```bash
vp dev               # start dev server
vp check             # format, lint, type-check
vp test              # run tests
vp build             # build for production
vp run deploy        # deploy to Cloudflare Workers
```

## Notes

- Hosted as the `floor-plan` Cloudflare Worker.
- Serves a static Vite build through Workers assets.
- Uses browser `localStorage` for project persistence.
- Supports JSON export and import for local backup and transfer.
- No Cloudflare bindings or secrets are required right now.

See `../../DEPLOYMENT.md` for the shared release checklist.
