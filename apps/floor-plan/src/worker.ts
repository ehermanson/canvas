import {
  handleAuthRequest,
  handlePlannerProjectsRequest,
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

    if (
      url.pathname === "/api/planner-projects" ||
      url.pathname.startsWith("/api/planner-projects/")
    ) {
      return handlePlannerProjectsRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
