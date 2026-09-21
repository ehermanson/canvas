import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  Canvas,
  calculateFitViewState,
  findFurnitureAtPoint,
  getExactFurnitureNudgeUpdates,
  getWallInteriorUnitNormal,
  getWallLabelLayout,
  shouldDrawSelectedWallMeasurements,
} from "@/components/canvas";
import { useRoomPlanner } from "@/hooks/use-floor-planner";
import { ThemeProvider } from "@/hooks/use-theme";
import { createDefaultPlannerState } from "@/lib/planner-state";
import type { FurnitureItem, Point } from "@/types";

const ROOM_POINTS: Point[] = [
  { x: 0, y: 0 },
  { x: 144, y: 0 },
  { x: 144, y: 120 },
  { x: 0, y: 120 },
];

const OVAL: FurnitureItem = {
  id: "oval",
  type: "custom",
  name: "Oval table",
  shape: "circle",
  width: 60,
  depth: 30,
  x: 72,
  y: 60,
  rotation: 0,
  color: "#38bdf8",
  locked: false,
};

describe("canvas furniture interaction helpers", () => {
  it("does not select a point inside an oval's bounds but outside its visible footprint", () => {
    expect(findFurnitureAtPoint([OVAL], { x: 97, y: 70 })).toBeNull();
    expect(findFurnitureAtPoint([OVAL], { x: 92, y: 65 })?.id).toBe("oval");
  });

  it("nudges a furniture group by an exact shared delta", () => {
    const second = { ...OVAL, id: "second", x: 100, y: 80 };
    expect(
      getExactFurnitureNudgeUpdates([OVAL, second], [OVAL.id, second.id], { x: 1, y: 0 }),
    ).toEqual([
      { id: OVAL.id, x: 73, y: 60 },
      { id: second.id, x: 101, y: 80 },
    ]);
  });
});

describe("Canvas keyboard handling", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    Object.defineProperties(HTMLCanvasElement.prototype, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
  });

  it("moves exactly while a keyboard furniture selector is focused and leaves input Undo native", () => {
    const undo = vi.fn();
    function Harness() {
      const [state] = useState(() => ({
        ...createDefaultPlannerState("in"),
        furniture: [OVAL],
      }));
      const planner = useRoomPlanner(state);
      const item = planner.furniture[0];
      return (
        <>
          <button
            type="button"
            data-sidebar-furniture-id={item.id}
            onClick={() => planner.setSelectedId(item.id)}
          >
            Select oval
          </button>
          <input aria-label="Furniture name" defaultValue="Oval table" />
          <output data-testid="position">
            {item.x},{item.y}
          </output>
          <Canvas planner={{ ...planner, undo }} />
        </>
      );
    }

    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    const selector = screen.getByRole("button", { name: "Select oval" });
    fireEvent.click(selector);
    selector.focus();
    fireEvent.keyDown(selector, { key: "ArrowRight" });
    expect(screen.getByTestId("position").textContent).toBe("73,60");
    expect(screen.getByText("Moved Oval table 1 inch")).toBeTruthy();

    const input = screen.getByRole("textbox", { name: "Furniture name" });
    input.focus();
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
  });

  it("rolls back a live furniture drag when a second pointer begins a pinch", () => {
    function Harness() {
      const [state] = useState(() => ({
        ...createDefaultPlannerState("in"),
        furniture: [OVAL],
      }));
      const planner = useRoomPlanner(state);
      const item = planner.furniture[0];
      return (
        <>
          <output data-testid="position">
            {item.x},{item.y}
          </output>
          <Canvas planner={planner} />
        </>
      );
    }

    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();

    fireEvent.pointerDown(canvas!, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 72,
      clientY: 60,
    });
    fireEvent.pointerMove(canvas!, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 92,
      clientY: 60,
    });
    expect(screen.getByTestId("position").textContent).toBe("92,60");

    fireEvent.pointerDown(canvas!, {
      pointerId: 2,
      pointerType: "touch",
      button: 0,
      clientX: 120,
      clientY: 90,
    });
    expect(screen.getByTestId("position").textContent).toBe("72,60");

    fireEvent.pointerUp(canvas!, { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(canvas!, { pointerId: 2, pointerType: "touch" });
    expect(screen.getByTestId("position").textContent).toBe("72,60");
  });

  it("rolls back on pointer cancellation and accepts the next independent drag", () => {
    function Harness() {
      const [state] = useState(() => ({
        ...createDefaultPlannerState("in"),
        furniture: [OVAL],
      }));
      const planner = useRoomPlanner(state);
      const item = planner.furniture[0];
      return (
        <>
          <output data-testid="position">
            {item.x},{item.y}
          </output>
          <Canvas planner={planner} />
        </>
      );
    }

    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    const canvas = document.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, {
      pointerId: 3,
      pointerType: "touch",
      button: 0,
      clientX: 72,
      clientY: 60,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 3,
      pointerType: "touch",
      clientX: 92,
      clientY: 60,
    });
    expect(screen.getByTestId("position").textContent).toBe("92,60");
    fireEvent.pointerCancel(canvas, { pointerId: 3, pointerType: "touch" });
    expect(screen.getByTestId("position").textContent).toBe("72,60");

    fireEvent.pointerDown(canvas, {
      pointerId: 4,
      pointerType: "mouse",
      button: 0,
      clientX: 72,
      clientY: 60,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 82,
      clientY: 60,
    });
    fireEvent.pointerUp(canvas, { pointerId: 4, pointerType: "mouse" });
    expect(screen.getByTestId("position").textContent).toBe("82,60");
  });
});

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
