import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useRoomPlanner } from '@/hooks/use-floor-planner';
import type { FurniturePreset, RoomPlannerState } from '@/types';

const DESK_PRESET: FurniturePreset = {
  type: 'desk',
  name: 'Desk',
  shape: 'rectangle',
  width: 60,
  depth: 30,
  color: '#f59e0b',
};

const PULLOUT_PRESET: FurniturePreset = {
  type: 'pullout-sofa',
  name: 'Pull-out Sofa',
  shape: 'rectangle',
  width: 72,
  depth: 38,
  color: '#7c3aed',
  pulloutSofa: {
    bedSize: 'full',
    isOpen: false,
    closedWidth: 72,
    closedDepth: 38,
    openWidth: 72,
    openDepth: 75,
  },
};

function createPlannerState(
  overrides: Partial<RoomPlannerState> = {},
): RoomPlannerState {
  return {
    unit: 'in',
    room: {
      endpoints: [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 144, y: 0 },
        { id: 'c', x: 144, y: 120 },
        { id: 'd', x: 0, y: 120 },
      ],
      walls: [
        { id: 'w1', startId: 'a', endId: 'b', features: [] },
        { id: 'w2', startId: 'b', endId: 'c', features: [] },
        { id: 'w3', startId: 'c', endId: 'd', features: [] },
        { id: 'w4', startId: 'd', endId: 'a', features: [] },
      ],
    },
    furniture: [],
    gridSnap: 1,
    showMeasurements: true,
    showGrid: true,
    ...overrides,
  };
}

