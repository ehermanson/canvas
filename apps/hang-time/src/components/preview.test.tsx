import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CalculatorState } from "@/types";
import { calculateLayout } from "@/utils/calculations";
import { galleryOffsetForMove, Preview } from "./preview";

const viewport = vi.hoisted(() => ({
  setPan: vi.fn(),
  setZoom: vi.fn(),
  startPan: vi.fn(),
  stopPan: vi.fn(),
  updatePan: vi.fn(),
  zoomAtPoint: vi.fn(),
}));

vi.mock("@canvas-tools/viewport", () => ({
  useElementSize: () => ({ width: 1000, height: 700 }),
  useViewportController: () => ({
    fitToView: vi.fn(),
    pan: { x: 0, y: 0 },
    setPan: viewport.setPan,
    setZoom: viewport.setZoom,
    startPan: viewport.startPan,
    stepZoom: vi.fn(),
    stopPan: viewport.stopPan,
    updatePan: viewport.updatePan,
    zoom: 1,
    zoomAtPoint: viewport.zoomAtPoint,
    zoomPercent: 100,
  }),
}));

vi.mock("@canvas-tools/ui", () => ({
  ViewportToolbar: ({ children, ...props }: { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  ViewportToolbarButton: ({
    children,
    kind: _kind,
    ...props
  }: {
    children: ReactNode;
    kind?: string;
  }) => <button {...props}>{children}</button>,
  ViewportToolbarValue: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: { children: ReactNode }) => <label {...props}>{children}</label>,
}));

const state: CalculatorState = {
  unit: "in",
  wallWidth: 120,
  wallHeight: 96,
  frames: [{ id: "frame-a", width: 16, height: 20, row: 0 }],
  uniformSize: false,
  frameWidth: 16,
  frameHeight: 20,
  hangingOffset: 2,
  hangingType: "center",
  hookInset: 3,
  hSpacing: 3,
  hDistribution: "fixed",
  anchorType: "center",
  anchorValue: 0,
  hAnchorType: "center",
  hAnchorValue: 0,
  galleryOffsetX: 0,
  galleryOffsetY: 0,
  furnitureWidth: 48,
  furnitureHeight: 30,
  furnitureAnchor: "center",
  furnitureOffset: 0,
  frameFurnitureAlign: "center",
  furnitureVAnchor: "above-furniture",
  rowSpacing: 3,
  rowConfigs: [],
  vAlign: "center",
};

function makeCalculator() {
  const result = calculateLayout(state);
  return {
    state,
    layoutPositions: result.positions,
    layoutResult: result,
    setFrames: vi.fn(),
    setGalleryOffset: vi.fn(),
    resetGalleryOffset: vi.fn(),
    setUnit: vi.fn(),
  };
}

function StatefulPreview({ offsets }: { offsets: Array<[number, number]> }) {
  const [current, setCurrent] = useState({
    ...state,
    frames: [
      { id: "frame-a", width: 16, height: 20, row: 0 },
      { id: "frame-b", width: 16, height: 20, row: 0 },
    ],
  });
  const result = calculateLayout(current);
  return (
    <Preview
      calculator={
        {
          state: current,
          layoutPositions: result.positions,
          layoutResult: result,
          setFrames: vi.fn(),
          setGalleryOffset: (x: number, y: number) => {
            offsets.push([x, y]);
            setCurrent((previous) => ({ ...previous, galleryOffsetX: x, galleryOffsetY: y }));
          },
          resetGalleryOffset: vi.fn(),
          setUnit: vi.fn(),
        } as never
      }
    />
  );
}

beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  window.PointerEvent = TestPointerEvent as typeof PointerEvent;
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () =>
      new Proxy(
        {},
        {
          get: (_target, property) =>
            property === "measureText" ? () => ({ width: 20 }) : vi.fn(),
          set: () => true,
        },
      ),
  });
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => true);
});

beforeEach(() => vi.clearAllMocks());

