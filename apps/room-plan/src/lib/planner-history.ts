import type {
  FurnitureItem,
  HistoryEntry,
  PlannerHistoryState,
  Room,
} from '@/types';

const PLANNER_HISTORY_STORAGE_PREFIX = 'room-planner-history';

function cloneHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    room: structuredClone(entry.room),
    furniture: structuredClone(entry.furniture),
  };
}

export function createHistoryEntry(
  room: Room,
  furniture: FurnitureItem[],
): HistoryEntry {
  return cloneHistoryEntry({ room, furniture });
}

export function createPlannerHistoryState(
  room: Room,
  furniture: FurnitureItem[],
): PlannerHistoryState {
  return {
    future: [],
    navigationLocked: false,
    past: [],
    present: createHistoryEntry(room, furniture),
  };
}

export function getPlannerHistoryStorageKey(historyKey: string) {
  return `${PLANNER_HISTORY_STORAGE_PREFIX}:${historyKey}`;
}

export function getPlannerSnapshotHistoryKey(
  projectId: string,
  snapshotId: string,
) {
  return `${projectId}:${snapshotId}`;
}

function isWallFeature(value: unknown) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { type?: unknown }).type === 'string' &&
      typeof (value as { offset?: unknown }).offset === 'number' &&
      typeof (value as { width?: unknown }).width === 'number',
  );
}

function isWall(value: unknown) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { startId?: unknown }).startId === 'string' &&
      typeof (value as { endId?: unknown }).endId === 'string' &&
      Array.isArray((value as { features?: unknown }).features) &&
      (value as { features: unknown[] }).features.every(isWallFeature),
  );
}

function isEndpoint(value: unknown) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { x?: unknown }).x === 'number' &&
      typeof (value as { y?: unknown }).y === 'number',
  );
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as { furniture?: unknown }).furniture) &&
      Array.isArray(
        (value as { room?: { endpoints?: unknown } }).room?.endpoints,
      ) &&
      Array.isArray((value as { room?: { walls?: unknown } }).room?.walls) &&
      (value as { room: { endpoints: unknown[] } }).room.endpoints.every(
        isEndpoint,
      ) &&
      (value as { room: { walls: unknown[] } }).room.walls.every(isWall),
  );
}

function serializeHistoryEntry(entry: HistoryEntry) {
  return JSON.stringify(entry);
}

export function areHistoryEntriesEqual(a: HistoryEntry, b: HistoryEntry) {
  return serializeHistoryEntry(a) === serializeHistoryEntry(b);
}

function isPlannerHistoryState(value: unknown): value is PlannerHistoryState {
  return Boolean(
    value &&
      typeof value === 'object' &&
      isHistoryEntry((value as { present?: unknown }).present) &&
      Array.isArray((value as { past?: unknown }).past) &&
      Array.isArray((value as { future?: unknown }).future) &&
      (typeof (value as { navigationLocked?: unknown }).navigationLocked ===
        'boolean' ||
        typeof (value as { navigationLocked?: unknown }).navigationLocked ===
          'undefined') &&
      (value as { past: unknown[] }).past.every(isHistoryEntry) &&
      (value as { future: unknown[] }).future.every(isHistoryEntry),
  );
}

export function loadPlannerHistoryState(
  historyKey: string | null | undefined,
  room: Room,
  furniture: FurnitureItem[],
): PlannerHistoryState {
  const initialState = createPlannerHistoryState(room, furniture);

  if (!historyKey || typeof window === 'undefined') {
    return initialState;
  }

  try {
    const raw = window.sessionStorage.getItem(
      getPlannerHistoryStorageKey(historyKey),
    );
    if (!raw) {
      return initialState;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlannerHistoryState(parsed)) {
      return initialState;
    }

    if (!areHistoryEntriesEqual(parsed.present, initialState.present)) {
      return initialState;
    }

    return {
      future: parsed.future.map(cloneHistoryEntry),
      navigationLocked:
        parsed.navigationLocked === true && parsed.future.length > 0,
      past: parsed.past.map(cloneHistoryEntry),
      present: cloneHistoryEntry(parsed.present),
    };
  } catch {
    return initialState;
  }
}

export function persistPlannerHistoryState(
  historyKey: string | null | undefined,
  historyState: PlannerHistoryState,
) {
  if (!historyKey || typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    getPlannerHistoryStorageKey(historyKey),
    JSON.stringify(historyState),
  );
}

export function removePlannerHistoryState(
  historyKey: string | null | undefined,
) {
  if (!historyKey || typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(getPlannerHistoryStorageKey(historyKey));
}
