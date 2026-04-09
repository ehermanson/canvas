import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  LEGACY_ACTIVE_SESSION_STORAGE_KEY,
  LEGACY_PLANNER_STORAGE_KEY,
  LEGACY_SESSIONS_STORAGE_KEY,
  PLANNER_ACTIVE_PROJECT_STORAGE_KEY,
  PLANNER_PROJECTS_STORAGE_KEY,
  PLANNER_PROJECTS_STORAGE_VERSION,
  usePlannerProjects,
} from "@/hooks/use-planner-projects";
import type { PlannerProjectExport, RoomPlannerState } from "@/types";

function createPlannerState(overrides: Partial<RoomPlannerState> = {}): RoomPlannerState {
  return {
    unit: "in",
    room: {
      endpoints: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 144, y: 0 },
        { id: "c", x: 144, y: 120 },
        { id: "d", x: 0, y: 120 },
      ],
      walls: [
        { id: "w1", startId: "a", endId: "b", features: [] },
        { id: "w2", startId: "b", endId: "c", features: [] },
        { id: "w3", startId: "c", endId: "d", features: [] },
        { id: "w4", startId: "d", endId: "a", features: [] },
      ],
    },
    furniture: [],
    gridSnap: 1,
    showMeasurements: true,
    showGrid: true,
    neutralFurnitureColors: false,
    ...overrides,
  };
}

function resetUrl() {
  window.history.replaceState(null, "", "/");
}

