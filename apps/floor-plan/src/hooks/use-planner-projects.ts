import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createId } from "@/lib/id";
import { getPlannerSnapshotHistoryKey, removePlannerHistoryState } from "@/lib/planner-history";
import { createDefaultPlannerState, normalizePlannerState } from "@/lib/planner-state";
import type {
  PlannerProject,
  PlannerProjectExport,
  PlannerProjectStore,
  PlannerSnapshot,
  RoomPlannerState,
} from "@/types";

interface LegacyPlannerSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  state: RoomPlannerState;
}

interface LegacyPlannerSessionStore {
  version: number;
  sessions: LegacyPlannerSession[];
}

interface PlannerProjectsState {
  activeProjectId: string;
  projects: PlannerProject[];
}

interface PlannerUrlSelection {
  projectId: string | null;
  snapshotId: string | null;
}

type UrlUpdateMode = "push" | "replace";

export const LEGACY_PLANNER_STORAGE_KEY = "floor-planner-state";
export const LEGACY_ACTIVE_SESSION_STORAGE_KEY = "floor-planner-active-session";
export const LEGACY_SESSIONS_STORAGE_KEY = "floor-planner-sessions";
export const PLANNER_ACTIVE_PROJECT_STORAGE_KEY = "floor-planner-active-project";
export const PLANNER_PROJECTS_STORAGE_KEY = "floor-planner-projects";
export const PLANNER_PROJECTS_STORAGE_VERSION = 1;

const PREVIOUS_PLANNER_STORAGE_KEY = "room-planner-state";
const PREVIOUS_ACTIVE_SESSION_STORAGE_KEY = "room-planner-active-session";
const PREVIOUS_SESSIONS_STORAGE_KEY = "room-planner-sessions";
const PREVIOUS_ACTIVE_PROJECT_STORAGE_KEY = "room-planner-active-project";
const PREVIOUS_PROJECTS_STORAGE_KEY = "room-planner-projects";

const DEFAULT_PROJECT_NAME = "Untitled Room";
const DEFAULT_SNAPSHOT_NAME = "Current Layout";
const PROJECT_ID_QUERY_PARAM = "projectId";
const SNAPSHOT_ID_QUERY_PARAM = "snapshotId";

function nowIso() {
  return new Date().toISOString();
}

function clonePlannerState(state: RoomPlannerState) {
  return structuredClone(state);
}

function formatUntitledProjectName(index: number) {
  return index === 1 ? DEFAULT_PROJECT_NAME : `${DEFAULT_PROJECT_NAME} ${index}`;
}

function getUniqueName(baseName: string, existingNames: Iterable<string>, fallbackName: string) {
  const trimmed = baseName.trim() || fallbackName;
  const names = new Set(existingNames);

  if (!names.has(trimmed)) {
    return trimmed;
  }

  let suffix = 2;
  while (names.has(`${trimmed} (${suffix})`)) {
    suffix += 1;
  }

  return `${trimmed} (${suffix})`;
}

function getUniqueProjectName(baseName: string, projects: PlannerProject[], excludeId?: string) {
  return getUniqueName(
    baseName,
    projects.filter((project) => project.id !== excludeId).map((project) => project.name),
    DEFAULT_PROJECT_NAME,
  );
}

function getUniqueSnapshotName(baseName: string, snapshots: PlannerSnapshot[], excludeId?: string) {
  return getUniqueName(
    baseName,
    snapshots.filter((snapshot) => snapshot.id !== excludeId).map((snapshot) => snapshot.name),
    DEFAULT_SNAPSHOT_NAME,
  );
}

function getNextUntitledProjectName(projects: PlannerProject[]) {
  let index = 1;
  while (projects.some((project) => project.name === formatUntitledProjectName(index))) {
    index += 1;
  }
  return formatUntitledProjectName(index);
}

