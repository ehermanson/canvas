import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ViewportToolbar,
  ViewportToolbarButton,
  ViewportToolbarValue,
} from '@canvas-tools/ui';
import {
  fitPointsToViewport,
  zoomPanAtPoint as getZoomPanAtPoint,
  zoomPanAtWorldPoint as getZoomPanAtWorldPoint,
  screenToWorld as mapScreenToWorld,
  worldToScreen as mapWorldToScreen,
} from '@canvas-tools/viewport';
import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Copy,
  HelpCircle,
  Moon,
  Pencil,
  RotateCw,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { RoomPlannerReturn } from '@/hooks/use-floor-planner';
import { useTheme } from '@/hooks/use-theme';
import type {
  FurnitureAlignmentMatch,
  FurnitureResizeEdge,
} from '@/lib/furniture-geometry';
import {
  checkFurnitureCollision,
  checkFurnitureRoomCollision,
  getFurnitureAlignmentMatches,
  getFurnitureBounds,
  getFurnitureResizeHandlePoints,
  getNearestBoundsClearances,
  getNearestFurnitureClearances,
  resizeFurnitureByHandleDelta,
  resizeFurnitureFromEdge,
  snapFurnitureToBoundsGrid,
  snapFurnitureToRoomWalls,
} from '@/lib/furniture-geometry';
import {
  distSq,
  getBounds,
  getWallAngle,
  getWallLength,
  getWallMeasurementSpans,
  projectOntoSegment,
  rotatePointAround,
} from '@/lib/room-geometry';
import type {
  FurnitureItem,
  Point,
  Unit,
  Wall,
  WallEndpoint,
  WallFeature,
} from '@/types';

interface CanvasProps {
  planner: RoomPlannerReturn;
}

type DisplayFormatter = RoomPlannerReturn['toDisplay'];
type ViewportBounds = {
  centerX: number;
  centerY: number;
  height: number;
  maxX: number;
  minX: number;
  width: number;
};
type FitViewState = {
  canvasCenterX: number;
  canvasCenterY: number;
  centerX: number;
  centerY: number;
  zoom: number;
};
type Circle = {
  center: Point;
  radius: number;
};
type Rect = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};
type WallLabelLayout = {
  badgeCenter: Point;
  bounds: Rect;
  labelCenter: Point;
  labelRect: Rect;
  orientation: 'column' | 'row';
};
type FurnitureAlignmentGuide = {
  axis: 'x' | 'y';
  end: number;
  position: number;
  start: number;
};
type CanvasContextMenuTarget =
  | { id: string; kind: 'furniture' }
  | { featureId: string; kind: 'feature'; wallId: string }
  | { id: string; kind: 'wall' };
type FurnitureRenameDialogState = {
  draftName: string;
  itemId: string;
};

const MAJOR_GRID_SIZE = 12;
const MINOR_GRID_STEPS = [1, 3, 6] as const;
const MINOR_GRID_MIN_SCREEN_SPACING = 10;
const WALL_GRID_SNAP = 1;
const MIN_CANVAS_ZOOM = 0.1;
const MAX_CANVAS_ZOOM = 20;
const FIT_TO_VIEW_PADDING = 80;
const WALL_LABEL_BADGE_RADIUS = 8;
const WALL_LABEL_GAP = 6;
const WALL_LABEL_NORMAL_OFFSETS = [24, 36, 48, 64, 80];
const WALL_LABEL_TANGENT_OFFSETS = [
  0, 18, -18, 36, -36, 54, -54, 72, -72, 96, -96,
];

export function calculateFitViewState(
  viewport: ViewportBounds | null,
  points: Point[],
): FitViewState | null {
  const fit = fitPointsToViewport(viewport, points, {
    fallbackSize: { height: 120, width: 144 },
    maxZoom: 4,
    minZoom: MIN_CANVAS_ZOOM,
    padding: FIT_TO_VIEW_PADDING,
  });

  if (!viewport || !fit) {
    return null;
  }

  return {
    centerX: fit.centerX,
    centerY: fit.centerY,
    canvasCenterX: viewport.centerX,
    canvasCenterY: viewport.centerY,
    zoom: fit.zoom,
  };
}

export function getWallInteriorUnitNormal(
  start: Point,
  end: Point,
  roomCentroid: Point | null,
): Point {
  const angle = getWallAngle(start, end);
  const baseNormal = {
    x: Math.cos(angle + Math.PI / 2),
    y: Math.sin(angle + Math.PI / 2),
  };

  if (!roomCentroid) {
    return baseNormal;
  }

  const wallMidX = (start.x + end.x) / 2;
  const wallMidY = (start.y + end.y) / 2;
  const dotToCenter =
    (roomCentroid.x - wallMidX) * baseNormal.x +
    (roomCentroid.y - wallMidY) * baseNormal.y;

  return dotToCenter >= 0
    ? baseNormal
    : {
        x: -baseNormal.x,
        y: -baseNormal.y,
      };
}

export function shouldDrawSelectedWallMeasurements(
  wallLength: number,
  features: WallFeature[],
) {
  const spans = getWallMeasurementSpans(wallLength, features);
  if (spans.length !== 1) {
    return spans.length > 0;
  }

  const [span] = spans;
  return span.startOffset !== 0 || span.endOffset !== wallLength;
}

function createRect(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): Rect {
  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
  };
}

function doRectsOverlap(a: Rect, b: Rect, padding = 0) {
  return !(
    a.maxX + padding < b.minX ||
    a.minX - padding > b.maxX ||
    a.maxY + padding < b.minY ||
    a.minY - padding > b.maxY
  );
}

function doesCircleOverlapRect(circle: Circle, rect: Rect, padding = 0) {
  const closestX = Math.max(
    rect.minX - padding,
    Math.min(circle.center.x, rect.maxX + padding),
  );
  const closestY = Math.max(
    rect.minY - padding,
    Math.min(circle.center.y, rect.maxY + padding),
  );
  const dx = circle.center.x - closestX;
  const dy = circle.center.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function buildWallLabelLayout(
  center: Point,
  labelWidth: number,
  labelHeight: number,
  orientation: 'column' | 'row',
): WallLabelLayout {
  const badgeDiameter = WALL_LABEL_BADGE_RADIUS * 2;
  if (labelWidth <= 0) {
    const bounds = createRect(center.x, center.y, badgeDiameter, badgeDiameter);
    return {
      badgeCenter: center,
      bounds,
      labelCenter: center,
      labelRect: createRect(center.x, center.y, 0, 0),
      orientation,
    };
  }

  if (orientation === 'column') {
    const totalWidth = Math.max(badgeDiameter, labelWidth);
    const totalHeight = badgeDiameter + WALL_LABEL_GAP + labelHeight;
    const bounds = createRect(center.x, center.y, totalWidth, totalHeight);
    const badgeCenter = {
      x: center.x,
      y: bounds.minY + WALL_LABEL_BADGE_RADIUS,
    };
    const labelRect = createRect(
      center.x,
      bounds.minY + badgeDiameter + WALL_LABEL_GAP + labelHeight / 2,
      labelWidth,
      labelHeight,
    );

    return {
      badgeCenter,
      bounds,
      labelCenter: {
        x: center.x,
        y: (labelRect.minY + labelRect.maxY) / 2,
      },
      labelRect,
      orientation,
    };
  }

  const totalWidth = badgeDiameter + WALL_LABEL_GAP + labelWidth;
  const totalHeight = Math.max(badgeDiameter, labelHeight);
  const bounds = createRect(center.x, center.y, totalWidth, totalHeight);
  const badgeCenter = {
    x: bounds.minX + WALL_LABEL_BADGE_RADIUS,
    y: center.y,
  };
  const labelRect = createRect(
    bounds.minX + badgeDiameter + WALL_LABEL_GAP + labelWidth / 2,
    center.y,
    labelWidth,
    labelHeight,
  );

  return {
    badgeCenter,
    bounds,
    labelCenter: {
      x: (labelRect.minX + labelRect.maxX) / 2,
      y: center.y,
    },
    labelRect,
    orientation,
  };
}

export function getWallLabelLayout({
  anchor,
  canvasBounds,
  labelHeight,
  labelWidth,
  obstacleCircles,
  obstacleRects,
  outwardNormal,
  tangent,
}: {
  anchor: Point;
  canvasBounds: Rect;
  labelHeight: number;
  labelWidth: number;
  obstacleCircles: Circle[];
  obstacleRects: Rect[];
  outwardNormal: Point;
  tangent: Point;
}): WallLabelLayout {
  const prefersRow = Math.abs(tangent.x) >= Math.abs(tangent.y);
  let bestLayout: WallLabelLayout | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const orientation of ['row', 'column'] as const) {
    const orientationPenalty = prefersRow === (orientation === 'row') ? 0 : 12;

    for (const normalOffset of WALL_LABEL_NORMAL_OFFSETS) {
      for (const tangentOffset of WALL_LABEL_TANGENT_OFFSETS) {
        const center = {
          x:
            anchor.x +
            outwardNormal.x * normalOffset +
            tangent.x * tangentOffset,
          y:
            anchor.y +
            outwardNormal.y * normalOffset +
            tangent.y * tangentOffset,
        };
        const layout = buildWallLabelLayout(
          center,
          labelWidth,
          labelHeight,
          orientation,
        );

        const rectCollisions = obstacleRects.filter((rect) =>
          doRectsOverlap(layout.bounds, rect, 6),
        ).length;
        const circleCollisions = obstacleCircles.filter((circle) =>
          doesCircleOverlapRect(circle, layout.bounds, 8),
        ).length;
        const overflow =
          Math.max(0, canvasBounds.minX - layout.bounds.minX) +
          Math.max(0, layout.bounds.maxX - canvasBounds.maxX) +
          Math.max(0, canvasBounds.minY - layout.bounds.minY) +
          Math.max(0, layout.bounds.maxY - canvasBounds.maxY);
        const score =
          (rectCollisions + circleCollisions) * 1_000_000 +
          overflow * 10_000 +
          orientationPenalty +
          Math.abs(normalOffset - WALL_LABEL_NORMAL_OFFSETS[0]) * 2 +
          Math.abs(tangentOffset);

        if (score < bestScore) {
          bestLayout = layout;
          bestScore = score;
        }
      }
    }
  }

  return (
    bestLayout ??
    buildWallLabelLayout(
      {
        x: anchor.x + outwardNormal.x * WALL_LABEL_NORMAL_OFFSETS[0],
        y: anchor.y + outwardNormal.y * WALL_LABEL_NORMAL_OFFSETS[0],
      },
      labelWidth,
      labelHeight,
      'row',
    )
  );
}

function isGridMultiple(value: number, step: number) {
  return Math.abs(value / step - Math.round(value / step)) < 1e-6;
}

function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

function getMinorGridSize(currentZoom: number) {
  for (const step of MINOR_GRID_STEPS) {
    if (step * currentZoom >= MINOR_GRID_MIN_SCREEN_SPACING) {
      return step;
    }
  }

  return null;
}

function drawGridLayer(
  ctx: CanvasRenderingContext2D,
  {
    canvasHeight,
    canvasWidth,
    gridSize,
    skipEvery,
    strokeStyle,
    toScreen,
    viewportBottomRight,
    viewportTopLeft,
  }: {
    canvasHeight: number;
    canvasWidth: number;
    gridSize: number;
    skipEvery?: number;
    strokeStyle: string;
    toScreen: (wx: number, wy: number) => Point;
    viewportBottomRight: Point;
    viewportTopLeft: Point;
  },
) {
  const startX = Math.floor(viewportTopLeft.x / gridSize) * gridSize;
  const startY = Math.floor(viewportTopLeft.y / gridSize) * gridSize;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = startX; x <= viewportBottomRight.x; x += gridSize) {
    if (skipEvery && isGridMultiple(x, skipEvery)) {
      continue;
    }

    const screenX = Math.round(toScreen(x, 0).x) + 0.5;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvasHeight);
  }

  for (let y = startY; y <= viewportBottomRight.y; y += gridSize) {
    if (skipEvery && isGridMultiple(y, skipEvery)) {
      continue;
    }

    const screenY = Math.round(toScreen(0, y).y) + 0.5;
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvasWidth, screenY);
  }

  ctx.stroke();
  ctx.restore();
}

function createOutsideRoomClipPath(
  canvasWidth: number,
  canvasHeight: number,
  roomPolygonScreen: Point[] | null,
) {
  if (!roomPolygonScreen || roomPolygonScreen.length < 3) {
    return null;
  }

  const clipPath = new Path2D();
  clipPath.rect(0, 0, canvasWidth, canvasHeight);
  clipPath.moveTo(roomPolygonScreen[0].x, roomPolygonScreen[0].y);

  for (let i = 1; i < roomPolygonScreen.length; i++) {
    clipPath.lineTo(roomPolygonScreen[i].x, roomPolygonScreen[i].y);
  }

  clipPath.closePath();
  return clipPath;
}

function drawDistanceToWalls(
  ctx: CanvasRenderingContext2D,
  measurements: Array<{
    dist: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>,
  toScreen: (wx: number, wy: number) => Point,
  isDark: boolean,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  ctx.save();
  for (const measurement of measurements) {
    const from = toScreen(measurement.fromX, measurement.fromY);
    const to = toScreen(measurement.toX, measurement.toY);

    ctx.strokeStyle = isDark ? 'rgba(34,211,238,0.5)' : 'rgba(6,182,212,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const displayDist = toDisplay(measurement.dist);
    const label =
      unit === 'cm'
        ? `${displayDist.toFixed(0)}cm`
        : `${Number.parseFloat(displayDist.toFixed(3))}"`;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(label);
    ctx.fillStyle = isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)';
    ctx.fillRect(midX - metrics.width / 2 - 3, midY - 7, metrics.width + 6, 14);
    ctx.fillStyle = isDark ? '#22d3ee' : '#0891b2';
    ctx.fillText(label, midX, midY);
  }
  ctx.restore();
}

function drawFurnitureAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  guides: FurnitureAlignmentGuide[],
  toScreen: (wx: number, wy: number) => Point,
  isDark: boolean,
) {
  if (guides.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(103,232,249,0.95)' : 'rgba(8,145,178,0.92)';
  ctx.lineWidth = 1.5;

  for (const guide of guides) {
    const start =
      guide.axis === 'x'
        ? toScreen(guide.position, guide.start)
        : toScreen(guide.start, guide.position);
    const end =
      guide.axis === 'x'
        ? toScreen(guide.position, guide.end)
        : toScreen(guide.end, guide.position);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawScaleIndicator(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  isDark: boolean,
  currentZoom: number,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  const niceUnits = [6, 12, 24, 36, 48, 60, 72, 96, 120, 144, 240];
  let scaleUnits = 12;
  for (const n of niceUnits) {
    if (n * currentZoom >= 40 && n * currentZoom <= 200) {
      scaleUnits = n;
      break;
    }
  }

  const barWidth = scaleUnits * currentZoom;
  const x = canvasW - barWidth - 20;
  const y = canvasH - 24;

  ctx.save();
  ctx.strokeStyle = isDark ? '#94a3b8' : '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barWidth, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + barWidth, y - 4);
  ctx.lineTo(x + barWidth, y + 4);
  ctx.stroke();

  const displayUnits = toDisplay(scaleUnits);
  const label =
    unit === 'cm'
      ? `${displayUnits.toFixed(0)} cm`
      : `${displayUnits.toFixed(0)}"`;

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
  ctx.fillText(label, x + barWidth / 2, y - 4);
  ctx.restore();
}

function drawSelectedWallMeasurements(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  start: Point,
  end: Point,
  inwardNormal: Point,
  zoom: number,
  toScreen: (wx: number, wy: number) => Point,
  isDark: boolean,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  const wallLength = getWallLength(start, end);
  if (!shouldDrawSelectedWallMeasurements(wallLength, wall.features)) {
    return;
  }

  const spans = getWallMeasurementSpans(wallLength, wall.features);
  if (spans.length === 0) {
    return;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const offsetDistance = 16 / zoom;
  const tickHalf = 5;
  const lineOffset = {
    x: inwardNormal.x * offsetDistance,
    y: inwardNormal.y * offsetDistance,
  };

  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(34,211,238,0.7)' : 'rgba(6,182,212,0.7)';
  ctx.fillStyle = isDark ? '#22d3ee' : '#0891b2';
  ctx.lineWidth = 1.5;
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const span of spans) {
    const startT = span.startOffset / wallLength;
    const endT = span.endOffset / wallLength;
    const startPoint = {
      x: start.x + dx * startT + lineOffset.x,
      y: start.y + dy * startT + lineOffset.y,
    };
    const endPoint = {
      x: start.x + dx * endT + lineOffset.x,
      y: start.y + dy * endT + lineOffset.y,
    };
    const s1 = toScreen(startPoint.x, startPoint.y);
    const s2 = toScreen(endPoint.x, endPoint.y);
    const segmentLength = Math.hypot(s2.x - s1.x, s2.y - s1.y);
    const screenDx = s2.x - s1.x;
    const screenDy = s2.y - s1.y;
    const screenLength = Math.hypot(screenDx, screenDy) || 1;
    const screenNormal = {
      x: -screenDy / screenLength,
      y: screenDx / screenLength,
    };

    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();

    const tickVector = {
      x: screenNormal.x * tickHalf,
      y: screenNormal.y * tickHalf,
    };

    ctx.beginPath();
    ctx.moveTo(s1.x - tickVector.x, s1.y - tickVector.y);
    ctx.lineTo(s1.x + tickVector.x, s1.y + tickVector.y);
    ctx.moveTo(s2.x - tickVector.x, s2.y - tickVector.y);
    ctx.lineTo(s2.x + tickVector.x, s2.y + tickVector.y);
    ctx.stroke();

    if (segmentLength < 28) {
      continue;
    }

    const label = formatWallSpanDimension(span.length, toDisplay, unit);
    const midX = (s1.x + s2.x) / 2;
    const midY = (s1.y + s2.y) / 2;
    const metrics = ctx.measureText(label);
    const paddingX = 4;
    const paddingY = 3;

    ctx.fillStyle = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)';
    ctx.fillRect(
      midX - metrics.width / 2 - paddingX,
      midY - 7 - paddingY,
      metrics.width + paddingX * 2,
      14 + paddingY * 2,
    );
    ctx.fillStyle = isDark ? '#22d3ee' : '#0891b2';
    ctx.fillText(label, midX, midY);
  }

  ctx.restore();
}

function formatWallSpanDimension(
  value: number,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  if (unit === 'cm') {
    return `${toDisplay(value).toFixed(0)}cm`;
  }

  return `${Number.parseFloat(toDisplay(value).toFixed(3))}"`;
}

function drawBoundsDimensions(
  ctx: CanvasRenderingContext2D,
  bounds: { maxX: number; maxY: number; minX: number; minY: number },
  toScreen: (wx: number, wy: number) => Point,
  isDark: boolean,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  const topLeft = toScreen(bounds.minX, bounds.minY);
  const topRight = toScreen(bounds.maxX, bounds.minY);
  const bottomLeft = toScreen(bounds.minX, bounds.maxY);
  const width = topRight.x - topLeft.x;
  const height = bottomLeft.y - topLeft.y;

  if (Math.abs(width) < 28 && Math.abs(height) < 28) {
    return;
  }

  const horizontalOffset = 18;
  const verticalOffset = 18;
  const tick = 5;
  const horizontalLabel = formatCanvasDimension(
    bounds.maxX - bounds.minX,
    toDisplay,
    unit,
  );
  const verticalLabel = formatCanvasDimension(
    bounds.maxY - bounds.minY,
    toDisplay,
    unit,
  );

  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(34,211,238,0.75)' : 'rgba(8,145,178,0.75)';
  ctx.fillStyle = isDark ? '#22d3ee' : '#0891b2';
  ctx.lineWidth = 1.5;
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (Math.abs(width) >= 28) {
    const y = topLeft.y - horizontalOffset;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, y);
    ctx.lineTo(topRight.x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(topLeft.x, y - tick);
    ctx.lineTo(topLeft.x, y + tick);
    ctx.moveTo(topRight.x, y - tick);
    ctx.lineTo(topRight.x, y + tick);
    ctx.stroke();

    const midX = (topLeft.x + topRight.x) / 2;
    const metrics = ctx.measureText(horizontalLabel);
    ctx.fillStyle = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)';
    ctx.fillRect(midX - metrics.width / 2 - 4, y - 10, metrics.width + 8, 16);
    ctx.fillStyle = isDark ? '#22d3ee' : '#0891b2';
    ctx.fillText(horizontalLabel, midX, y - 1);
  }

  if (Math.abs(height) >= 28) {
    const x = topLeft.x - verticalOffset;
    ctx.beginPath();
    ctx.moveTo(x, topLeft.y);
    ctx.lineTo(x, bottomLeft.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - tick, topLeft.y);
    ctx.lineTo(x + tick, topLeft.y);
    ctx.moveTo(x - tick, bottomLeft.y);
    ctx.lineTo(x + tick, bottomLeft.y);
    ctx.stroke();

    const midY = (topLeft.y + bottomLeft.y) / 2;
    const metrics = ctx.measureText(verticalLabel);
    ctx.fillStyle = isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)';
    ctx.fillRect(x - metrics.width / 2 - 4, midY - 8, metrics.width + 8, 16);
    ctx.fillStyle = isDark ? '#22d3ee' : '#0891b2';
    ctx.fillText(verticalLabel, x, midY);
  }

  ctx.restore();
}

function formatCanvasDimension(
  value: number,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  const displayValue = toDisplay(value);
  if (unit === 'cm') {
    return `${displayValue.toFixed(0)} cm`;
  }

  const rounded = Number.parseFloat(displayValue.toFixed(3));
  const formatted = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : String(rounded);
  return `${formatted}"`;
}

function formatFurnitureDimensions(
  item: FurnitureItem,
  toDisplay: DisplayFormatter,
  unit: Unit,
) {
  return `${formatCanvasDimension(item.width, toDisplay, unit)} X ${formatCanvasDimension(item.depth, toDisplay, unit)}`;
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let label = text;
  while (ctx.measureText(`${label}...`).width > maxWidth && label.length > 3) {
    label = label.slice(0, -1);
  }

  return label.length < text.length ? `${label}...` : label;
}

function getFurnitureLabelColor(color: string, isDark: boolean) {
  return isDark ? `${color}dd` : `${color}cc`;
}

const ROTATE_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 8a10 10 0 0 1 12 1"/><path d="M22 6l2 4-4 1"/><path d="M21 24a10 10 0 0 1-12-1"/><path d="M10 26l-2-4 4-1"/></g><g fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 8a10 10 0 0 1 12 1"/><path d="M22 6l2 4-4 1"/><path d="M21 24a10 10 0 0 1-12-1"/><path d="M10 26l-2-4 4-1"/></g></svg>`;
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  ROTATE_CURSOR_SVG,
)}") 16 16, grab`;

function getResizeCursor(edge: FurnitureResizeEdge, rotation: number) {
  const axisRotation =
    edge === 'left' || edge === 'right' ? rotation : rotation + 90;
  const normalized = ((axisRotation % 180) + 180) % 180;
  const snapped = (Math.round(normalized / 45) * 45) % 180;

  switch (snapped) {
    case 45:
      return 'nesw-resize';
    case 90:
      return 'ns-resize';
    case 135:
      return 'nwse-resize';
    default:
      return 'ew-resize';
  }
}

