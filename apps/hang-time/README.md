# Hang Time

Picture hanging and gallery wall calculator deployed at `https://hang-time.app/`.

## Commands

```bash
npm run dev --workspace @canvas-tools/hang-time
npm run lint --workspace @canvas-tools/hang-time
npm run test --workspace @canvas-tools/hang-time
npm run build --workspace @canvas-tools/hang-time
npm run deploy --workspace @canvas-tools/hang-time
```

## Notes

- Hosted as the `hang-time` Cloudflare Worker.
- Serves a static Vite build through Workers assets.
- Uses browser `localStorage` for saved layouts.
- No Cloudflare bindings or secrets are required right now.

See `../../DEPLOYMENT.md` for the shared release checklist.