function getNextVariationName(snapshots: PlannerSnapshot[]) {
  let index = 1;
  while (snapshots.some((snapshot) => snapshot.name === `Variation ${index}`)) {
    index += 1;
  }
  return `Variation ${index}`;
}

function createSnapshot(
  name: string,
  state: RoomPlannerState,
  snapshots: PlannerSnapshot[],
): PlannerSnapshot {
  const timestamp = nowIso();

  return {
    id: createId(),
    name: getUniqueSnapshotName(name, snapshots),
    createdAt: timestamp,
    updatedAt: timestamp,
    state: clonePlannerState(state),
  };
}

function normalizeSnapshot(
  snapshot: unknown,
  snapshots: PlannerSnapshot[],
): PlannerSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const parsed = snapshot as Partial<PlannerSnapshot>;
  const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : nowIso();
  const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : createdAt;

  return {
    id: typeof parsed.id === "string" ? parsed.id : createId(),
    name: getUniqueSnapshotName(
      typeof parsed.name === "string" ? parsed.name : DEFAULT_SNAPSHOT_NAME,
      snapshots,
    ),
    createdAt,
    updatedAt,
    state: normalizePlannerState(parsed.state),
  };
}

function createProject(
  name: string,
  state: RoomPlannerState,
  projects: PlannerProject[],
): PlannerProject {
  const timestamp = nowIso();
  const snapshot = createSnapshot(DEFAULT_SNAPSHOT_NAME, state, []);

  return {
    id: createId(),
    name: getUniqueProjectName(name, projects),
    createdAt: timestamp,
    updatedAt: timestamp,
    activeSnapshotId: snapshot.id,
    snapshots: [snapshot],
  };
}

function createDefaultProject(projects: PlannerProject[]) {
  return createProject(getNextUntitledProjectName(projects), createDefaultPlannerState(), projects);
}

function normalizeProjects(projects: unknown) {
  if (!Array.isArray(projects)) {
    return [] as PlannerProject[];
  }

  return projects.reduce<PlannerProject[]>((normalizedProjects, project) => {
    if (!project || typeof project !== "object") {
      return normalizedProjects;
    }

    const parsed = project as Partial<PlannerProject>;
    const normalizedSnapshots = Array.isArray(parsed.snapshots)
      ? parsed.snapshots.reduce<PlannerSnapshot[]>((snapshots, snapshot) => {
          const normalizedSnapshot = normalizeSnapshot(snapshot, snapshots);
          if (normalizedSnapshot) {
            snapshots.push(normalizedSnapshot);
          }
          return snapshots;
        }, [])
      : [];

    const snapshots =
      normalizedSnapshots.length > 0
        ? normalizedSnapshots
        : [createSnapshot(DEFAULT_SNAPSHOT_NAME, createDefaultPlannerState(), [])];
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : nowIso();
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : createdAt;
    const nextProject: PlannerProject = {
      id: typeof parsed.id === "string" ? parsed.id : createId(),
      name: getUniqueProjectName(
        typeof parsed.name === "string" ? parsed.name : DEFAULT_PROJECT_NAME,
        normalizedProjects,
      ),
      createdAt,
      updatedAt,
      activeSnapshotId: snapshots.some((snapshot) => snapshot.id === parsed.activeSnapshotId)
        ? parsed.activeSnapshotId!
        : snapshots[0].id,
      snapshots,
    };

    normalizedProjects.push(nextProject);
    return normalizedProjects;
  }, []);
}

function getActiveSnapshotForProject(project: PlannerProject) {
  return (
    project.snapshots.find((snapshot) => snapshot.id === project.activeSnapshotId) ??
    project.snapshots[0]
  );
}

