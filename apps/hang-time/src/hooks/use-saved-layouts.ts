import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { SavedLayout } from "@/types";

const STORAGE_KEY = "picture-hanging-layouts";
const LOADED_LAYOUT_KEY = "picture-hanging-loaded-layout-id";
const IMPORT_COMPLETE_KEY = "picture-hanging-remote-import-complete";
const URL_CHANGE_EVENT = "hang-time:url-change";

let historyPatchRefs = 0;
let restoreHistoryPatch: (() => void) | null = null;

interface LayoutMutationResult {
  error?: string;
  success: boolean;
}

const REMOTE_UNAVAILABLE_MESSAGE =
  "Unable to reach account storage. Your local data is safe — changes will sync when the connection is restored.";

function patchHistoryForUrlChanges() {
  if (typeof window === "undefined") return () => {};

  historyPatchRefs += 1;
  if (historyPatchRefs === 1) {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const notifyUrlChange = () => window.dispatchEvent(new Event(URL_CHANGE_EVENT));

    window.history.pushState = (...args) => {
      originalPushState(...args);
      notifyUrlChange();
    };
    window.history.replaceState = (...args) => {
      originalReplaceState(...args);
      notifyUrlChange();
    };
    window.addEventListener("popstate", notifyUrlChange);

    restoreHistoryPatch = () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", notifyUrlChange);
    };
  }

  return () => {
    historyPatchRefs -= 1;
    if (historyPatchRefs === 0) {
      restoreHistoryPatch?.();
      restoreHistoryPatch = null;
    }
  };
}

