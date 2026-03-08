import { PULLOUT_SOFA_DEFAULTS } from '@/data/furniture-presets';
import { createId } from '@/lib/id';
import { syncPulloutSofaItem } from '@/lib/pullout-sofa';
import type {
  FurnitureItem,
  Room,
  RoomPlannerState,
  Unit,
  Wall,
  WallEndpoint,
} from '@/types';

function isUnit(value: unknown): value is Unit {
  return value === 'cm' || value === 'in';
}

function isRoom(value: unknown): value is Room {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const room = value as Partial<Room>;
  return Array.isArray(room.endpoints) && Array.isArray(room.walls);
}

export function normalizeGridSnap(value: number | null | undefined) {
  return value === 0 ? 0 : 1;
}

export function verticesToRoom(vertices: { x: number; y: number }[]): Room {
  const endpoints: WallEndpoint[] = vertices.map((vertex) => ({
    id: createId(),
    x: vertex.x,
    y: vertex.y,
  }));
  const walls: Wall[] = endpoints.map((endpoint, index) => ({
    id: createId(),
    startId: endpoint.id,
    endId: endpoints[(index + 1) % endpoints.length].id,
    features: [],
  }));

  return { endpoints, walls };
}

export function createDefaultRoom(): Room {
  return verticesToRoom([
    { x: 0, y: 0 },
    { x: 144, y: 0 },
    { x: 144, y: 120 },
    { x: 0, y: 120 },
  ]);
}

function normalizeFurnitureItem(item: FurnitureItem) {
  if (item.type !== 'pullout-sofa') {
    return item;
  }

  if (item.pulloutSofa) {
    return syncPulloutSofaItem(item, item.pulloutSofa);
  }

  return syncPulloutSofaItem(item, {
    ...PULLOUT_SOFA_DEFAULTS.queen,
    isOpen: false,
    closedWidth: item.width,
    closedDepth: item.depth,
  });
}

export function createDefaultPlannerState(unit: Unit = 'in'): RoomPlannerState {
  return {
    unit,
    room: createDefaultRoom(),
    furniture: [],
    gridSnap: 1,
    showMeasurements: true,
    showGrid: true,
  };
}

export function normalizePlannerState(
  value: Partial<RoomPlannerState> | null | undefined,
  fallbackUnit: Unit = 'in',
): RoomPlannerState {
  const normalizedUnit = isUnit(value?.unit) ? value.unit : fallbackUnit;
  const room = isRoom(value?.room) ? value.room : createDefaultRoom();

  return {
    unit: normalizedUnit,
    room: structuredClone(room),
    furniture: Array.isArray(value?.furniture)
      ? value.furniture.map((item) =>
          normalizeFurnitureItem(structuredClone(item)),
        )
      : [],
    gridSnap: normalizeGridSnap(value?.gridSnap),
    showMeasurements: value?.showMeasurements ?? true,
    showGrid: value?.showGrid ?? true,
  };
}