function readPlannerUrlSelection(): PlannerUrlSelection {
  if (typeof window === "undefined") {
    return {
      projectId: null,
      snapshotId: null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get(PROJECT_ID_QUERY_PARAM);
  const snapshotId = searchParams.get(SNAPSHOT_ID_QUERY_PARAM);

  return {
    projectId: projectId && projectId.trim().length > 0 ? projectId : null,
    snapshotId: snapshotId && snapshotId.trim().length > 0 ? snapshotId : null,
  };
}

function applyPlannerUrlSelection(
  store: PlannerProjectsState,
  selection: PlannerUrlSelection,
): PlannerProjectsState {
  const fallbackProject =
    store.projects.find((project) => project.id === store.activeProjectId) ?? store.projects[0];

  if (!fallbackProject) {
    return store;
  }

  const activeProject =
    (selection.projectId
      ? store.projects.find((project) => project.id === selection.projectId)
      : null) ?? fallbackProject;
  const activeSnapshot =
    (selection.snapshotId
      ? activeProject.snapshots.find((snapshot) => snapshot.id === selection.snapshotId)
      : null) ?? getActiveSnapshotForProject(activeProject);

  if (
    store.activeProjectId === activeProject.id &&
    activeProject.activeSnapshotId === activeSnapshot.id
  ) {
    return store;
  }

  return {
    activeProjectId: activeProject.id,
    projects: store.projects.map((project) =>
      project.id === activeProject.id && project.activeSnapshotId !== activeSnapshot.id
        ? {
            ...project,
            activeSnapshotId: activeSnapshot.id,
          }
        : project,
    ),
  };
}

function writePlannerUrlSelection(projectId: string, snapshotId: string, mode: UrlUpdateMode) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (
    url.searchParams.get(PROJECT_ID_QUERY_PARAM) === projectId &&
    url.searchParams.get(SNAPSHOT_ID_QUERY_PARAM) === snapshotId
  ) {
    return;
  }

  url.searchParams.set(PROJECT_ID_QUERY_PARAM, projectId);
  url.searchParams.set(SNAPSHOT_ID_QUERY_PARAM, snapshotId);

  const nextUrl = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;

  if (mode === "push") {
    window.history.pushState(null, "", nextUrl);
    return;
  }

  window.history.replaceState(null, "", nextUrl);
}

function normalizeLegacySessions(sessions: unknown) {
  if (!Array.isArray(sessions)) {
    return [] as LegacyPlannerSession[];
  }

  return sessions.reduce<LegacyPlannerSession[]>((normalizedSessions, session) => {
    if (!session || typeof session !== "object") {
      return normalizedSessions;
    }

    const parsed = session as Partial<LegacyPlannerSession>;
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : nowIso();
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : createdAt;

    normalizedSessions.push({
      id: typeof parsed.id === "string" ? parsed.id : createId(),
      name:
        typeof parsed.name === "string" && parsed.name.trim().length > 0
          ? parsed.name
          : DEFAULT_PROJECT_NAME,
      createdAt,
      updatedAt,
      state: normalizePlannerState(parsed.state),
    });

    return normalizedSessions;
  }, []);
}

function migrateLegacySessionsToProjects(sessions: LegacyPlannerSession[]): PlannerProject[] {
  return sessions.reduce<PlannerProject[]>((projects, session) => {
    const snapshot: PlannerSnapshot = {
      id: createId(),
      name: DEFAULT_SNAPSHOT_NAME,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      state: clonePlannerState(session.state),
    };

    projects.push({
      id: session.id,
      name: getUniqueProjectName(session.name, projects),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      activeSnapshotId: snapshot.id,
      snapshots: [snapshot],
    });

    return projects;
  }, []);
}

function loadPlannerProjectsState(): PlannerProjectsState {
  try {
    const rawProjects =
      localStorage.getItem(PLANNER_PROJECTS_STORAGE_KEY) ??
      localStorage.getItem(PREVIOUS_PROJECTS_STORAGE_KEY);
    if (rawProjects) {
      const parsed = JSON.parse(rawProjects) as Partial<PlannerProjectStore>;
      const projects = normalizeProjects(parsed.projects);
      if (projects.length > 0) {
        const storedActiveId =
          localStorage.getItem(PLANNER_ACTIVE_PROJECT_STORAGE_KEY) ??
          localStorage.getItem(PREVIOUS_ACTIVE_PROJECT_STORAGE_KEY);
        const activeProjectId = projects.some((project) => project.id === storedActiveId)
          ? storedActiveId!
          : projects[0].id;

        return applyPlannerUrlSelection({ activeProjectId, projects }, readPlannerUrlSelection());
      }
    }
  } catch {
    // ignore corrupt storage and rebuild below
  }

  try {
    const rawSessions =
      localStorage.getItem(LEGACY_SESSIONS_STORAGE_KEY) ??
      localStorage.getItem(PREVIOUS_SESSIONS_STORAGE_KEY);
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions) as Partial<LegacyPlannerSessionStore>;
      const sessions = normalizeLegacySessions(parsed.sessions);
      if (sessions.length > 0) {
        const projects = migrateLegacySessionsToProjects(sessions);
        const storedActiveSessionId =
          localStorage.getItem(LEGACY_ACTIVE_SESSION_STORAGE_KEY) ??
          localStorage.getItem(PREVIOUS_ACTIVE_SESSION_STORAGE_KEY);
        const activeProjectId = projects.some((project) => project.id === storedActiveSessionId)
          ? storedActiveSessionId!
          : projects[0].id;

        return applyPlannerUrlSelection({ activeProjectId, projects }, readPlannerUrlSelection());
      }
    }
  } catch {
    // ignore corrupt storage and rebuild below
  }

  try {
    const rawLegacyState =
      localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY) ??
      localStorage.getItem(PREVIOUS_PLANNER_STORAGE_KEY);
    if (rawLegacyState) {
      const parsedLegacyState = JSON.parse(rawLegacyState) as Partial<RoomPlannerState>;
      const project = createProject(
        DEFAULT_PROJECT_NAME,
        normalizePlannerState(parsedLegacyState),
        [],
      );
      return applyPlannerUrlSelection(
        {
          activeProjectId: project.id,
          projects: [project],
        },
        readPlannerUrlSelection(),
      );
    }
  } catch {
    // ignore corrupt storage and rebuild below
  }

  const project = createDefaultProject([]);
  return applyPlannerUrlSelection(
    {
      activeProjectId: project.id,
      projects: [project],
    },
    readPlannerUrlSelection(),
  );
}

