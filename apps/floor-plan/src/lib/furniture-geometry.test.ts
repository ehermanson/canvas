import { describe, expect, it } from "vite-plus/test";

import {
  checkFurnitureCollision,
  checkFurnitureRoomCollision,
  getFurnitureAlignmentMatches,
  getFurnitureBounds,
  getFurnitureEdgePoints,
  getFurnitureResizeHandlePoints,
  getNearestBoundsClearances,
  getNearestFurnitureClearances,
  resizeFurnitureByHandleDelta,
  resizeFurnitureFromEdge,
  snapFurnitureToBoundsGrid,
  snapFurnitureToRoomWalls,
} from "@/lib/furniture-geometry";
import type { FurnitureItem } from "@/types";

function createItem(overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    id: "item",
    type: "desk",
    name: "Desk",
    shape: "rectangle",
    width: 60,
    depth: 30,
    x: 0,
    y: 0,
    rotation: 0,
    color: "#000",
    locked: false,
    ...overrides,
  };
}

describe("furniture-geometry", () => {
  const roomPolygon = [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 100 },
    { x: 0, y: 100 },
  ];

  it("returns cardinal edge points for an unrotated rectangle", () => {
    const points = getFurnitureEdgePoints(createItem());

    expect(points).toEqual([
      { x: 0, y: -15 },
      { x: 30, y: 0 },
      { x: 0, y: 15 },
      { x: -30, y: 0 },
    ]);
  });

  it("computes axis-aligned bounds for rotated furniture", () => {
    expect(getFurnitureBounds(createItem())).toEqual({
      minX: -30,
      maxX: 30,
      minY: -15,
      maxY: 15,
    });

    const rotatedBounds = getFurnitureBounds(createItem({ rotation: 90 }));
    expect(rotatedBounds.minX).toBeCloseTo(-15);
    expect(rotatedBounds.maxX).toBeCloseTo(15);
    expect(rotatedBounds.minY).toBeCloseTo(-30);
    expect(rotatedBounds.maxY).toBeCloseTo(30);
  });

  it("rotates edge points with the furniture item", () => {
    const points = getFurnitureEdgePoints(createItem({ rotation: 90 }));

    expect(points[0].x).toBeCloseTo(15);
    expect(points[0].y).toBeCloseTo(0);
    expect(points[1].x).toBeCloseTo(0);
    expect(points[1].y).toBeCloseTo(30);
  });

  it("returns edge resize handle points for the selected furniture item", () => {
    expect(getFurnitureResizeHandlePoints(createItem())).toEqual({
      left: { x: -30, y: 0 },
      right: { x: 30, y: 0 },
      top: { x: 0, y: -15 },
      bottom: { x: 0, y: 15 },
    });
  });

  it("resizes a rectangle from the dragged edge while keeping the opposite edge fixed", () => {
    expect(resizeFurnitureFromEdge(createItem(), "right", { x: 40, y: 0 })).toEqual({
      x: 5,
      y: 0,
      width: 70,
      depth: 30,
    });

    expect(resizeFurnitureFromEdge(createItem(), "bottom", { x: 0, y: 25 })).toEqual({
      x: 0,
      y: 5,
      width: 60,
      depth: 40,
    });
  });

  it("resizes a rotated rectangle in its local axis", () => {
    const resized = resizeFurnitureFromEdge(createItem({ rotation: 90 }), "right", { x: 0, y: 40 });

    expect(resized.x).toBeCloseTo(0);
    expect(resized.y).toBeCloseTo(5);
    expect(resized.width).toBe(70);
    expect(resized.depth).toBe(30);
  });

  it("keeps circles square while resizing from an edge", () => {
    expect(
      resizeFurnitureFromEdge(
        createItem({
          shape: "circle",
          width: 40,
          depth: 40,
          type: "table",
        }),
        "right",
        { x: 30, y: 0 },
      ),
    ).toEqual({
      x: 5,
      y: 0,
      width: 50,
      depth: 50,
    });
  });

  it("nudges a resize handle by world delta", () => {
    expect(resizeFurnitureByHandleDelta(createItem(), "left", { x: -2, y: 0 })).toEqual({
      x: -1,
      y: 0,
      width: 62,
      depth: 30,
    });

    expect(resizeFurnitureByHandleDelta(createItem(), "top", { x: 0, y: 3 })).toEqual({
      x: 0,
      y: 1.5,
      width: 60,
      depth: 27,
    });
  });

  it("resizes rotated furniture from keyboard handle movement in world space", () => {
    const resized = resizeFurnitureByHandleDelta(createItem({ rotation: 90 }), "top", {
      x: 1,
      y: 0,
    });

    expect(resized.x).toBeCloseTo(0.5);
    expect(resized.y).toBeCloseTo(0);
    expect(resized.width).toBe(60);
    expect(resized.depth).toBe(31);
  });

  it("chooses the nearest room walls for clearance measurements", () => {
    expect(
      getNearestFurnitureClearances(createItem({ x: 80, y: 70 }), {
        minX: 0,
        maxX: 120,
        minY: 0,
        maxY: 140,
      }),
    ).toEqual([
      {
        fromX: 110,
        fromY: 70,
        toX: 120,
        toY: 70,
        dist: 10,
      },
      {
        fromX: 80,
        fromY: 55,
        toX: 80,
        toY: 0,
        dist: 55,
      },
    ]);
  });

  it("uses the closer top wall when that clearance is smaller", () => {
    expect(
      getNearestFurnitureClearances(createItem({ x: 30, y: 25 }), {
        minX: 0,
        maxX: 120,
        minY: 0,
        maxY: 140,
      }),
    ).toEqual(
      [
        {
          fromX: 0,
          fromY: 25,
          toX: 0,
          toY: 25,
          dist: 0,
        },
        {
          fromX: 30,
          fromY: 10,
          toX: 30,
          toY: 0,
          dist: 10,
        },
      ].filter((measurement) => measurement.dist >= 1),
    );
  });

  it("computes nearest wall clearances for a multi-item group bounds box", () => {
    expect(
      getNearestBoundsClearances(
        {
          minX: 20,
          maxX: 90,
          minY: 30,
          maxY: 80,
        },
        {
          minX: 0,
          maxX: 120,
          minY: 0,
          maxY: 140,
        },
        {
          x: 55,
          y: 55,
        },
      ),
    ).toEqual([
      {
        fromX: 20,
        fromY: 55,
        toX: 0,
        toY: 55,
        dist: 20,
      },
      {
        fromX: 55,
        fromY: 30,
        toX: 55,
        toY: 0,
        dist: 30,
      },
    ]);
  });

  it("finds the closest edge and center alignment matches against other furniture bounds", () => {
    expect(
      getFurnitureAlignmentMatches(
        {
          minX: 10,
          maxX: 40,
          minY: 10,
          maxY: 30,
        },
        [
          {
            minX: 42,
            maxX: 72,
            minY: 0,
            maxY: 40,
          },
        ],
        3,
      ),
    ).toEqual({
      x: {
        delta: 2,
        position: 42,
        reference: "end",
        targetBounds: {
          minX: 42,
          maxX: 72,
          minY: 0,
          maxY: 40,
        },
        targetReference: "start",
      },
      y: {
        delta: 0,
        position: 20,
        reference: "center",
        targetBounds: {
          minX: 42,
          maxX: 72,
          minY: 0,
          maxY: 40,
        },
        targetReference: "center",
      },
    });
  });

  it("skips alignment axes that are disabled or outside the threshold", () => {
    expect(
      getFurnitureAlignmentMatches(
        {
          minX: 10,
          maxX: 40,
          minY: 10,
          maxY: 30,
        },
        [
          {
            minX: 46,
            maxX: 76,
            minY: 50,
            maxY: 70,
          },
        ],
        4,
        { x: true, y: false },
      ),
    ).toEqual({
      x: null,
      y: null,
    });
  });

  it("detects overlapping rectangles", () => {
    const a = createItem();
    const b = createItem({ id: "b", x: 20 });

    expect(checkFurnitureCollision(a, b)).toBe(true);
  });

  it("does not treat rugs overlapping furniture as a collision", () => {
    const rug = createItem({
      type: "rug",
      name: "Rug",
      width: 72,
      depth: 48,
    });
    const chair = createItem({
      id: "b",
      type: "chair",
      name: "Chair",
      width: 24,
      depth: 24,
      x: 8,
      y: 4,
    });

    expect(checkFurnitureCollision(rug, chair)).toBe(false);
    expect(checkFurnitureCollision(chair, rug)).toBe(false);
  });

  it("does not treat edge-touching rectangles as a collision", () => {
    const a = createItem();
    const b = createItem({ id: "b", x: 60 });

    expect(checkFurnitureCollision(a, b)).toBe(false);
  });

  it("does not flag nearby rotated rectangles that do not touch", () => {
    const a = createItem({ rotation: 45 });
    const b = createItem({ id: "b", x: 64, y: 0, rotation: -45 });

    expect(checkFurnitureCollision(a, b)).toBe(false);
  });

  it("detects rotated rectangle overlap", () => {
    const a = createItem({ rotation: 45 });
    const b = createItem({ id: "b", x: 15, y: 5, rotation: -15 });

    expect(checkFurnitureCollision(a, b)).toBe(true);
  });

  it("handles circle-to-circle collision and touching correctly", () => {
    const a = createItem({
      shape: "circle",
      width: 40,
      depth: 40,
      type: "table",
    });
    const touching = createItem({
      id: "b",
      shape: "circle",
      width: 40,
      depth: 40,
      type: "table",
      x: 40,
    });
    const overlapping = createItem({
      id: "c",
      shape: "circle",
      width: 40,
      depth: 40,
      type: "table",
      x: 39.5,
    });

    expect(checkFurnitureCollision(a, touching)).toBe(false);
    expect(checkFurnitureCollision(a, overlapping)).toBe(true);
  });

  it("handles circle-to-rectangle collision and separation correctly", () => {
    const rectangle = createItem({ width: 60, depth: 30 });
    const separatedCircle = createItem({
      id: "b",
      shape: "circle",
      width: 20,
      depth: 20,
      type: "table",
      x: 41,
    });
    const overlappingCircle = createItem({
      id: "c",
      shape: "circle",
      width: 20,
      depth: 20,
      type: "table",
      x: 39,
    });

    expect(checkFurnitureCollision(rectangle, separatedCircle)).toBe(false);
    expect(checkFurnitureCollision(rectangle, overlappingCircle)).toBe(true);
  });

  it("does not flag furniture that stays inside the room polygon", () => {
    expect(
      checkFurnitureRoomCollision(createItem({ x: 60, y: 50, rotation: 30 }), roomPolygon),
    ).toBe(false);
  });

  it("flags rectangular furniture that extends beyond a room wall", () => {
    expect(checkFurnitureRoomCollision(createItem({ x: 105, y: 50 }), roomPolygon)).toBe(true);
  });

  it("allows circular furniture to touch a wall but not cross it", () => {
    expect(
      checkFurnitureRoomCollision(
        createItem({
          shape: "circle",
          type: "table",
          width: 24,
          depth: 24,
          x: 12,
          y: 50,
        }),
        roomPolygon,
      ),
    ).toBe(false);

    expect(
      checkFurnitureRoomCollision(
        createItem({
          shape: "circle",
          type: "table",
          width: 24,
          depth: 24,
          x: 11.5,
          y: 50,
        }),
        roomPolygon,
      ),
    ).toBe(true);
  });

  it("snaps nearby furniture edges flush to the closest room wall", () => {
    expect(snapFurnitureToRoomWalls(createItem({ x: 89, y: 50 }), roomPolygon, 2)).toMatchObject({
      x: 90,
      y: 50,
    });
  });

  it("pulls slightly out-of-bounds furniture back inside when close to a wall", () => {
    expect(snapFurnitureToRoomWalls(createItem({ x: 91, y: 50 }), roomPolygon, 2)).toMatchObject({
      x: 90,
      y: 50,
    });
  });

  it("snaps moved furniture clearances to the nearest inch grid", () => {
    expect(
      snapFurnitureToBoundsGrid(
        createItem({
          x: 40.955,
          y: 50,
        }),
        {
          minX: 0,
          maxX: 120,
          minY: 0,
          maxY: 100,
        },
        1,
        { x: true, y: false },
      ),
    ).toMatchObject({
      x: 41,
      y: 50,
    });
  });

  it("snaps using the closer right wall when that is the nearest reference", () => {
    expect(
      snapFurnitureToBoundsGrid(
        createItem({
          x: 84.045,
          y: 50,
        }),
        {
          minX: 0,
          maxX: 120,
          minY: 0,
          maxY: 100,
        },
        1,
        { x: true, y: false },
      ),
    ).toMatchObject({
      x: 84,
      y: 50,
    });
  });

  it("does not snap furniture that is not close to a room wall", () => {
    expect(snapFurnitureToRoomWalls(createItem({ x: 75, y: 50 }), roomPolygon, 2)).toMatchObject({
      x: 75,
      y: 50,
    });
  });

  it("snaps a rotated rectangle when a corner is close to the wall", () => {
    const snapped = snapFurnitureToRoomWalls(
      createItem({
        x: 106,
        y: 50,
        width: 24,
        depth: 24,
        rotation: 45,
      }),
      roomPolygon,
      4,
    );

    expect(snapped.x).toBeLessThan(106);
    expect(checkFurnitureRoomCollision(snapped, roomPolygon)).toBe(false);
  });
});