describe('useRoomPlanner', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults grid snapping to 1 inch', () => {
    const { result } = renderHook(() => useRoomPlanner());

    expect(result.current.gridSnap).toBe(1);
  });

  it('normalizes legacy snap values to 1 inch when loading state', () => {
    const { result } = renderHook(() =>
      useRoomPlanner(
        createPlannerState({
          gridSnap: 6,
        }),
      ),
    );

    expect(result.current.gridSnap).toBe(1);
  });

  it('loads a new planner state and restores that snapshot history independently', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(DESK_PRESET);
    });

    expect(result.current.selectedId).toBe(itemId);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.loadState(
        createPlannerState({
          gridSnap: 0,
          room: {
            endpoints: [
              { id: 'e1', x: 0, y: 0 },
              { id: 'e2', x: 120, y: 0 },
              { id: 'e3', x: 120, y: 96 },
              { id: 'e4', x: 0, y: 96 },
            ],
            walls: [
              { id: 'w1', startId: 'e1', endId: 'e2', features: [] },
              { id: 'w2', startId: 'e2', endId: 'e3', features: [] },
              { id: 'w3', startId: 'e3', endId: 'e4', features: [] },
              { id: 'w4', startId: 'e4', endId: 'e1', features: [] },
            ],
          },
        }),
        'project-1:snapshot-2',
      );
    });

    expect(result.current.gridSnap).toBe(0);
    expect(result.current.room.endpoints[1]?.x).toBe(120);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });

  it('makes the first committed change undoable from the loaded snapshot state', () => {
    const { result } = renderHook(() => useRoomPlanner());

    act(() => {
      result.current.addFurniture(DESK_PRESET);
    });

    expect(result.current.furniture).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.furniture).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
  });

  it('persists snapshot history in session storage across refreshes', () => {
    const historyKey = 'project-1:snapshot-1';
    const { result, unmount } = renderHook(() =>
      useRoomPlanner(createPlannerState(), historyKey),
    );

    act(() => {
      result.current.addFurniture(DESK_PRESET);
    });

    const persistedState = result.current.state;
    expect(result.current.canUndo).toBe(true);
    unmount();

    const restored = renderHook(() =>
      useRoomPlanner(persistedState, historyKey),
    );

    expect(restored.result.current.furniture).toHaveLength(1);
    expect(restored.result.current.canUndo).toBe(true);
    expect(restored.result.current.historyDebug.pastCount).toBe(1);

    act(() => {
      restored.result.current.undo();
    });

    expect(restored.result.current.furniture).toHaveLength(0);
  });

  it('can jump directly to an earlier history step', () => {
    const { result } = renderHook(() => useRoomPlanner());

    act(() => {
      result.current.addFurniture(DESK_PRESET);
      result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Two',
      });
    });

    expect(result.current.furniture).toHaveLength(2);
    expect(result.current.historyDebug.totalCount).toBe(3);

    act(() => {
      result.current.jumpToHistory(0);
    });

    expect(result.current.furniture).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.historyDebug.currentPosition).toBe(0);
    expect(result.current.isHistoryEditingLocked).toBe(true);
  });

  it('can discard future history after time traveling', () => {
    const { result } = renderHook(() => useRoomPlanner());

    act(() => {
      result.current.addFurniture(DESK_PRESET);
    });

    act(() => {
      result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Two',
      });
    });

    act(() => {
      result.current.jumpToHistory(0);
    });

    expect(result.current.isHistoryEditingLocked).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.discardFutureHistory();
    });

    expect(result.current.isHistoryEditingLocked).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historyDebug.totalCount).toBe(1);
  });

  it('does not lock editing after ordinary undo and redo', () => {
    const { result } = renderHook(() => useRoomPlanner());

    act(() => {
      result.current.addFurniture(DESK_PRESET);
      result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Two',
      });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);
    expect(result.current.isHistoryEditingLocked).toBe(false);

    act(() => {
      result.current.redo();
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.isHistoryEditingLocked).toBe(false);
  });

  it('clears the browsing lock when returning to the latest step', () => {
    const { result } = renderHook(() => useRoomPlanner());

    act(() => {
      result.current.addFurniture(DESK_PRESET);
    });

    act(() => {
      result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Two',
      });
    });

    act(() => {
      result.current.jumpToHistory(0);
    });

    expect(result.current.isHistoryEditingLocked).toBe(true);

    act(() => {
      result.current.redo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.isHistoryEditingLocked).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('migrates legacy pull-out sofas without metadata on load', () => {
    const { result } = renderHook(() =>
      useRoomPlanner(
        createPlannerState({
          furniture: [
            {
              id: 'legacy-sofa',
              type: 'pullout-sofa',
              name: 'Legacy Sofa',
              shape: 'rectangle',
              width: 70,
              depth: 36,
              x: 50,
              y: 50,
              rotation: 0,
              color: '#000',
              locked: false,
            },
          ],
        }),
      ),
    );

    const item = result.current.furniture[0];

    expect(item.pulloutSofa).toBeDefined();
    expect(item.pulloutSofa?.closedWidth).toBe(84);
    expect(item.pulloutSofa?.openWidth).toBe(84);
    expect(item.pulloutSofa?.closedDepth).toBe(36);
    expect(item.pulloutSofa?.bedSize).toBe('queen');
  });

  it('adds furniture at the room center and selects it', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(DESK_PRESET);
    });

    const item = result.current.furniture.find((entry) => entry.id === itemId);

    expect(item).toMatchObject({
      width: 60,
      depth: 30,
      x: 72,
      y: 60,
    });
    expect(result.current.selectedId).toBe(itemId);
  });

  it('supports multi-select bulk duplication and removal', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let firstId = '';
    let secondId = '';
    act(() => {
      firstId = result.current.addFurniture(DESK_PRESET);
      secondId = result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Two',
      });
      result.current.setSelectedIds([firstId, secondId]);
    });

    expect(result.current.selectedIds).toEqual([firstId, secondId]);

    act(() => {
      result.current.duplicateFurnitureGroup(result.current.selectedIds);
    });

    expect(result.current.furniture).toHaveLength(4);
    expect(result.current.selectedIds).toHaveLength(2);

    act(() => {
      result.current.removeFurnitureGroup(result.current.selectedIds);
    });

    expect(result.current.furniture).toHaveLength(2);
  });

  it('reorders furniture layers and keeps that order undoable', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let firstId = '';
    let secondId = '';
    let thirdId = '';

    act(() => {
      firstId = result.current.addFurniture(DESK_PRESET);
      secondId = result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Two',
      });
      thirdId = result.current.addFurniture({
        ...DESK_PRESET,
        name: 'Desk Three',
      });
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      firstId,
      secondId,
      thirdId,
    ]);

    act(() => {
      result.current.sendFurnitureToBack(thirdId);
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      thirdId,
      firstId,
      secondId,
    ]);

    act(() => {
      result.current.moveFurnitureForward(thirdId);
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      firstId,
      thirdId,
      secondId,
    ]);

    act(() => {
      result.current.bringFurnitureToFront(firstId);
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      thirdId,
      secondId,
      firstId,
    ]);

    act(() => {
      result.current.moveFurnitureBackward(firstId);
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      thirdId,
      firstId,
      secondId,
    ]);

    act(() => {
      result.current.undo();
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      thirdId,
      secondId,
      firstId,
    ]);

    act(() => {
      result.current.redo();
    });

    expect(result.current.furniture.map((item) => item.id)).toEqual([
      thirdId,
      firstId,
      secondId,
    ]);
  });

  it('rotates the room and furniture together around the room center', () => {
    const { result } = renderHook(() =>
      useRoomPlanner(
        createPlannerState({
          furniture: [
            {
              id: 'desk-1',
              type: 'desk',
              name: 'Desk',
              shape: 'rectangle',
              width: 60,
              depth: 30,
              x: 90,
              y: 30,
              rotation: 0,
              color: '#f59e0b',
              locked: false,
            },
          ],
        }),
      ),
    );

    act(() => {
      result.current.rotateRoom();
    });

    expect(result.current.room.endpoints).toEqual([
      { id: 'a', x: 132, y: -12 },
      { id: 'b', x: 132, y: 132 },
      { id: 'c', x: 12, y: 132 },
      { id: 'd', x: 12, y: -12 },
    ]);
    expect(result.current.furniture).toEqual([
      expect.objectContaining({
        id: 'desk-1',
        x: 102,
        y: 78,
        rotation: 90,
      }),
    ]);
  });

  it('toggles a pull-out sofa while preserving its top edge', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(PULLOUT_PRESET);
    });

    const before = result.current.furniture.find(
      (entry) => entry.id === itemId,
    );
    expect(before).toBeDefined();
    const beforeTop = before!.y - before!.depth / 2;

    act(() => {
      result.current.togglePulloutSofa(itemId);
    });

    const after = result.current.furniture.find((entry) => entry.id === itemId);
    expect(after?.pulloutSofa?.isOpen).toBe(true);
    expect(after?.y).toBe(before!.y + (75 - 38) / 2);
    expect(after ? after.y - after.depth / 2 : null).toBe(beforeTop);
  });

  it('updates pull-out bed size while preserving open state and top edge', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(PULLOUT_PRESET);
      result.current.togglePulloutSofa(itemId);
    });

    const before = result.current.furniture.find(
      (entry) => entry.id === itemId,
    );
    expect(before?.pulloutSofa?.isOpen).toBe(true);
    const beforeTop = before!.y - before!.depth / 2;

    act(() => {
      result.current.setPulloutBedSize(itemId, 'queen');
    });

    const after = result.current.furniture.find((entry) => entry.id === itemId);
    expect(after?.pulloutSofa?.bedSize).toBe('queen');
    expect(after?.pulloutSofa?.isOpen).toBe(true);
    expect(after?.width).toBe(84);
    expect(after?.depth).toBe(80);
    expect(after ? after.y - after.depth / 2 : null).toBe(beforeTop);
  });

  it('keeps pull-out sofa widths in sync when reducing only one width field', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(PULLOUT_PRESET);
    });

    act(() => {
      result.current.updatePulloutSofa(itemId, {
        closedWidth: 60,
      });
    });

    const item = result.current.furniture.find((entry) => entry.id === itemId);
    expect(item?.pulloutSofa?.closedWidth).toBe(60);
    expect(item?.pulloutSofa?.openWidth).toBe(60);
    expect(item?.width).toBe(60);
  });

  it('updates pull-out sofa widths together during live frame changes', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(PULLOUT_PRESET);
    });

    act(() => {
      result.current.setFurnitureFrame(itemId, {
        x: 80,
        y: 70,
        width: 58,
        depth: 38,
      });
    });

    const item = result.current.furniture.find((entry) => entry.id === itemId);
    expect(item).toMatchObject({
      x: 80,
      y: 70,
      width: 58,
      depth: 38,
    });
    expect(item?.pulloutSofa?.closedWidth).toBe(58);
    expect(item?.pulloutSofa?.openWidth).toBe(58);
  });

  it('updates only the active pull-out sofa depth during live frame changes', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(PULLOUT_PRESET);
      result.current.togglePulloutSofa(itemId);
    });

    act(() => {
      result.current.setFurnitureFrame(itemId, {
        x: 72,
        y: 78,
        width: 72,
        depth: 82,
      });
    });

    const item = result.current.furniture.find((entry) => entry.id === itemId);
    expect(item?.depth).toBe(82);
    expect(item?.pulloutSofa?.openDepth).toBe(82);
    expect(item?.pulloutSofa?.closedDepth).toBe(38);
  });

  it('pushes synced pull-out sofa frame updates for discrete resize actions', () => {
    const { result } = renderHook(() => useRoomPlanner());

    let itemId = '';
    act(() => {
      itemId = result.current.addFurniture(PULLOUT_PRESET);
    });

    act(() => {
      result.current.updateFurnitureFrame(itemId, {
        x: 74,
        y: 60,
        width: 68,
        depth: 38,
      });
    });

    const item = result.current.furniture.find((entry) => entry.id === itemId);
    expect(item?.width).toBe(68);
    expect(item?.pulloutSofa?.closedWidth).toBe(68);
    expect(item?.pulloutSofa?.openWidth).toBe(68);
    expect(result.current.canUndo).toBe(true);
  });

  it('translates a selected wall by moving both endpoints together', () => {
    const { result } = renderHook(() => useRoomPlanner());

    act(() => {
      result.current.translateWall(result.current.room.walls[3].id, -2, 0);
    });

    const leftWall = result.current.room.walls[3];
    const start = result.current.room.endpoints.find(
      (endpoint) => endpoint.id === leftWall.startId,
    );
    const end = result.current.room.endpoints.find(
      (endpoint) => endpoint.id === leftWall.endId,
    );

    expect(start).toMatchObject({ x: -2, y: 120 });
    expect(end).toMatchObject({ x: -2, y: 0 });
  });

  it('nudges a wall feature along the wall and clamps to valid bounds', () => {
    const { result } = renderHook(() => useRoomPlanner());
    const wallId = result.current.room.walls[0].id;

    act(() => {
      result.current.addWallFeature(wallId, {
        type: 'window',
        offset: 100,
        width: 30,
      });
    });

    const featureId = result.current.room.walls[0].features[0]?.id;
    expect(featureId).toBeDefined();

    act(() => {
      result.current.nudgeWallFeature(wallId, featureId!, 20);
    });

    expect(result.current.room.walls[0].features[0]?.offset).toBe(114);

    act(() => {
      result.current.nudgeWallFeature(wallId, featureId!, -200);
    });

    expect(result.current.room.walls[0].features[0]?.offset).toBe(0);
  });

  it('supports wall openings as editable wall features', () => {
    const { result } = renderHook(() => useRoomPlanner());
    const wallId = result.current.room.walls[1].id;

    act(() => {
      result.current.addWallFeature(wallId, {
        type: 'opening',
        offset: 24,
        width: 42,
      });
    });

    const opening = result.current.room.walls[1].features[0];
    expect(opening).toMatchObject({
      type: 'opening',
      offset: 24,
      width: 42,
    });

    act(() => {
      result.current.updateWallFeature(wallId, opening!.id, {
        width: 48,
      });
    });

    expect(result.current.room.walls[1].features[0]?.width).toBe(48);
  });
});
