export default {
  async fetch(
    request: Request,
    _env: unknown,
    _ctx: unknown,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
