import { useCallback, useEffect, useMemo, useState } from 'react';
import { PULLOUT_SOFA_DEFAULTS } from '@/data/furniture-presets';
import { createId } from '@/lib/id';
import {
  areHistoryEntriesEqual,
  createHistoryEntry,
  loadPlannerHistoryState,
  persistPlannerHistoryState,
} from '@/lib/planner-history';
import {
  createDefaultPlannerState,
  normalizePlannerState,
  verticesToRoom,
} from '@/lib/planner-state';
import { syncPulloutSofaItem } from '@/lib/pullout-sofa';
import {
  findRoomPolygon,
  getBounds,
  getWallLength,
  rotatePointAround,
} from '@/lib/room-geometry';
import type {
  FurnitureItem,
  FurniturePreset,
  PlannerHistoryState,
  Point,
  PulloutBedSize,
  PulloutSofaState,
  Room,
  RoomPlannerState,
  Unit,
  Wall,
  WallEndpoint,
  WallFeature,
} from '@/types';

const UNIT_STORAGE_KEY = 'room-planner-unit';

const MAX_HISTORY = 50;

function summarizeHistoryEntry(entry: {
  furniture: FurnitureItem[];
  room: Room;
}) {
  return {
    endpointCount: entry.room.endpoints.length,
    furnitureCount: entry.furniture.length,
    wallCount: entry.room.walls.length,
  };
}

function normalizeRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

