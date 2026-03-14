export type Theme = 'light' | 'dark';
export type Unit = 'in' | 'cm';

// ── Geometry ──

export interface Point {
  x: number;
  y: number;
}

// ── Room ──

export interface WallEndpoint {
  id: string;
  x: number;
  y: number;
}

export interface WallFeature {
  id: string;
  type: 'door' | 'window' | 'closet' | 'opening';
  /** Distance along the wall from start endpoint, in inches */
  offset: number;
  /** Width of the feature, in inches */
  width: number;
  /** Door swing direction (doors only) */
  swingDirection?: 'inward' | 'outward';
  /** Door hinge side (doors only) */
  swingHand?: 'left' | 'right';
  /** Window height from floor (windows only), in inches */
  sillHeight?: number;
  /** Window/closet height, in inches */
  height?: number;
}

export interface Wall {
  id: string;
  /** ID of the start endpoint */
  startId: string;
  /** ID of the end endpoint */
  endId: string;
  features: WallFeature[];
}

export interface Room {
  /** All wall endpoints (shared endpoints = connection) */
  endpoints: WallEndpoint[];
  /** Wall segments connecting endpoints */
  walls: Wall[];
}

// ── Furniture ──

export type FurnitureType =
  | 'desk'
  | 'chair'
  | 'couch'
  | 'pullout-sofa'
  | 'bed'
  | 'table'
  | 'dining-table'
  | 'coffee-table'
  | 'rug'
  | 'bookshelf'
  | 'dresser'
  | 'nightstand'
  | 'tv-stand'
  | 'wardrobe'
  | 'custom';

export type FurnitureShape = 'rectangle' | 'circle';
export type PulloutBedSize = 'twin' | 'full' | 'queen' | 'king';

export interface PulloutSofaState {
  bedSize: PulloutBedSize;
  isOpen: boolean;
  closedWidth: number;
  closedDepth: number;
  openWidth: number;
  openDepth: number;
}

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  name: string;
  shape: FurnitureShape;
  /** Width in inches */
  width: number;
  /** Depth in inches */
  depth: number;
  /** Position X (center) in inches from room origin */
  x: number;
  /** Position Y (center) in inches from room origin */
  y: number;
  /** Rotation in degrees (clockwise) */
  rotation: number;
  /** Display color */
  color: string;
  /** Whether the item is locked in place */
  locked: boolean;
  /** Pull-out sofa metadata */
  pulloutSofa?: PulloutSofaState;
}

// ── Planner State ──

export interface RoomPlannerState {
  unit: Unit;
  room: Room;
  furniture: FurnitureItem[];
  /** Grid snap size in inches (0 = disabled) */
  gridSnap: number;
  /** Whether to show measurement overlays */
  showMeasurements: boolean;
  /** Whether to show grid */
  showGrid: boolean;
  /** Whether to render furniture with a neutral palette */
  neutralFurnitureColors: boolean;
}

export interface PlannerSnapshot {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  state: RoomPlannerState;
}

export interface PlannerProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeSnapshotId: string;
  snapshots: PlannerSnapshot[];
}

export interface PlannerProjectStore {
  version: number;
  projects: PlannerProject[];
}

export interface PlannerProjectExport {
  version: number;
  exportedAt: string;
  project: Omit<PlannerProject, 'id'>;
}

// ── Undo/Redo ──

export interface HistoryEntry {
  room: Room;
  furniture: FurnitureItem[];
}

export interface PlannerHistoryState {
  future: HistoryEntry[];
  navigationLocked: boolean;
  past: HistoryEntry[];
  present: HistoryEntry;
}

// ── Furniture presets ──

export interface FurniturePreset {
  type: FurnitureType;
  name: string;
  shape: FurnitureShape;
  width: number;
  depth: number;
  color: string;
  pulloutSofa?: PulloutSofaState;
}

// ── Room templates ──

export interface RoomTemplate {
  name: string;
  description: string;
  vertices: Point[];
}