function persistPlannerProjectsState(store: PlannerProjectsState) {
  const serializedStore: PlannerProjectStore = {
    version: PLANNER_PROJECTS_STORAGE_VERSION,
    projects: store.projects,
  };

  localStorage.setItem(PLANNER_PROJECTS_STORAGE_KEY, JSON.stringify(serializedStore));
  localStorage.setItem(PLANNER_ACTIVE_PROJECT_STORAGE_KEY, store.activeProjectId);
  localStorage.removeItem(LEGACY_PLANNER_STORAGE_KEY);
  localStorage.removeItem(LEGACY_SESSIONS_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ACTIVE_SESSION_STORAGE_KEY);
  localStorage.removeItem(PREVIOUS_PLANNER_STORAGE_KEY);
  localStorage.removeItem(PREVIOUS_SESSIONS_STORAGE_KEY);
  localStorage.removeItem(PREVIOUS_ACTIVE_SESSION_STORAGE_KEY);
  localStorage.removeItem(PREVIOUS_ACTIVE_PROJECT_STORAGE_KEY);
  localStorage.removeItem(PREVIOUS_PROJECTS_STORAGE_KEY);
}

function getDuplicateProjectName(name: string) {
  return `${name} Copy`;
}

function getDuplicateSnapshotName(name: string) {
  return `${name} Copy`;
}

