import {
  handleAuthRequest,
  handleLayoutsRequest,
  handleSessionRequest,
  type CanvasAuthEnv,
} from "@canvas-tools/auth-db";

export default {
  async fetch(request: Request, env: CanvasAuthEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      return handleAuthRequest(request, env);
    }

    if (url.pathname === "/api/session") {
      return handleSessionRequest(request, env);
    }

    if (url.pathname === "/api/layouts" || url.pathname.startsWith("/api/layouts/")) {
      return handleLayoutsRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
