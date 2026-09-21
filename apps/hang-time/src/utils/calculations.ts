import type {
  CalculatorState,
  Distribution,
  FramePosition,
  GalleryFrame,
  GalleryVAlign,
  LayoutResult,
  ValidationIssue,
} from "@/types";

export const INCH_TO_CM = 2.54;

export const toDisplayUnit = (value: number, unit: "in" | "cm"): number => {
  return unit === "in" ? value : value * INCH_TO_CM;
};

export const fromDisplayUnit = (value: number, unit: "in" | "cm"): number => {
  return unit === "in" ? value : value / INCH_TO_CM;
};

// Format with up to 3 decimal places, trimming trailing zeros
const formatNumber = (value: number, maxDecimals: number): string => {
  const fixed = value.toFixed(maxDecimals);
  // Remove trailing zeros after decimal point
  return fixed.replace(/\.?0+$/, "");
};

export const formatMeasurement = (value: number, unit: "in" | "cm"): string => {
  // Inches: up to 3 decimals (1/8" = 0.125), cm: up to 1 decimal
  const decimals = unit === "in" ? 3 : 1;
  return unit === "in"
    ? `${formatNumber(value, decimals)}"`
    : `${formatNumber(value, decimals)} cm`;
};

export const formatShort = (value: number, unit: "in" | "cm"): string => {
  const decimals = unit === "in" ? 3 : 1;
  return unit === "in" ? `${formatNumber(value, decimals)}"` : `${formatNumber(value, decimals)}cm`;
};

interface LayoutRow {
  id: string;
  frames: { frame: GalleryFrame; originalIndex: number }[];
  width: number;
  height: number;
  hSpacing: number;
  vAlign: GalleryVAlign;
  hDistribution: Distribution;
}

// Get effective frame dimensions (respects uniformSize toggle)
function getFrameDimensions(
  frame: GalleryFrame,
  state: CalculatorState,
): { width: number; height: number } {
  if (state.uniformSize) {
    return { width: state.frameWidth, height: state.frameHeight };
  }
  return { width: frame.width, height: frame.height };
}