function normalizeRotationDegrees(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

function getRotationAngleDegrees(center: Point, point: Point) {
  return normalizeRotationDegrees(
    (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI + 90,
  );
}

function getSignedRotationDeltaDegrees(current: number, start: number) {
  return ((current - start + 540) % 360) - 180;
}

type FurnitureRotationTarget = {
  center: Point;
  ids: string[];
  primaryId: string | null;
};

type FurnitureRotationState = {
  center: Point;
  ids: string[];
  startAngle: number;
  startScreen: Point;
  startTransforms: Array<Pick<FurnitureItem, 'id' | 'rotation' | 'x' | 'y'>>;
};

// ── Interaction state ──

type InteractionState =
  | { mode: 'idle' }
  | { mode: 'panning'; startMouse: Point; startPan: Point }
  | {
      mode: 'pending-endpoint';
      endpointId: string;
      startScreen: Point;
      startWorld: Point;
      altKey: boolean;
    }
  | {
      mode: 'pending-furniture';
      id: string;
      ids: string[];
      offset: Point;
      startPositions: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>;
      toggleSelection: boolean;
      startScreen: Point;
    }
  | { mode: 'pending-marquee'; additive: boolean; startScreen: Point }
  | {
      mode: 'pending-resize';
      id: string;
      edge: FurnitureResizeEdge;
      startScreen: Point;
    }
  | ({ mode: 'pending-rotation' } & FurnitureRotationState)
  | {
      mode: 'pending-feature';
      wallId: string;
      featureId: string;
      startScreen: Point;
    }
  | { mode: 'selected-endpoint'; endpointId: string }
  | { mode: 'dragging-endpoint'; endpointId: string; snapTarget: string | null }
  | {
      mode: 'dragging-furniture';
      id: string;
      ids: string[];
      offset: Point;
      startPositions: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>;
      startScreen: Point;
      moved: boolean;
    }
  | {
      mode: 'dragging-marquee';
      additive: boolean;
      currentScreen: Point;
      startScreen: Point;
    }
  | {
      mode: 'dragging-resize';
      id: string;
      edge: FurnitureResizeEdge;
      startScreen: Point;
      moved: boolean;
    }
  | ({ mode: 'dragging-rotation' } & FurnitureRotationState)
  | { mode: 'dragging-feature'; wallId: string; featureId: string }
  | {
      mode: 'drawing-wall';
      fromEndpointId: string;
      currentEnd: Point;
      snapTargetId: string | null;
    };

const HANDLE_RADIUS = 7;
const SNAP_RADIUS = 14;
const CLICK_THRESHOLD = 4;
const DRAG_INTENT_THRESHOLD = 8;
const ROTATION_HANDLE_OFFSET = 28;
const ROTATION_HANDLE_RADIUS = 7;
const RESIZE_HANDLE_RADIUS = 6;
const RESIZE_HANDLE_EDGES = ['left', 'right', 'top', 'bottom'] as const;
const FURNITURE_WALL_SNAP_SCREEN_THRESHOLD = 16;
const FURNITURE_ALIGNMENT_SNAP_SCREEN_THRESHOLD = 10;

function getContextMenuFeatureWidth(defaultWidth: number, wallLength: number) {
  return Math.max(6, Math.min(defaultWidth, wallLength));
}

function createWallFeatureFromContextMenu(
  type: WallFeature['type'],
  wallLength: number,
): Omit<WallFeature, 'id'> | null {
  if (wallLength <= 0) {
    return null;
  }

  switch (type) {
    case 'door': {
      const width = getContextMenuFeatureWidth(36, wallLength);
      return {
        type,
        offset: Math.max(0, (wallLength - width) / 2),
        width,
        swingDirection: 'inward',
        swingHand: 'left',
      };
    }
    case 'window': {
      const width = getContextMenuFeatureWidth(36, wallLength);
      return {
        type,
        offset: Math.max(0, (wallLength - width) / 2),
        width,
        sillHeight: 36,
        height: 48,
      };
    }
    case 'opening': {
      const width = getContextMenuFeatureWidth(42, wallLength);
      return {
        type,
        offset: Math.max(0, (wallLength - width) / 2),
        width,
      };
    }
    case 'closet': {
      const width = getContextMenuFeatureWidth(48, wallLength);
      return {
        type,
        offset: Math.max(0, (wallLength - width) / 2),
        width,
        height: 96,
      };
    }
  }
}

function CanvasSettingsPopover({
  gridSnap,
  setGridSnap,
  setShowGrid,
  setShowMeasurements,
  setUnit,
  showGrid,
  showMeasurements,
  unit,
}: Pick<
  RoomPlannerReturn,
  | 'gridSnap'
  | 'setGridSnap'
  | 'setShowGrid'
  | 'setShowMeasurements'
  | 'setUnit'
  | 'showGrid'
  | 'showMeasurements'
  | 'unit'
>) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <ViewportToolbarButton
            kind="icon"
            aria-label="Canvas settings"
            title="Canvas settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </ViewportToolbarButton>
        }
      />
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-gray-500 uppercase dark:text-white/45">
            Canvas Settings
          </p>
          <p className="text-xs text-gray-500 dark:text-white/45">
            Display and measurement controls
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Units</Label>
            <Select
              value={unit}
              onValueChange={(value) => setUnit(value as Unit)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Inches</SelectItem>
                <SelectItem value="cm">Centimeters</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Show Grid</Label>
            <Switch checked={showGrid} onCheckedChange={setShowGrid} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Measurements</Label>
            <Switch
              checked={showMeasurements}
              onCheckedChange={setShowMeasurements}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Grid Snap</Label>
            <Select
              value={String(gridSnap)}
              onValueChange={(value) => setGridSnap(Number(value))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="1">
                  {unit === 'cm' ? '2.5 cm' : '1"'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Theme</Label>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </>
              )}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CanvasHelpPopover() {
  const shortcuts = [
    { keys: 'Shift + Click', label: 'Multiselect furniture or walls' },
    { keys: 'Space + Drag', label: 'Pan the canvas' },
    { keys: 'Drag Empty Space', label: 'Draw a selection box' },
    { keys: 'Scroll', label: 'Zoom in and out' },
    { keys: 'Delete', label: 'Remove selected items' },
    { keys: 'Arrows', label: 'Nudge selection' },
    { keys: 'Ctrl + D', label: 'Duplicate selection' },
    { keys: 'Ctrl + Z', label: 'Undo the last change' },
  ];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <ViewportToolbarButton
            kind="icon"
            aria-label="Canvas help"
            title="Canvas help"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </ViewportToolbarButton>
        }
      />
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">
            Canvas Help
          </p>
          <p className="text-xs text-gray-500 dark:text-white/45">
            Shortcuts and interaction tips for editing the room.
          </p>
        </div>

        <div className="space-y-2.5">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-start justify-between gap-3"
            >
              <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                {shortcut.keys}
              </span>
              <span className="flex-1 text-right text-xs text-gray-500 dark:text-white/50">
                {shortcut.label}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Canvas({ planner }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [selectedFeature, setSelectedFeature] = useState<{
    featureId: string;
    wallId: string;
  } | null>(null);
  const [selectedResizeHandle, setSelectedResizeHandle] = useState<{
    edge: FurnitureResizeEdge;
    id: string;
  } | null>(null);
  const [contextMenuTarget, setContextMenuTarget] =
    useState<CanvasContextMenuTarget | null>(null);
  const [renameDialog, setRenameDialog] =
    useState<FurnitureRenameDialogState | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── View state ──
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [cursor, setCursor] = useState('default');

  // ── Interaction ──
  const interactionRef = useRef<InteractionState>({ mode: 'idle' });
  const alignmentGuidesRef = useRef<FurnitureAlignmentGuide[]>([]);
  const mouseScreenRef = useRef<Point>({ x: 0, y: 0 });
  const altKeyRef = useRef(false);
  const spaceKeyRef = useRef(false);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const {
    discardFutureHistory,
    isHistoryEditingLocked,
    returnToLatestHistory,
    room,
    roomPolygon,
    rotateRoom,
    furniture,
    selectedId,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    toggleSelectedId,
    addWallFeature,
    removeWall,
    removeWallFeature,
    moveFurnitureGroup,
    updateFurnitureGroup,
    setFurnitureFrame,
    updateFurnitureFrame,
    setFurnitureTransforms,
    commitFurnitureMove,
    renameFurniture,
    duplicateFurniture,
    duplicateFurnitureGroup,
    removeFurniture,
    removeFurnitureGroup,
    moveFurnitureForward,
    moveFurnitureBackward,
    bringFurnitureToFront,
    sendFurnitureToBack,
    togglePulloutSofa,
    moveEndpoint,
    commitEndpointMove,
    mergeEndpoints,
    addWallToNewPoint,
    addWallBetweenEndpoints,
    moveWallFeature,
    moveFeatureToWall,
    commitFeatureMove,
    translateWall,
    nudgeWallFeature,
    updateWallFeature,
    selectedWallId,
    setSelectedWallId,
    disconnectEndpoint,
    splitEndpoint,
    showGrid,
    gridSnap,
    showMeasurements,
    setGridSnap,
    setShowGrid,
    setShowMeasurements,
    setUnit,
    toDisplay,
    unit,
  } = planner;

  const contextMenuItem = useMemo(
    () =>
      contextMenuTarget?.kind === 'furniture'
        ? (furniture.find((item) => item.id === contextMenuTarget.id) ?? null)
        : null,
    [contextMenuTarget, furniture],
  );
  const contextMenuWall = useMemo(
    () =>
      contextMenuTarget?.kind === 'wall'
        ? (room.walls.find((wall) => wall.id === contextMenuTarget.id) ?? null)
        : null,
    [contextMenuTarget, room.walls],
  );
  const contextMenuFeature = useMemo(() => {
    if (contextMenuTarget?.kind !== 'feature') {
      return null;
    }

    const wall = room.walls.find(
      (entry) => entry.id === contextMenuTarget.wallId,
    );
    if (!wall) {
      return null;
    }

    const feature =
      wall.features.find((entry) => entry.id === contextMenuTarget.featureId) ??
      null;
    if (!feature) {
      return null;
    }

    return {
      feature,
      wall,
    };
  }, [contextMenuTarget, room.walls]);
  const deleteTarget = useMemo(
    () => furniture.find((item) => item.id === deleteTargetId) ?? null,
    [deleteTargetId, furniture],
  );
  const contextMenuWallLength = useMemo(() => {
    if (!contextMenuWall) {
      return null;
    }

    const start = room.endpoints.find(
      (endpoint) => endpoint.id === contextMenuWall.startId,
    );
    const end = room.endpoints.find(
      (endpoint) => endpoint.id === contextMenuWall.endId,
    );
    if (!start || !end) {
      return null;
    }

    return getWallLength(start, end);
  }, [contextMenuWall, room.endpoints]);
  const contextMenuLayerIndex = useMemo(
    () =>
      contextMenuItem
        ? furniture.findIndex((item) => item.id === contextMenuItem.id)
        : -1,
    [contextMenuItem, furniture],
  );
  const canMoveContextMenuItemBackward = contextMenuLayerIndex > 0;
  const canMoveContextMenuItemForward =
    contextMenuLayerIndex >= 0 && contextMenuLayerIndex < furniture.length - 1;

  useEffect(() => {
    if (
      contextMenuTarget &&
      ((contextMenuTarget.kind === 'furniture' && !contextMenuItem) ||
        (contextMenuTarget.kind === 'feature' && !contextMenuFeature) ||
        (contextMenuTarget.kind === 'wall' && !contextMenuWall))
    ) {
      setContextMenuTarget(null);
    }
  }, [contextMenuFeature, contextMenuItem, contextMenuTarget, contextMenuWall]);

  const handleRenameSubmit = useCallback(() => {
    if (!renameDialog) {
      return;
    }

    renameFurniture(renameDialog.itemId, renameDialog.draftName);
    setRenameDialog(null);
  }, [renameDialog, renameFurniture]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTargetId) {
      return;
    }

    removeFurniture(deleteTargetId);
    setDeleteTargetId(null);
  }, [deleteTargetId, removeFurniture]);

  const handleAddWallFeatureFromContextMenu = useCallback(
    (type: WallFeature['type']) => {
      if (!contextMenuWall || !contextMenuWallLength) {
        return;
      }

      const feature = createWallFeatureFromContextMenu(
        type,
        contextMenuWallLength,
      );
      if (!feature) {
        return;
      }

      addWallFeature(contextMenuWall.id, feature);
    },
    [addWallFeature, contextMenuWall, contextMenuWallLength],
  );

  const handleDeleteWallFeatureFromContextMenu = useCallback(() => {
    if (!contextMenuFeature) {
      return;
    }

    removeWallFeature(
      contextMenuFeature.wall.id,
      contextMenuFeature.feature.id,
    );
    setSelectedFeature(null);
  }, [contextMenuFeature, removeWallFeature]);

  const handleToggleDoorSwingDirection = useCallback(() => {
    if (!contextMenuFeature || contextMenuFeature.feature.type !== 'door') {
      return;
    }

    updateWallFeature(
      contextMenuFeature.wall.id,
      contextMenuFeature.feature.id,
      {
        swingDirection:
          (contextMenuFeature.feature.swingDirection ?? 'inward') === 'inward'
            ? 'outward'
            : 'inward',
      },
    );
  }, [contextMenuFeature, updateWallFeature]);

  const handleToggleDoorHinge = useCallback(() => {
    if (!contextMenuFeature || contextMenuFeature.feature.type !== 'door') {
      return;
    }

    updateWallFeature(
      contextMenuFeature.wall.id,
      contextMenuFeature.feature.id,
      {
        swingHand:
          (contextMenuFeature.feature.swingHand ?? 'left') === 'left'
            ? 'right'
            : 'left',
      },
    );
  }, [contextMenuFeature, updateWallFeature]);

  // ── Coordinate transforms ──

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(panOffset);
  panRef.current = panOffset;

  const screenToWorld = useCallback(
    (sx: number, sy: number): Point =>
      mapScreenToWorld(
        { x: sx, y: sy },
        { pan: panRef.current, zoom: zoomRef.current },
      ),
    [],
  );

  const worldToScreen = useCallback(
    (wx: number, wy: number): Point =>
      mapWorldToScreen(
        { x: wx, y: wy },
        { pan: panRef.current, zoom: zoomRef.current },
      ),
    [],
  );

  const getRotationHandleScreenPoint = useCallback(
    (item: FurnitureItem): Point => {
      const center = worldToScreen(item.x, item.y);
      const distance =
        (item.depth * zoomRef.current) / 2 + ROTATION_HANDLE_OFFSET;
      const angle = (item.rotation * Math.PI) / 180 - Math.PI / 2;
      return {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      };
    },
    [worldToScreen],
  );

  const getResizeHandleScreenPoint = useCallback(
    (item: FurnitureItem, edge: FurnitureResizeEdge): Point => {
      const handlePoint = getFurnitureResizeHandlePoints(item)[edge];
      return worldToScreen(handlePoint.x, handlePoint.y);
    },
    [worldToScreen],
  );

  const applyFurnitureRotation = useCallback(
    (
      rotationState: FurnitureRotationState,
      worldPoint: Point,
      snapToIncrement: boolean,
    ) => {
      const currentAngle = getRotationAngleDegrees(
        rotationState.center,
        worldPoint,
      );
      const rawDelta = getSignedRotationDeltaDegrees(
        currentAngle,
        rotationState.startAngle,
      );
      const rotationDelta = snapToIncrement
        ? Math.round(rawDelta / 15) * 15
        : rawDelta;

      setFurnitureTransforms(
        rotationState.startTransforms.map((item) => {
          const nextCenter = rotatePointAround(
            { x: item.x, y: item.y },
            rotationState.center,
            rotationDelta,
          );

          return {
            id: item.id,
            x: nextCenter.x,
            y: nextCenter.y,
            rotation: normalizeRotationDegrees(item.rotation + rotationDelta),
          };
        }),
      );
    },
    [setFurnitureTransforms],
  );

  const getVisibleViewportBounds = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const dpr = window.devicePixelRatio || 1;
    const containerRect = container.getBoundingClientRect();
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;
    const openSidebar = document.querySelector<HTMLElement>(
      '[data-sidebar-panel="open"]',
    );

    const leftInset = openSidebar
      ? Math.max(
          0,
          Math.min(
            canvasWidth,
            openSidebar.getBoundingClientRect().right - containerRect.left + 16,
          ),
        )
      : 0;

    return {
      minX: leftInset,
      maxX: canvasWidth,
      centerX: leftInset + (canvasWidth - leftInset) / 2,
      centerY: canvasHeight / 2,
      width: canvasWidth - leftInset,
      height: canvasHeight,
    } satisfies ViewportBounds;
  }, []);

  const resizeCanvasToContainer = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return false;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    return true;
  }, []);

  // Walls stay on a 1-inch lattice even when furniture snap is disabled.
  const snapWallPoint = useCallback(
    (point: Point): Point => snapPointToGrid(point, WALL_GRID_SNAP),
    [],
  );

  // ── Fit to view ──

  const getFitViewState = useCallback(() => {
    const points =
      roomPolygon && roomPolygon.length > 0 ? roomPolygon : room.endpoints;
    return calculateFitViewState(getVisibleViewportBounds(), points);
  }, [getVisibleViewportBounds, room.endpoints, roomPolygon]);

  const fitToView = useCallback(() => {
    const fitView = getFitViewState();
    if (!fitView) return;

    setZoom(fitView.zoom);
    setPanOffset({
      x: fitView.canvasCenterX - fitView.centerX * fitView.zoom,
      y: fitView.canvasCenterY - fitView.centerY * fitView.zoom,
    });
  }, [getFitViewState]);

  const zoomAtPoint = useCallback(
    (targetZoom: number, sx: number, sy: number) => {
      const next = getZoomPanAtPoint({
        currentPan: panRef.current,
        currentZoom: zoomRef.current,
        maxZoom: MAX_CANVAS_ZOOM,
        minZoom: MIN_CANVAS_ZOOM,
        screenPoint: { x: sx, y: sy },
        targetZoom,
      });

      setPanOffset(next.pan);
      setZoom(next.zoom);
    },
    [],
  );

  const zoomAtWorldPoint = useCallback(
    (
      targetZoom: number,
      worldPoint: Point,
      screenAnchor: { x: number; y: number },
    ) => {
      const next = getZoomPanAtWorldPoint({
        maxZoom: MAX_CANVAS_ZOOM,
        minZoom: MIN_CANVAS_ZOOM,
        screenAnchor,
        targetZoom,
        worldPoint,
      });

      setPanOffset(next.pan);
      setZoom(next.zoom);
    },
    [],
  );

  const stepZoom = useCallback(
    (direction: 'in' | 'out') => {
      const currentZoom = zoomRef.current;
      const factor = 1.15;
      const targetZoom =
        direction === 'in' ? currentZoom * factor : currentZoom / factor;
      const fitView = getFitViewState();
      const viewport = getVisibleViewportBounds();
      if (!viewport) return;

      if (!fitView) {
        zoomAtPoint(targetZoom, viewport.centerX, viewport.centerY);
        return;
      }

      zoomAtWorldPoint(
        targetZoom,
        { x: fitView.centerX, y: fitView.centerY },
        { x: viewport.centerX, y: viewport.centerY },
      );
    },
    [getFitViewState, getVisibleViewportBounds, zoomAtPoint, zoomAtWorldPoint],
  );

  const fitZoom = getFitViewState()?.zoom ?? zoom;
  const zoomPercent = Math.max(1, Math.round((zoom / fitZoom) * 100));
  const roomBounds = getBounds(roomPolygon ?? room.endpoints);

  const getCombinedFurnitureBounds = useCallback((items: FurnitureItem[]) => {
    if (items.length === 0) {
      return null;
    }

    return items.reduce(
      (bounds, item) => {
        const itemBounds = getFurnitureBounds(item);
        return {
          minX: Math.min(bounds.minX, itemBounds.minX),
          maxX: Math.max(bounds.maxX, itemBounds.maxX),
          minY: Math.min(bounds.minY, itemBounds.minY),
          maxY: Math.max(bounds.maxY, itemBounds.maxY),
        };
      },
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      },
    );
  }, []);

  const getSelectedFurnitureItems = useCallback(
    (ids: string[]) => furniture.filter((item) => ids.includes(item.id)),
    [furniture],
  );

  const getGroupRotationHandleScreenPoint = useCallback(
    (items: FurnitureItem[]): Point | null => {
      const groupBounds = getCombinedFurnitureBounds(items);
      if (!groupBounds) {
        return null;
      }

      const topCenter = worldToScreen(
        (groupBounds.minX + groupBounds.maxX) / 2,
        groupBounds.minY,
      );
      return {
        x: topCenter.x,
        y: topCenter.y - ROTATION_HANDLE_OFFSET,
      };
    },
    [getCombinedFurnitureBounds, worldToScreen],
  );

  const getFurnitureItemsAtPositions = useCallback(
    (
      ids: string[],
      positions: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>,
    ): FurnitureItem[] => {
      const positionById = new Map(
        positions.map((position) => [position.id, position]),
      );

      return furniture
        .filter((item) => ids.includes(item.id))
        .map((item) => {
          const nextPosition = positionById.get(item.id);
          return nextPosition
            ? {
                ...item,
                x: nextPosition.x,
                y: nextPosition.y,
              }
            : item;
        });
    },
    [furniture],
  );

  const canPlaceFurnitureGroup = useCallback(
    (
      ids: string[],
      positions: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>,
    ) => {
      const movingItems = getFurnitureItemsAtPositions(ids, positions);
      const stationaryItems = furniture.filter(
        (item) => !ids.includes(item.id),
      );

      if (roomPolygon) {
        for (const item of movingItems) {
          if (checkFurnitureRoomCollision(item, roomPolygon)) {
            return false;
          }
        }
      }

      for (const item of movingItems) {
        for (const other of stationaryItems) {
          if (item.type === 'rug' || other.type === 'rug') {
            continue;
          }

          if (checkFurnitureCollision(item, other)) {
            return false;
          }
        }
      }

      return true;
    },
    [furniture, getFurnitureItemsAtPositions, roomPolygon],
  );

  const buildFurnitureAlignmentGuides = useCallback(
    (
      bounds: { maxX: number; maxY: number; minX: number; minY: number },
      matches: {
        x: FurnitureAlignmentMatch | null;
        y: FurnitureAlignmentMatch | null;
      },
      delta: Point,
    ) => {
      const padding = 8 / zoomRef.current;
      const shiftedBounds = {
        minX: bounds.minX + delta.x,
        maxX: bounds.maxX + delta.x,
        minY: bounds.minY + delta.y,
        maxY: bounds.maxY + delta.y,
      };
      const guides: FurnitureAlignmentGuide[] = [];

      if (matches.x) {
        guides.push({
          axis: 'x',
          position: matches.x.position,
          start:
            Math.min(shiftedBounds.minY, matches.x.targetBounds.minY) - padding,
          end:
            Math.max(shiftedBounds.maxY, matches.x.targetBounds.maxY) + padding,
        });
      }

      if (matches.y) {
        guides.push({
          axis: 'y',
          position: matches.y.position,
          start:
            Math.min(shiftedBounds.minX, matches.y.targetBounds.minX) - padding,
          end:
            Math.max(shiftedBounds.maxX, matches.y.targetBounds.maxX) + padding,
        });
      }

      return guides;
    },
    [],
  );

  const getSnappedFurniturePlacement = useCallback(
    (
      item: FurnitureItem,
      position: Point,
      axes: { x?: boolean; y?: boolean },
    ) => {
      let nextItem = {
        ...item,
        x: position.x,
        y: position.y,
      };

      if (gridSnap > 0 && roomBounds) {
        nextItem = snapFurnitureToBoundsGrid(
          nextItem,
          roomBounds,
          gridSnap,
          axes,
        );
      }

      if (roomPolygon && roomPolygon.length >= 3) {
        nextItem = snapFurnitureToRoomWalls(
          nextItem,
          roomPolygon,
          FURNITURE_WALL_SNAP_SCREEN_THRESHOLD / zoomRef.current,
        );
      }

      return nextItem;
    },
    [gridSnap, roomBounds, roomPolygon],
  );

  const getFurnitureGroupPlacement = useCallback(
    (
      draggedId: string,
      ids: string[],
      startPositions: Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>,
      position: Point,
      axes: { x?: boolean; y?: boolean },
    ) => {
      const draggedItem = furniture.find((item) => item.id === draggedId);
      const draggedStart = startPositions.find((item) => item.id === draggedId);
      if (!draggedItem || !draggedStart) {
        return {
          guides: [] as FurnitureAlignmentGuide[],
          positions: [] as Array<Pick<FurnitureItem, 'id' | 'x' | 'y'>>,
        };
      }

      const snappedDraggedItem = getSnappedFurniturePlacement(
        draggedItem,
        position,
        axes,
      );
      const delta = {
        x: snappedDraggedItem.x - draggedStart.x,
        y: snappedDraggedItem.y - draggedStart.y,
      };
      let nextPositions = startPositions.map((item) => ({
        id: item.id,
        x: item.x + delta.x,
        y: item.y + delta.y,
      }));
      const movingItems = getFurnitureItemsAtPositions(ids, nextPositions);
      const groupBounds = getCombinedFurnitureBounds(movingItems);

      if (!groupBounds) {
        return {
          guides: [] as FurnitureAlignmentGuide[],
          positions: nextPositions,
        };
      }

      const otherBounds = furniture
        .filter((item) => !ids.includes(item.id))
        .map((item) => getFurnitureBounds(item));
      const matches = getFurnitureAlignmentMatches(
        groupBounds,
        otherBounds,
        FURNITURE_ALIGNMENT_SNAP_SCREEN_THRESHOLD / zoomRef.current,
        axes,
      );

      let appliedDeltaX = 0;
      let appliedDeltaY = 0;
      let appliedXMatch: FurnitureAlignmentMatch | null = null;
      let appliedYMatch: FurnitureAlignmentMatch | null = null;

      if (matches.x) {
        const xPositions = nextPositions.map((item) => ({
          ...item,
          x: item.x + matches.x!.delta,
        }));
        if (canPlaceFurnitureGroup(ids, xPositions)) {
          appliedDeltaX = matches.x.delta;
          appliedXMatch = matches.x;
          nextPositions = xPositions;
        }
      }

      if (matches.y) {
        const yPositions = nextPositions.map((item) => ({
          ...item,
          y: item.y + matches.y!.delta,
        }));
        if (canPlaceFurnitureGroup(ids, yPositions)) {
          appliedDeltaY = matches.y.delta;
          appliedYMatch = matches.y;
          nextPositions = yPositions;
        }
      }

      return {
        guides: buildFurnitureAlignmentGuides(
          groupBounds,
          {
            x: appliedXMatch,
            y: appliedYMatch,
          },
          { x: appliedDeltaX, y: appliedDeltaY },
        ),
        positions: nextPositions,
      };
    },
    [
      buildFurnitureAlignmentGuides,
      canPlaceFurnitureGroup,
      furniture,
      getCombinedFurnitureBounds,
      getFurnitureItemsAtPositions,
      getSnappedFurniturePlacement,
    ],
  );

  const getMarqueeSelectionIds = useCallback(
    (startScreen: Point, currentScreen: Point) => {
      const minX = Math.min(startScreen.x, currentScreen.x);
      const maxX = Math.max(startScreen.x, currentScreen.x);
      const minY = Math.min(startScreen.y, currentScreen.y);
      const maxY = Math.max(startScreen.y, currentScreen.y);

      return furniture
        .filter((item) => {
          const bounds = getFurnitureBounds(item);
          const topLeft = worldToScreen(bounds.minX, bounds.minY);
          const bottomRight = worldToScreen(bounds.maxX, bounds.maxY);
          const itemMinX = Math.min(topLeft.x, bottomRight.x);
          const itemMaxX = Math.max(topLeft.x, bottomRight.x);
          const itemMinY = Math.min(topLeft.y, bottomRight.y);
          const itemMaxY = Math.max(topLeft.y, bottomRight.y);

          return !(
            itemMaxX < minX ||
            itemMinX > maxX ||
            itemMaxY < minY ||
            itemMinY > maxY
          );
        })
        .map((item) => item.id);
    },
    [furniture, worldToScreen],
  );

  // ── Hit testing ──

  const hitTestEndpoint = useCallback(
    (screenPoint: Point): WallEndpoint | null => {
      const r = HANDLE_RADIUS + 2;
      for (const ep of room.endpoints) {
        const s = worldToScreen(ep.x, ep.y);
        if (distSq(screenPoint, s) <= r * r) return ep;
      }
      return null;
    },
    [room.endpoints, worldToScreen],
  );

  const hitTestFeature = useCallback(
    (
      worldPoint: Point,
    ): { wallId: string; featureId: string; wall: Wall } | null => {
      const epMap = new Map(room.endpoints.map((e) => [e.id, e]));
      for (const wall of room.walls) {
        const a = epMap.get(wall.startId);
        const b = epMap.get(wall.endId);
        if (!a || !b) continue;
        for (const feature of wall.features) {
          const wallLen = getWallLength(a, b);
          if (wallLen === 0) continue;
          const midOffset = feature.offset + feature.width / 2;
          const frac = midOffset / wallLen;
          const fx = a.x + (b.x - a.x) * frac;
          const fy = a.y + (b.y - a.y) * frac;
          const d = Math.sqrt(distSq(worldPoint, { x: fx, y: fy }));
          if (d < feature.width / 2 + 8 / zoomRef.current) {
            return { wallId: wall.id, featureId: feature.id, wall };
          }
        }
      }
      return null;
    },
    [room.walls, room.endpoints],
  );

  const hitTestFurniture = useCallback(
    (worldPoint: Point): FurnitureItem | null => {
      for (let i = furniture.length - 1; i >= 0; i--) {
        const item = furniture[i];
        const rad = (-item.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = worldPoint.x - item.x;
        const dy = worldPoint.y - item.y;
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        if (item.shape === 'circle') {
          const r = item.width / 2;
          if (lx * lx + ly * ly <= r * r) return item;
        } else {
          const hw = item.width / 2;
          const hd = item.depth / 2;
          if (Math.abs(lx) <= hw && Math.abs(ly) <= hd) return item;
        }
      }
      return null;
    },
    [furniture],
  );

  const hitTestRotationHandle = useCallback(
    (screenPoint: Point): FurnitureRotationTarget | null => {
      if (selectedIds.length === 0) return null;

      if (selectedIds.length === 1 && selectedId) {
        const item = furniture.find((entry) => entry.id === selectedId);
        if (!item || item.locked) return null;
        const handlePoint = getRotationHandleScreenPoint(item);
        return distSq(screenPoint, handlePoint) <= ROTATION_HANDLE_RADIUS ** 2
          ? {
              center: { x: item.x, y: item.y },
              ids: [item.id],
              primaryId: item.id,
            }
          : null;
      }

      const selectedItems = getSelectedFurnitureItems(selectedIds);
      const rotatableIds = selectedItems
        .filter((item) => !item.locked)
        .map((item) => item.id);
      if (rotatableIds.length === 0) {
        return null;
      }

      const groupBounds = getCombinedFurnitureBounds(selectedItems);
      const handlePoint = getGroupRotationHandleScreenPoint(selectedItems);
      if (!groupBounds || !handlePoint) {
        return null;
      }

      return distSq(screenPoint, handlePoint) <= ROTATION_HANDLE_RADIUS ** 2
        ? {
            center: {
              x: (groupBounds.minX + groupBounds.maxX) / 2,
              y: (groupBounds.minY + groupBounds.maxY) / 2,
            },
            ids: rotatableIds,
            primaryId:
              selectedId && rotatableIds.includes(selectedId)
                ? selectedId
                : (rotatableIds[0] ?? null),
          }
        : null;
    },
    [
      furniture,
      getCombinedFurnitureBounds,
      getGroupRotationHandleScreenPoint,
      getRotationHandleScreenPoint,
      getSelectedFurnitureItems,
      selectedId,
      selectedIds,
    ],
  );

  const hitTestResizeHandle = useCallback(
    (
      screenPoint: Point,
    ): { edge: FurnitureResizeEdge; item: FurnitureItem } | null => {
      if (!selectedId || selectedIds.length !== 1) return null;
      const item = furniture.find((entry) => entry.id === selectedId);
      if (!item || item.locked) return null;

      for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
        const handlePoint = getResizeHandleScreenPoint(item, edge);
        if (distSq(screenPoint, handlePoint) <= RESIZE_HANDLE_RADIUS ** 2) {
          return { item, edge };
        }
      }

      return null;
    },
    [furniture, getResizeHandleScreenPoint, selectedId, selectedIds.length],
  );

  const hitTestWallSegment = useCallback(
    (worldPoint: Point): Wall | null => {
      const epMap = new Map(room.endpoints.map((e) => [e.id, e]));
      const threshold = 6 / zoomRef.current; // ~6px tolerance
      for (const wall of room.walls) {
        const a = epMap.get(wall.startId);
        const b = epMap.get(wall.endId);
        if (!a || !b) continue;
        const proj = projectOntoSegment(
          worldPoint.x,
          worldPoint.y,
          a.x,
          a.y,
          b.x,
          b.y,
        );
        if (proj.dist <= threshold) return wall;
      }
      return null;
    },
    [room.walls, room.endpoints],
  );

  // ── Find snap target endpoint (for connecting) ──
  const findSnapEndpoint = useCallback(
    (screenPoint: Point, excludeId?: string): WallEndpoint | null => {
      let best: WallEndpoint | null = null;
      let bestDist = SNAP_RADIUS * SNAP_RADIUS;
      for (const ep of room.endpoints) {
        if (ep.id === excludeId) continue;
        const s = worldToScreen(ep.x, ep.y);
        const d = distSq(screenPoint, s);
        if (d < bestDist) {
          bestDist = d;
          best = ep;
        }
      }
      return best;
    },
    [room.endpoints, worldToScreen],
  );

  // ── Mouse handlers ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setContextMenuTarget(null);
      alignmentGuidesRef.current = [];
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const screen = { x: sx, y: sy };

      // Drawing mode: place wall on click
      const interaction = interactionRef.current;
      if (interaction.mode === 'drawing-wall') {
        if (e.button !== 0) {
          // Right-click or other: exit drawing mode
          interactionRef.current = { mode: 'idle' };
          setCursor('default');
          rerender();
          return;
        }

        // Check snap to existing endpoint
        const snap = findSnapEndpoint(screen, interaction.fromEndpointId);
        if (snap) {
          addWallBetweenEndpoints(interaction.fromEndpointId, snap.id);
          interactionRef.current = { mode: 'idle' };
          setCursor('default');
          rerender();
        } else {
          const snapped = snapWallPoint(world);
          const newEpId = addWallToNewPoint(
            interaction.fromEndpointId,
            snapped,
          );
          interactionRef.current = {
            mode: 'drawing-wall',
            fromEndpointId: newEpId,
            currentEnd: snapped,
            snapTargetId: null,
          };
          rerender();
        }
        return;
      }

      // Middle click, ctrl+click, or space+drag = pan
      if (
        e.button === 1 ||
        (e.button === 0 &&
          (e.ctrlKey ||
            spaceKeyRef.current ||
            (isHistoryEditingLocked && e.shiftKey)))
      ) {
        interactionRef.current = {
          mode: 'panning',
          startMouse: { x: e.clientX, y: e.clientY },
          startPan: { ...panRef.current },
        };
        setCursor('grabbing');
        return;
      }

      if (isHistoryEditingLocked) {
        return;
      }

      if (e.button !== 0) return;

      const rotationHandleHit = hitTestRotationHandle(screen);
      if (rotationHandleHit) {
        if (rotationHandleHit.primaryId && selectedIds.length === 1) {
          setSelectedId(rotationHandleHit.primaryId);
        }
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        interactionRef.current = {
          mode: 'pending-rotation',
          center: rotationHandleHit.center,
          ids: rotationHandleHit.ids,
          startAngle: getRotationAngleDegrees(rotationHandleHit.center, world),
          startTransforms: furniture
            .filter((item) => rotationHandleHit.ids.includes(item.id))
            .map((item) => ({
              id: item.id,
              x: item.x,
              y: item.y,
              rotation: item.rotation,
            })),
          startScreen: screen,
        };
        setCursor(ROTATE_CURSOR);
        return;
      }

      const resizeHandleHit = hitTestResizeHandle(screen);
      if (resizeHandleHit) {
        setSelectedId(resizeHandleHit.item.id);
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle({
          id: resizeHandleHit.item.id,
          edge: resizeHandleHit.edge,
        });
        interactionRef.current = {
          mode: 'pending-resize',
          id: resizeHandleHit.item.id,
          edge: resizeHandleHit.edge,
          startScreen: screen,
        };
        setCursor(
          getResizeCursor(resizeHandleHit.edge, resizeHandleHit.item.rotation),
        );
        return;
      }

      // Check endpoint hit (highest priority for wall interaction)
      const epHit = hitTestEndpoint(screen);
      if (epHit) {
        setSelectedId(null);
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        interactionRef.current = {
          mode: 'pending-endpoint',
          endpointId: epHit.id,
          startScreen: screen,
          startWorld: { x: epHit.x, y: epHit.y },
          altKey: e.altKey,
        };
        return;
      }

      // Check feature hit
      const featureHit = hitTestFeature(world);
      if (featureHit) {
        setSelectedWallId(featureHit.wallId);
        setSelectedId(null);
        setSelectedFeature({
          wallId: featureHit.wallId,
          featureId: featureHit.featureId,
        });
        setSelectedResizeHandle(null);
        interactionRef.current = {
          mode: 'pending-feature',
          wallId: featureHit.wallId,
          featureId: featureHit.featureId,
          startScreen: screen,
        };
        setCursor('grabbing');
        return;
      }

      // Check wall segment hit
      const wallHit = hitTestWallSegment(world);
      if (wallHit) {
        alignmentGuidesRef.current = [];
        setSelectedWallId(wallHit.id);
        setSelectedId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        return;
      }

      // Check furniture hit
      const furnitureHit = hitTestFurniture(world);
      if (furnitureHit && !furnitureHit.locked) {
        alignmentGuidesRef.current = [];
        const isAlreadySelected = selectedIds.includes(furnitureHit.id);
        const dragIds = isAlreadySelected ? selectedIds : [furnitureHit.id];
        const startPositions = furniture
          .filter((item) => dragIds.includes(item.id) && !item.locked)
          .map((item) => ({
            id: item.id,
            x: item.x,
            y: item.y,
          }));

        if (!e.shiftKey && !isAlreadySelected) {
          setSelectedId(furnitureHit.id);
        }
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        interactionRef.current = {
          mode: 'pending-furniture',
          id: furnitureHit.id,
          ids: dragIds,
          offset: {
            x: world.x - furnitureHit.x,
            y: world.y - furnitureHit.y,
          },
          startPositions,
          toggleSelection: e.shiftKey,
          startScreen: screen,
        };
        setCursor('grabbing');
        return;
      }

      // Empty space: click to clear or drag to marquee-select
      alignmentGuidesRef.current = [];
      setSelectedWallId(null);
      setSelectedFeature(null);
      setSelectedResizeHandle(null);
      interactionRef.current = {
        mode: 'pending-marquee',
        additive: e.shiftKey,
        startScreen: screen,
      };
      setCursor('crosshair');
    },
    [
      screenToWorld,
      hitTestEndpoint,
      hitTestFeature,
      hitTestWallSegment,
      hitTestFurniture,
      hitTestRotationHandle,
      hitTestResizeHandle,
      findSnapEndpoint,
      snapWallPoint,
      addWallToNewPoint,
      addWallBetweenEndpoints,
      furniture,
      selectedIds,
      isHistoryEditingLocked,
      setSelectedId,
      setSelectedWallId,
      rerender,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const screen = { x: sx, y: sy };
      const world = screenToWorld(sx, sy);
      mouseScreenRef.current = screen;

      const interaction = interactionRef.current;

      switch (interaction.mode) {
        case 'panning': {
          const dx = e.clientX - interaction.startMouse.x;
          const dy = e.clientY - interaction.startMouse.y;
          setPanOffset({
            x: interaction.startPan.x + dx,
            y: interaction.startPan.y + dy,
          });
          return;
        }

        case 'pending-endpoint': {
          const dx = sx - interaction.startScreen.x;
          const dy = sy - interaction.startScreen.y;
          if (
            dx * dx + dy * dy >
            DRAG_INTENT_THRESHOLD * DRAG_INTENT_THRESHOLD
          ) {
            // Alt+drag: disconnect endpoint from the wall most aligned with drag direction
            if (interaction.altKey) {
              const connectedWalls = room.walls.filter(
                (w) =>
                  w.startId === interaction.endpointId ||
                  w.endId === interaction.endpointId,
              );
              if (connectedWalls.length >= 2) {
                const epMap = new Map(room.endpoints.map((ep) => [ep.id, ep]));
                // Find the wall LEAST aligned with drag (the one to leave behind).
                // disconnectEndpoint gives that wall a new endpoint at the junction,
                // so the original endpoint (dragged) stays on the wall the user is pulling.
                let leastWall = connectedWalls[0];
                let leastDot = Infinity;
                const dragLen = Math.sqrt(dx * dx + dy * dy);
                const dragDx = dx / dragLen;
                const dragDy = dy / dragLen;
                for (const w of connectedWalls) {
                  const otherId =
                    w.startId === interaction.endpointId ? w.endId : w.startId;
                  const other = epMap.get(otherId);
                  if (!other) continue;
                  const ep = epMap.get(interaction.endpointId);
                  if (!ep) continue;
                  const wdx = other.x - ep.x;
                  const wdy = other.y - ep.y;
                  const wLen = Math.sqrt(wdx * wdx + wdy * wdy);
                  if (wLen === 0) continue;
                  const dot = (wdx / wLen) * dragDx + (wdy / wLen) * dragDy;
                  if (dot < leastDot) {
                    leastDot = dot;
                    leastWall = w;
                  }
                }
                disconnectEndpoint(interaction.endpointId, leastWall.id);
                // Original endpoint stays on the wall aligned with drag direction
                interactionRef.current = {
                  mode: 'dragging-endpoint',
                  endpointId: interaction.endpointId,
                  snapTarget: null,
                };
                setCursor('grabbing');
                return;
              }
            }
            // Normal drag
            interactionRef.current = {
              mode: 'dragging-endpoint',
              endpointId: interaction.endpointId,
              snapTarget: null,
            };
            setCursor('grabbing');
          }
          return;
        }

        case 'pending-furniture': {
          if (interaction.toggleSelection) {
            return;
          }

          if (
            distSq(screen, interaction.startScreen) <=
            DRAG_INTENT_THRESHOLD ** 2
          ) {
            return;
          }

          interactionRef.current = {
            mode: 'dragging-furniture',
            id: interaction.id,
            ids: interaction.ids,
            offset: interaction.offset,
            startPositions: interaction.startPositions,
            startScreen: interaction.startScreen,
            moved: true,
          };

          let nx = world.x - interaction.offset.x;
          let ny = world.y - interaction.offset.y;
          if (gridSnap > 0) {
            nx = Math.round(nx / gridSnap) * gridSnap;
            ny = Math.round(ny / gridSnap) * gridSnap;
          }
          const draggedStart = interaction.startPositions.find(
            (item) => item.id === interaction.id,
          );
          if (!draggedStart) {
            return;
          }
          const nextPositions = getFurnitureGroupPlacement(
            interaction.id,
            interaction.ids,
            interaction.startPositions,
            { x: nx, y: ny },
            {
              x: Math.abs(nx - draggedStart.x) > Number.EPSILON,
              y: Math.abs(ny - draggedStart.y) > Number.EPSILON,
            },
          );
          alignmentGuidesRef.current = nextPositions.guides;
          moveFurnitureGroup(nextPositions.positions);
          return;
        }

        case 'dragging-endpoint': {
          let target = snapWallPoint(world);

          // Shift: constrain to horizontal/vertical relative to connected endpoints
          if (e.shiftKey) {
            const connectedWalls = room.walls.filter(
              (w) =>
                w.startId === interaction.endpointId ||
                w.endId === interaction.endpointId,
            );
            const epMap = new Map(room.endpoints.map((ep) => [ep.id, ep]));
            // Find the neighbor that gives the best axis alignment
            let bestConstrained = target;
            let bestAxisDist = Infinity;
            for (const w of connectedWalls) {
              const neighborId =
                w.startId === interaction.endpointId ? w.endId : w.startId;
              const neighbor = epMap.get(neighborId);
              if (!neighbor) continue;
              const dx = Math.abs(target.x - neighbor.x);
              const dy = Math.abs(target.y - neighbor.y);
              if (dx <= dy) {
                // Snap vertical (align x with neighbor)
                if (dx < bestAxisDist) {
                  bestAxisDist = dx;
                  bestConstrained = { x: neighbor.x, y: target.y };
                }
              } else {
                // Snap horizontal (align y with neighbor)
                if (dy < bestAxisDist) {
                  bestAxisDist = dy;
                  bestConstrained = { x: target.x, y: neighbor.y };
                }
              }
            }
            target = snapWallPoint(bestConstrained);
          }

          // Check for snap to other endpoint
          const snapEp = findSnapEndpoint(screen, interaction.endpointId);
          if (snapEp) {
            target = { x: snapEp.x, y: snapEp.y };
            interactionRef.current = {
              ...interaction,
              snapTarget: snapEp.id,
            };
          } else {
            interactionRef.current = { ...interaction, snapTarget: null };
          }
          moveEndpoint(interaction.endpointId, target);
          return;
        }

        case 'dragging-furniture': {
          const moved =
            interaction.moved ||
            distSq(screen, interaction.startScreen) > CLICK_THRESHOLD ** 2;
          if (moved !== interaction.moved) {
            interactionRef.current = {
              ...interaction,
              moved,
            };
          }
          let nx = world.x - interaction.offset.x;
          let ny = world.y - interaction.offset.y;
          if (gridSnap > 0) {
            nx = Math.round(nx / gridSnap) * gridSnap;
            ny = Math.round(ny / gridSnap) * gridSnap;
          }
          const draggedStart = interaction.startPositions.find(
            (item) => item.id === interaction.id,
          );
          if (!draggedStart) {
            return;
          }
          const nextPositions = getFurnitureGroupPlacement(
            interaction.id,
            interaction.ids,
            interaction.startPositions,
            { x: nx, y: ny },
            {
              x: Math.abs(nx - draggedStart.x) > Number.EPSILON,
              y: Math.abs(ny - draggedStart.y) > Number.EPSILON,
            },
          );
          alignmentGuidesRef.current = nextPositions.guides;
          moveFurnitureGroup(nextPositions.positions);
          return;
        }

        case 'pending-marquee': {
          if (
            distSq(screen, interaction.startScreen) <=
            DRAG_INTENT_THRESHOLD ** 2
          ) {
            return;
          }

          interactionRef.current = {
            mode: 'dragging-marquee',
            additive: interaction.additive,
            startScreen: interaction.startScreen,
            currentScreen: screen,
          };
          setCursor('crosshair');
          rerender();
          return;
        }

        case 'dragging-marquee': {
          interactionRef.current = {
            ...interaction,
            currentScreen: screen,
          };
          setCursor('crosshair');
          rerender();
          return;
        }

        case 'pending-resize': {
          if (
            distSq(screen, interaction.startScreen) <=
            DRAG_INTENT_THRESHOLD ** 2
          ) {
            return;
          }

          interactionRef.current = {
            mode: 'dragging-resize',
            id: interaction.id,
            edge: interaction.edge,
            startScreen: interaction.startScreen,
            moved: true,
          };

          const item = furniture.find((entry) => entry.id === interaction.id);
          if (!item) return;
          const nextFrame = resizeFurnitureFromEdge(
            item,
            interaction.edge,
            world,
            1,
          );
          setFurnitureFrame(interaction.id, nextFrame);
          return;
        }

        case 'dragging-resize': {
          const item = furniture.find((entry) => entry.id === interaction.id);
          if (!item) return;
          const moved =
            interaction.moved ||
            distSq(screen, interaction.startScreen) > CLICK_THRESHOLD ** 2;
          if (moved !== interaction.moved) {
            interactionRef.current = {
              ...interaction,
              moved,
            };
          }
          const nextFrame = resizeFurnitureFromEdge(
            item,
            interaction.edge,
            world,
            1,
          );
          setFurnitureFrame(interaction.id, nextFrame);
          return;
        }

        case 'pending-rotation': {
          if (
            distSq(screen, interaction.startScreen) <=
            DRAG_INTENT_THRESHOLD ** 2
          ) {
            return;
          }

          interactionRef.current = {
            mode: 'dragging-rotation',
            center: interaction.center,
            ids: interaction.ids,
            startAngle: interaction.startAngle,
            startScreen: interaction.startScreen,
            startTransforms: interaction.startTransforms,
          };
          applyFurnitureRotation(interaction, world, e.shiftKey);
          return;
        }

        case 'dragging-rotation': {
          applyFurnitureRotation(interaction, world, e.shiftKey);
          return;
        }

        case 'pending-feature': {
          if (
            distSq(screen, interaction.startScreen) <=
            DRAG_INTENT_THRESHOLD ** 2
          ) {
            return;
          }

          interactionRef.current = {
            mode: 'dragging-feature',
            wallId: interaction.wallId,
            featureId: interaction.featureId,
          };

          const epMap = new Map(room.endpoints.map((ep) => [ep.id, ep]));
          const wall = room.walls.find((w) => w.id === interaction.wallId);
          if (!wall) return;
          const feature = wall.features.find(
            (f) => f.id === interaction.featureId,
          );
          if (!feature) return;

          let bestWallId = interaction.wallId;
          let bestDist = Infinity;
          let bestT = 0;
          let bestLen = 0;
          for (const w of room.walls) {
            const wa = epMap.get(w.startId);
            const wb = epMap.get(w.endId);
            if (!wa || !wb) continue;
            const proj = projectOntoSegment(
              world.x,
              world.y,
              wa.x,
              wa.y,
              wb.x,
              wb.y,
            );
            if (proj.dist < bestDist) {
              bestDist = proj.dist;
              bestWallId = w.id;
              bestT = proj.t;
              bestLen = getWallLength(wa, wb);
            }
          }

          if (bestLen === 0) return;
          const newOffset = Math.max(
            0,
            Math.min(
              bestLen - feature.width,
              bestT * bestLen - feature.width / 2,
            ),
          );

          if (bestWallId !== interaction.wallId) {
            moveFeatureToWall(
              interaction.wallId,
              bestWallId,
              interaction.featureId,
              newOffset,
            );
            interactionRef.current = {
              mode: 'dragging-feature',
              wallId: bestWallId,
              featureId: interaction.featureId,
            };
            setSelectedWallId(bestWallId);
            setSelectedFeature({
              wallId: bestWallId,
              featureId: interaction.featureId,
            });
          } else {
            moveWallFeature(
              interaction.wallId,
              interaction.featureId,
              newOffset,
            );
          }
          return;
        }

        case 'dragging-feature': {
          const epMap = new Map(room.endpoints.map((ep) => [ep.id, ep]));
          const wall = room.walls.find((w) => w.id === interaction.wallId);
          if (!wall) return;
          const feature = wall.features.find(
            (f) => f.id === interaction.featureId,
          );
          if (!feature) return;

          // Find closest wall to mouse position
          let bestWallId = interaction.wallId;
          let bestDist = Infinity;
          let bestT = 0;
          let bestLen = 0;
          for (const w of room.walls) {
            const wa = epMap.get(w.startId);
            const wb = epMap.get(w.endId);
            if (!wa || !wb) continue;
            const proj = projectOntoSegment(
              world.x,
              world.y,
              wa.x,
              wa.y,
              wb.x,
              wb.y,
            );
            if (proj.dist < bestDist) {
              bestDist = proj.dist;
              bestWallId = w.id;
              bestT = proj.t;
              bestLen = getWallLength(wa, wb);
            }
          }

          if (bestLen === 0) return;
          const newOffset = Math.max(
            0,
            Math.min(
              bestLen - feature.width,
              bestT * bestLen - feature.width / 2,
            ),
          );

          if (bestWallId !== interaction.wallId) {
            // Transfer feature to closest wall
            moveFeatureToWall(
              interaction.wallId,
              bestWallId,
              interaction.featureId,
              newOffset,
            );
            interactionRef.current = {
              mode: 'dragging-feature',
              wallId: bestWallId,
              featureId: interaction.featureId,
            };
            setSelectedWallId(bestWallId);
            setSelectedFeature({
              wallId: bestWallId,
              featureId: interaction.featureId,
            });
          } else {
            moveWallFeature(
              interaction.wallId,
              interaction.featureId,
              newOffset,
            );
          }
          return;
        }

        case 'drawing-wall': {
          let snapped = snapWallPoint(world);

          // Shift: constrain to horizontal/vertical from source endpoint
          if (e.shiftKey) {
            const fromEp = room.endpoints.find(
              (ep) => ep.id === interaction.fromEndpointId,
            );
            if (fromEp) {
              const dx = Math.abs(snapped.x - fromEp.x);
              const dy = Math.abs(snapped.y - fromEp.y);
              if (dx <= dy) {
                snapped = snapWallPoint({ x: fromEp.x, y: snapped.y });
              } else {
                snapped = snapWallPoint({ x: snapped.x, y: fromEp.y });
              }
            }
          }

          const snapEp = findSnapEndpoint(screen, interaction.fromEndpointId);
          interactionRef.current = {
            ...interaction,
            currentEnd: snapEp ? { x: snapEp.x, y: snapEp.y } : snapped,
            snapTargetId: snapEp?.id ?? null,
          };
          return;
        }

        case 'idle': {
          if (spaceKeyRef.current) {
            setCursor('grab');
            return;
          }

          // Update cursor based on hover
          const rotationHandleHit = hitTestRotationHandle(screen);
          if (rotationHandleHit) {
            setCursor(ROTATE_CURSOR);
            return;
          }
          const resizeHandleHit = hitTestResizeHandle(screen);
          if (resizeHandleHit) {
            setCursor(
              getResizeCursor(
                resizeHandleHit.edge,
                resizeHandleHit.item.rotation,
              ),
            );
            return;
          }
          const epHit = hitTestEndpoint(screen);
          if (epHit) {
            setCursor('grab');
            return;
          }
          const featureHit = hitTestFeature(world);
          if (featureHit) {
            setCursor('grab');
            return;
          }
          const fHit = hitTestFurniture(world);
          if (fHit && !fHit.locked) {
            setCursor('grab');
            return;
          }
          setCursor('default');
          return;
        }
      }
    },
    [
      screenToWorld,
      snapWallPoint,
      findSnapEndpoint,
      hitTestEndpoint,
      hitTestFeature,
      hitTestFurniture,
      hitTestRotationHandle,
      hitTestResizeHandle,
      getFurnitureGroupPlacement,
      applyFurnitureRotation,
      moveEndpoint,
      moveFurnitureGroup,
      setFurnitureFrame,
      moveWallFeature,
      moveFeatureToWall,
      setSelectedWallId,
      disconnectEndpoint,
      furniture,
      gridSnap,
      room.endpoints,
      room.walls,
      rerender,
    ],
  );

  const handleMouseUp = useCallback(() => {
    const interaction = interactionRef.current;
    alignmentGuidesRef.current = [];

    switch (interaction.mode) {
      case 'pending-endpoint': {
        if (interaction.altKey) {
          // Alt+click → split shared endpoint apart
          splitEndpoint(interaction.endpointId);
          interactionRef.current = { mode: 'idle' };
          setCursor('default');
          rerender();
          return;
        }
        // Was a click (not drag) → select endpoint
        interactionRef.current = {
          mode: 'selected-endpoint',
          endpointId: interaction.endpointId,
        };
        setCursor('default');
        rerender();
        return;
      }

      case 'pending-furniture': {
        if (interaction.toggleSelection) {
          toggleSelectedId(interaction.id);
        } else if (!selectedIds.includes(interaction.id)) {
          setSelectedId(interaction.id);
        }
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'pending-marquee': {
        if (!interaction.additive) {
          setSelectedId(null);
        }
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        rerender();
        return;
      }

      case 'pending-resize': {
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'pending-rotation': {
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'pending-feature': {
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'dragging-endpoint': {
        // If snapped to another endpoint, merge them
        if (interaction.snapTarget) {
          mergeEndpoints(interaction.endpointId, interaction.snapTarget);
        } else {
          commitEndpointMove();
        }
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'dragging-furniture': {
        if (interaction.moved) {
          commitFurnitureMove();
        }
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'dragging-marquee': {
        const nextIds = getMarqueeSelectionIds(
          interaction.startScreen,
          interaction.currentScreen,
        );
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        setSelectedIds(
          interaction.additive
            ? Array.from(new Set([...selectedIds, ...nextIds]))
            : nextIds,
        );
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        rerender();
        return;
      }

      case 'dragging-rotation': {
        commitFurnitureMove();
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'dragging-resize': {
        if (interaction.moved) {
          commitFurnitureMove();
        }
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'dragging-feature': {
        commitFeatureMove();
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }

      case 'panning': {
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        return;
      }
    }
  }, [
    mergeEndpoints,
    commitEndpointMove,
    commitFurnitureMove,
    commitFeatureMove,
    getMarqueeSelectionIds,
    selectedIds,
    splitEndpoint,
    toggleSelectedId,
    rerender,
    setSelectedId,
    setSelectedIds,
    setSelectedWallId,
  ]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = e.ctrlKey || e.metaKey ? 1.15 : 1.1;
      const direction = e.deltaY < 0 ? 1 : -1;
      const currentZoom = zoomRef.current;
      const newZoom = currentZoom * (direction > 0 ? factor : 1 / factor);

      zoomAtPoint(newZoom, mx, my);
    },
    [zoomAtPoint],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isHistoryEditingLocked) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const screen = { x: sx, y: sy };
      const world = screenToWorld(sx, sy);

      const epHit = hitTestEndpoint(screen);
      if (epHit) {
        interactionRef.current = {
          mode: 'drawing-wall',
          fromEndpointId: epHit.id,
          currentEnd: { x: epHit.x, y: epHit.y },
          snapTargetId: null,
        };
        setCursor('crosshair');
        rerender();
        return;
      }

      const furnitureHit = hitTestFurniture(world);
      if (furnitureHit?.type === 'pullout-sofa' && furnitureHit.pulloutSofa) {
        togglePulloutSofa(furnitureHit.id);
      }
    },
    [
      hitTestEndpoint,
      hitTestFurniture,
      isHistoryEditingLocked,
      rerender,
      screenToWorld,
      togglePulloutSofa,
    ],
  );

  const handleContextMenuCapture = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      if (interactionRef.current.mode === 'drawing-wall') {
        e.preventDefault();
        interactionRef.current = { mode: 'idle' };
        setCursor('default');
        setContextMenuTarget(null);
        rerender();
        return;
      }

      if (isHistoryEditingLocked) {
        e.preventDefault();
        setContextMenuTarget(null);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const furnitureHit = hitTestFurniture(world);
      const featureHit = hitTestFeature(world);
      const wallHit = hitTestWallSegment(world);

      if (furnitureHit) {
        interactionRef.current = { mode: 'idle' };
        alignmentGuidesRef.current = [];
        setCursor('default');
        setSelectedId(furnitureHit.id);
        setSelectedIds([furnitureHit.id]);
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        setContextMenuTarget({
          kind: 'furniture',
          id: furnitureHit.id,
        });
        return;
      }

      if (featureHit) {
        interactionRef.current = { mode: 'idle' };
        alignmentGuidesRef.current = [];
        setCursor('default');
        setSelectedId(null);
        setSelectedIds([]);
        setSelectedWallId(featureHit.wallId);
        setSelectedFeature({
          wallId: featureHit.wallId,
          featureId: featureHit.featureId,
        });
        setSelectedResizeHandle(null);
        setContextMenuTarget({
          kind: 'feature',
          wallId: featureHit.wallId,
          featureId: featureHit.featureId,
        });
        return;
      }

      if (wallHit) {
        interactionRef.current = { mode: 'idle' };
        alignmentGuidesRef.current = [];
        setCursor('default');
        setSelectedId(null);
        setSelectedIds([]);
        setSelectedWallId(wallHit.id);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
        setContextMenuTarget({
          kind: 'wall',
          id: wallHit.id,
        });
        return;
      }

      e.preventDefault();
      setContextMenuTarget(null);
    },
    [
      hitTestFurniture,
      hitTestFeature,
      hitTestWallSegment,
      isHistoryEditingLocked,
      rerender,
      screenToWorld,
      setSelectedId,
      setSelectedIds,
      setSelectedWallId,
    ],
  );

  // ── Drawing ──

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const isDark = theme === 'dark';
    const z = zoomRef.current;
    const pan = panRef.current;

    const toScreen = (wx: number, wy: number): Point => ({
      x: wx * z + pan.x,
      y: wy * z + pan.y,
    });

    const toWorld = (sx: number, sy: number): Point => ({
      x: (sx - pan.x) / z,
      y: (sy - pan.y) / z,
    });

    const roomPolygonScreen =
      roomPolygon && roomPolygon.length >= 3
        ? roomPolygon.map((point) => toScreen(point.x, point.y))
        : null;
    const outsideRoomClipPath = createOutsideRoomClipPath(
      w,
      h,
      roomPolygonScreen,
    );
    const strokeWallSegment = (
      from: Point,
      to: Point,
      strokeStyle: string,
      lineWidth: number,
      lineCap: CanvasLineCap = 'round',
    ) => {
      ctx.save();
      if (outsideRoomClipPath) {
        ctx.clip(outsideRoomClipPath, 'evenodd');
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = lineCap;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    };

    // ── Grid ──
    if (showGrid) {
      const topLeft = toWorld(0, 0);
      const bottomRight = toWorld(w, h);

      const minorGridSize = getMinorGridSize(z);
      if (minorGridSize) {
        drawGridLayer(ctx, {
          canvasHeight: h,
          canvasWidth: w,
          gridSize: minorGridSize,
          skipEvery: MAJOR_GRID_SIZE,
          strokeStyle: isDark
            ? 'rgba(255,255,255,0.025)'
            : 'rgba(15,23,42,0.035)',
          toScreen,
          viewportBottomRight: bottomRight,
          viewportTopLeft: topLeft,
        });
      }

      drawGridLayer(ctx, {
        canvasHeight: h,
        canvasWidth: w,
        gridSize: MAJOR_GRID_SIZE,
        strokeStyle: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.08)',
        toScreen,
        viewportBottomRight: bottomRight,
        viewportTopLeft: topLeft,
      });
    }

    const { endpoints, walls } = room;
    const epMap = new Map(endpoints.map((e) => [e.id, e]));

    // ── Room fill (closed polygon) ──
    if (roomPolygon && roomPolygon.length >= 3) {
      ctx.save();
      ctx.beginPath();
      const first = toScreen(roomPolygon[0].x, roomPolygon[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < roomPolygon.length; i++) {
        const p = toScreen(roomPolygon[i].x, roomPolygon[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(30,41,59,0.45)' : 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.restore();
    }

    // ── Walls ──
    const wallThickness = 6;
    for (const wall of walls) {
      const a = epMap.get(wall.startId);
      const b = epMap.get(wall.endId);
      if (!a || !b) continue;
      const s1 = toScreen(a.x, a.y);
      const s2 = toScreen(b.x, b.y);
      const isSelected = wall.id === selectedWallId;

      // Selected wall: subtle highlight glow behind
      if (isSelected) {
        strokeWallSegment(
          s1,
          s2,
          isDark ? 'rgba(129,140,248,0.3)' : 'rgba(99,102,241,0.25)',
          wallThickness + 6,
        );
      }

      strokeWallSegment(
        s1,
        s2,
        isSelected
          ? isDark
            ? '#a5b4fc'
            : '#6366f1'
          : isDark
            ? '#94a3b8'
            : '#334155',
        wallThickness,
      );
    }

    // ── Wall features (doors, windows, openings, closets) ──
    // Compute room centroid for inward/outward direction
    const roomCentroid =
      roomPolygon && roomPolygon.length >= 3
        ? {
            x:
              roomPolygon.reduce((sum, point) => sum + point.x, 0) /
              roomPolygon.length,
            y:
              roomPolygon.reduce((sum, point) => sum + point.y, 0) /
              roomPolygon.length,
          }
        : null;

    for (const wall of walls) {
      const a = epMap.get(wall.startId);
      const b = epMap.get(wall.endId);
      if (!a || !b) continue;
      const wallLen = getWallLength(a, b);
      const angle = getWallAngle(a, b);

      // Perpendicular normal — pick the one pointing toward room interior
      const inwardNormal = getWallInteriorUnitNormal(a, b, roomCentroid);
      const inwardSign =
        inwardNormal.x * Math.cos(angle + Math.PI / 2) +
          inwardNormal.y * Math.sin(angle + Math.PI / 2) >=
        0
          ? 1
          : -1;

      for (const feature of wall.features) {
        const frac = feature.offset / wallLen;
        const fracEnd = (feature.offset + feature.width) / wallLen;
        const startX = a.x + (b.x - a.x) * frac;
        const startY = a.y + (b.y - a.y) * frac;
        const endX = a.x + (b.x - a.x) * fracEnd;
        const endY = a.y + (b.y - a.y) * fracEnd;

        const s1 = toScreen(startX, startY);
        const s2 = toScreen(endX, endY);

        if (feature.type === 'door') {
          // Clear wall behind door
          ctx.save();
          strokeWallSegment(
            s1,
            s2,
            isDark ? '#1e293b' : '#ffffff',
            wallThickness + 2,
          );

          const doorWidth = feature.width * z;
          const isRightHinge = feature.swingHand === 'right';
          const hingeScreen = isRightHinge ? s2 : s1;

          // Door baseline angle: from hinge toward the free end along the wall
          const baseAngle = isRightHinge ? angle + Math.PI : angle;

          // Swing perpendicular direction: inward or outward relative to room
          const swingPerp =
            feature.swingDirection === 'outward' ? -inwardSign : inwardSign;
          // Flipping hinge reverses baseAngle by π, so we must also
          // flip the perpendicular rotation to stay on the same side
          const hingeFlip = isRightHinge ? -1 : 1;

          // Arc sweeps 90° from the wall line toward the swing side
          const arcStart = baseAngle;
          const arcEnd = baseAngle + (hingeFlip * swingPerp * Math.PI) / 2;

          // Draw arc
          ctx.strokeStyle = isDark
            ? 'rgba(99,102,241,0.5)'
            : 'rgba(79,70,229,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(
            hingeScreen.x,
            hingeScreen.y,
            doorWidth,
            Math.min(arcStart, arcEnd),
            Math.max(arcStart, arcEnd),
          );
          ctx.stroke();

          // Draw door leaf (line from hinge to end of arc)
          ctx.strokeStyle = isDark ? '#6366f1' : '#4f46e5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hingeScreen.x, hingeScreen.y);
          ctx.lineTo(
            hingeScreen.x + Math.cos(arcEnd) * doorWidth,
            hingeScreen.y + Math.sin(arcEnd) * doorWidth,
          );
          ctx.stroke();
          ctx.restore();
        } else if (feature.type === 'window') {
          ctx.save();
          strokeWallSegment(
            s1,
            s2,
            isDark ? '#1e293b' : '#ffffff',
            wallThickness + 2,
          );

          ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
          ctx.lineWidth = 2;
          const perpX = Math.cos(angle + Math.PI / 2) * 3;
          const perpY = Math.sin(angle + Math.PI / 2) * 3;
          ctx.beginPath();
          ctx.moveTo(s1.x + perpX, s1.y + perpY);
          ctx.lineTo(s2.x + perpX, s2.y + perpY);
          ctx.moveTo(s1.x - perpX, s1.y - perpY);
          ctx.lineTo(s2.x - perpX, s2.y - perpY);
          ctx.stroke();
          ctx.restore();
        } else if (feature.type === 'opening') {
          ctx.save();

          // Clear the wall segment to create a true opening.
          strokeWallSegment(
            s1,
            s2,
            isDark ? '#1e293b' : '#ffffff',
            wallThickness + 2,
          );

          // Draw short jamb markers at each end so the opening reads intentionally.
          const jambHalf = 6;
          const perpX = Math.cos(angle + Math.PI / 2) * jambHalf;
          const perpY = Math.sin(angle + Math.PI / 2) * jambHalf;
          ctx.strokeStyle = isDark ? '#10b981' : '#059669';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s1.x - perpX, s1.y - perpY);
          ctx.lineTo(s1.x + perpX, s1.y + perpY);
          ctx.moveTo(s2.x - perpX, s2.y - perpY);
          ctx.lineTo(s2.x + perpX, s2.y + perpY);
          ctx.stroke();
          ctx.restore();
        } else if (feature.type === 'closet') {
          // Draw closet as a subtle box extending outward from the wall
          const closetDepth = 24 * z; // 24 inches deep
          const outX = -inwardNormal.x * closetDepth;
          const outY = -inwardNormal.y * closetDepth;

          ctx.save();

          // Clear wall segment behind closet (like doors/windows)
          strokeWallSegment(
            s1,
            s2,
            isDark ? '#1e293b' : '#ffffff',
            wallThickness + 2,
          );

          // Filled background of the closet box
          ctx.fillStyle = isDark
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.04)';
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.lineTo(s2.x + outX, s2.y + outY);
          ctx.lineTo(s1.x + outX, s1.y + outY);
          ctx.closePath();
          ctx.fill();

          // Solid border for the box
          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.25)'
            : 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.lineTo(s2.x + outX, s2.y + outY);
          ctx.lineTo(s1.x + outX, s1.y + outY);
          ctx.closePath();
          ctx.stroke();

          // Center divider line (double doors)
          const midWallX = (s1.x + s2.x) / 2;
          const midWallY = (s1.y + s2.y) / 2;
          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.15)'
            : 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(midWallX, midWallY);
          ctx.lineTo(midWallX + outX, midWallY + outY);
          ctx.stroke();

          // Wall-line indicator (visible mark along the wall)
          ctx.strokeStyle = isDark
            ? 'rgba(168,162,158,0.6)'
            : 'rgba(120,113,108,0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.restore();
        }

        if (
          selectedFeature?.wallId === wall.id &&
          selectedFeature.featureId === feature.id
        ) {
          ctx.save();
          strokeWallSegment(
            s1,
            s2,
            isDark ? 'rgba(34,211,238,0.75)' : 'rgba(6,182,212,0.75)',
            wallThickness + 4,
          );

          ctx.strokeStyle = isDark ? '#67e8f9' : '#0891b2';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    if (showMeasurements && selectedWallId) {
      const selectedWall = walls.find((wall) => wall.id === selectedWallId);
      if (selectedWall) {
        const a = epMap.get(selectedWall.startId);
        const b = epMap.get(selectedWall.endId);
        if (a && b) {
          const inwardNormal = getWallInteriorUnitNormal(a, b, roomCentroid);

          drawSelectedWallMeasurements(
            ctx,
            selectedWall,
            a,
            b,
            { x: -inwardNormal.x, y: -inwardNormal.y },
            z,
            toScreen,
            isDark,
            toDisplay,
            unit,
          );
        }
      }
    }

    // ── Wall labels (number badge + dimension) ──
    const interaction = interactionRef.current;
    const placedWallLabelBounds: Rect[] = [];
    const canvasBounds = {
      minX: 12,
      minY: 12,
      maxX: w - 12,
      maxY: h - 12,
    };
    ctx.save();
    const wallLabels = walls
      .map((wall, index) => {
        const a = epMap.get(wall.startId);
        const b = epMap.get(wall.endId);
        if (!a || !b) {
          return null;
        }

        return {
          a,
          b,
          index,
          length: getWallLength(a, b),
          wall,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => left.length - right.length);

    for (const { a, b, index, length } of wallLabels) {
      const s1 = toScreen(a.x, a.y);
      const s2 = toScreen(b.x, b.y);
      const tangentLength = Math.hypot(s2.x - s1.x, s2.y - s1.y) || 1;
      const tangent = {
        x: (s2.x - s1.x) / tangentLength,
        y: (s2.y - s1.y) / tangentLength,
      };
      const midScreen = {
        x: (s1.x + s2.x) / 2,
        y: (s1.y + s2.y) / 2,
      };
      const inwardNormal = getWallInteriorUnitNormal(a, b, roomCentroid);
      const outwardNormal = {
        x: -inwardNormal.x,
        y: -inwardNormal.y,
      };
      const endpointObstacles = [
        {
          center: s1,
          radius: HANDLE_RADIUS + 8,
        },
        {
          center: s2,
          radius: HANDLE_RADIUS + 8,
        },
      ];
      const dimLabel = showMeasurements
        ? unit === 'cm'
          ? `${toDisplay(length).toFixed(0)} cm`
          : `${parseFloat(toDisplay(length).toFixed(3))}"`
        : null;

      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      const labelPad = 4;
      const labelHeight = 14 + labelPad;
      const labelWidth = dimLabel
        ? ctx.measureText(dimLabel).width + labelPad * 2
        : 0;
      const layout = getWallLabelLayout({
        anchor: midScreen,
        canvasBounds,
        labelHeight,
        labelWidth,
        obstacleCircles: endpointObstacles,
        obstacleRects: placedWallLabelBounds,
        outwardNormal,
        tangent,
      });

      placedWallLabelBounds.push(layout.bounds);
      // Wall number badge
      const numLabel = `${index + 1}`;
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = isDark ? 'rgba(99,102,241,0.8)' : 'rgba(79,70,229,0.8)';
      ctx.beginPath();
      ctx.arc(
        layout.badgeCenter.x,
        layout.badgeCenter.y,
        WALL_LABEL_BADGE_RADIUS,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(numLabel, layout.badgeCenter.x, layout.badgeCenter.y);

      // Dimension label
      if (dimLabel) {
        ctx.fillStyle = isDark
          ? 'rgba(15,23,42,0.85)'
          : 'rgba(255,255,255,0.9)';
        ctx.fillRect(
          layout.labelRect.minX,
          layout.labelRect.minY,
          layout.labelRect.maxX - layout.labelRect.minX,
          layout.labelRect.maxY - layout.labelRect.minY,
        );
        ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
        ctx.fillText(dimLabel, layout.labelCenter.x, layout.labelCenter.y);
      }
    }
    ctx.restore();

    // ── Endpoint handles ──
    const isDrawing = interaction.mode === 'drawing-wall';

    ctx.save();
    for (const ep of endpoints) {
      const s = toScreen(ep.x, ep.y);
      const isDragging =
        (interaction.mode === 'dragging-endpoint' &&
          interaction.endpointId === ep.id) ||
        (interaction.mode === 'pending-endpoint' &&
          interaction.endpointId === ep.id);
      const isSnapTarget =
        (interaction.mode === 'dragging-endpoint' &&
          interaction.snapTarget === ep.id) ||
        (interaction.mode === 'drawing-wall' &&
          interaction.snapTargetId === ep.id);
      const isSelected =
        interaction.mode === 'selected-endpoint' &&
        interaction.endpointId === ep.id;

      // Count connections for visual hint
      const connCount = walls.filter(
        (w) => w.startId === ep.id || w.endId === ep.id,
      ).length;

      let radius = HANDLE_RADIUS;
      let fillColor = isDark ? '#334155' : '#ffffff';
      let strokeColor = isDark ? '#64748b' : '#94a3b8';
      let strokeWidth = 2;

      if (isDragging) {
        radius = HANDLE_RADIUS + 2;
        strokeColor = '#f59e0b';
        strokeWidth = 2.5;
      } else if (isSnapTarget) {
        radius = HANDLE_RADIUS + 3;
        fillColor = '#22c55e';
        strokeColor = '#16a34a';
        strokeWidth = 2.5;
      } else if (isSelected) {
        radius = HANDLE_RADIUS + 2;
        fillColor = isDark ? '#312e81' : '#eef2ff';
        strokeColor = '#6366f1';
        strokeWidth = 2.5;
      } else if (isDrawing) {
        strokeColor = '#6366f1';
        strokeWidth = 2;
      } else if (connCount === 1) {
        // Open endpoint - highlight as draggable/connectable
        strokeColor = isDark ? '#818cf8' : '#6366f1';
      }

      // Selected endpoint: draw outer ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    ctx.restore();

    // ── Alt-hover disconnect indicator on shared endpoints ──
    if (
      altKeyRef.current &&
      (interaction.mode === 'idle' || interaction.mode === 'selected-endpoint')
    ) {
      const ms = mouseScreenRef.current;
      const hitR = HANDLE_RADIUS + 2;
      for (const ep of endpoints) {
        const s = toScreen(ep.x, ep.y);
        if (distSq(ms, s) > hitR * hitR) continue;
        const connCount = walls.filter(
          (w) => w.startId === ep.id || w.endId === ep.id,
        ).length;
        if (connCount < 2) continue;
        // Draw disconnect badge: small circle with a minus sign
        const bx = s.x + HANDLE_RADIUS + 6;
        const by = s.y - HANDLE_RADIUS - 6;
        ctx.save();
        // Badge background
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        // Minus sign
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 3.5, by);
        ctx.lineTo(bx + 3.5, by);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }

    // ── Drawing mode ghost wall ──
    if (interaction.mode === 'drawing-wall') {
      const fromEp = epMap.get(interaction.fromEndpointId);
      if (fromEp) {
        const s1 = toScreen(fromEp.x, fromEp.y);
        const s2 = toScreen(interaction.currentEnd.x, interaction.currentEnd.y);

        ctx.save();
        ctx.strokeStyle = interaction.snapTargetId
          ? '#22c55e'
          : isDark
            ? '#818cf8'
            : '#6366f1';
        ctx.lineWidth = interaction.snapTargetId ? 4 : 3;
        ctx.setLineDash(interaction.snapTargetId ? [] : [8, 6]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ghost dimension label
        const length = getWallLength(fromEp, interaction.currentEnd);
        if (length > 1) {
          const displayLen = toDisplay(length);
          const dimLabel =
            unit === 'cm'
              ? `${displayLen.toFixed(0)} cm`
              : `${parseFloat(displayLen.toFixed(3))}"`;
          const midX = (s1.x + s2.x) / 2;
          const midY = (s1.y + s2.y) / 2 - 14;

          ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const metrics = ctx.measureText(dimLabel);
          const pad = 5;

          ctx.fillStyle = isDark
            ? 'rgba(99,102,241,0.9)'
            : 'rgba(79,70,229,0.9)';
          ctx.beginPath();
          const rx = metrics.width / 2 + pad;
          const ry = 10;
          ctx.roundRect(midX - rx, midY - ry, rx * 2, ry * 2, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(dimLabel, midX, midY);
        }

        // Ghost endpoint
        if (!interaction.snapTargetId) {
          ctx.beginPath();
          ctx.arc(s2.x, s2.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? '#818cf8' : '#6366f1';
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // ── Furniture ──
    for (const item of furniture) {
      const screen = toScreen(item.x, item.y);
      const isSelected = selectedIds.includes(item.id);
      const showSingleItemHandles = isSelected && selectedIds.length === 1;
      const isDraggingItem =
        interaction.mode === 'dragging-furniture' && interaction.id === item.id;

      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate((item.rotation * Math.PI) / 180);

      const sw = item.width * z;
      const sd = item.depth * z;

      if (!isDraggingItem) {
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      const isRug = item.type === 'rug';
      ctx.globalAlpha = isRug ? 0.18 : isDraggingItem ? 0.58 : 0.42;
      ctx.fillStyle = item.color;

      if (item.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, sw / 2, sd / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-sw / 2, -sd / 2, sw, sd);
      }

      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSelected
        ? '#f59e0b'
        : getFurnitureLabelColor(item.color, isDark);
      ctx.lineWidth = isSelected ? 2.5 : 1;

      if (item.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, sw / 2, sd / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(-sw / 2, -sd / 2, sw, sd);
      }

      const maxLabelWidth = sw - 12;
      const maxLabelHeight = sd - 12;
      const canShowName = maxLabelWidth > 26 && maxLabelHeight > 18;
      const canShowDimensions =
        showMeasurements && maxLabelWidth > 46 && maxLabelHeight > 30;

      if (canShowName) {
        const nameFontSize = Math.max(
          9,
          Math.min(12, Math.min(sw / 5.8, sd / 4.5)),
        );
        ctx.font = `${nameFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        const nameLabel = truncateCanvasText(ctx, item.name, maxLabelWidth);
        const nameMetrics = ctx.measureText(nameLabel);

        let detailLabel = '';
        let detailMetrics: TextMetrics | null = null;
        const detailFontSize = Math.max(8, nameFontSize - 1);

        if (canShowDimensions) {
          ctx.font = `${detailFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          detailLabel = truncateCanvasText(
            ctx,
            formatFurnitureDimensions(item, toDisplay, unit),
            maxLabelWidth,
          );
          detailMetrics = ctx.measureText(detailLabel);
        }

        const lineGap = 3;
        const labelHeight = canShowDimensions
          ? nameFontSize + detailFontSize + lineGap
          : nameFontSize;
        const labelWidth = Math.max(
          nameMetrics.width,
          detailMetrics?.width ?? 0,
        );
        const showTwoLineLabel =
          canShowDimensions &&
          labelHeight < maxLabelHeight &&
          labelWidth < maxLabelWidth;
        const showSingleLineLabel =
          !showTwoLineLabel && nameMetrics.width < maxLabelWidth;
        const rugLabelTextColor = isDark
          ? 'rgba(226,232,240,0.74)'
          : 'rgba(30,41,59,0.66)';
        const rugLabelDetailColor = isDark
          ? 'rgba(203,213,225,0.62)'
          : 'rgba(51,65,85,0.56)';
        const rugLabelHaloColor = isDark
          ? 'rgba(15,23,42,0.58)'
          : 'rgba(248,250,252,0.82)';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1;
        ctx.fillStyle = isRug
          ? rugLabelTextColor
          : getFurnitureLabelColor(item.color, isDark);
        ctx.font = `700 ${nameFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

        if (isRug) {
          ctx.shadowColor = rugLabelHaloColor;
          ctx.shadowBlur = 7;
          ctx.strokeStyle = rugLabelHaloColor;
          ctx.lineWidth = 3;
        }

        if (showTwoLineLabel) {
          const nameY = -(detailFontSize + lineGap) / 2;
          const detailY = nameFontSize / 2 + lineGap / 2;
          if (isRug) {
            ctx.strokeText(nameLabel, 0, nameY);
          }
          ctx.fillText(nameLabel, 0, nameY);
          ctx.fillStyle = isRug
            ? rugLabelDetailColor
            : getFurnitureLabelColor(item.color, isDark);
          ctx.globalAlpha = isRug ? 1 : 0.9;
          ctx.font = `${detailFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          if (isRug) {
            ctx.lineWidth = 2.5;
            ctx.strokeText(detailLabel, 0, detailY);
          }
          ctx.fillText(detailLabel, 0, detailY);
        } else if (showSingleLineLabel) {
          if (isRug) {
            ctx.strokeText(nameLabel, 0, 0);
          }
          ctx.fillText(nameLabel, 0, 0);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      if (showSingleItemHandles && !item.locked) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f59e0b';
        const rotationHandleY = -sd / 2 - ROTATION_HANDLE_OFFSET;
        ctx.beginPath();
        ctx.arc(0, rotationHandleY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, -sd / 2);
        ctx.lineTo(0, rotationHandleY);
        ctx.stroke();
        ctx.setLineDash([]);

        const resizeHandles = [
          { x: -sw / 2, y: 0 },
          { x: sw / 2, y: 0 },
          { x: 0, y: -sd / 2 },
          { x: 0, y: sd / 2 },
        ];

        ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        for (const [index, handle] of resizeHandles.entries()) {
          const edge = RESIZE_HANDLE_EDGES[index];
          const isActiveResizeHandle =
            selectedResizeHandle?.id === item.id &&
            selectedResizeHandle.edge === edge;

          ctx.beginPath();
          ctx.arc(handle.x, handle.y, RESIZE_HANDLE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = isActiveResizeHandle
            ? '#f59e0b'
            : isDark
              ? '#0f172a'
              : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = isActiveResizeHandle ? '#ffffff' : '#f59e0b';
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    if (interaction.mode === 'dragging-furniture') {
      drawFurnitureAlignmentGuides(
        ctx,
        alignmentGuidesRef.current,
        toScreen,
        isDark,
      );
    }

    if (interaction.mode === 'dragging-marquee') {
      const minX = Math.min(
        interaction.startScreen.x,
        interaction.currentScreen.x,
      );
      const minY = Math.min(
        interaction.startScreen.y,
        interaction.currentScreen.y,
      );
      const width = Math.abs(
        interaction.currentScreen.x - interaction.startScreen.x,
      );
      const height = Math.abs(
        interaction.currentScreen.y - interaction.startScreen.y,
      );

      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(56,189,248,0.10)' : 'rgba(6,182,212,0.12)';
      ctx.strokeStyle = isDark ? 'rgba(56,189,248,0.8)' : 'rgba(8,145,178,0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(minX, minY, width, height);
      ctx.strokeRect(minX, minY, width, height);
      ctx.restore();
    }

    // ── Collision highlights ──
    const invalidFurnitureIds = new Set<string>();

    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        const a = furniture[i];
        const b = furniture[j];
        if (a.type === 'rug' || b.type === 'rug') continue;
        if (checkFurnitureCollision(a, b)) {
          invalidFurnitureIds.add(a.id);
          invalidFurnitureIds.add(b.id);
        }
      }
    }

    if (roomPolygon) {
      for (const item of furniture) {
        if (checkFurnitureRoomCollision(item, roomPolygon)) {
          invalidFurnitureIds.add(item.id);
        }
      }
    }

    for (const item of furniture) {
      if (!invalidFurnitureIds.has(item.id)) continue;

      const screen = toScreen(item.x, item.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.strokeStyle = 'rgba(239,68,68,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      const sw = item.width * z;
      const sd = item.depth * z;
      if (item.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, sw / 2 + 3, sd / 2 + 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(-sw / 2 - 3, -sd / 2 - 3, sw + 6, sd + 6);
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (selectedIds.length > 1) {
      const selectedItems = getSelectedFurnitureItems(selectedIds);
      if (selectedItems.length > 0) {
        const groupBounds = selectedItems.reduce(
          (bounds, item) => {
            const itemBounds = getFurnitureBounds(item);
            return {
              minX: Math.min(bounds.minX, itemBounds.minX),
              maxX: Math.max(bounds.maxX, itemBounds.maxX),
              minY: Math.min(bounds.minY, itemBounds.minY),
              maxY: Math.max(bounds.maxY, itemBounds.maxY),
            };
          },
          {
            minX: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
          },
        );
        const topLeft = toScreen(groupBounds.minX, groupBounds.minY);
        const bottomRight = toScreen(groupBounds.maxX, groupBounds.maxY);

        ctx.save();
        ctx.strokeStyle = isDark
          ? 'rgba(34,211,238,0.75)'
          : 'rgba(8,145,178,0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          topLeft.x,
          topLeft.y,
          bottomRight.x - topLeft.x,
          bottomRight.y - topLeft.y,
        );
        ctx.setLineDash([]);

        if (selectedItems.some((item) => !item.locked)) {
          const handlePoint = getGroupRotationHandleScreenPoint(selectedItems);
          if (handlePoint) {
            const topCenterX = (topLeft.x + bottomRight.x) / 2;

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(topCenterX, topLeft.y);
            ctx.lineTo(handlePoint.x, handlePoint.y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(handlePoint.x, handlePoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        ctx.restore();

        if (showMeasurements) {
          drawBoundsDimensions(
            ctx,
            groupBounds,
            toScreen,
            isDark,
            toDisplay,
            unit,
          );
        }
      }
    }

    // ── Measurement overlays for selected furniture ──
    if (showMeasurements && roomPolygon) {
      if (selectedId && selectedIds.length === 1) {
        const selected = furniture.find((f) => f.id === selectedId);
        if (selected) {
          const roomBounds = getBounds(roomPolygon);
          if (roomBounds) {
            drawDistanceToWalls(
              ctx,
              getNearestFurnitureClearances(selected, roomBounds),
              toScreen,
              isDark,
              toDisplay,
              unit,
            );
          }
        }
      } else if (selectedIds.length > 1) {
        const selectedItems = furniture.filter((item) =>
          selectedIds.includes(item.id),
        );
        if (selectedItems.length > 0) {
          const roomBounds = getBounds(roomPolygon);
          if (roomBounds) {
            const bounds = selectedItems.reduce(
              (groupBounds, item) => {
                const itemBounds = getFurnitureBounds(item);
                return {
                  minX: Math.min(groupBounds.minX, itemBounds.minX),
                  maxX: Math.max(groupBounds.maxX, itemBounds.maxX),
                  minY: Math.min(groupBounds.minY, itemBounds.minY),
                  maxY: Math.max(groupBounds.maxY, itemBounds.maxY),
                };
              },
              {
                minX: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY,
              },
            );
            const anchor = {
              x: (bounds.minX + bounds.maxX) / 2,
              y: (bounds.minY + bounds.maxY) / 2,
            };

            drawDistanceToWalls(
              ctx,
              getNearestBoundsClearances(bounds, roomBounds, anchor),
              toScreen,
              isDark,
              toDisplay,
              unit,
            );
          }
        }
      }
    }

    // ── Scale indicator ──
    drawScaleIndicator(ctx, w, h, isDark, z, toDisplay, unit);

    // ── Drawing mode hint ──
    if (isDrawing) {
      ctx.save();
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hint = 'Click to place wall segments. Right-click or ESC to stop.';
      const hx = w / 2;
      const hy = h - 44;
      const metrics = ctx.measureText(hint);
      ctx.fillStyle = isDark ? 'rgba(99,102,241,0.85)' : 'rgba(79,70,229,0.85)';
      ctx.beginPath();
      ctx.roundRect(
        hx - metrics.width / 2 - 12,
        hy - 14,
        metrics.width + 24,
        28,
        6,
      );
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(hint, hx, hy);
      ctx.restore();
    }
  }, [
    theme,
    room,
    roomPolygon,
    furniture,
    selectedId,
    selectedIds,
    selectedFeature,
    selectedResizeHandle,
    selectedWallId,
    showGrid,
    showMeasurements,
    toDisplay,
    unit,
    getGroupRotationHandleScreenPoint,
    getSelectedFurnitureItems,
  ]);

  // ── Resize observer ──
  useLayoutEffect(() => {
    resizeCanvasToContainer();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      resizeCanvasToContainer();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeCanvasToContainer]);

  // ── Initial fit ──
  const fitToViewRef = useRef(fitToView);
  fitToViewRef.current = fitToView;

  useLayoutEffect(() => {
    if (!resizeCanvasToContainer()) {
      return;
    }

    fitToViewRef.current();
  }, [resizeCanvasToContainer]);

  // ── Render loop ──
  useEffect(() => {
    let animId: number;
    const loop = () => {
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [draw]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (selectedFeature && selectedFeature.wallId !== selectedWallId) {
      setSelectedFeature(null);
    }
  }, [selectedFeature, selectedWallId]);

  useEffect(() => {
    if (
      selectedResizeHandle &&
      (selectedResizeHandle.id !== selectedId || selectedIds.length !== 1)
    ) {
      setSelectedResizeHandle(null);
    }
  }, [selectedId, selectedIds.length, selectedResizeHandle]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        altKeyRef.current = true;
      }
      if (
        e.key === ' ' &&
        document.activeElement === document.body &&
        !e.repeat
      ) {
        e.preventDefault();
        spaceKeyRef.current = true;
        if (interactionRef.current.mode === 'idle') {
          setCursor('grab');
        }
      }
      if (e.key === 'Escape') {
        if (renameDialog || deleteTargetId) {
          setRenameDialog(null);
          setDeleteTargetId(null);
          return;
        }
        if (contextMenuTarget) {
          setContextMenuTarget(null);
          return;
        }
        if (
          interactionRef.current.mode === 'drawing-wall' ||
          interactionRef.current.mode === 'selected-endpoint'
        ) {
          interactionRef.current = { mode: 'idle' };
          setCursor('default');
          rerender();
          return;
        }
        setSelectedId(null);
        setSelectedWallId(null);
        setSelectedFeature(null);
        setSelectedResizeHandle(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          planner.redo();
        } else {
          planner.undo();
        }
        return;
      }
      if (renameDialog || deleteTargetId || contextMenuTarget) {
        return;
      }
      if (planner.isHistoryEditingLocked) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement !== document.body) return;
        e.preventDefault();
        if (selectedIds.length > 0) {
          removeFurnitureGroup(selectedIds);
        } else if (selectedWallId) {
          planner.removeWall(selectedWallId);
        }
      }
      if (e.key === 'r' && document.activeElement === document.body) {
        if (selectedIds.length > 1) {
          planner.rotateFurnitureGroup(selectedIds, 15);
          return;
        }

        const singleSelectedId = selectedId ?? selectedIds[0];
        if (!singleSelectedId) {
          return;
        }

        const item = furniture.find((f) => f.id === singleSelectedId);
        if (item && !item.locked) {
          planner.rotateFurniture(singleSelectedId, (item.rotation + 15) % 360);
        }
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        if (selectedIds.length === 1 && selectedId) {
          duplicateFurniture(selectedId);
        } else {
          duplicateFurnitureGroup(selectedIds);
        }
      }
      if (
        document.activeElement === document.body &&
        interactionRef.current.mode === 'idle' &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        const baseStep = gridSnap > 0 ? gridSnap : 1;
        const step = e.shiftKey ? baseStep * 10 : baseStep;

        if (selectedResizeHandle && selectedId) {
          const item = furniture.find((entry) => entry.id === selectedId);
          if (!item || item.locked) return;

          const delta =
            e.key === 'ArrowUp'
              ? { x: 0, y: -step }
              : e.key === 'ArrowDown'
                ? { x: 0, y: step }
                : e.key === 'ArrowLeft'
                  ? { x: -step, y: 0 }
                  : { x: step, y: 0 };

          if (!delta) {
            return;
          }

          e.preventDefault();
          const nextFrame = resizeFurnitureByHandleDelta(
            item,
            selectedResizeHandle.edge,
            delta,
            1,
          );
          updateFurnitureFrame(selectedId, nextFrame);
          return;
        }

        const delta =
          e.key === 'ArrowUp'
            ? { x: 0, y: -step }
            : e.key === 'ArrowDown'
              ? { x: 0, y: step }
              : e.key === 'ArrowLeft'
                ? { x: -step, y: 0 }
                : { x: step, y: 0 };

        if (selectedFeature) {
          e.preventDefault();
          const featureDelta =
            e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -step : step;
          nudgeWallFeature(
            selectedFeature.wallId,
            selectedFeature.featureId,
            featureDelta,
          );
          return;
        }

        if (selectedWallId) {
          e.preventDefault();
          translateWall(selectedWallId, delta.x, delta.y);
          return;
        }

        if (selectedIds.length > 0) {
          const movableItems = furniture.filter(
            (item) => selectedIds.includes(item.id) && !item.locked,
          );
          const anchorItem =
            movableItems.find((item) => item.id === selectedId) ??
            movableItems[movableItems.length - 1];

          if (!anchorItem) {
            return;
          }

          e.preventDefault();
          const snappedAnchor = getSnappedFurniturePlacement(
            anchorItem,
            {
              x: anchorItem.x + delta.x,
              y: anchorItem.y + delta.y,
            },
            {
              x: delta.x !== 0,
              y: delta.y !== 0,
            },
          );
          const appliedDelta = {
            x: snappedAnchor.x - anchorItem.x,
            y: snappedAnchor.y - anchorItem.y,
          };
          const updates = movableItems.map((item) => ({
            id: item.id,
            x: item.x + appliedDelta.x,
            y: item.y + appliedDelta.y,
          }));

          if (updates.length === 1 && selectedId) {
            planner.updateFurniture(selectedId, {
              x: updates[0].x,
              y: updates[0].y,
            });
          } else {
            updateFurnitureGroup(updates);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        altKeyRef.current = false;
      }
      if (e.key === ' ') {
        spaceKeyRef.current = false;
        if (interactionRef.current.mode === 'idle') {
          setCursor('default');
        }
      }
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedId,
    selectedIds,
    selectedFeature,
    selectedResizeHandle,
    selectedWallId,
    duplicateFurniture,
    duplicateFurnitureGroup,
    contextMenuTarget,
    deleteTargetId,
    furniture,
    gridSnap,
    nudgeWallFeature,
    planner,
    removeFurnitureGroup,
    renameDialog,
    setSelectedId,
    setSelectedWallId,
    updateFurnitureFrame,
    updateFurnitureGroup,
    getSnappedFurniturePlacement,
    translateWall,
    rerender,
  ]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ContextMenu
        onOpenChange={(open) => {
          if (!open) {
            setContextMenuTarget(null);
          }
        }}
      >
        <ContextMenuTrigger className="absolute inset-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ cursor }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              const mode = interactionRef.current.mode;
              if (
                mode !== 'drawing-wall' &&
                mode !== 'idle' &&
                mode !== 'selected-endpoint' &&
                mode !== 'pending-endpoint' &&
                mode !== 'pending-furniture' &&
                mode !== 'pending-resize' &&
                mode !== 'pending-rotation' &&
                mode !== 'pending-feature'
              ) {
                handleMouseUp();
              }
            }}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onContextMenuCapture={handleContextMenuCapture}
          />
        </ContextMenuTrigger>
        {contextMenuItem ? (
          <ContextMenuContent sideOffset={10}>
            <div className="px-2 py-1.5">
              <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-gray-400 uppercase dark:text-white/35">
                Furniture
              </p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {contextMenuItem.name}
              </p>
            </div>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => sendFurnitureToBack(contextMenuItem.id)}
              disabled={!canMoveContextMenuItemBackward}
            >
              <ChevronsDown className="h-4 w-4" />
              To Back
              <ContextMenuShortcut>Layer</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => moveFurnitureBackward(contextMenuItem.id)}
              disabled={!canMoveContextMenuItemBackward}
            >
              <ChevronDown className="h-4 w-4" />
              Backward
              <ContextMenuShortcut>Layer</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => moveFurnitureForward(contextMenuItem.id)}
              disabled={!canMoveContextMenuItemForward}
            >
              <ChevronUp className="h-4 w-4" />
              Forward
              <ContextMenuShortcut>Layer</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => bringFurnitureToFront(contextMenuItem.id)}
              disabled={!canMoveContextMenuItemForward}
            >
              <ChevronsUp className="h-4 w-4" />
              To Front
              <ContextMenuShortcut>Layer</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                setRenameDialog({
                  draftName: contextMenuItem.name,
                  itemId: contextMenuItem.id,
                })
              }
            >
              <Pencil className="h-4 w-4" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => duplicateFurniture(contextMenuItem.id)}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => setDeleteTargetId(contextMenuItem.id)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        ) : contextMenuWall ? (
          <ContextMenuContent sideOffset={10}>
            <div className="px-2 py-1.5">
              <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-gray-400 uppercase dark:text-white/35">
                Wall
              </p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {contextMenuWallLength
                  ? `Segment ${Number.parseFloat(
                      toDisplay(contextMenuWallLength).toFixed(1),
                    )}${unit === 'cm' ? ' cm' : '"'}`
                  : 'Wall Segment'}
              </p>
            </div>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => handleAddWallFeatureFromContextMenu('door')}
            >
              Add Door
              <ContextMenuShortcut>
                {formatCanvasDimension(36, toDisplay, unit)}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleAddWallFeatureFromContextMenu('window')}
            >
              Add Window
              <ContextMenuShortcut>
                {formatCanvasDimension(36, toDisplay, unit)}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleAddWallFeatureFromContextMenu('opening')}
            >
              Add Opening
              <ContextMenuShortcut>
                {formatCanvasDimension(42, toDisplay, unit)}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleAddWallFeatureFromContextMenu('closet')}
            >
              Add Closet
              <ContextMenuShortcut>
                {formatCanvasDimension(48, toDisplay, unit)}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => removeWall(contextMenuWall.id)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Wall
            </ContextMenuItem>
          </ContextMenuContent>
        ) : contextMenuFeature ? (
          <ContextMenuContent sideOffset={10}>
            <div className="px-2 py-1.5">
              <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-gray-400 uppercase dark:text-white/35">
                Feature
              </p>
              <p className="truncate text-sm font-medium capitalize text-gray-900 dark:text-white">
                {contextMenuFeature.feature.type}
              </p>
            </div>
            {contextMenuFeature.feature.type === 'door' ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleToggleDoorSwingDirection}>
                  Flip Swing
                  <ContextMenuShortcut>
                    {contextMenuFeature.feature.swingDirection ?? 'inward'}
                  </ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleToggleDoorHinge}>
                  Flip Hinge
                  <ContextMenuShortcut>
                    {contextMenuFeature.feature.swingHand ?? 'left'}
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </>
            ) : null}
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={handleDeleteWallFeatureFromContextMenu}
            >
              <Trash2 className="h-4 w-4" />
              Delete Feature
            </ContextMenuItem>
          </ContextMenuContent>
        ) : null}
      </ContextMenu>
      <Dialog
        open={renameDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Furniture</DialogTitle>
            <DialogDescription>
              Give this piece a clearer label for the canvas and sidebar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameDialog?.draftName ?? ''}
            onChange={(event) =>
              setRenameDialog((current) =>
                current
                  ? {
                      ...current,
                      draftName: event.target.value,
                    }
                  : current,
              )
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleRenameSubmit();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!renameDialog?.draftName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Furniture?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove "${deleteTarget.name}" from this layout? This can still be undone.`
                : 'Remove this furniture item from the layout? This can still be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isHistoryEditingLocked ? (
        <div className="absolute top-4 left-1/2 z-10 flex max-w-[min(92vw,40rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/30 bg-slate-950/85 px-3 py-1.5 text-[11px] font-medium text-amber-100 shadow-lg backdrop-blur">
          <span className="whitespace-nowrap">
            You are viewing an earlier version.
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 py-0 text-[11px] font-medium text-amber-200 underline-offset-2 hover:text-amber-100"
            onClick={returnToLatestHistory}
          >
            Return to Latest
          </Button>
          <span className="text-amber-200/50">|</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 py-0 text-[11px] font-medium text-amber-200 underline-offset-2 hover:text-amber-100"
            onClick={() => {
              const message =
                'Editing from here will remove the newer changes. Continue?';
              if (window.confirm(message)) {
                discardFutureHistory();
              }
            }}
          >
            Edit From Here
          </Button>
        </div>
      ) : null}
      <ViewportToolbar className="absolute top-4 right-4">
        <ViewportToolbarButton
          kind="step"
          onClick={() => stepZoom('out')}
          aria-label="Zoom out"
        >
          -
        </ViewportToolbarButton>
        <ViewportToolbarValue>{zoomPercent}%</ViewportToolbarValue>
        <ViewportToolbarButton
          kind="step"
          onClick={() => stepZoom('in')}
          aria-label="Zoom in"
        >
          +
        </ViewportToolbarButton>
        <ViewportToolbarButton onClick={fitToView}>Fit</ViewportToolbarButton>
        <ViewportToolbarButton
          kind="icon"
          onClick={() => rotateRoom()}
          disabled={room.endpoints.length < 3}
          className="disabled:text-gray-400 dark:disabled:text-white/30"
          aria-label="Rotate room 90 degrees clockwise"
          title="Rotate room 90 degrees clockwise"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </ViewportToolbarButton>
        <CanvasHelpPopover />
        <CanvasSettingsPopover
          gridSnap={gridSnap}
          setGridSnap={setGridSnap}
          setShowGrid={setShowGrid}
          setShowMeasurements={setShowMeasurements}
          setUnit={setUnit}
          showGrid={showGrid}
          showMeasurements={showMeasurements}
          unit={unit}
        />
      </ViewportToolbar>
    </div>
  );
}
