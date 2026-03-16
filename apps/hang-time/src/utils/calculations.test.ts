import { describe, expect, it } from "vite-plus/test";
import type { CalculatorState, GalleryFrame } from "@/types";
import {
  calculateLayoutPositions,
  formatMeasurement,
  formatShort,
  fromDisplayUnit,
  INCH_TO_CM,
  toDisplayUnit,
} from "./calculations";

// Helper to create frames
const createFrame = (width: number, height: number, row?: number): GalleryFrame => ({
  id: Math.random().toString(36).substring(7),
  width,
  height,
  row,
});

const createFrames = (count: number, width: number, height: number): GalleryFrame[] =>
  Array.from({ length: count }, () => createFrame(width, height));

// Default state factory for tests
const createDefaultState = (overrides: Partial<CalculatorState> = {}): CalculatorState => ({
  unit: "in",
  wallWidth: 120,
  wallHeight: 96,
  frames: createFrames(1, 16, 20),
  uniformSize: true,
  frameWidth: 16,
  frameHeight: 20,
  hangingOffset: 2,
  hangingType: "center",
  hookInset: 2,
  hSpacing: 4,
  hDistribution: "fixed",
  anchorType: "center",
  anchorValue: 0,
  hAnchorType: "center",
  hAnchorValue: 0,
  furnitureWidth: 48,
  furnitureHeight: 30,
  furnitureAnchor: "center",
  furnitureOffset: 0,
  frameFurnitureAlign: "center",
  furnitureVAnchor: "above-furniture",
  vAlign: "center",
  rowSpacing: 3,
  rowConfigs: [],
  ...overrides,
});

describe("Unit Conversion", () => {
  describe("toDisplayUnit", () => {
    it("returns value unchanged for inches", () => {
      expect(toDisplayUnit(10, "in")).toBe(10);
    });

    it("converts inches to centimeters", () => {
      expect(toDisplayUnit(10, "cm")).toBe(10 * INCH_TO_CM);
    });

    it("handles zero", () => {
      expect(toDisplayUnit(0, "in")).toBe(0);
      expect(toDisplayUnit(0, "cm")).toBe(0);
    });

    it("handles decimal values", () => {
      expect(toDisplayUnit(2.5, "cm")).toBeCloseTo(6.35);
    });
  });

  describe("fromDisplayUnit", () => {
    it("returns value unchanged for inches", () => {
      expect(fromDisplayUnit(10, "in")).toBe(10);
    });

    it("converts centimeters to inches", () => {
      expect(fromDisplayUnit(25.4, "cm")).toBeCloseTo(10);
    });

    it("handles zero", () => {
      expect(fromDisplayUnit(0, "in")).toBe(0);
      expect(fromDisplayUnit(0, "cm")).toBe(0);
    });

    it("roundtrips correctly", () => {
      const original = 15;
      const converted = toDisplayUnit(original, "cm");
      const backConverted = fromDisplayUnit(converted, "cm");
      expect(backConverted).toBeCloseTo(original);
    });
  });
});

describe("Measurement Formatting", () => {
  describe("formatMeasurement", () => {
    it("formats inches with quote suffix", () => {
      expect(formatMeasurement(10, "in")).toBe('10"');
    });

    it("formats centimeters with cm suffix", () => {
      expect(formatMeasurement(10, "cm")).toBe("10 cm");
    });

    it("trims trailing zeros for inches", () => {
      expect(formatMeasurement(10.5, "in")).toBe('10.5"');
      expect(formatMeasurement(10.0, "in")).toBe('10"');
    });

    it("shows up to 3 decimals for inches", () => {
      expect(formatMeasurement(10.125, "in")).toBe('10.125"');
      expect(formatMeasurement(10.1256, "in")).toBe('10.126"');
    });

    it("shows up to 1 decimal for centimeters", () => {
      expect(formatMeasurement(10.5, "cm")).toBe("10.5 cm");
      expect(formatMeasurement(10.55, "cm")).toBe("10.6 cm");
    });

    it("handles zero", () => {
      expect(formatMeasurement(0, "in")).toBe('0"');
      expect(formatMeasurement(0, "cm")).toBe("0 cm");
    });
  });

  describe("formatShort", () => {
    it("formats inches with quote suffix (no space)", () => {
      expect(formatShort(10, "in")).toBe('10"');
    });

    it("formats centimeters with cm suffix (no space)", () => {
      expect(formatShort(10, "cm")).toBe("10cm");
    });

    it("trims trailing zeros", () => {
      expect(formatShort(10.0, "in")).toBe('10"');
      expect(formatShort(10.0, "cm")).toBe("10cm");
    });
  });
});