function duplicateProjectRecord(
  source: PlannerProject,
  projects: PlannerProject[],
): PlannerProject {
  const timestamp = nowIso();
  const snapshotIdMap = new Map<string, string>();
  const snapshots = source.snapshots.map((snapshot) => {
    const nextSnapshotId = createId();
    snapshotIdMap.set(snapshot.id, nextSnapshotId);

    return {
      id: nextSnapshotId,
      name: getUniqueSnapshotName(snapshot.name, []),
      createdAt: timestamp,
      updatedAt: timestamp,
      state: clonePlannerState(snapshot.state),
    };
  });

  return {
    id: createId(),
    name: getUniqueProjectName(getDuplicateProjectName(source.name), projects),
    createdAt: timestamp,
    updatedAt: timestamp,
    activeSnapshotId: snapshotIdMap.get(source.activeSnapshotId) ?? snapshots[0]?.id ?? createId(),
    snapshots,
  };
}

function buildImportedProject(
  exportedProject: PlannerProjectExport,
  projects: PlannerProject[],
): PlannerProject {
  const timestamp = nowIso();
  const snapshots = exportedProject.project.snapshots.reduce<PlannerSnapshot[]>(
    (nextSnapshots, snapshot) => {
      nextSnapshots.push({
        id: createId(),
        name: getUniqueSnapshotName(snapshot.name, nextSnapshots),
        createdAt: timestamp,
        updatedAt: timestamp,
        state: normalizePlannerState(snapshot.state),
      });
      return nextSnapshots;
    },
    [],
  );
  const activeSnapshotIndex = exportedProject.project.snapshots.findIndex(
    (snapshot) => snapshot.id === exportedProject.project.activeSnapshotId,
  );

  return {
    id: createId(),
    name: getUniqueProjectName(`${exportedProject.project.name} (Imported)`, projects),
    createdAt: timestamp,
    updatedAt: timestamp,
    activeSnapshotId: snapshots[activeSnapshotIndex]?.id ?? snapshots[0]?.id ?? createId(),
    snapshots:
      snapshots.length > 0
        ? snapshots
        : [createSnapshot(DEFAULT_SNAPSHOT_NAME, createDefaultPlannerState(), [])],
  };
}

function parsePlannerProjectExport(raw: string): PlannerProjectExport {
  const parsed = JSON.parse(raw) as Partial<PlannerProjectExport>;

  if (typeof parsed.version !== "number" || !parsed.project || typeof parsed.project !== "object") {
    throw new Error("Invalid project file.");
  }

  if (parsed.version !== PLANNER_PROJECTS_STORAGE_VERSION) {
    throw new Error("Unsupported project file version.");
  }

  const snapshots = Array.isArray(parsed.project.snapshots)
    ? parsed.project.snapshots.reduce<PlannerSnapshot[]>((nextSnapshots, snapshot) => {
        const normalizedSnapshot = normalizeSnapshot(snapshot, nextSnapshots);
        if (normalizedSnapshot) {
          nextSnapshots.push(normalizedSnapshot);
        }
        return nextSnapshots;
      }, [])
    : [];

  const createdAt =
    typeof parsed.project.createdAt === "string" ? parsed.project.createdAt : nowIso();
  const updatedAt =
    typeof parsed.project.updatedAt === "string" ? parsed.project.updatedAt : createdAt;

  return {
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : nowIso(),
    project: {
      name: typeof parsed.project.name === "string" ? parsed.project.name : DEFAULT_PROJECT_NAME,
      createdAt,
      updatedAt,
      activeSnapshotId:
        snapshots.find((snapshot) => snapshot.id === parsed.project?.activeSnapshotId)?.id ??
        snapshots[0]?.id ??
        createId(),
      snapshots:
        snapshots.length > 0
          ? snapshots
          : [createSnapshot(DEFAULT_SNAPSHOT_NAME, createDefaultPlannerState(), [])],
    },
  };
}

