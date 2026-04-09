import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function getSessionUserEmail(payload: unknown): { hasSession: boolean; userEmail: string | null } {
  if (!payload || typeof payload !== "object") {
    return { hasSession: false, userEmail: null };
  }

  if ("user" in payload) {
    const session = payload as { user?: { email?: string | null } };
    return {
      hasSession: true,
      userEmail: session.user?.email ?? null,
    };
  }

  if ("data" in payload) {
    const wrapped = payload as {
      data?: { user?: { email?: string | null } } | null;
    };
    return getSessionUserEmail(wrapped.data);
  }

  return { hasSession: false, userEmail: null };
}

export function AuthPanel({ className }: { className?: string }) {
  const { data, error, isPending } = authClient.useSession();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasSession, userEmail } = getSessionUserEmail(data);

  useEffect(() => {
    if (!hasSession || typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) {
      return;
    }

    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [hasSession]);

  async function signInWithGoogle() {
    try {
      setActionError(null);
      setIsSubmitting(true);
      const result = await authClient.signIn.social({
        callbackURL: window.location.href,
        provider: "google",
      });
      if (result?.error) {
        setActionError(result.error.message ?? "Unable to sign in");
      }
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to sign in";
      setActionError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    try {
      setActionError(null);
      setIsSubmitting(true);
      await authClient.signOut();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to sign out";
      setActionError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorMessage = actionError ?? error?.message ?? null;

  if (isPending) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {hasSession ? (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-gray-500 dark:text-white/50">
            {userEmail}
          </span>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:text-white/35 dark:hover:text-white/60"
            onClick={signOut}
            disabled={isSubmitting}
          >
            <LogOut className="size-3" />
            Log out
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-white/50 dark:hover:text-white/70"
          onClick={signInWithGoogle}
          disabled={isSubmitting}
        >
          <LogIn className="size-3" />
          Log in
        </button>
      )}
      {errorMessage ? (
        <p className="text-[11px] text-red-500 dark:text-red-400">{errorMessage}</p>
      ) : null}
    </div>
  );
}
