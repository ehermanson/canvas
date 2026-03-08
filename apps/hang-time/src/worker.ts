// Cloudflare Worker entry point
// Static assets are served automatically via the [assets] config in wrangler.toml
// This worker handles any additional logic if needed (API routes, etc.)

export default {
  async fetch(
    request: Request,
    _env: unknown,
    _ctx: unknown,
  ): Promise<Response> {
    // The static assets binding handles serving the built React app
    // This fetch handler is for any custom logic you want to add

    const url = new URL(request.url);

    // Example: Add an API route
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For SPA routing, return 404 - assets binding handles the rest
    return new Response('Not found', { status: 404 });
  },
};
