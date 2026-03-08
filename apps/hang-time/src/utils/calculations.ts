import type {
  CalculatorState,
  Distribution,
  FramePosition,
  GalleryFrame,
  GalleryVAlign,
} from '@/types';

export const INCH_TO_CM = 2.54;

export const toDisplayUnit = (value: number, unit: 'in' | 'cm'): number => {
  return unit === 'in' ? value : value * INCH_TO_CM;
};

export const fromDisplayUnit = (value: number, unit: 'in' | 'cm'): number => {
  return unit === 'in' ? value : value / INCH_TO_CM;
};

// Format with up to 3 decimal places, trimming trailing zeros
const formatNumber = (value: number, maxDecimals: number): string => {
  const fixed = value.toFixed(maxDecimals);
  // Remove trailing zeros after decimal point
  return fixed.replace(/\.?0+$/, '');
};

export const formatMeasurement = (value: number, unit: 'in' | 'cm'): string => {
  // Inches: up to 3 decimals (1/8" = 0.125), cm: up to 1 decimal
  const decimals = unit === 'in' ? 3 : 1;
  return unit === 'in'
    ? `${formatNumber(value, decimals)}"`
    : `${formatNumber(value, decimals)} cm`;
};

export const formatShort = (value: number, unit: 'in' | 'cm'): string => {
  const decimals = unit === 'in' ? 3 : 1;
  return unit === 'in'
    ? `${formatNumber(value, decimals)}"`
    : `${formatNumber(value, decimals)}cm`;
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

export function calculateLayoutPositions(
  state: CalculatorState,
): FramePosition[] {
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
  const rowMap = new Map<number, LayoutRow['frames']>();
  frames.forEach((frame, index) => {
    const rowNum = frame.row ?? 0;
    if (!rowMap.has(rowNum)) {
      rowMap.set(rowNum, []);
    }
    rowMap.get(rowNum)!.push({ frame, originalIndex: index });
  });

  // Sort by row number and create row objects
  const sortedRowNums = [...rowMap.keys()].sort((a, b) => a - b);
  sortedRowNums.forEach((rowNum, idx) => {
    const rowFrames = rowMap.get(rowNum)!;
    const rowConfig = rowConfigs.find((c) => c.id === `row-${idx}`);
    const rowHSpacing = rowConfig?.hSpacing ?? hSpacing;
    const rowVAlign = rowConfig?.vAlign ?? vAlign;
    const rowHDistribution = rowConfig?.hDistribution ?? hDistribution;

    const rowWidth =
      rowFrames.reduce(
        (sum, f) => sum + getFrameDimensions(f.frame, state).width,
        0,
      ) +
      (rowFrames.length - 1) * rowHSpacing;
    const rowHeight = Math.max(
      ...rowFrames.map((f) => getFrameDimensions(f.frame, state).height),
    );

    rows.push({
      id: `row-${idx}`,
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
    rows.reduce((sum, row) => sum + row.height, 0) +
    (rows.length - 1) * rowSpacing;

  // Step 3: Calculate vertical starting position based on anchor type
  let boundingBoxY: number;
  if (anchorType === 'center') {
    boundingBoxY = (wallHeight - totalHeight) / 2;
  } else if (anchorType === 'ceiling') {
    boundingBoxY = anchorValue;
  } else if (anchorType === 'floor') {
    boundingBoxY = wallHeight - anchorValue - totalHeight;
  } else if (anchorType === 'furniture') {
    const furnitureTop = wallHeight - furnitureHeight;
    if (furnitureVAnchor === 'center') {
      boundingBoxY = (furnitureTop - totalHeight) / 2;
    } else if (furnitureVAnchor === 'ceiling') {
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

    if (row.hDistribution !== 'fixed') {
      const availableSpace = wallWidth - totalFrameWidth;

      switch (row.hDistribution) {
        case 'space-between':
          effectiveHSpacing =
            framesInRow > 1 ? availableSpace / (framesInRow - 1) : 0;
          rowStartX = 0;
          break;
        case 'space-evenly':
          effectiveHSpacing = availableSpace / (framesInRow + 1);
          rowStartX = effectiveHSpacing;
          break;
        case 'space-around':
          effectiveHSpacing = availableSpace / framesInRow;
          rowStartX = effectiveHSpacing / 2;
          break;
        default:
          rowStartX = 0;
      }
    } else {
      // Fixed mode: use anchor-based positioning
      // Recalculate row width with fixed spacing
      const fixedRowWidth = totalFrameWidth + (framesInRow - 1) * row.hSpacing;

      // Handle furniture alignment
      if (anchorType === 'furniture') {
        let furnitureLeft: number;
        if (furnitureAnchor === 'center') {
          furnitureLeft = (wallWidth - furnitureWidth) / 2;
        } else if (furnitureAnchor === 'left') {
          furnitureLeft = furnitureOffset;
        } else {
          furnitureLeft = wallWidth - furnitureWidth - furnitureOffset;
        }
        const furnitureCenterX = furnitureLeft + furnitureWidth / 2;

        if (frameFurnitureAlign === 'span') {
          // Use distribution within furniture width bounds
          if (hDistribution !== 'fixed') {
            const availableSpace = furnitureWidth - totalFrameWidth;

            switch (hDistribution) {
              case 'space-between':
                effectiveHSpacing =
                  framesInRow > 1 ? availableSpace / (framesInRow - 1) : 0;
                rowStartX = furnitureLeft;
                break;
              case 'space-evenly':
                effectiveHSpacing = availableSpace / (framesInRow + 1);
                rowStartX = furnitureLeft + effectiveHSpacing;
                break;
              case 'space-around':
                effectiveHSpacing = availableSpace / framesInRow;
                rowStartX = furnitureLeft + effectiveHSpacing / 2;
                break;
              default:
                rowStartX = furnitureLeft;
            }
          } else {
            rowStartX = furnitureCenterX - fixedRowWidth / 2;
          }
        } else if (frameFurnitureAlign === 'center') {
          rowStartX = furnitureCenterX - fixedRowWidth / 2;
        } else if (frameFurnitureAlign === 'left') {
          rowStartX = furnitureLeft;
        } else {
          // right
          rowStartX = furnitureLeft + furnitureWidth - fixedRowWidth;
        }
      } else {
        // Standard anchor-based positioning
        if (hAnchorType === 'center') {
          rowStartX = (wallWidth - fixedRowWidth) / 2;
        } else if (hAnchorType === 'left') {
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
      if (row.vAlign === 'top') {
        y = currentRowY;
      } else if (row.vAlign === 'bottom') {
        y = currentRowY + row.height - dims.height;
      } else {
        // center
        y = currentRowY + (row.height - dims.height) / 2;
      }
      const hookY = y + hangingOffset;

      // Calculate hook positions
      let hookX: number;
      let hookX2: number | undefined;
      let hookGap: number | undefined;

      if (hangingType === 'dual') {
        hookX = currentX + hookInset;
        hookX2 = currentX + dims.width - hookInset;
        hookGap = dims.width - 2 * hookInset;
      } else {
        hookX = currentX + dims.width / 2;
      }

      const isOutOfBounds =
        currentX < 0 ||
        y < 0 ||
        currentX + dims.width > wallWidth ||
        y + dims.height > wallHeight;

      positions.push({
        id: originalIndex + 1,
        name: `Frame ${originalIndex + 1}`,
        row: rowIdx,
        x: currentX,
        y,
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