describe("Preview pointer interactions", () => {
  it("uses a second pointer for an anchored pinch and cancels an active gallery move", () => {
    const calculator = makeCalculator();
    const { container } = render(<Preview calculator={calculator as never} />);
    const canvas = container.querySelector("canvas")!;
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 10,
        top: 20,
        width: 1000,
        height: 700,
        right: 1010,
        bottom: 720,
        x: 10,
        y: 20,
        toJSON() {},
      }),
    });

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 400,
      clientY: 330,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 420,
      clientY: 340,
    });
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "touch",
      button: 0,
      clientX: 500,
      clientY: 300,
    });
    expect(calculator.setGalleryOffset).toHaveBeenLastCalledWith(0, 0);
    expect(calculator.setFrames).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 600,
      clientY: 300,
    });
    expect(viewport.setZoom).toHaveBeenCalled();
    expect(viewport.setPan).toHaveBeenCalled();
    const nextZoom = viewport.setZoom.mock.calls[viewport.setZoom.mock.calls.length - 1]?.[0];
    const nextPan = viewport.setPan.mock.calls[viewport.setPan.mock.calls.length - 1]?.[0];
    const startMidpoint = { x: (420 + 500) / 2 - 10, y: (340 + 300) / 2 - 20 };
    const worldAnchor = startMidpoint;
    const movedMidpoint = { x: (420 + 600) / 2 - 10, y: (340 + 300) / 2 - 20 };
    expect(nextPan).toEqual({
      x: movedMidpoint.x - worldAnchor.x * nextZoom,
      y: movedMidpoint.y - worldAnchor.y * nextZoom,
    });

    fireEvent.pointerCancel(canvas, { pointerId: 2, pointerType: "touch" });
    expect(viewport.stopPan).toHaveBeenCalled();
  });

  it("computes every drag move from the captured offset instead of accumulating rerenders", () => {
    const start = { x: 3, y: -2 };
    const bounds = { minX: 20, minY: 10 };
    expect(galleryOffsetForMove(start, bounds, 25, 12)).toEqual({ x: 8, y: 0 });
    expect(galleryOffsetForMove(start, bounds, 30, 14)).toEqual({ x: 13, y: 2 });
  });

  it("moves a multi-frame gallery through the visible mode and restores its start offset on cancel", () => {
    const offsets: Array<[number, number]> = [];
    const { container } = render(<StatefulPreview offsets={offsets} />);
    const toggle = screen.getByRole("button", { name: "Move whole gallery" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    const canvas = container.querySelector("canvas")!;
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 1000,
        height: 700,
        right: 1000,
        bottom: 700,
        x: 0,
        y: 0,
        toJSON() {},
      }),
    });
    // First frame is x=42.5..58.5 and y=38..58 wall units at 6.875 px/unit.
    fireEvent.pointerDown(canvas, {
      pointerId: 20,
      pointerType: "touch",
      button: 0,
      clientX: 350,
      clientY: 320,
    });
    expect(viewport.startPan).not.toHaveBeenCalled();
    fireEvent.pointerMove(canvas, {
      pointerId: 20,
      pointerType: "touch",
      clientX: 370,
      clientY: 320,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 20,
      pointerType: "touch",
      clientX: 390,
      clientY: 320,
    });
    expect(offsets.length).toBeGreaterThanOrEqual(2);
    expect(offsets[offsets.length - 1][0]).toBeCloseTo(offsets[offsets.length - 2][0] * 2);
    fireEvent.pointerCancel(canvas, { pointerId: 20, pointerType: "touch" });
    expect(offsets[offsets.length - 1]).toEqual([0, 0]);
  });

  it("does not start a canvas gesture from toolbar controls", () => {
    render(<Preview calculator={makeCalculator() as never} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reset gallery position" }), {
      pointerId: 3,
      pointerType: "touch",
    });
    expect(viewport.startPan).not.toHaveBeenCalled();
  });
});
