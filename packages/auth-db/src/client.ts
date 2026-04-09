import { createAuthClient } from "better-auth/react";

export function createCanvasAuthClient() {
  return createAuthClient({
    fetchOptions: {
      credentials: "include",
    },
  });
}