export function calculateLayoutPositions(state: CalculatorState): FramePosition[] {
  const {
    frames,
    vAlign,
    rowSpacing,
    rowConfigs,
    hSpacing,
    hDistribution,
    hangingOffset,
    hangingType,
    hookInset,
    anchorType,
    anchorValue,
    hAnchorType,
    hAnchorValue,
    galleryOffsetX = 0,
    galleryOffsetY = 0,
    wallWidth,
    wallHeight,
    furnitureWidth,
    furnitureHeight,
    furnitureAnchor,
    furnitureOffset,
    frameFurnitureAlign,
    furnitureVAnchor,
  } = state;

  if (frames.length === 0) return [];

  // Step 1: Group frames into rows
  const rows: LayoutRow[] = [];
  const rowMap = new Map<number, LayoutRow["frames"]>();
  frames.forEach((frame, index) => {
    const rowNum = frame.row ?? 0;
    if (!rowMap.has(rowNum)) {
      rowMap.set(rowNum, []);
    }
    rowMap.get(rowNum)!.push({ frame, originalIndex: index });
  });

  // Sort by row number and create row objects
  const sortedRowNums = [...rowMap.keys()].sort((a, b) => a - b);
  sortedRowNums.forEach((rowNum) => {
    const rowFrames = rowMap.get(rowNum)!;
    const rowConfig = rowConfigs.find((c) => c.id === `row-${rowNum}`);
    const rowHSpacing = rowConfig?.hSpacing ?? hSpacing;
    const rowVAlign = rowConfig?.vAlign ?? vAlign;
    const rowHDistribution = rowConfig?.hDistribution ?? hDistribution;

    const rowWidth =
      rowFrames.reduce((sum, f) => sum + getFrameDimensions(f.frame, state).width, 0) +
      (rowFrames.length - 1) * rowHSpacing;
    const rowHeight = Math.max(...rowFrames.map((f) => getFrameDimensions(f.frame, state).height));

    rows.push({
      id: `row-${rowNum}`,
      frames: rowFrames,
      width: rowWidth,
      height: rowHeight,
      hSpacing: rowHSpacing,
      vAlign: rowVAlign,
      hDistribution: rowHDistribution,
    });
  });

  // Step 2: Calculate total height
  const totalHeight =
    rows.reduce((sum, row) => sum + row.height, 0) + (rows.length - 1) * rowSpacing;

  // Step 3: Calculate vertical starting position based on anchor type
  let boundingBoxY: number;
  if (anchorType === "center") {
    boundingBoxY = (wallHeight - totalHeight) / 2;
  } else if (anchorType === "ceiling") {
    boundingBoxY = anchorValue;
  } else if (anchorType === "floor") {
    boundingBoxY = wallHeight - anchorValue - totalHeight;
  } else if (anchorType === "furniture") {
    const furnitureTop = wallHeight - furnitureHeight;
    if (furnitureVAnchor === "center") {
      boundingBoxY = (furnitureTop - totalHeight) / 2;
    } else if (furnitureVAnchor === "ceiling") {
      boundingBoxY = anchorValue;
    } else {
      // above-furniture
      boundingBoxY = furnitureTop - anchorValue - totalHeight;
    }
  } else {
    boundingBoxY = wallHeight - anchorValue - totalHeight;
  }

  // Step 4: Position frames within each row
  const positions: FramePosition[] = [];
  let currentRowY = boundingBoxY;

  rows.forEach((row, rowIdx) => {
    const framesInRow = row.frames.length;
    const totalFrameWidth = row.frames.reduce(
      (sum, f) => sum + getFrameDimensions(f.frame, state).width,
      0,
    );

    // Calculate horizontal positioning based on distribution mode
    let effectiveHSpacing = row.hSpacing;
    let rowStartX: number;

    const furnitureLeft =
      furnitureAnchor === "center"
        ? (wallWidth - furnitureWidth) / 2
        : furnitureAnchor === "left"
          ? furnitureOffset
          : wallWidth - furnitureWidth - furnitureOffset;
    const distributionWidth =
      anchorType === "furniture" && frameFurnitureAlign === "span" ? furnitureWidth : wallWidth;
    const distributionLeft =
      anchorType === "furniture" && frameFurnitureAlign === "span" ? furnitureLeft : 0;

    if (row.hDistribution !== "fixed") {
      const availableSpace = distributionWidth - totalFrameWidth;

      switch (row.hDistribution) {
        case "space-between":
          effectiveHSpacing = framesInRow > 1 ? availableSpace / (framesInRow - 1) : 0;
          rowStartX = distributionLeft;
          break;
        case "space-evenly":
          effectiveHSpacing = availableSpace / (framesInRow + 1);
          rowStartX = distributionLeft + effectiveHSpacing;
          break;
        case "space-around":
          effectiveHSpacing = availableSpace / framesInRow;
          rowStartX = distributionLeft + effectiveHSpacing / 2;
          break;
        default:
          rowStartX = 0;
      }
    } else {
      // Fixed mode: use anchor-based positioning
      // Recalculate row width with fixed spacing
      const fixedRowWidth = totalFrameWidth + (framesInRow - 1) * row.hSpacing;

      // Handle furniture alignment
      if (anchorType === "furniture") {
        const furnitureCenterX = furnitureLeft + furnitureWidth / 2;

        if (frameFurnitureAlign === "span") {
          // Use distribution within furniture width bounds
          if (row.hDistribution !== "fixed") {
            const availableSpace = furnitureWidth - totalFrameWidth;

            switch (row.hDistribution) {
              case "space-between":
                effectiveHSpacing = framesInRow > 1 ? availableSpace / (framesInRow - 1) : 0;
                rowStartX = furnitureLeft;
                break;
              case "space-evenly":
                effectiveHSpacing = availableSpace / (framesInRow + 1);
                rowStartX = furnitureLeft + effectiveHSpacing;
                break;
              case "space-around":
                effectiveHSpacing = availableSpace / framesInRow;
                rowStartX = furnitureLeft + effectiveHSpacing / 2;
                break;
              default:
                rowStartX = furnitureLeft;
            }
          } else {
            rowStartX = furnitureCenterX - fixedRowWidth / 2;
          }
        } else if (frameFurnitureAlign === "center") {
          rowStartX = furnitureCenterX - fixedRowWidth / 2;
        } else if (frameFurnitureAlign === "left") {
          rowStartX = furnitureLeft;
        } else {
          // right
          rowStartX = furnitureLeft + furnitureWidth - fixedRowWidth;
        }
      } else {
        // Standard anchor-based positioning
        if (hAnchorType === "center") {
          rowStartX = (wallWidth - fixedRowWidth) / 2;
        } else if (hAnchorType === "left") {
          rowStartX = hAnchorValue;
        } else {
          rowStartX = wallWidth - fixedRowWidth - hAnchorValue;
        }
      }
    }

    let currentX = rowStartX;

    row.frames.forEach(({ frame, originalIndex }) => {
      const dims = getFrameDimensions(frame, state);

      // Position frame vertically within row based on vAlign
      let y: number;
      if (row.vAlign === "top") {
        y = currentRowY;
      } else if (row.vAlign === "bottom") {
        y = currentRowY + row.height - dims.height;
      } else {
        // center
        y = currentRowY + (row.height - dims.height) / 2;
      }
      const translatedX = currentX + galleryOffsetX;
      const translatedY = y + galleryOffsetY;
      const hookY = translatedY + hangingOffset;

      // Calculate hook positions
      let hookX: number;
      let hookX2: number | undefined;
      let hookGap: number | undefined;

      if (hangingType === "dual") {
        hookX = translatedX + hookInset;
        hookX2 = translatedX + dims.width - hookInset;
        hookGap = dims.width - 2 * hookInset;
      } else {
        hookX = translatedX + dims.width / 2;
      }

      const isOutOfBounds =
        translatedX < 0 ||
        translatedY < 0 ||
        translatedX + dims.width > wallWidth ||
        translatedY + dims.height > wallHeight;

      positions.push({
        id: originalIndex + 1,
        frameId: frame.id,
        name: `Frame ${originalIndex + 1}`,
        row: rowIdx,
        x: translatedX,
        y: translatedY,
        width: dims.width,
        height: dims.height,
        hangingOffset,
        hookX,
        hookX2,
        hookY,
        hookGap,
        fromLeft: hookX,
        fromTop: hookY,
        fromFloor: wallHeight - hookY,
        fromRight: wallWidth - (hookX2 ?? hookX),
        fromCeiling: hookY,
        isOutOfBounds,
      });

      currentX += dims.width + effectiveHSpacing;
    });

    currentRowY += row.height + rowSpacing;
  });

  // Sort by original index
  positions.sort((a, b) => a.id - b.id);

  return positions;
}