describe("calculateLayoutPositions", () => {
  describe("Basic Layout", () => {
    it("returns correct number of frames", () => {
      const state = createDefaultState({
        frames: createFrames(4, 16, 20),
      });
      const positions = calculateLayoutPositions(state);
      expect(positions).toHaveLength(4);
    });

    it("assigns sequential IDs starting from 1", () => {
      const state = createDefaultState({
        frames: createFrames(3, 16, 20),
      });
      const positions = calculateLayoutPositions(state);
      expect(positions.map((p) => p.id)).toEqual([1, 2, 3]);
    });

    it("uses uniform dimensions when uniformSize is true", () => {
      const frames = [createFrame(10, 10), createFrame(20, 20), createFrame(30, 30)];
      const state = createDefaultState({
        frames,
        uniformSize: true,
        frameWidth: 16,
        frameHeight: 20,
      });
      const positions = calculateLayoutPositions(state);
      positions.forEach((p) => {
        expect(p.width).toBe(16);
        expect(p.height).toBe(20);
      });
    });

    it("uses individual frame dimensions when uniformSize is false", () => {
      const frames = [createFrame(10, 12), createFrame(20, 22), createFrame(30, 32)];
      const state = createDefaultState({
        frames,
        uniformSize: false,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].width).toBe(10);
      expect(positions[0].height).toBe(12);
      expect(positions[1].width).toBe(20);
      expect(positions[1].height).toBe(22);
      expect(positions[2].width).toBe(30);
      expect(positions[2].height).toBe(32);
    });
  });

  describe("Center Hook (default)", () => {
    it("positions hook at frame center horizontally", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        hAnchorType: "left",
        hAnchorValue: 0,
        hDistribution: "fixed",
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].hookX).toBe(10); // 0 + 20/2
    });

    it("positions hook at hangingOffset from top", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        hangingOffset: 3,
        anchorType: "ceiling",
        anchorValue: 0,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].hookY).toBe(3); // y=0 + hangingOffset=3
    });

    it("does not set hookX2 or hookGap", () => {
      const state = createDefaultState({ hangingType: "center" });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].hookX2).toBeUndefined();
      expect(positions[0].hookGap).toBeUndefined();
    });
  });

  describe("Dual Hooks", () => {
    it("positions two hooks with correct inset", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        hangingType: "dual",
        hookInset: 3,
        hAnchorType: "left",
        hAnchorValue: 0,
        hDistribution: "fixed",
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].hookX).toBe(3); // left hook: x + inset
      expect(positions[0].hookX2).toBe(17); // right hook: x + width - inset
      expect(positions[0].hookGap).toBe(14); // width - 2*inset
    });
  });

  describe("Horizontal Distribution Modes", () => {
    const createDistributionState = (
      hDistribution: "fixed" | "space-between" | "space-evenly" | "space-around",
    ) =>
      createDefaultState({
        frames: createFrames(3, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hDistribution,
      });

    it("space-between: first at edge, last at edge", () => {
      const state = createDistributionState("space-between");
      const positions = calculateLayoutPositions(state);
      // Available space = 100 - (3*20) = 40
      // Spacing = 40 / (3-1) = 20
      expect(positions[0].x).toBe(0);
      expect(positions[1].x).toBe(40); // 0 + 20 + 20
      expect(positions[2].x).toBe(80); // 0 + 2*(20+20)
    });

    it("space-evenly: equal space at edges and between", () => {
      const state = createDistributionState("space-evenly");
      const positions = calculateLayoutPositions(state);
      // Available space = 100 - (3*20) = 40
      // Spacing = 40 / (3+1) = 10
      expect(positions[0].x).toBe(10);
      expect(positions[1].x).toBe(40); // 10 + 20 + 10
      expect(positions[2].x).toBe(70); // 10 + 2*(20+10)
    });

    it("space-around: half space at edges, full between", () => {
      const state = createDistributionState("space-around");
      const positions = calculateLayoutPositions(state);
      // Available space = 100 - (3*20) = 40
      // Spacing = 40 / 3 ≈ 13.33
      // Start = spacing/2 ≈ 6.67
      const spacing = 40 / 3;
      expect(positions[0].x).toBeCloseTo(spacing / 2);
      expect(positions[1].x).toBeCloseTo(spacing / 2 + 20 + spacing);
    });

    it("fixed with center anchor: centers group on wall", () => {
      const state = createDefaultState({
        frames: createFrames(3, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hDistribution: "fixed",
        hAnchorType: "center",
        hSpacing: 4,
      });
      const positions = calculateLayoutPositions(state);
      // Total width = 3*20 + 2*4 = 68
      // Start = (100 - 68) / 2 = 16
      expect(positions[0].x).toBe(16);
    });

    it("fixed with left anchor: positions from left edge", () => {
      const state = createDefaultState({
        frames: createFrames(3, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hDistribution: "fixed",
        hAnchorType: "left",
        hAnchorValue: 10,
        hSpacing: 4,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].x).toBe(10);
    });

    it("fixed with right anchor: positions from right edge", () => {
      const state = createDefaultState({
        frames: createFrames(3, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hDistribution: "fixed",
        hAnchorType: "right",
        hAnchorValue: 10,
        hSpacing: 4,
      });
      const positions = calculateLayoutPositions(state);
      // Total width = 3*20 + 2*4 = 68
      // Start = wallWidth - totalWidth - anchorValue = 100 - 68 - 10 = 22
      expect(positions[0].x).toBe(22);
    });
  });

  describe("Vertical Anchor Types", () => {
    it("center: vertically centers frame", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        uniformSize: true,
        frameHeight: 20,
        wallHeight: 100,
        anchorType: "center",
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].y).toBe(40); // (100 - 20) / 2
    });

    it("ceiling: positions from top", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        uniformSize: true,
        frameHeight: 20,
        wallHeight: 100,
        anchorType: "ceiling",
        anchorValue: 15,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].y).toBe(15);
    });

    it("floor: positions from bottom", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        uniformSize: true,
        frameHeight: 20,
        wallHeight: 100,
        anchorType: "floor",
        anchorValue: 10,
      });
      const positions = calculateLayoutPositions(state);
      // y = wallHeight - anchorValue - totalHeight = 100 - 10 - 20 = 70
      expect(positions[0].y).toBe(70);
    });

    it("furniture: positions above furniture", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        uniformSize: true,
        frameHeight: 20,
        wallHeight: 100,
        anchorType: "furniture",
        anchorValue: 5, // gap above furniture
        furnitureHeight: 30,
      });
      const positions = calculateLayoutPositions(state);
      // furnitureTop = 100 - 30 = 70
      // y = 70 - 5 - 20 = 45
      expect(positions[0].y).toBe(45);
    });
  });

  describe("Multi-Row Layout", () => {
    it("respects row assignment", () => {
      const frames = [
        createFrame(16, 20, 0),
        createFrame(16, 20, 1),
        createFrame(16, 20, 0),
        createFrame(16, 20, 1),
      ];
      const state = createDefaultState({
        frames,
        uniformSize: true,
        frameWidth: 16,
        frameHeight: 20,
      });
      const positions = calculateLayoutPositions(state);
      // Frames should be grouped by their row assignment
      expect(positions.filter((p) => p.row === 0)).toHaveLength(2);
      expect(positions.filter((p) => p.row === 1)).toHaveLength(2);
    });
  });

  describe("Vertical Alignment within Rows", () => {
    it("vAlign top: aligns frames to top of row", () => {
      const frames = [
        createFrame(16, 10, 0), // short frame
        createFrame(16, 20, 0), // tall frame
      ];
      const state = createDefaultState({
        frames,
        uniformSize: false,
        vAlign: "top",
        anchorType: "ceiling",
        anchorValue: 0,
      });
      const positions = calculateLayoutPositions(state);
      // Both frames should start at y=0 (top aligned)
      expect(positions[0].y).toBe(0);
      expect(positions[1].y).toBe(0);
    });

    it("vAlign bottom: aligns frames to bottom of row", () => {
      const frames = [
        createFrame(16, 10, 0), // short frame
        createFrame(16, 20, 0), // tall frame
      ];
      const state = createDefaultState({
        frames,
        uniformSize: false,
        vAlign: "bottom",
        anchorType: "ceiling",
        anchorValue: 0,
      });
      const positions = calculateLayoutPositions(state);
      // Row height is 20 (max of frames)
      // Short frame should be at y = 0 + (20 - 10) = 10
      // Tall frame should be at y = 0
      expect(positions[0].y).toBe(10); // short frame pushed down
      expect(positions[1].y).toBe(0); // tall frame at top
    });

    it("vAlign center: centers frames within row", () => {
      const frames = [
        createFrame(16, 10, 0), // short frame
        createFrame(16, 20, 0), // tall frame
      ];
      const state = createDefaultState({
        frames,
        uniformSize: false,
        vAlign: "center",
        anchorType: "ceiling",
        anchorValue: 0,
      });
      const positions = calculateLayoutPositions(state);
      // Row height is 20 (max of frames)
      // Short frame should be at y = 0 + (20 - 10) / 2 = 5
      // Tall frame should be at y = 0
      expect(positions[0].y).toBe(5); // short frame centered
      expect(positions[1].y).toBe(0); // tall frame at top (fills row)
    });
  });

  describe("Distance Calculations", () => {
    it("calculates fromLeft as distance to hook", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        hAnchorType: "left",
        hAnchorValue: 30,
        hDistribution: "fixed",
      });
      const positions = calculateLayoutPositions(state);
      // hookX = x + width/2 = 30 + 10 = 40
      expect(positions[0].fromLeft).toBe(40);
    });

    it("calculates fromRight as distance from right hook", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hangingType: "dual",
        hookInset: 2,
        hAnchorType: "left",
        hAnchorValue: 30,
        hDistribution: "fixed",
      });
      const positions = calculateLayoutPositions(state);
      // hookX2 = x + width - inset = 30 + 20 - 2 = 48
      // fromRight = wallWidth - hookX2 = 100 - 48 = 52
      expect(positions[0].fromRight).toBe(52);
    });

    it("calculates fromFloor correctly", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        hangingOffset: 2,
        wallHeight: 100,
        anchorType: "ceiling",
        anchorValue: 10,
      });
      const positions = calculateLayoutPositions(state);
      // hookY = y + hangingOffset = 10 + 2 = 12
      // fromFloor = wallHeight - hookY = 100 - 12 = 88
      expect(positions[0].fromFloor).toBe(88);
    });

    it("calculates fromCeiling as hookY", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        hangingOffset: 2,
        anchorType: "ceiling",
        anchorValue: 10,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].fromCeiling).toBe(positions[0].hookY);
    });
  });

  describe("Edge Cases", () => {
    it("handles single frame with space-between (no division by zero)", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        hDistribution: "space-between",
      });
      const positions = calculateLayoutPositions(state);
      expect(positions).toHaveLength(1);
      // With single frame, spacing should be 0, frame at edge
      expect(positions[0].x).toBe(0);
    });

    it("handles empty frames array", () => {
      const state = createDefaultState({ frames: [] });
      const positions = calculateLayoutPositions(state);
      expect(positions).toHaveLength(0);
    });

    it("includes frame dimensions in position output", () => {
      const state = createDefaultState({
        frames: createFrames(1, 25, 35),
        uniformSize: true,
        frameWidth: 25,
        frameHeight: 35,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].width).toBe(25);
      expect(positions[0].height).toBe(35);
    });

    it("includes hangingOffset in position output", () => {
      const state = createDefaultState({
        frames: createFrames(1, 16, 20),
        hangingOffset: 5,
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].hangingOffset).toBe(5);
    });
  });

  describe("Out of Bounds Detection", () => {
    it("marks frame as in bounds when fully within wall", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        frameHeight: 20,
        wallWidth: 100,
        wallHeight: 100,
        hAnchorType: "center",
        anchorType: "center",
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].isOutOfBounds).toBe(false);
    });

    it("marks frame as out of bounds when extending past left edge", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hDistribution: "fixed",
        hAnchorType: "left",
        hAnchorValue: -5, // Starts 5 units off the left edge
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].isOutOfBounds).toBe(true);
    });

    it("marks frame as out of bounds when extending past right edge", () => {
      const state = createDefaultState({
        frames: createFrames(1, 20, 20),
        uniformSize: true,
        frameWidth: 20,
        wallWidth: 100,
        hDistribution: "fixed",
        hAnchorType: "left",
        hAnchorValue: 90, // Starts at 90, ends at 110
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].isOutOfBounds).toBe(true);
    });

    it("frame exactly fitting wall is not out of bounds", () => {
      const state = createDefaultState({
        frames: createFrames(1, 100, 100),
        uniformSize: true,
        frameWidth: 100,
        frameHeight: 100,
        wallWidth: 100,
        wallHeight: 100,
        hDistribution: "fixed",
        hAnchorType: "center",
        anchorType: "center",
      });
      const positions = calculateLayoutPositions(state);
      expect(positions[0].isOutOfBounds).toBe(false);
    });
  });
});