describe("usePlannerProjects", () => {
  beforeEach(() => {
    localStorage.clear();
    resetUrl();
  });

  it("migrates the legacy single-state storage into one project with one snapshot", () => {
    localStorage.setItem(LEGACY_PLANNER_STORAGE_KEY, JSON.stringify(createPlannerState()));

    const { result } = renderHook(() => usePlannerProjects());

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.activeProject.name).toBe("Untitled Room");
    expect(result.current.activeSnapshot.name).toBe("Current Layout");
    expect(localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PLANNER_PROJECTS_STORAGE_KEY)).toBeNull();
  });

  it("migrates flat legacy sessions into projects and preserves the active selection", () => {
    localStorage.setItem(
      LEGACY_SESSIONS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sessions: [
          {
            id: "session-1",
            name: "Bedroom A",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            state: createPlannerState(),
          },
          {
            id: "session-2",
            name: "Bedroom B",
            createdAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            state: createPlannerState({ gridSnap: 0 }),
          },
        ],
      }),
    );
    localStorage.setItem(LEGACY_ACTIVE_SESSION_STORAGE_KEY, "session-2");

    const { result } = renderHook(() => usePlannerProjects());

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.activeProjectId).toBe("session-2");
    expect(result.current.activeProject.name).toBe("Bedroom B");
    expect(result.current.activeSnapshot.name).toBe("Current Layout");
    expect(result.current.activeSnapshot.state.gridSnap).toBe(0);
    expect(localStorage.getItem(LEGACY_SESSIONS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_ACTIVE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("creates, duplicates, renames, selects, and deletes projects", () => {
    const { result } = renderHook(() => usePlannerProjects());

    act(() => {
      result.current.createProject();
    });

    const createdProjectId = result.current.activeProjectId;
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.activeProject.name).toBe("Untitled Room 2");

    act(() => {
      result.current.renameProject(createdProjectId, "Primary Bedroom");
      result.current.duplicateProject(createdProjectId);
    });

    expect(result.current.projects).toHaveLength(3);
    expect(result.current.activeProject.name).toBe("Primary Bedroom Copy");

    const firstProjectId = result.current.projects[0].id;
    act(() => {
      result.current.selectProject(firstProjectId);
    });
    expect(result.current.activeProjectId).toBe(firstProjectId);

    act(() => {
      result.current.deleteProject(firstProjectId);
    });
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.activeProjectId).not.toBe(firstProjectId);
  });

  it("replaces the last deleted project with a fresh default project", () => {
    const { result } = renderHook(() => usePlannerProjects());
    const initialProjectId = result.current.activeProjectId;

    act(() => {
      result.current.deleteProject(initialProjectId);
    });

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.activeProjectId).not.toBe(initialProjectId);
    expect(result.current.activeProject.name).toBe("Untitled Room");
    expect(result.current.activeProject.snapshots).toHaveLength(1);
  });

  it("creates, duplicates, renames, selects, and deletes snapshots within a project", () => {
    const { result } = renderHook(() => usePlannerProjects());
    const projectId = result.current.activeProjectId;
    const originalSnapshotId = result.current.activeSnapshotId;

    act(() => {
      result.current.createSnapshot(projectId);
    });

    const createdSnapshotId = result.current.activeSnapshotId;
    expect(result.current.activeSnapshot.name).toBe("Variation 1");

    act(() => {
      result.current.renameSnapshot(projectId, createdSnapshotId, "Desk by Window");
      result.current.duplicateSnapshot(projectId, createdSnapshotId);
    });

    expect(result.current.activeSnapshot.name).toBe("Desk by Window Copy");
    expect(result.current.activeProject.snapshots).toHaveLength(3);

    act(() => {
      result.current.selectSnapshot(projectId, originalSnapshotId);
    });
    expect(result.current.activeSnapshotId).toBe(originalSnapshotId);

    act(() => {
      result.current.deleteSnapshot(projectId, originalSnapshotId);
    });
    expect(result.current.activeProject.snapshots).toHaveLength(2);

    act(() => {
      result.current.deleteSnapshot(projectId, result.current.activeSnapshotId);
      result.current.deleteSnapshot(projectId, result.current.activeSnapshotId);
    });
    expect(result.current.activeProject.snapshots).toHaveLength(1);
  });

  it("autosaves active snapshot state updates and keeps the active project key in sync", () => {
    const { result } = renderHook(() => usePlannerProjects());

    act(() => {
      result.current.updateSnapshotState(
        result.current.activeProjectId,
        result.current.activeSnapshotId,
        createPlannerState({ gridSnap: 0 }),
      );
    });

    const storedActiveId = localStorage.getItem(PLANNER_ACTIVE_PROJECT_STORAGE_KEY);
    const storedProjects = localStorage.getItem(PLANNER_PROJECTS_STORAGE_KEY);

    expect(storedActiveId).toBe(result.current.activeProjectId);
    expect(storedProjects).toContain('"gridSnap":0');
  });

  it("syncs the active project and snapshot ids into the URL", () => {
    const { result } = renderHook(() => usePlannerProjects());

    let params = new URLSearchParams(window.location.search);
    expect(params.get("projectId")).toBe(result.current.activeProjectId);
    expect(params.get("snapshotId")).toBe(result.current.activeSnapshotId);

    act(() => {
      result.current.createSnapshot(result.current.activeProjectId);
    });

    params = new URLSearchParams(window.location.search);
    expect(params.get("projectId")).toBe(result.current.activeProjectId);
    expect(params.get("snapshotId")).toBe(result.current.activeSnapshotId);
  });

  it("prefers URL-selected project and snapshot ids on initial load", () => {
    localStorage.setItem(
      PLANNER_PROJECTS_STORAGE_KEY,
      JSON.stringify({
        version: PLANNER_PROJECTS_STORAGE_VERSION,
        projects: [
          {
            id: "project-1",
            name: "Living Room",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            activeSnapshotId: "snapshot-1a",
            snapshots: [
              {
                id: "snapshot-1a",
                name: "Current Layout",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
                state: createPlannerState(),
              },
            ],
          },
          {
            id: "project-2",
            name: "Guest Room",
            createdAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            activeSnapshotId: "snapshot-2a",
            snapshots: [
              {
                id: "snapshot-2a",
                name: "Current Layout",
                createdAt: "2026-01-02T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
                state: createPlannerState(),
              },
              {
                id: "snapshot-2b",
                name: "Desk by Window",
                createdAt: "2026-01-03T00:00:00.000Z",
                updatedAt: "2026-01-03T00:00:00.000Z",
                state: createPlannerState({ gridSnap: 0 }),
              },
            ],
          },
        ],
      }),
    );
    localStorage.setItem(PLANNER_ACTIVE_PROJECT_STORAGE_KEY, "project-1");
    window.history.replaceState(null, "", "/?projectId=project-2&snapshotId=snapshot-2b");

    const { result } = renderHook(() => usePlannerProjects());

    expect(result.current.activeProjectId).toBe("project-2");
    expect(result.current.activeSnapshotId).toBe("snapshot-2b");
    expect(result.current.activeSnapshot.state.gridSnap).toBe(0);
  });

  it("updates the active selection when the browser history changes", () => {
    const { result } = renderHook(() => usePlannerProjects());
    const initialProjectId = result.current.activeProjectId;
    const initialSnapshotId = result.current.activeSnapshotId;

    act(() => {
      result.current.createProject();
    });

    const nextProjectId = result.current.activeProjectId;
    const nextSnapshotId = result.current.activeSnapshotId;
    expect(nextProjectId).not.toBe(initialProjectId);
    expect(nextSnapshotId).not.toBe(initialSnapshotId);

    act(() => {
      window.history.pushState(
        null,
        "",
        `/?projectId=${initialProjectId}&snapshotId=${initialSnapshotId}`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.activeProjectId).toBe(initialProjectId);
    expect(result.current.activeSnapshotId).toBe(initialSnapshotId);
  });

  it("exports and imports a project with new local ids and a unique name", () => {
    const { result } = renderHook(() => usePlannerProjects());

    act(() => {
      result.current.createSnapshot(result.current.activeProjectId);
    });

    const exported = result.current.exportProject(result.current.activeProjectId);
    expect(exported).not.toBeNull();

    act(() => {
      result.current.importProject(exported!);
    });

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.activeProject.name).toBe("Untitled Room (Imported)");
    expect(result.current.activeProject.id).not.toBe(result.current.projects[0].id);
    expect(result.current.activeProject.snapshots).toHaveLength(2);
  });

  it("rejects invalid imported project files", () => {
    const { result } = renderHook(() => usePlannerProjects());

    expect(() => {
      act(() => {
        result.current.importProject('{"version":999}');
      });
    }).toThrow("Invalid project file.");
  });

  it("exports the expected versioned project payload", () => {
    const { result } = renderHook(() => usePlannerProjects());
    const payload = JSON.parse(
      result.current.exportProject(result.current.activeProjectId)!,
    ) as PlannerProjectExport;

    expect(payload.version).toBe(PLANNER_PROJECTS_STORAGE_VERSION);
    expect(payload.project.name).toBe("Untitled Room");
    expect(payload.project.snapshots).toHaveLength(1);
    expect(payload.project.snapshots[0]?.state.room.endpoints).toHaveLength(4);
  });
});
