# Hang Time

Picture hanging and gallery wall calculator deployed at `https://hang-time.app/`.

## Commands

```bash
vp dev               # start dev server
vp check             # format, lint, type-check
vp test              # run tests
vp build             # build for production
vp run deploy        # deploy to Cloudflare Workers
```

## Notes

- Hosted as the `hang-time` Cloudflare Worker.
- Serves a static Vite build through Workers assets.
- Uses browser `localStorage` for saved layouts.
- No Cloudflare bindings or secrets are required right now.

See `../../DEPLOYMENT.md` for the shared release checklist.