export function calculateLayout(state: CalculatorState): LayoutResult {
  const positions = calculateLayoutPositions(state);
  const issues: ValidationIssue[] = [];
  const invalidFrames = positions.filter(
    (position) =>
      !Number.isFinite(position.width) ||
      !Number.isFinite(position.height) ||
      position.width <= 0 ||
      position.height <= 0 ||
      ![
        position.x,
        position.y,
        position.hookX,
        position.hookX2 ?? position.hookX,
        position.hookY,
        position.fromFloor,
      ].every(Number.isFinite),
  );
  if (
    !Number.isFinite(state.wallWidth) ||
    !Number.isFinite(state.wallHeight) ||
    !Number.isFinite(state.hSpacing) ||
    !Number.isFinite(state.rowSpacing) ||
    !Number.isFinite(state.anchorValue) ||
    !Number.isFinite(state.hAnchorValue) ||
    !Number.isFinite(state.galleryOffsetX ?? 0) ||
    !Number.isFinite(state.galleryOffsetY ?? 0) ||
    state.wallWidth <= 0 ||
    state.wallHeight <= 0 ||
    invalidFrames.length
  ) {
    issues.push({
      code: "dimensions-invalid",
      message: `Wall and frame dimensions must be finite positive numbers${invalidFrames.length ? `. Check ${invalidFrames.map((frame) => frame.name).join(", ")}` : ""}.`,
      frameIds: invalidFrames.map((frame) => frame.frameId),
    });
  }
  const byRow = new Map<number, FramePosition[]>();
  for (const position of positions) {
    const row = position.row ?? 0;
    byRow.set(row, [...(byRow.get(row) ?? []), position]);
  }

  for (const row of byRow.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const requiredWidth = sorted.reduce((sum, frame) => sum + frame.width, 0);
    const availableWidth =
      state.anchorType === "furniture" && state.frameFurnitureAlign === "span"
        ? state.furnitureWidth
        : state.wallWidth;
    if (requiredWidth > availableWidth) {
      const shortage = requiredWidth - availableWidth;
      issues.push({
        code: "horizontal-shortage",
        message: `This row needs ${formatMeasurement(toDisplayUnit(shortage, state.unit), state.unit)} more ${state.anchorType === "furniture" && state.frameFurnitureAlign === "span" ? "furniture" : "wall"} width.`,
        frameIds: sorted.map((frame) => frame.frameId),
        requiredExtraSpace: shortage,
      });
    }
  }

  for (let first = 0; first < positions.length; first += 1) {
    for (let second = first + 1; second < positions.length; second += 1) {
      const a = positions[first];
      const b = positions[second];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlapX > 0 && overlapY > 0) {
        issues.push({
          code: "frame-overlap",
          message: `${a.name} and ${b.name} overlap. Increase spacing or move one frame to another row.`,
          frameIds: [a.frameId, b.frameId],
        });
      }
    }
  }

  const outOfBounds = positions.filter((position) => position.isOutOfBounds);
  if (outOfBounds.length) {
    issues.push({
      code: "frame-out-of-bounds",
      message: `${outOfBounds.map((frame) => frame.name).join(", ")} ${outOfBounds.length === 1 ? "extends" : "extend"} beyond the wall. Move the gallery or increase the wall size.`,
      frameIds: outOfBounds.map((frame) => frame.frameId),
    });
  }

  if (state.anchorType === "furniture") {
    const furnitureLeft =
      state.furnitureAnchor === "center"
        ? (state.wallWidth - state.furnitureWidth) / 2
        : state.furnitureAnchor === "left"
          ? state.furnitureOffset
          : state.wallWidth - state.furnitureWidth - state.furnitureOffset;
    if (
      !Number.isFinite(state.furnitureWidth) ||
      !Number.isFinite(state.furnitureHeight) ||
      !Number.isFinite(state.furnitureOffset) ||
      state.furnitureWidth <= 0 ||
      state.furnitureHeight <= 0 ||
      furnitureLeft < 0 ||
      furnitureLeft + state.furnitureWidth > state.wallWidth ||
      state.furnitureHeight > state.wallHeight
    ) {
      issues.push({
        code: "furniture-out-of-bounds",
        message: "Furniture must have positive dimensions and fit completely within the wall.",
      });
    }
  }

  const offsetFrames = positions.filter(
    (position) =>
      !Number.isFinite(state.hangingOffset) ||
      state.hangingOffset < 0 ||
      state.hangingOffset > position.height,
  );
  if (offsetFrames.length) {
    issues.push({
      code: "hanging-offset-invalid",
      field: "hangingOffset",
      frameIds: offsetFrames.map((frame) => frame.frameId),
      message: `Hook offset must be between 0 and each frame's height. Check ${offsetFrames.map((frame) => frame.name).join(", ")}.`,
    });
  }

  if (state.hangingType === "dual") {
    const insetFrames = positions.filter(
      (position) =>
        !Number.isFinite(state.hookInset) ||
        state.hookInset < 0 ||
        state.hookInset >= position.width / 2,
    );
    if (insetFrames.length) {
      issues.push({
        code: "hook-inset-invalid",
        field: "hookInset",
        frameIds: insetFrames.map((frame) => frame.frameId),
        message: `Dual-hook inset must be nonnegative and less than half each frame's width. Check ${insetFrames.map((frame) => frame.name).join(", ")}.`,
      });
    }
  }

  return { positions, issues, isValid: issues.length === 0 };
}
