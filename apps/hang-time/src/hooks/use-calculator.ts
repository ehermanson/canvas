import {
  parseAsBoolean,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_PRESET } from '@/data/gallery-presets';
import { createId } from '@/lib/id';
import type {
  AnchorType,
  CalculatorState,
  Distribution,
  FrameFurnitureAlignment,
  FramePosition,
  FurnitureAnchor,
  FurnitureVerticalAnchor,
  GalleryFrame,
  GalleryRowConfig,
  GalleryVAlign,
  HangingType,
  HorizontalAnchorType,
  Unit,
} from '@/types';
import {
  calculateLayoutPositions,
  fromDisplayUnit,
  toDisplayUnit,
} from '@/utils/calculations';

const UNIT_STORAGE_KEY = 'picture-hanging-unit';

// Get saved unit from localStorage or default to 'in'
function getSavedUnit(): 'in' | 'cm' {
  if (typeof window === 'undefined') return 'in';
  const saved = localStorage.getItem(UNIT_STORAGE_KEY);
  return saved === 'cm' ? 'cm' : 'in';
}

// Parser definitions grouped by concern
const wallParsers = {
  u: parseAsStringLiteral(['in', 'cm'] as const).withDefault(getSavedUnit()),
  ww: parseAsFloat.withDefault(120),
  wh: parseAsFloat.withDefault(96),
};

const framesParsers = {
  f: parseAsString.withDefault(''), // JSON-encoded GalleryFrame[]
  us: parseAsBoolean.withDefault(false), // uniformSize - when false, frames use individual sizes
};

const frameParsers = {
  fw: parseAsFloat.withDefault(12),
  fh: parseAsFloat.withDefault(12),
  ho: parseAsFloat.withDefault(2),
  ht: parseAsStringLiteral(['center', 'dual'] as const).withDefault('center'),
  hi: parseAsFloat.withDefault(3), // hook inset from edge for dual hanging
  hs: parseAsFloat.withDefault(3),
  hd: parseAsStringLiteral([
    'fixed',
    'space-between',
    'space-evenly',
    'space-around',
  ] as const).withDefault('fixed'),
};

const positionParsers = {
  at: parseAsStringLiteral([
    'floor',
    'ceiling',
    'center',
    'furniture',
  ] as const).withDefault('floor'),
  av: parseAsFloat.withDefault(57),
  hat: parseAsStringLiteral(['center', 'left', 'right'] as const).withDefault(
    'center',
  ),
  hav: parseAsFloat.withDefault(0),
};

const furnitureParsers = {
  fuw: parseAsFloat.withDefault(48),
  fuh: parseAsFloat.withDefault(30),
  fua: parseAsStringLiteral(['left', 'center', 'right'] as const).withDefault(
    'center',
  ),
  fuo: parseAsFloat.withDefault(0),
  ffa: parseAsStringLiteral([
    'left',
    'center',
    'right',
    'span',
  ] as const).withDefault('center'),
  fva: parseAsStringLiteral([
    'center',
    'ceiling',
    'above-furniture',
  ] as const).withDefault('above-furniture'),
};

const layoutParsers = {
  va: parseAsStringLiteral(['center', 'top', 'bottom'] as const).withDefault(
    'center',
  ),
  rs: parseAsFloat.withDefault(3), // row spacing (vertical between rows)
  rc: parseAsString.withDefault(''), // JSON-encoded GalleryRowConfig[]
};

// Parse frames from JSON string
function parseFrames(json: string): GalleryFrame[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (f) =>
            typeof f.id === 'string' &&
            typeof f.w === 'number' &&
            typeof f.h === 'number',
        )
        .map((f) => ({
          id: f.id,
          width: f.w,
          height: f.h,
          ...(f.r !== undefined ? { row: f.r } : {}),
        }));
    }
  } catch {
    // Invalid JSON
  }
  return [];
}

// Serialize frames to JSON with short keys
function serializeFrames(frames: GalleryFrame[]): string {
  if (frames.length === 0) return '';
  return JSON.stringify(
    frames.map((f) => ({
      id: f.id,
      w: f.width,
      h: f.height,
      ...(f.row !== undefined ? { r: f.row } : {}),
    })),
  );
}