export function useRoomPlanner(
  initialState?: RoomPlannerState,
  historyKey?: string,
) {
  const [initialPlannerState] = useState(() => {
    const savedUnit = localStorage.getItem(UNIT_STORAGE_KEY);
    const fallbackUnit = savedUnit === 'cm' ? 'cm' : 'in';
    return normalizePlannerState(
      initialState ?? createDefaultPlannerState(fallbackUnit),
      fallbackUnit,
    );
  });
  const [historyState, setHistoryState] = useState<PlannerHistoryState>(() =>
    loadPlannerHistoryState(
      historyKey ?? null,
      initialPlannerState.room,
      initialPlannerState.furniture,
    ),
  );
  const [unit, setUnitState] = useState<Unit>(initialPlannerState.unit);
  const [room, setRoom] = useState(historyState.present.room);
  const [furniture, setFurniture] = useState(historyState.present.furniture);
  const [gridSnap, setGridSnap] = useState(initialPlannerState.gridSnap);
  const [showMeasurements, setShowMeasurements] = useState(
    initialPlannerState.showMeasurements,
  );
  const [showGrid, setShowGrid] = useState(initialPlannerState.showGrid);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [activeHistoryKey, setActiveHistoryKey] = useState(historyKey ?? null);

  const applyHistoryState = useCallback(
    (nextHistoryState: PlannerHistoryState) => {
      setHistoryState(nextHistoryState);
      setRoom(structuredClone(nextHistoryState.present.room));
      setFurniture(structuredClone(nextHistoryState.present.furniture));
    },
    [],
  );

  const pushHistory = useCallback(
    (newRoom: Room, newFurniture: FurnitureItem[]) => {
      const nextEntry = createHistoryEntry(newRoom, newFurniture);
      setHistoryState((prev) => {
        if (areHistoryEntriesEqual(prev.present, nextEntry)) {
          return prev;
        }

        const nextPast = [
          ...prev.past,
          createHistoryEntry(prev.present.room, prev.present.furniture),
        ];
        if (nextPast.length > MAX_HISTORY) {
          nextPast.shift();
        }

        return {
          future: [],
          navigationLocked: false,
          past: nextPast,
          present: nextEntry,
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (historyState.past.length === 0) return;
    const entry = historyState.past[historyState.past.length - 1];
    if (!entry) return;
    applyHistoryState({
      future: [createHistoryEntry(room, furniture), ...historyState.future],
      navigationLocked:
        historyState.navigationLocked &&
        historyState.past.length + historyState.future.length > 0,
      past: historyState.past.slice(0, -1),
      present: createHistoryEntry(entry.room, entry.furniture),
    });
  }, [applyHistoryState, furniture, historyState, room]);

  const redo = useCallback(() => {
    if (historyState.future.length === 0) return;
    const entry = historyState.future[0];
    if (!entry) return;
    const nextFuture = historyState.future.slice(1);
    applyHistoryState({
      future: nextFuture,
      navigationLocked: historyState.navigationLocked && nextFuture.length > 0,
      past: [...historyState.past, createHistoryEntry(room, furniture)].slice(
        -MAX_HISTORY,
      ),
      present: createHistoryEntry(entry.room, entry.furniture),
    });
  }, [applyHistoryState, furniture, historyState, room]);

  const jumpToHistory = useCallback(
    (position: number) => {
      const timeline = [
        ...historyState.past,
        historyState.present,
        ...historyState.future,
      ];
      const target = timeline[position];
      if (!target || position === historyState.past.length) {
        return;
      }

      applyHistoryState({
        future: timeline
          .slice(position + 1)
          .map((entry) => createHistoryEntry(entry.room, entry.furniture)),
        navigationLocked: position < timeline.length - 1,
        past: timeline
          .slice(0, position)
          .map((entry) => createHistoryEntry(entry.room, entry.furniture)),
        present: createHistoryEntry(target.room, target.furniture),
      });
    },
    [applyHistoryState, historyState],
  );

  const canUndo = historyState.past.length > 0;
  const canRedo = historyState.future.length > 0;
  const isHistoryEditingLocked = historyState.navigationLocked;

  const returnToLatestHistory = useCallback(() => {
    const latestPosition =
      historyState.past.length + historyState.future.length;
    jumpToHistory(latestPosition);
  }, [historyState.future.length, historyState.past.length, jumpToHistory]);

  const discardFutureHistory = useCallback(() => {
    if (historyState.future.length === 0) {
      return;
    }

    applyHistoryState({
      future: [],
      navigationLocked: false,
      past: historyState.past.map((entry) =>
        createHistoryEntry(entry.room, entry.furniture),
      ),
      present: createHistoryEntry(
        historyState.present.room,
        historyState.present.furniture,
      ),
    });
  }, [
    applyHistoryState,
    historyState.future.length,
    historyState.past,
    historyState.present,
  ]);

  // ── Unit conversion ──
  const CM_PER_INCH = 2.54;

  const toDisplay = useCallback(
    (inches: number) => (unit === 'cm' ? inches * CM_PER_INCH : inches),
    [unit],
  );

  const fromDisplay = useCallback(
    (value: number) => (unit === 'cm' ? value / CM_PER_INCH : value),
    [unit],
  );

  const setUnit = useCallback((u: Unit) => {
    setUnitState(u);
  }, []);

  const loadState = useCallback(
    (nextState: RoomPlannerState, nextHistoryKey?: string | null) => {
      const normalized = normalizePlannerState(nextState);
      const restoredHistoryState = loadPlannerHistoryState(
        nextHistoryKey ?? activeHistoryKey,
        normalized.room,
        normalized.furniture,
      );
      setUnitState(normalized.unit);
      setRoom(restoredHistoryState.present.room);
      setFurniture(restoredHistoryState.present.furniture);
      setGridSnap(normalized.gridSnap);
      setShowMeasurements(normalized.showMeasurements);
      setShowGrid(normalized.showGrid);
      setSelectedIds([]);
      setSelectedWallId(null);
      applyHistoryState(restoredHistoryState);
      setActiveHistoryKey(nextHistoryKey ?? activeHistoryKey);
    },
    [activeHistoryKey, applyHistoryState],
  );

  const selectedId =
    selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIds(id ? [id] : []);
  }, []);

  const toggleSelectedId = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
    );
  }, []);

  // ── Endpoint helpers ──

  const getEndpoint = useCallback(
    (id: string): WallEndpoint | undefined =>
      room.endpoints.find((e) => e.id === id),
    [room.endpoints],
  );

  const getWallsForEndpoint = useCallback(
    (endpointId: string): Wall[] =>
      room.walls.filter(
        (w) => w.startId === endpointId || w.endId === endpointId,
      ),
    [room.walls],
  );

  // ── Endpoint mutations ──

  /** Live-update endpoint position during drag (no history push) */
  const moveEndpoint = useCallback((id: string, point: Point) => {
    setRoom((prev) => ({
      ...prev,
      endpoints: prev.endpoints.map((ep) =>
        ep.id === id ? { ...ep, x: point.x, y: point.y } : ep,
      ),
    }));
  }, []);

  /** Push history after drag ends */
  const commitEndpointMove = useCallback(() => {
    setRoom((prev) => {
      pushHistory(prev, furniture);
      return prev;
    });
  }, [furniture, pushHistory]);

  /** Create a new wall from an existing endpoint to a new point. Returns new endpoint ID. */
  const addWallToNewPoint = useCallback(
    (fromEndpointId: string, toPoint: Point): string => {
      const newEpId = createId();
      setRoom((prev) => {
        const newEndpoint: WallEndpoint = {
          id: newEpId,
          x: toPoint.x,
          y: toPoint.y,
        };
        const newWall: Wall = {
          id: createId(),
          startId: fromEndpointId,
          endId: newEpId,
          features: [],
        };
        const updated = {
          ...prev,
          endpoints: [...prev.endpoints, newEndpoint],
          walls: [...prev.walls, newWall],
        };
        pushHistory(updated, furniture);
        return updated;
      });
      return newEpId;
    },
    [furniture, pushHistory],
  );

  /** Create a wall between two existing endpoints */
  const addWallBetweenEndpoints = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      setRoom((prev) => {
        // Don't create duplicate wall
        const exists = prev.walls.some(
          (w) =>
            (w.startId === fromId && w.endId === toId) ||
            (w.startId === toId && w.endId === fromId),
        );
        if (exists) return prev;

        const newWall: Wall = {
          id: createId(),
          startId: fromId,
          endId: toId,
          features: [],
        };
        const updated = {
          ...prev,
          walls: [...prev.walls, newWall],
        };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  /** Merge sourceEndpoint into targetEndpoint (connect) */
  const mergeEndpoints = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setRoom((prev) => {
        const walls = prev.walls.map((w) => ({
          ...w,
          startId: w.startId === sourceId ? targetId : w.startId,
          endId: w.endId === sourceId ? targetId : w.endId,
        }));
        // Remove duplicate walls (same start+end)
        const seen = new Set<string>();
        const dedupedWalls = walls.filter((w) => {
          if (w.startId === w.endId) return false; // self-loop
          const key = [w.startId, w.endId].sort().join('-');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const endpoints = prev.endpoints.filter((ep) => ep.id !== sourceId);
        const updated = { ...prev, endpoints, walls: dedupedWalls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  /** Disconnect an endpoint from a specific wall (split shared endpoint) */
  const disconnectEndpoint = useCallback(
    (endpointId: string, wallId: string) => {
      setRoom((prev) => {
        const wall = prev.walls.find((w) => w.id === wallId);
        if (!wall) return prev;
        const ep = prev.endpoints.find((e) => e.id === endpointId);
        if (!ep) return prev;

        // Only disconnect if endpoint is shared by multiple walls
        const connectedWalls = prev.walls.filter(
          (w) => w.startId === endpointId || w.endId === endpointId,
        );
        if (connectedWalls.length < 2) return prev;

        const newEp: WallEndpoint = {
          id: createId(),
          x: ep.x,
          y: ep.y,
        };
        const walls = prev.walls.map((w) => {
          if (w.id !== wallId) return w;
          return {
            ...w,
            startId: w.startId === endpointId ? newEp.id : w.startId,
            endId: w.endId === endpointId ? newEp.id : w.endId,
          };
        });
        const updated = {
          ...prev,
          endpoints: [...prev.endpoints, newEp],
          walls,
        };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  /** Split a shared endpoint apart: each wall gets its own endpoint, nudged along its direction */
  const splitEndpoint = useCallback(
    (endpointId: string, offset = 10) => {
      setRoom((prev) => {
        const ep = prev.endpoints.find((e) => e.id === endpointId);
        if (!ep) return prev;

        const connectedWalls = prev.walls.filter(
          (w) => w.startId === endpointId || w.endId === endpointId,
        );
        if (connectedWalls.length < 2) return prev;

        const epMap = new Map(prev.endpoints.map((e) => [e.id, e]));
        const newEndpoints: WallEndpoint[] = [];
        let walls = [...prev.walls];

        // For each wall, compute the nudge direction (toward the wall's other end)
        for (let i = 0; i < connectedWalls.length; i++) {
          const w = connectedWalls[i];
          const otherId = w.startId === endpointId ? w.endId : w.startId;
          const other = epMap.get(otherId);
          let dx = 0;
          let dy = 0;
          if (other) {
            const len = Math.sqrt(
              (other.x - ep.x) ** 2 + (other.y - ep.y) ** 2,
            );
            if (len > 0) {
              dx = ((other.x - ep.x) / len) * offset;
              dy = ((other.y - ep.y) / len) * offset;
            }
          }

          if (i === 0) {
            // First wall keeps the original endpoint, just nudge it
            newEndpoints.push({ ...ep, x: ep.x + dx, y: ep.y + dy });
          } else {
            // Other walls get new endpoints
            const newEp: WallEndpoint = {
              id: createId(),
              x: ep.x + dx,
              y: ep.y + dy,
            };
            newEndpoints.push(newEp);
            walls = walls.map((wall) => {
              if (wall.id !== w.id) return wall;
              return {
                ...wall,
                startId: wall.startId === endpointId ? newEp.id : wall.startId,
                endId: wall.endId === endpointId ? newEp.id : wall.endId,
              };
            });
          }
        }

        // Replace the original endpoint with its nudged version, add new ones
        const endpoints = prev.endpoints.map((e) =>
          e.id === endpointId ? newEndpoints[0] : e,
        );
        for (let i = 1; i < newEndpoints.length; i++) {
          endpoints.push(newEndpoints[i]);
        }

        const updated = { ...prev, endpoints, walls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  /** Remove a wall segment and clean up orphaned endpoints */
  const removeWall = useCallback(
    (wallId: string) => {
      setRoom((prev) => {
        const wall = prev.walls.find((w) => w.id === wallId);
        if (!wall) return prev;

        const walls = prev.walls.filter((w) => w.id !== wallId);
        // Remove orphaned endpoints
        const usedIds = new Set<string>();
        for (const w of walls) {
          usedIds.add(w.startId);
          usedIds.add(w.endId);
        }
        const endpoints = prev.endpoints.filter((ep) => usedIds.has(ep.id));
        const updated = { ...prev, endpoints, walls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  // ── Wall length editing ──

  const setWallLength = useCallback(
    (wallId: string, newLength: number) => {
      setRoom((prev) => {
        const wall = prev.walls.find((w) => w.id === wallId);
        if (!wall) return prev;
        const a = prev.endpoints.find((e) => e.id === wall.startId);
        const b = prev.endpoints.find((e) => e.id === wall.endId);
        if (!a || !b) return prev;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const currentLen = Math.sqrt(dx * dx + dy * dy);
        if (currentLen === 0) return prev;

        const scale = newLength / currentLen;
        const newBx = a.x + dx * scale;
        const newBy = a.y + dy * scale;

        const endpoints = prev.endpoints.map((ep) =>
          ep.id === wall.endId ? { ...ep, x: newBx, y: newBy } : ep,
        );
        const updated = { ...prev, endpoints };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  // ── Wall features ──

  const addWallFeature = useCallback(
    (wallId: string, feature: Omit<WallFeature, 'id'>) => {
      setRoom((prev) => {
        const walls = prev.walls.map((w) =>
          w.id === wallId
            ? {
                ...w,
                features: [...w.features, { ...feature, id: createId() }],
              }
            : w,
        );
        const updated = { ...prev, walls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  const updateWallFeature = useCallback(
    (wallId: string, featureId: string, updates: Partial<WallFeature>) => {
      setRoom((prev) => {
        const walls = prev.walls.map((w) =>
          w.id === wallId
            ? {
                ...w,
                features: w.features.map((f) =>
                  f.id === featureId ? { ...f, ...updates } : f,
                ),
              }
            : w,
        );
        const updated = { ...prev, walls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  const removeWallFeature = useCallback(
    (wallId: string, featureId: string) => {
      setRoom((prev) => {
        const walls = prev.walls.map((w) =>
          w.id === wallId
            ? { ...w, features: w.features.filter((f) => f.id !== featureId) }
            : w,
        );
        const updated = { ...prev, walls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  /** Move a wall feature during drag (no history push) */
  const moveWallFeature = useCallback(
    (wallId: string, featureId: string, newOffset: number) => {
      setRoom((prev) => {
        const walls = prev.walls.map((w) =>
          w.id === wallId
            ? {
                ...w,
                features: w.features.map((f) =>
                  f.id === featureId ? { ...f, offset: newOffset } : f,
                ),
              }
            : w,
        );
        return { ...prev, walls };
      });
    },
    [],
  );

  const commitFeatureMove = useCallback(() => {
    setRoom((prev) => {
      pushHistory(prev, furniture);
      return prev;
    });
  }, [furniture, pushHistory]);

  /** Transfer a feature from one wall to another during drag (no history push) */
  const moveFeatureToWall = useCallback(
    (
      fromWallId: string,
      toWallId: string,
      featureId: string,
      newOffset: number,
    ) => {
      setRoom((prev) => {
        const fromWall = prev.walls.find((w) => w.id === fromWallId);
        if (!fromWall) return prev;
        const feature = fromWall.features.find((f) => f.id === featureId);
        if (!feature) return prev;

        const walls = prev.walls.map((w) => {
          if (w.id === fromWallId) {
            return {
              ...w,
              features: w.features.filter((f) => f.id !== featureId),
            };
          }
          if (w.id === toWallId) {
            return {
              ...w,
              features: [...w.features, { ...feature, offset: newOffset }],
            };
          }
          return w;
        });
        return { ...prev, walls };
      });
    },
    [],
  );

  const translateWall = useCallback(
    (wallId: string, dx: number, dy: number) => {
      setRoom((prev) => {
        const wall = prev.walls.find((entry) => entry.id === wallId);
        if (!wall) return prev;

        const endpoints = prev.endpoints.map((endpoint) =>
          endpoint.id === wall.startId || endpoint.id === wall.endId
            ? { ...endpoint, x: endpoint.x + dx, y: endpoint.y + dy }
            : endpoint,
        );
        const updated = { ...prev, endpoints };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  const nudgeWallFeature = useCallback(
    (wallId: string, featureId: string, delta: number) => {
      setRoom((prev) => {
        const wall = prev.walls.find((entry) => entry.id === wallId);
        if (!wall) return prev;

        const start = prev.endpoints.find(
          (endpoint) => endpoint.id === wall.startId,
        );
        const end = prev.endpoints.find(
          (endpoint) => endpoint.id === wall.endId,
        );
        const feature = wall.features.find((entry) => entry.id === featureId);
        if (!start || !end || !feature) return prev;

        const wallLength = getWallLength(start, end);
        const nextOffset = Math.max(
          0,
          Math.min(wallLength - feature.width, feature.offset + delta),
        );

        const walls = prev.walls.map((entry) =>
          entry.id === wallId
            ? {
                ...entry,
                features: entry.features.map((wallFeature) =>
                  wallFeature.id === featureId
                    ? { ...wallFeature, offset: nextOffset }
                    : wallFeature,
                ),
              }
            : entry,
        );
        const updated = { ...prev, walls };
        pushHistory(updated, furniture);
        return updated;
      });
    },
    [furniture, pushHistory],
  );

  // ── Furniture mutations ──

  const applyFurnitureFrame = useCallback(
    (
      item: FurnitureItem,
      frame: Pick<FurnitureItem, 'depth' | 'width' | 'x' | 'y'>,
    ) => {
      if (!item.pulloutSofa) {
        return {
          ...item,
          ...frame,
        };
      }

      const pulloutSofa = item.pulloutSofa.isOpen
        ? {
            ...item.pulloutSofa,
            closedWidth: frame.width,
            openWidth: frame.width,
            openDepth: frame.depth,
          }
        : {
            ...item.pulloutSofa,
            closedWidth: frame.width,
            openWidth: frame.width,
            closedDepth: frame.depth,
          };

      return syncPulloutSofaItem(
        {
          ...item,
          ...frame,
        },
        pulloutSofa,
      );
    },
    [],
  );

  const addFurniture = useCallback(
    (preset: FurniturePreset) => {
      const polygon = findRoomPolygon(room.endpoints, room.walls);
      let cx = 72;
      let cy = 60;
      if (polygon && polygon.length > 0) {
        const xs = polygon.map((v) => v.x);
        const ys = polygon.map((v) => v.y);
        cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      }

      const item: FurnitureItem = {
        id: createId(),
        type: preset.type,
        name: preset.name,
        shape: preset.shape,
        width: preset.width,
        depth: preset.depth,
        x: cx,
        y: cy,
        rotation: 0,
        color: preset.color,
        locked: false,
        pulloutSofa: preset.pulloutSofa,
      };

      const nextItem = preset.pulloutSofa
        ? syncPulloutSofaItem(item, preset.pulloutSofa)
        : item;

      setFurniture((prev) => {
        const next = [...prev, nextItem];
        pushHistory(room, next);
        return next;
      });
      setSelectedId(nextItem.id);
      return nextItem.id;
    },
    [room, pushHistory, setSelectedId],
  );

  const updateFurniture = useCallback(
    (id: string, updates: Partial<FurnitureItem>) => {
      setFurniture((prev) => {
        const next = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
        pushHistory(room, next);
        return next;
      });
    },
    [room, pushHistory],
  );

  const moveFurniture = useCallback((id: string, x: number, y: number) => {
    setFurniture((prev) => prev.map((f) => (f.id === id ? { ...f, x, y } : f)));
  }, []);

  const moveFurnitureGroup = useCallback(
    (updates: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>) => {
      const updateMap = new Map(
        updates.map((update) => [update.id, { x: update.x, y: update.y }]),
      );
      setFurniture((prev) =>
        prev.map((item) => {
          const nextPosition = updateMap.get(item.id);
          return nextPosition ? { ...item, ...nextPosition } : item;
        }),
      );
    },
    [],
  );

  const updateFurnitureGroup = useCallback(
    (updates: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>) => {
      const updateMap = new Map(
        updates.map((update) => [update.id, { x: update.x, y: update.y }]),
      );
      setFurniture((prev) => {
        const next = prev.map((item) => {
          const nextPosition = updateMap.get(item.id);
          return nextPosition ? { ...item, ...nextPosition } : item;
        });
        pushHistory(room, next);
        return next;
      });
    },
    [pushHistory, room],
  );

  const setFurnitureFrame = useCallback(
    (id: string, frame: Pick<FurnitureItem, 'depth' | 'width' | 'x' | 'y'>) => {
      setFurniture((prev) =>
        prev.map((item) =>
          item.id === id ? applyFurnitureFrame(item, frame) : item,
        ),
      );
    },
    [applyFurnitureFrame],
  );

  const updateFurnitureFrame = useCallback(
    (id: string, frame: Pick<FurnitureItem, 'depth' | 'width' | 'x' | 'y'>) => {
      setFurniture((prev) => {
        const next = prev.map((item) =>
          item.id === id ? applyFurnitureFrame(item, frame) : item,
        );
        pushHistory(room, next);
        return next;
      });
    },
    [applyFurnitureFrame, pushHistory, room],
  );

  const setFurnitureRotation = useCallback((id: string, rotation: number) => {
    setFurniture((prev) =>
      prev.map((f) => (f.id === id ? { ...f, rotation } : f)),
    );
  }, []);

  const commitFurnitureMove = useCallback(() => {
    pushHistory(room, furniture);
  }, [room, furniture, pushHistory]);

  const rotateFurniture = useCallback(
    (id: string, rotation: number) => {
      setFurniture((prev) => {
        const next = prev.map((f) => (f.id === id ? { ...f, rotation } : f));
        pushHistory(room, next);
        return next;
      });
    },
    [room, pushHistory],
  );

  const updatePulloutSofa = useCallback(
    (id: string, updates: Partial<PulloutSofaState>) => {
      setFurniture((prev) => {
        const next = prev.map((item) => {
          if (item.id !== id || !item.pulloutSofa) return item;
          const widthUpdates =
            updates.closedWidth !== undefined && updates.openWidth === undefined
              ? {
                  closedWidth: updates.closedWidth,
                  openWidth: updates.closedWidth,
                }
              : updates.openWidth !== undefined &&
                  updates.closedWidth === undefined
                ? {
                    closedWidth: updates.openWidth,
                    openWidth: updates.openWidth,
                  }
                : {};
          const pulloutSofa = {
            ...item.pulloutSofa,
            ...widthUpdates,
            ...updates,
          };
          return syncPulloutSofaItem(item, pulloutSofa, {
            preserveTop: true,
          });
        });
        pushHistory(room, next);
        return next;
      });
    },
    [room, pushHistory],
  );

  const setPulloutBedSize = useCallback(
    (id: string, bedSize: PulloutBedSize) => {
      setFurniture((prev) => {
        const next = prev.map((item) => {
          if (item.id !== id || item.type !== 'pullout-sofa') return item;
          const pulloutSofa = item.pulloutSofa ?? {
            ...PULLOUT_SOFA_DEFAULTS.queen,
            isOpen: false,
          };
          return syncPulloutSofaItem(
            item,
            {
              ...PULLOUT_SOFA_DEFAULTS[bedSize],
              isOpen: pulloutSofa.isOpen,
            },
            {
              preserveTop: true,
            },
          );
        });
        pushHistory(room, next);
        return next;
      });
    },
    [room, pushHistory],
  );

  const togglePulloutSofa = useCallback(
    (id: string) => {
      setFurniture((prev) => {
        const next = prev.map((item) => {
          if (item.id !== id || !item.pulloutSofa) return item;
          return syncPulloutSofaItem(
            item,
            {
              ...item.pulloutSofa,
              isOpen: !item.pulloutSofa.isOpen,
            },
            {
              preserveTop: true,
            },
          );
        });
        pushHistory(room, next);
        return next;
      });
    },
    [room, pushHistory],
  );

  const removeFurniture = useCallback(
    (id: string) => {
      setFurniture((prev) => {
        const next = prev.filter((f) => f.id !== id);
        pushHistory(room, next);
        return next;
      });
      setSelectedIds((current) =>
        current.filter((selected) => selected !== id),
      );
    },
    [room, pushHistory],
  );

  const removeFurnitureGroup = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }

      const idsToRemove = new Set(ids);
      setFurniture((prev) => {
        const next = prev.filter((item) => !idsToRemove.has(item.id));
        pushHistory(room, next);
        return next;
      });
      setSelectedIds((current) =>
        current.filter((selected) => !idsToRemove.has(selected)),
      );
    },
    [room, pushHistory],
  );

  const duplicateFurniture = useCallback(
    (id: string) => {
      const source = furniture.find((f) => f.id === id);
      if (!source) return;
      const item: FurnitureItem = {
        ...structuredClone(source),
        id: createId(),
        x: source.x + 24,
        y: source.y + 24,
        name: `${source.name} (copy)`,
      };
      setFurniture((prev) => {
        const next = [...prev, item];
        pushHistory(room, next);
        return next;
      });
      setSelectedIds([item.id]);
    },
    [furniture, room, pushHistory],
  );

  const duplicateFurnitureGroup = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }

      const sourceIds = new Set(ids);
      const sources = furniture.filter((item) => sourceIds.has(item.id));
      if (sources.length === 0) {
        return;
      }

      const copies = sources.map((source) => ({
        ...structuredClone(source),
        id: createId(),
        x: source.x + 24,
        y: source.y + 24,
        name: `${source.name} (copy)`,
      }));

      setFurniture((prev) => {
        const next = [...prev, ...copies];
        pushHistory(room, next);
        return next;
      });
      setSelectedIds(copies.map((copy) => copy.id));
    },
    [furniture, room, pushHistory],
  );

  // ── Room templates ──

  const applyTemplate = useCallback(
    (vertices: Point[]) => {
      const newRoom = verticesToRoom(vertices);
      setRoom(newRoom);
      setFurniture([]);
      pushHistory(newRoom, []);
      setSelectedIds([]);
    },
    [pushHistory],
  );

  const rotateRoom = useCallback(
    (rotationDegrees = 90) => {
      const bounds = getBounds(room.endpoints);
      if (!bounds) {
        return;
      }

      const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const nextRoom: Room = {
        ...room,
        endpoints: room.endpoints.map((endpoint) => ({
          ...endpoint,
          ...rotatePointAround(endpoint, center, rotationDegrees),
        })),
      };
      const nextFurniture = furniture.map((item) => {
        const nextCenter = rotatePointAround(item, center, rotationDegrees);
        return {
          ...item,
          x: nextCenter.x,
          y: nextCenter.y,
          rotation: normalizeRotation(item.rotation + rotationDegrees),
        };
      });

      setRoom(nextRoom);
      setFurniture(nextFurniture);
      pushHistory(nextRoom, nextFurniture);
    },
    [furniture, pushHistory, room],
  );

  // ── Computed values ──

  const roomPolygon = useMemo(
    () => findRoomPolygon(room.endpoints, room.walls),
    [room.endpoints, room.walls],
  );

  const selectedFurniture = useMemo(
    () => furniture.find((f) => f.id === selectedId) ?? null,
    [furniture, selectedId],
  );

  const state: RoomPlannerState = useMemo(
    () => ({
      unit,
      room,
      furniture,
      gridSnap,
      showMeasurements,
      showGrid,
    }),
    [unit, room, furniture, gridSnap, showMeasurements, showGrid],
  );

  useEffect(() => {
    localStorage.setItem(UNIT_STORAGE_KEY, unit);
  }, [unit]);

  useEffect(() => {
    persistPlannerHistoryState(activeHistoryKey, historyState);
  }, [activeHistoryKey, historyState]);

  const historyDebug = useMemo(
    () => ({
      currentPosition: historyState.past.length,
      future: historyState.future.map((entry, index) => ({
        id: `future-${index}`,
        label: `Future ${index + 1}`,
        position: historyState.past.length + index + 1,
        ...summarizeHistoryEntry(entry),
      })),
      futureCount: historyState.future.length,
      key: activeHistoryKey,
      latestPosition: historyState.past.length + historyState.future.length,
      locked: isHistoryEditingLocked,
      past: historyState.past.map((entry, index) => ({
        id: `past-${index}`,
        label: `Past ${historyState.past.length - index}`,
        position: index,
        ...summarizeHistoryEntry(entry),
      })),
      pastCount: historyState.past.length,
      present: {
        id: 'present',
        label: 'Current',
        position: historyState.past.length,
        ...summarizeHistoryEntry({ furniture, room }),
      },
      totalCount: historyState.past.length + historyState.future.length + 1,
    }),
    [
      activeHistoryKey,
      furniture,
      historyState.future,
      historyState.past,
      isHistoryEditingLocked,
      room,
    ],
  );

  return {
    state,
    discardFutureHistory,
    historyDebug,
    isHistoryEditingLocked,
    jumpToHistory,
    loadState,
    returnToLatestHistory,
    // Unit
    unit,
    setUnit,
    toDisplay,
    fromDisplay,
    // Room
    room,
    roomPolygon,
    applyTemplate,
    rotateRoom,
    // Endpoints
    getEndpoint,
    getWallsForEndpoint,
    moveEndpoint,
    commitEndpointMove,
    mergeEndpoints,
    disconnectEndpoint,
    splitEndpoint,
    // Walls
    addWallToNewPoint,
    addWallBetweenEndpoints,
    removeWall,
    setWallLength,
    // Wall features
    addWallFeature,
    updateWallFeature,
    removeWallFeature,
    moveWallFeature,
    moveFeatureToWall,
    commitFeatureMove,
    translateWall,
    nudgeWallFeature,
    // Furniture
    furniture,
    addFurniture,
    updateFurniture,
    updatePulloutSofa,
    moveFurniture,
    moveFurnitureGroup,
    updateFurnitureGroup,
    setFurnitureFrame,
    updateFurnitureFrame,
    setFurnitureRotation,
    commitFurnitureMove,
    rotateFurniture,
    removeFurniture,
    removeFurnitureGroup,
    duplicateFurniture,
    duplicateFurnitureGroup,
    setPulloutBedSize,
    togglePulloutSofa,
    // Selection
    selectedId,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    toggleSelectedId,
    selectedFurniture,
    selectedWallId,
    setSelectedWallId,
    // Display
    gridSnap,
    setGridSnap,
    showMeasurements,
    setShowMeasurements,
    showGrid,
    setShowGrid,
    // History
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export type RoomPlannerReturn = ReturnType<typeof useRoomPlanner>;