async function parseLayoutsResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(REMOTE_UNAVAILABLE_MESSAGE);
  }

  const data = (await response.json()) as {
    error?: string;
    layout?: SavedLayout;
    layouts?: SavedLayout[];
  };

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function useSavedLayouts() {
  const { data: session } = authClient.useSession();
  const [localLayouts, setLocalLayouts] = useState<SavedLayout[]>([]);
  const [remoteLayouts, setRemoteLayouts] = useState<SavedLayout[]>([]);
  const [loadedLayoutId, setLoadedLayoutId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(() => window.location.search);
  const [isDetached, setIsDetached] = useState(false);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [hasDismissedImport, setHasDismissedImport] = useState(() => {
    return localStorage.getItem(IMPORT_COMPLETE_KEY) === "true";
  });
  const isSignedIn = Boolean(session);
  const layouts = isSignedIn ? remoteLayouts : localLayouts;

  useEffect(() => {
    const unpatchHistory = patchHistoryForUrlChanges();

    const handleUrlChange = () => {
      const nextUrl = window.location.search;
      setCurrentUrl((prevUrl) => {
        if (prevUrl === nextUrl) return prevUrl;
        setIsDetached(false);
        return nextUrl;
      });
    };

    window.addEventListener(URL_CHANGE_EVENT, handleUrlChange);

    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, handleUrlChange);
      unpatchHistory();
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLocalLayouts(JSON.parse(stored));
      }

      const loadedId = sessionStorage.getItem(LOADED_LAYOUT_KEY);
      if (loadedId) {
        setLoadedLayoutId(loadedId);
      }
    } catch {
      setLocalLayouts([]);
    }
  }, []);

  const syncLocalLayouts = useCallback((newLayouts: SavedLayout[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts));
    setLocalLayouts(newLayouts);
  }, []);

  const loadRemoteLayouts = useCallback(async () => {
    setIsRemoteLoading(true);
    setRemoteError(null);

    try {
      const response = await fetch("/api/layouts", {
        credentials: "include",
      });
      const data = await parseLayoutsResponse(response);
      setRemoteLayouts(data.layouts ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved layouts";
      setRemoteError(message);
      setRemoteLayouts([]);
    } finally {
      setIsRemoteLoading(false);
    }
  }, []);

  const importLocalLayouts = useCallback(async (): Promise<LayoutMutationResult> => {
    if (!isSignedIn || localLayouts.length === 0) {
      return { success: true };
    }

    try {
      const response = await fetch("/api/layouts/import-local", {
        body: JSON.stringify({
          layouts: localLayouts,
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return {
          success: false,
          error: REMOTE_UNAVAILABLE_MESSAGE,
        };
      }
      const data = (await response.json()) as { error?: string; layouts?: SavedLayout[] };
      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Unable to import local layouts",
        };
      }

      localStorage.setItem(IMPORT_COMPLETE_KEY, "true");
      setHasDismissedImport(true);
      await loadRemoteLayouts();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : REMOTE_UNAVAILABLE_MESSAGE;
      return { success: false, error: message };
    }
  }, [isSignedIn, loadRemoteLayouts, localLayouts]);

  useEffect(() => {
    if (!isSignedIn) {
      setRemoteLayouts([]);
      setRemoteError(null);
      setIsRemoteLoading(false);
      return;
    }

    void loadRemoteLayouts();
  }, [isSignedIn, loadRemoteLayouts]);

  const isNameTaken = useCallback(
    (name: string, excludeId?: string) => {
      const trimmed = name.trim().toLowerCase();
      return layouts.some(
        (layout) => layout.title.toLowerCase() === trimmed && layout.id !== excludeId,
      );
    },
    [layouts],
  );

  const existingLayoutForCurrentConfig = useMemo(() => {
    if (isDetached) return null;
    return layouts.find((layout) => layout.url === currentUrl) || null;
  }, [layouts, currentUrl, isDetached]);

  const loadedLayout = useMemo(() => {
    return layouts.find((layout) => layout.id === loadedLayoutId) || null;
  }, [layouts, loadedLayoutId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!loadedLayout) return false;
    return currentUrl !== loadedLayout.url;
  }, [loadedLayout, currentUrl]);

  const save = useCallback(
    async (title: string): Promise<LayoutMutationResult> => {
      const trimmedTitle = title.trim();

      if (isNameTaken(trimmedTitle)) {
        return {
          success: false,
          error: "A layout with this name already exists",
        };
      }

      const existingConfig = layouts.find((layout) => layout.url === currentUrl);
      if (existingConfig) {
        return {
          success: false,
          error: `This configuration is already saved as "${existingConfig.title}"`,
        };
      }

      try {
        if (isSignedIn) {
          const response = await fetch("/api/layouts", {
            body: JSON.stringify({
              title: trimmedTitle || "Untitled Layout",
              url: currentUrl,
            }),
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          const data = await parseLayoutsResponse(response);
          if (!data.layout) {
            throw new Error("Missing layout response");
          }
          setRemoteLayouts((current) => [data.layout!, ...current]);
          setLoadedLayoutId(data.layout.id);
          sessionStorage.setItem(LOADED_LAYOUT_KEY, data.layout.id);
          return { success: true };
        }

        const now = Date.now();
        const layout: SavedLayout = {
          id: crypto.randomUUID(),
          title: trimmedTitle || "Untitled Layout",
          url: currentUrl,
          createdAt: now,
          updatedAt: now,
        };
        syncLocalLayouts([...localLayouts, layout]);
        setLoadedLayoutId(layout.id);
        sessionStorage.setItem(LOADED_LAYOUT_KEY, layout.id);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save";
        return { success: false, error: message };
      }
    },
    [currentUrl, isNameTaken, isSignedIn, layouts, localLayouts, syncLocalLayouts],
  );

  const update = useCallback(
    async (id: string): Promise<LayoutMutationResult> => {
      const existingConfig = layouts.find(
        (layout) => layout.url === currentUrl && layout.id !== id,
      );
      if (existingConfig) {
        return {
          success: false,
          error: `This configuration is already saved as "${existingConfig.title}"`,
        };
      }

      try {
        if (isSignedIn) {
          const response = await fetch(`/api/layouts/${id}`, {
            body: JSON.stringify({ url: currentUrl }),
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            method: "PATCH",
          });
          const data = await parseLayoutsResponse(response);
          if (!data.layout) {
            throw new Error("Missing layout response");
          }
          setRemoteLayouts((current) =>
            current.map((layout) => (layout.id === id ? data.layout! : layout)),
          );
          return { success: true };
        }

        const updatedLayouts = localLayouts.map((layout) =>
          layout.id === id ? { ...layout, url: currentUrl, updatedAt: Date.now() } : layout,
        );
        syncLocalLayouts(updatedLayouts);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update";
        return { success: false, error: message };
      }
    },
    [currentUrl, isSignedIn, layouts, localLayouts, syncLocalLayouts],
  );

  const rename = useCallback(
    async (id: string, newTitle: string): Promise<LayoutMutationResult> => {
      const trimmedTitle = newTitle.trim();

      if (!trimmedTitle) {
        return { success: false, error: "Name cannot be empty" };
      }

      if (isNameTaken(trimmedTitle, id)) {
        return {
          success: false,
          error: "A layout with this name already exists",
        };
      }

      try {
        if (isSignedIn) {
          const response = await fetch(`/api/layouts/${id}`, {
            body: JSON.stringify({ title: trimmedTitle }),
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            method: "PATCH",
          });
          const data = await parseLayoutsResponse(response);
          if (!data.layout) {
            throw new Error("Missing layout response");
          }
          setRemoteLayouts((current) =>
            current.map((layout) => (layout.id === id ? data.layout! : layout)),
          );
          return { success: true };
        }

        const updatedLayouts = localLayouts.map((layout) =>
          layout.id === id ? { ...layout, title: trimmedTitle, updatedAt: Date.now() } : layout,
        );
        syncLocalLayouts(updatedLayouts);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to rename";
        return { success: false, error: message };
      }
    },
    [isNameTaken, isSignedIn, localLayouts, syncLocalLayouts],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        if (isSignedIn) {
          const response = await fetch(`/api/layouts/${id}`, {
            credentials: "include",
            method: "DELETE",
          });
          if (!response.ok) {
            throw new Error("Failed to delete layout");
          }
          setRemoteLayouts((current) => current.filter((layout) => layout.id !== id));
        } else {
          syncLocalLayouts(localLayouts.filter((layout) => layout.id !== id));
        }

        if (loadedLayoutId === id) {
          setLoadedLayoutId(null);
          sessionStorage.removeItem(LOADED_LAYOUT_KEY);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete layout";
        setRemoteError(message);
      }
    },
    [isSignedIn, loadedLayoutId, localLayouts, syncLocalLayouts],
  );

  const load = useCallback((layout: SavedLayout) => {
    setLoadedLayoutId(layout.id);
    setIsDetached(false);
    sessionStorage.setItem(LOADED_LAYOUT_KEY, layout.id);
    window.location.search = layout.url;
  }, []);

  const startFresh = useCallback(() => {
    setLoadedLayoutId(null);
    setIsDetached(true);
    sessionStorage.removeItem(LOADED_LAYOUT_KEY);
  }, []);

  return {
    existingLayoutForCurrentConfig,
    hasUnsavedChanges,
    isNameTaken,
    isRemoteLoading,
    isSignedIn,
    canImportLocal: isSignedIn && localLayouts.length > 0 && !hasDismissedImport,
    importLocalLayouts,
    layouts,
    load,
    loadedLayout,
    remoteError,
    remove,
    rename,
    save,
    startFresh,
    update,
  };
}

export type UseSavedLayoutsReturn = ReturnType<typeof useSavedLayouts>;