// Parse row configs from JSON string
function parseRowConfigs(json: string): GalleryRowConfig[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (r): r is GalleryRowConfig => typeof r.id === 'string',
      );
    }
  } catch {
    // Invalid JSON
  }
  return [];
}

// Create default frames from preset (with fresh IDs)
function createDefaultFrames(): GalleryFrame[] {
  return DEFAULT_PRESET.frames.map((f) => ({
    ...f,
    id: createId(),
  }));
}

export function useCalculator() {
  // URL-synced state grouped by concern
  const [wall, setWall] = useQueryStates(wallParsers);
  const [framesState, setFramesState] = useQueryStates(framesParsers);
  const [frame, setFrame] = useQueryStates(frameParsers);
  const [position, setPosition] = useQueryStates(positionParsers);
  const [furniture, setFurniture] = useQueryStates(furnitureParsers);
  const [layout, setLayout] = useQueryStates(layoutParsers);

  // Parse frames from URL (or create defaults if empty)
  const frames = useMemo(() => {
    const parsed = parseFrames(framesState.f);
    if (parsed.length === 0) {
      return createDefaultFrames();
    }
    return parsed;
  }, [framesState.f]);

  const rowConfigs = useMemo(() => parseRowConfigs(layout.rc), [layout.rc]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(UNIT_STORAGE_KEY, wall.u);
  }, [wall.u]);

  // Construct state object for calculations
  const state: CalculatorState = useMemo(
    () => ({
      unit: wall.u as Unit,
      wallWidth: wall.ww,
      wallHeight: wall.wh,
      frames,
      uniformSize: framesState.us,
      frameWidth: frame.fw,
      frameHeight: frame.fh,
      hangingOffset: frame.ho,
      hangingType: frame.ht as HangingType,
      hookInset: frame.hi,
      hSpacing: frame.hs,
      hDistribution: frame.hd as Distribution,
      anchorType: position.at as AnchorType,
      anchorValue: position.av,
      hAnchorType: position.hat as HorizontalAnchorType,
      hAnchorValue: position.hav,
      furnitureWidth: furniture.fuw,
      furnitureHeight: furniture.fuh,
      furnitureAnchor: furniture.fua as FurnitureAnchor,
      furnitureOffset: furniture.fuo,
      frameFurnitureAlign: furniture.ffa as FrameFurnitureAlignment,
      furnitureVAnchor: furniture.fva as FurnitureVerticalAnchor,
      rowSpacing: layout.rs,
      rowConfigs,
      vAlign: layout.va as GalleryVAlign,
    }),
    [wall, framesState, frame, position, furniture, frames, rowConfigs, layout],
  );

  // Unit conversion helpers
  const u = useCallback(
    (val: number) => toDisplayUnit(val, state.unit),
    [state.unit],
  );
  const fromU = useCallback(
    (val: number) => fromDisplayUnit(val, state.unit),
    [state.unit],
  );

  // Calculate layout positions
  const layoutPositions: FramePosition[] = useMemo(
    () => calculateLayoutPositions(state),
    [state],
  );

  // Setters
  const setUnit = (value: Unit) => setWall({ u: value });
  const setWallWidth = (value: number) => setWall({ ww: value });
  const setWallHeight = (value: number) => setWall({ wh: value });

  const setUniformSize = (value: boolean) => setFramesState({ us: value });
  const setFrameWidth = (value: number) => setFrame({ fw: value });
  const setFrameHeight = (value: number) => setFrame({ fh: value });
  const setHangingOffset = (value: number) => setFrame({ ho: value });
  const setHangingType = (value: HangingType) => setFrame({ ht: value });
  const setHookInset = (value: number) => setFrame({ hi: value });
  const setHSpacing = (value: number) => setFrame({ hs: value });
  const setHDistribution = (value: Distribution) => setFrame({ hd: value });

  const setAnchorType = (value: AnchorType) => setPosition({ at: value });
  const setAnchorValue = (value: number) => setPosition({ av: value });
  const setHAnchorType = (value: HorizontalAnchorType) =>
    setPosition({ hat: value });
  const setHAnchorValue = (value: number) => setPosition({ hav: value });
  const setManualPosition = useCallback(
    ({
      anchorType,
      anchorValue,
      hAnchorType,
      hAnchorValue,
    }: {
      anchorType: AnchorType;
      anchorValue: number;
      hAnchorType: HorizontalAnchorType;
      hAnchorValue: number;
    }) =>
      setPosition({
        at: anchorType,
        av: anchorValue,
        hat: hAnchorType,
        hav: hAnchorValue,
      }),
    [setPosition],
  );

  const setFurnitureWidth = (value: number) => setFurniture({ fuw: value });
  const setFurnitureHeight = (value: number) => setFurniture({ fuh: value });
  const setFurnitureAnchor = (value: FurnitureAnchor) =>
    setFurniture({ fua: value });
  const setFurnitureOffset = (value: number) => setFurniture({ fuo: value });
  const setFrameFurnitureAlign = (value: FrameFurnitureAlignment) =>
    setFurniture({ ffa: value });
  const setFurnitureVAnchor = (value: FurnitureVerticalAnchor) =>
    setFurniture({ fva: value });

  // Frame setters
  const setFrames = useCallback(
    (newFrames: GalleryFrame[]) => {
      setFramesState({ f: serializeFrames(newFrames) });
    },
    [setFramesState],
  );

  const addFrame = useCallback(() => {
    const newFrame: GalleryFrame = {
      id: createId(),
      width: frame.fw,
      height: frame.fh,
    };
    setFrames([...frames, newFrame]);
  }, [frames, setFrames, frame.fw, frame.fh]);

  const removeFrame = useCallback(
    (id: string) => {
      setFrames(frames.filter((f) => f.id !== id));
    },
    [frames, setFrames],
  );

  const updateFrame = useCallback(
    (id: string, updates: Partial<GalleryFrame>) => {
      setFrames(frames.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    },
    [frames, setFrames],
  );

  const reorderFrames = useCallback(
    (activeId: string, overId: string) => {
      const oldIndex = frames.findIndex((f) => f.id === activeId);
      const newIndex = frames.findIndex((f) => f.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newFrames = [...frames];
      const [removed] = newFrames.splice(oldIndex, 1);
      newFrames.splice(newIndex, 0, removed);
      setFrames(newFrames);
    },
    [frames, setFrames],
  );

  const setVAlign = (value: GalleryVAlign) => setLayout({ va: value });
  const setRowSpacing = (value: number) => setLayout({ rs: value });

  // Row config setters
  const setRowConfigs = useCallback(
    (configs: GalleryRowConfig[]) => {
      setLayout({ rc: configs.length > 0 ? JSON.stringify(configs) : '' });
    },
    [setLayout],
  );

  const updateRowConfig = useCallback(
    (rowId: string, updates: Partial<GalleryRowConfig>) => {
      const existing = rowConfigs.find((r) => r.id === rowId);
      if (existing) {
        setRowConfigs(
          rowConfigs.map((r) => (r.id === rowId ? { ...r, ...updates } : r)),
        );
      } else {
        setRowConfigs([...rowConfigs, { id: rowId, ...updates }]);
      }
    },
    [rowConfigs, setRowConfigs],
  );

  return {
    state,
    layoutPositions,
    u,
    fromU,
    setUnit,
    setWallWidth,
    setWallHeight,
    setUniformSize,
    setFrameWidth,
    setFrameHeight,
    setHangingOffset,
    setHangingType,
    setHookInset,
    setHSpacing,
    setHDistribution,
    setAnchorType,
    setAnchorValue,
    setHAnchorType,
    setHAnchorValue,
    setManualPosition,
    setFurnitureWidth,
    setFurnitureHeight,
    setFurnitureAnchor,
    setFurnitureOffset,
    setFrameFurnitureAlign,
    setFurnitureVAnchor,
    setFrames,
    addFrame,
    removeFrame,
    updateFrame,
    reorderFrames,
    setVAlign,
    setRowSpacing,
    setRowConfigs,
    updateRowConfig,
  };
}

export type UseCalculatorReturn = ReturnType<typeof useCalculator>;