export function usePlannerProjects() {
  const [store, setStore] = useState(loadPlannerProjectsState);
  const nextUrlUpdateModeRef = useRef<UrlUpdateMode>("replace");

  useEffect(() => {
    persistPlannerProjectsState(store);
  }, [store]);

  const activeProject = useMemo(() => {
    return (
      store.projects.find((project) => project.id === store.activeProjectId) ?? store.projects[0]
    );
  }, [store.activeProjectId, store.projects]);

  const activeSnapshot = useMemo(() => {
    return getActiveSnapshotForProject(activeProject);
  }, [activeProject]);

  useEffect(() => {
    writePlannerUrlSelection(activeProject.id, activeSnapshot.id, nextUrlUpdateModeRef.current);
    nextUrlUpdateModeRef.current = "replace";
  }, [activeProject.id, activeSnapshot.id]);

  useEffect(() => {
    function handlePopState() {
      nextUrlUpdateModeRef.current = "replace";
      setStore((current) => applyPlannerUrlSelection(current, readPlannerUrlSelection()));
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const selectProject = useCallback((projectId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) =>
      current.projects.some((project) => project.id === projectId)
        ? { ...current, activeProjectId: projectId }
        : current,
    );
  }, []);

  const renameProject = useCallback((projectId: string, name: string) => {
    setStore((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              name: getUniqueProjectName(name, current.projects, projectId),
              updatedAt: nowIso(),
            }
          : project,
      ),
    }));
  }, []);

  const createProjectFromDefault = useCallback(() => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => {
      const nextProject = createDefaultProject(current.projects);
      return {
        activeProjectId: nextProject.id,
        projects: [...current.projects, nextProject],
      };
    });
  }, []);

  const duplicateProject = useCallback((projectId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => {
      const source = current.projects.find((project) => project.id === projectId);
      if (!source) {
        return current;
      }

      const nextProject = duplicateProjectRecord(source, current.projects);
      return {
        activeProjectId: nextProject.id,
        projects: [...current.projects, nextProject],
      };
    });
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => {
      const projectIndex = current.projects.findIndex((project) => project.id === projectId);
      if (projectIndex === -1) {
        return current;
      }

      current.projects[projectIndex]?.snapshots.forEach((snapshot) => {
        removePlannerHistoryState(getPlannerSnapshotHistoryKey(projectId, snapshot.id));
      });

      if (current.projects.length === 1) {
        const replacement = createDefaultProject([]);
        return {
          activeProjectId: replacement.id,
          projects: [replacement],
        };
      }

      const nextProjects = current.projects.filter((project) => project.id !== projectId);
      const nextActiveId =
        current.activeProjectId === projectId
          ? nextProjects[Math.min(projectIndex, nextProjects.length - 1)].id
          : current.activeProjectId;

      return {
        activeProjectId: nextActiveId,
        projects: nextProjects,
      };
    });
  }, []);

  const selectSnapshot = useCallback((projectId: string, snapshotId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => ({
      ...current,
      activeProjectId: current.projects.some((project) => project.id === projectId)
        ? projectId
        : current.activeProjectId,
      projects: current.projects.map((project) =>
        project.id === projectId && project.snapshots.some((snapshot) => snapshot.id === snapshotId)
          ? {
              ...project,
              activeSnapshotId: snapshotId,
            }
          : project,
      ),
    }));
  }, []);

  const renameSnapshot = useCallback((projectId: string, snapshotId: string, name: string) => {
    setStore((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              updatedAt: nowIso(),
              snapshots: project.snapshots.map((snapshot) =>
                snapshot.id === snapshotId
                  ? {
                      ...snapshot,
                      name: getUniqueSnapshotName(name, project.snapshots, snapshotId),
                      updatedAt: nowIso(),
                    }
                  : snapshot,
              ),
            }
          : project,
      ),
    }));
  }, []);

  const createSnapshotFromCurrent = useCallback((projectId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => ({
      ...current,
      activeProjectId: projectId,
      projects: current.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const source =
          project.snapshots.find((snapshot) => snapshot.id === project.activeSnapshotId) ??
          project.snapshots[0];
        const nextSnapshot = createSnapshot(
          getNextVariationName(project.snapshots),
          source.state,
          project.snapshots,
        );
        const timestamp = nowIso();

        return {
          ...project,
          updatedAt: timestamp,
          activeSnapshotId: nextSnapshot.id,
          snapshots: [...project.snapshots, nextSnapshot],
        };
      }),
    }));
  }, []);

  const duplicateSnapshot = useCallback((projectId: string, snapshotId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => ({
      ...current,
      activeProjectId: projectId,
      projects: current.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const source = project.snapshots.find((snapshot) => snapshot.id === snapshotId);
        if (!source) {
          return project;
        }

        const nextSnapshot = createSnapshot(
          getDuplicateSnapshotName(source.name),
          source.state,
          project.snapshots,
        );
        const timestamp = nowIso();

        return {
          ...project,
          updatedAt: timestamp,
          activeSnapshotId: nextSnapshot.id,
          snapshots: [...project.snapshots, nextSnapshot],
        };
      }),
    }));
  }, []);

  const deleteSnapshot = useCallback((projectId: string, snapshotId: string) => {
    nextUrlUpdateModeRef.current = "push";
    setStore((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const snapshotIndex = project.snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
        if (snapshotIndex === -1 || project.snapshots.length === 1) {
          return project;
        }

        removePlannerHistoryState(getPlannerSnapshotHistoryKey(projectId, snapshotId));

        const nextSnapshots = project.snapshots.filter((snapshot) => snapshot.id !== snapshotId);
        const nextActiveSnapshotId =
          project.activeSnapshotId === snapshotId
            ? nextSnapshots[Math.min(snapshotIndex, nextSnapshots.length - 1)].id
            : project.activeSnapshotId;

        return {
          ...project,
          updatedAt: nowIso(),
          activeSnapshotId: nextActiveSnapshotId,
          snapshots: nextSnapshots,
        };
      }),
    }));
  }, []);

  const updateSnapshotState = useCallback(
    (projectId: string, snapshotId: string, state: RoomPlannerState) => {
      setStore((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: nowIso(),
                snapshots: project.snapshots.map((snapshot) =>
                  snapshot.id === snapshotId
                    ? {
                        ...snapshot,
                        state: clonePlannerState(state),
                        updatedAt: nowIso(),
                      }
                    : snapshot,
                ),
              }
            : project,
        ),
      }));
    },
    [],
  );

  const exportProject = useCallback(
    (projectId: string) => {
      const project = store.projects.find((entry) => entry.id === projectId);
      if (!project) {
        return null;
      }

      const payload: PlannerProjectExport = {
        version: PLANNER_PROJECTS_STORAGE_VERSION,
        exportedAt: nowIso(),
        project: {
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          activeSnapshotId: project.activeSnapshotId,
          snapshots: project.snapshots.map((snapshot) => ({
            id: snapshot.id,
            name: snapshot.name,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            state: clonePlannerState(snapshot.state),
          })),
        },
      };

      return JSON.stringify(payload, null, 2);
    },
    [store.projects],
  );

  const importProject = useCallback((raw: string) => {
    const imported = parsePlannerProjectExport(raw);
    nextUrlUpdateModeRef.current = "push";

    setStore((current) => {
      const nextProject = buildImportedProject(imported, current.projects);
      return {
        activeProjectId: nextProject.id,
        projects: [...current.projects, nextProject],
      };
    });
  }, []);

  return {
    activeProject,
    activeProjectId: activeProject.id,
    activeSnapshot,
    activeSnapshotId: activeSnapshot.id,
    createProject: createProjectFromDefault,
    createSnapshot: createSnapshotFromCurrent,
    deleteProject,
    deleteSnapshot,
    duplicateProject,
    duplicateSnapshot,
    exportProject,
    importProject,
    projects: store.projects,
    renameProject,
    renameSnapshot,
    selectProject,
    selectSnapshot,
    updateSnapshotState,
  };
}

export type PlannerProjectsReturn = ReturnType<typeof usePlannerProjects>;
