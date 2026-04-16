import { describe, expect, it } from "vite-plus/test";

import {
  calculateFitViewState,
  getWallInteriorUnitNormal,
  getWallLabelLayout,
  shouldDrawSelectedWallMeasurements,
} from "@/components/canvas";
import type { Point } from "@/types";

const ROOM_POINTS: Point[] = [
  { x: 0, y: 0 },
  { x: 144, y: 0 },
  { x: 144, y: 120 },
  { x: 0, y: 120 },
];

function doRectsOverlap(
  a: { maxX: number; maxY: number; minX: number; minY: number },
  b: { maxX: number; maxY: number; minX: number; minY: number },
) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function doesCircleOverlapRect(
  circle: { center: Point; radius: number },
  rect: { maxX: number; maxY: number; minX: number; minY: number },
) {
  const closestX = Math.max(rect.minX, Math.min(circle.center.x, rect.maxX));
  const closestY = Math.max(rect.minY, Math.min(circle.center.y, rect.maxY));
  const dx = circle.center.x - closestX;
  const dy = circle.center.y - closestY;

  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

describe("calculateFitViewState", () => {
  it("returns null when the viewport cannot accommodate fit padding", () => {
    expect(
      calculateFitViewState(
        {
          centerX: 150,
          centerY: 75,
          height: 150,
          maxX: 300,
          minX: 0,
          width: 300,
        },
        ROOM_POINTS,
      ),
    ).toBeNull();
  });

  it("returns a positive zoom for a valid viewport", () => {
    const fitView = calculateFitViewState(
      {
        centerX: 600,
        centerY: 400,
        height: 800,
        maxX: 1200,
        minX: 0,
        width: 1200,
      },
      ROOM_POINTS,
    );

    expect(fitView).toEqual(
      expect.objectContaining({
        centerX: 72,
        centerY: 60,
      }),
    );
    expect(fitView?.zoom).toBeGreaterThan(0);
  });
});

describe("getWallInteriorUnitNormal", () => {
  const roomCentroid = { x: 72, y: 60 };

  it("points into the room for the top wall of a rectangle", () => {
    const normal = getWallInteriorUnitNormal({ x: 0, y: 0 }, { x: 144, y: 0 }, roomCentroid);

    expect(normal.x).toBeCloseTo(0);
    expect(normal.y).toBeCloseTo(1);
  });

  it("points into the room for the left wall of a rectangle", () => {
    const normal = getWallInteriorUnitNormal({ x: 0, y: 120 }, { x: 0, y: 0 }, roomCentroid);

    expect(normal.x).toBeCloseTo(1);
    expect(normal.y).toBeCloseTo(0);
  });
});

describe("getWallLabelLayout", () => {
  const canvasBounds = {
    maxX: 500,
    maxY: 500,
    minX: 0,
    minY: 0,
  };

  it("moves labels far enough outward to clear endpoint handles on short walls", () => {
    const endpointObstacles = [
      { center: { x: 80, y: 100 }, radius: 15 },
      { center: { x: 120, y: 100 }, radius: 15 },
    ];
    const layout = getWallLabelLayout({
      anchor: { x: 100, y: 100 },
      canvasBounds,
      labelHeight: 18,
      labelWidth: 60,
      obstacleCircles: endpointObstacles,
      obstacleRects: [],
      outwardNormal: { x: 0, y: -1 },
      tangent: { x: 1, y: 0 },
    });

    expect(layout.bounds.maxY).toBeLessThan(100);
    expect(endpointObstacles.some((circle) => doesCircleOverlapRect(circle, layout.bounds))).toBe(
      false,
    );
  });

  it("avoids previously placed label bounds", () => {
    const obstacleRect = {
      maxX: 145,
      maxY: 70,
      minX: 55,
      minY: 40,
    };
    const layout = getWallLabelLayout({
      anchor: { x: 100, y: 100 },
      canvasBounds,
      labelHeight: 18,
      labelWidth: 56,
      obstacleCircles: [],
      obstacleRects: [obstacleRect],
      outwardNormal: { x: 0, y: -1 },
      tangent: { x: 1, y: 0 },
    });

    expect(doRectsOverlap(layout.bounds, obstacleRect)).toBe(false);
  });
});

describe("shouldDrawSelectedWallMeasurements", () => {
  it("returns false when the selected wall would only duplicate the default full-wall label", () => {
    expect(shouldDrawSelectedWallMeasurements(120, [])).toBe(false);
  });

  it("returns true when features split the wall into meaningful spans", () => {
    expect(
      shouldDrawSelectedWallMeasurements(120, [
        {
          id: "window-1",
          offset: 24,
          type: "window",
          width: 24,
        },
      ]),
    ).toBe(true);

    expect(
      shouldDrawSelectedWallMeasurements(120, [
        {
          id: "door-1",
          offset: 48,
          type: "door",
          width: 24,
        },
      ]),
    ).toBe(true);
  });
});
