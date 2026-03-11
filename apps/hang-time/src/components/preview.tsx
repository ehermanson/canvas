import {
  ViewportToolbar,
  ViewportToolbarButton,
  ViewportToolbarValue,
} from '@canvas-tools/ui';
import type { ViewportBounds } from '@canvas-tools/viewport';
import { useElementSize, useViewportController } from '@canvas-tools/viewport';
import { HelpCircle, Moon, Settings, Sun } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import { useTheme } from '@/hooks/use-theme';
import type { Unit } from '@/types';
import {
  calculateLayoutPositions,
  formatMeasurement,
  formatShort,
  fromDisplayUnit,
  toDisplayUnit,
} from '@/utils/calculations';

interface PreviewProps {
  calculator: UseCalculatorReturn;
}

type HookSelection = {
  frameId: number;
  hookIndex: number;
};

type PositionedFrame = {
  frameId: string;
  position: UseCalculatorReturn['layoutPositions'][number];
};

type LayoutBounds = {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
};

type FrameDragSession = {
  bounds: LayoutBounds;
  frameId: string;
  lastArrangementKey?: string;
  mode: 'gallery' | 'layout';
  moved: boolean;
  originalPosition: UseCalculatorReturn['layoutPositions'][number];
  startClientX: number;
  startClientY: number;
};

const ROW_SWITCH_HYSTERESIS = 2;
const SLOT_SWITCH_HYSTERESIS = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLayoutBounds(frames: PositionedFrame[]): LayoutBounds | null {
  if (frames.length === 0) {
    return null;
  }

  const minX = Math.min(...frames.map(({ position }) => position.x));
  const minY = Math.min(...frames.map(({ position }) => position.y));
  const maxX = Math.max(
    ...frames.map(({ position }) => position.x + position.width),
  );
  const maxY = Math.max(
    ...frames.map(({ position }) => position.y + position.height),
  );

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function findFrameAtPoint(
  frames: PositionedFrame[],
  point: { x: number; y: number },
  {
    offsetX,
    offsetY,
    scale,
  }: {
    offsetX: number;
    offsetY: number;
    scale: number;
  },
) {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    const { position } = frame;
    const left = offsetX + position.x * scale;
    const top = offsetY + position.y * scale;
    const right = left + position.width * scale;
    const bottom = top + position.height * scale;

    if (
      point.x >= left &&
      point.x <= right &&
      point.y >= top &&
      point.y <= bottom
    ) {
      return frame;
    }
  }

  return null;
}

function findHookAtPoint(
  frames: PositionedFrame[],
  point: { x: number; y: number },
  {
    offsetX,
    offsetY,
    scale,
    radius,
  }: {
    offsetX: number;
    offsetY: number;
    scale: number;
    radius: number;
  },
): HookSelection | null {
  for (const { position } of frames) {
    const hookX1 = offsetX + position.hookX * scale;
    const hookY = offsetY + position.hookY * scale;

    if (Math.hypot(point.x - hookX1, point.y - hookY) <= radius) {
      return { frameId: position.id, hookIndex: 0 };
    }

    if (position.hookX2 !== undefined) {
      const hookX2 = offsetX + position.hookX2 * scale;
      if (Math.hypot(point.x - hookX2, point.y - hookY) <= radius) {
        return { frameId: position.id, hookIndex: 1 };
      }
    }
  }

  return null;
}

function reorderFramesForCanvasDrag(
  frames: UseCalculatorReturn['state']['frames'],
  positionedFrames: PositionedFrame[],
  draggedFrameId: string,
  point: { x: number; y: number },
) {
  const rows = new Map<number, PositionedFrame[]>();
  positionedFrames.forEach((frame) => {
    const row = frame.position.row ?? 0;
    if (!rows.has(row)) {
      rows.set(row, []);
    }
    rows.get(row)!.push(frame);
  });

  const rowEntries = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rowIndex, rowFrames]) => ({
      rowIndex,
      frames: rowFrames,
      centerY:
        rowFrames.reduce(
          (sum, frame) => sum + frame.position.y + frame.position.height / 2,
          0,
        ) / rowFrames.length,
    }));

  if (rowEntries.length === 0) {
    return null;
  }

  const draggedFrame = frames.find((frame) => frame.id === draggedFrameId);
  if (!draggedFrame) {
    return null;
  }

  const currentRowIndex = draggedFrame.row ?? 0;
  const currentRowEntry =
    rowEntries.find((row) => row.rowIndex === currentRowIndex) ?? rowEntries[0];

  let targetRowEntry = rowEntries.reduce((best, row) =>
    Math.abs(row.centerY - point.y) < Math.abs(best.centerY - point.y)
      ? row
      : best,
  );

  if (targetRowEntry.rowIndex !== currentRowEntry.rowIndex) {
    const movingDown = targetRowEntry.centerY > currentRowEntry.centerY;
    const rowBoundary =
      (targetRowEntry.centerY + currentRowEntry.centerY) / 2 +
      (movingDown ? ROW_SWITCH_HYSTERESIS : -ROW_SWITCH_HYSTERESIS);

    if (
      (movingDown && point.y < rowBoundary) ||
      (!movingDown && point.y > rowBoundary)
    ) {
      targetRowEntry = currentRowEntry;
    }
  }

  const currentIndexInTargetRow = targetRowEntry.frames.findIndex(
    (frame) => frame.frameId === draggedFrameId,
  );

  const framesInTargetRow = targetRowEntry.frames.filter(
    (frame) => frame.frameId !== draggedFrameId,
  );

  let targetIndex = framesInTargetRow.length;
  for (let index = 0; index < framesInTargetRow.length; index += 1) {
    const frame = framesInTargetRow[index];
    const centerX = frame.position.x + frame.position.width / 2;
    const slotBoundary =
      centerX +
      (index >= Math.max(currentIndexInTargetRow, 0)
        ? SLOT_SWITCH_HYSTERESIS
        : -SLOT_SWITCH_HYSTERESIS);
    if (point.x < slotBoundary) {
      targetIndex = index;
      break;
    }
  }

  const groupedFrames = new Map<
    number,
    UseCalculatorReturn['state']['frames']
  >();
  frames.forEach((frame) => {
    const row = frame.row ?? 0;
    if (!groupedFrames.has(row)) {
      groupedFrames.set(row, []);
    }
    groupedFrames.get(row)!.push(frame);
  });

  groupedFrames.forEach((rowFrames, rowIndex) => {
    groupedFrames.set(
      rowIndex,
      rowFrames.filter((frame) => frame.id !== draggedFrameId),
    );
  });

  const targetRowFrames = groupedFrames.get(targetRowEntry.rowIndex) ?? [];
  const nextTargetRowFrames = [...targetRowFrames];
  nextTargetRowFrames.splice(targetIndex, 0, {
    ...draggedFrame,
    row: targetRowEntry.rowIndex,
  });
  groupedFrames.set(targetRowEntry.rowIndex, nextTargetRowFrames);

  const normalizedFrames = [...groupedFrames.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([, rowFrames], normalizedRowIndex) =>
      rowFrames.map((frame) => ({ ...frame, row: normalizedRowIndex })),
    );

  const arrangementKey = normalizedFrames
    .map((frame, index) => `${index}:${frame.id}:${frame.row ?? 0}`)
    .join('|');

  return {
    arrangementKey,
    frames: normalizedFrames,
  };
}

function CanvasLegendPopover({
  hasOutOfBoundsItems,
}: {
  hasOutOfBoundsItems: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewportToolbarButton
          kind="icon"
          className="relative"
          aria-label="Canvas legend"
          title="Canvas legend"
        >
          <HelpCircle className="size-4" />
          {hasOutOfBoundsItems ? (
            <>
              <span className="absolute top-1 right-1 flex h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="absolute top-[3px] right-[3px] h-2.5 w-2.5 animate-ping rounded-full bg-red-400/70" />
            </>
          ) : null}
        </ViewportToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
            <span className="text-xs text-gray-600 dark:text-white/70">
              Hook position
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-5 shrink-0 bg-green-500" />
            <span className="text-xs text-gray-600 dark:text-white/70">
              Distance from wall/floor
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-5 shrink-0 bg-cyan-500" />
            <span className="text-xs text-gray-600 dark:text-white/70">
              Hook comparison
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 shrink-0 rounded-sm border-2 border-red-500" />
            <span className="text-xs text-gray-600 dark:text-white/70">
              Frame exceeds wall
            </span>
          </div>
          <div className="mt-1 border-t border-gray-200 pt-2 dark:border-white/10">
            <p className="text-xs text-gray-500 dark:text-white/50">
              Click a hook to see measurements.
              <br />
              Shift+click another to compare.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CanvasSettingsPopover({
  setUnit,
  unit,
}: {
  setUnit: (unit: Unit) => void;
  unit: Unit;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewportToolbarButton
          kind="icon"
          aria-label="Canvas settings"
          title="Canvas settings"
        >
          <Settings className="size-4" />
        </ViewportToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-gray-500 uppercase dark:text-white/45">
            Canvas Settings
          </p>
          <p className="text-xs text-gray-500 dark:text-white/45">
            Measurement preferences
          </p>
        </div>

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
          <Label className="text-xs">Theme</Label>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="size-3.5" />
                Light
              </>
            ) : (
              <>
                <Moon className="size-3.5" />
                Dark
              </>
            )}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Preview({ calculator }: PreviewProps) {
  const { layoutPositions, setFrames, setManualPosition, setUnit, state } =
    calculator;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSize = useElementSize(containerRef);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingFrame, setIsDraggingFrame] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [dragPreviewFrames, setDragPreviewFrames] = useState<
    UseCalculatorReturn['state']['frames'] | null
  >(null);
  const [dragPreviewOffset, setDragPreviewOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const frameDragRef = useRef<FrameDragSession | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const lastManualPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Track reference hook (shows wall measurements) and compare hook (shows distance from reference)
  const [referenceHook, setReferenceHook] = useState<HookSelection | null>(
    null,
  );
  const [compareHook, setCompareHook] = useState<HookSelection | null>(null);

  const positionedFrames = useMemo<PositionedFrame[]>(
    () =>
      layoutPositions.map((position, index) => ({
        frameId: state.frames[index]?.id ?? String(position.id),
        position,
      })),
    [layoutPositions, state.frames],
  );

  const previewLayoutPositions = useMemo(
    () =>
      dragPreviewFrames
        ? calculateLayoutPositions({ ...state, frames: dragPreviewFrames })
        : layoutPositions,
    [dragPreviewFrames, layoutPositions, state],
  );

  const displayedFrames = dragPreviewFrames ?? state.frames;
  const displayedPositionedFrames = useMemo<PositionedFrame[]>(
    () =>
      previewLayoutPositions.map((position, index) => ({
        frameId: displayedFrames[index]?.id ?? String(position.id),
        position,
      })),
    [displayedFrames, previewLayoutPositions],
  );

  const moveLayoutTo = useCallback(
    (nextMinX: number, nextMinY: number, bounds: LayoutBounds) => {
      const clampedX = clamp(nextMinX, 0, state.wallWidth - bounds.width);
      const clampedY = clamp(nextMinY, 0, state.wallHeight - bounds.height);
      const lastPosition = lastManualPositionRef.current;

      if (
        lastPosition &&
        Math.abs(lastPosition.x - clampedX) < 0.001 &&
        Math.abs(lastPosition.y - clampedY) < 0.001
      ) {
        return;
      }

      lastManualPositionRef.current = { x: clampedX, y: clampedY };
      setManualPosition({
        anchorType: 'floor',
        anchorValue: state.wallHeight - (clampedY + bounds.height),
        hAnchorType: 'left',
        hAnchorValue: clampedX,
      });
    },
    [setManualPosition, state.wallHeight, state.wallWidth],
  );

  const fmt = useCallback(
    (val: number) =>
      formatMeasurement(toDisplayUnit(val, state.unit), state.unit),
    [state.unit],
  );
  const fmtShort = useCallback(
    (val: number) => formatShort(toDisplayUnit(val, state.unit), state.unit),
    [state.unit],
  );

  // Calculate dimensions - wall fits to available space
  const isDesktopLayout = containerSize.width >= 1024;
  const padding = isDesktopLayout ? 60 : 20;
  const reservedSidebarWidth = isDesktopLayout ? 360 : 0;

  // Base scale: fits wall to available space
  const baseScale = useMemo(() => {
    // Reserve space for the desktop sidebar only
    const availableWidth =
      containerSize.width - reservedSidebarWidth - padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    // Fit wall to available space (scale to fit both dimensions)
    const scaleX = availableWidth / state.wallWidth;
    const scaleY = availableHeight / state.wallHeight;
    return Math.min(
      scaleX,
      scaleY,
      (containerSize.width - padding * 2) / state.wallWidth,
    );
  }, [
    containerSize.width,
    containerSize.height,
    reservedSidebarWidth,
    padding,
    state.wallWidth,
    state.wallHeight,
  ]);

  const {
    fitToView,
    pan,
    startPan,
    stepZoom,
    stopPan,
    updatePan,
    zoom,
    zoomAtPoint,
    zoomPercent,
  } = useViewportController({
    containerRef,
    getFitTransform: useCallback(
      (viewport: ViewportBounds) => {
        const scaledWallWidth = state.wallWidth * baseScale;
        const scaledWallHeight = state.wallHeight * baseScale;
        const contentStartX = reservedSidebarWidth + padding;
        const contentWidth = Math.max(
          viewport.width - reservedSidebarWidth - padding * 2,
          1,
        );
        const centeredWallX =
          contentStartX + (contentWidth - scaledWallWidth) / 2;
        const maxWallX = viewport.width - padding - scaledWallWidth;
        const wallX =
          maxWallX >= contentStartX
            ? Math.min(Math.max(centeredWallX, contentStartX), maxWallX)
            : contentStartX;

        return {
          centerX: scaledWallWidth / 2,
          centerY: scaledWallHeight / 2,
          pan: {
            x: wallX,
            y: padding,
          },
          zoom: 1,
        };
      },
      [
        baseScale,
        padding,
        reservedSidebarWidth,
        state.wallHeight,
        state.wallWidth,
      ],
    ),
    maxZoom: 10,
    minZoom: 0.1,
  });

  // Effective scale = base scale * zoom
  const scale = baseScale * zoom;

  // Canvas fills the container, wall is positioned with pan offset
  const canvasWidth = containerSize.width;
  const canvasHeight = containerSize.height;

  // Handle canvas click to select hooks for measurement display
  // Regular click = set reference hook, Shift+click = set compare hook
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (suppressCanvasClickRef.current) {
        suppressCanvasClickRef.current = false;
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const hookRadius = 12; // Slightly larger than visual for easier clicking
      const isShiftClick = e.shiftKey;

      // Account for pan offset when calculating hook positions
      const offsetX = pan.x;
      const offsetY = pan.y;

      const hookHit = findHookAtPoint(positionedFrames, point, {
        offsetX,
        offsetY,
        scale,
        radius: hookRadius,
      });
      if (hookHit) {
        const frameHit = positionedFrames.find(
          ({ position }) => position.id === hookHit.frameId,
        );
        if (frameHit) {
          setSelectedFrameId(frameHit.frameId);
        }
        if (isShiftClick && referenceHook) {
          setCompareHook(hookHit);
        } else {
          setReferenceHook(hookHit);
          setCompareHook(null);
        }
        return;
      }

      const frameHit = findFrameAtPoint(positionedFrames, point, {
        offsetX,
        offsetY,
        scale,
      });
      if (frameHit) {
        setSelectedFrameId(frameHit.frameId);
        return;
      }

      setReferenceHook(null);
      setCompareHook(null);
      setSelectedFrameId(null);
    },
    [positionedFrames, scale, referenceHook, pan],
  );

  // Wheel zoom handler - zoom centered on cursor
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Cursor position in container
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom factor (faster zoom with Ctrl/Cmd key)
      const zoomSpeed = e.ctrlKey || e.metaKey ? 1.15 : 1.1;
      const delta = e.deltaY > 0 ? 1 / zoomSpeed : zoomSpeed;
      zoomAtPoint(zoom * delta, { x: mouseX, y: mouseY });
    },
    [zoom, zoomAtPoint],
  );

  // Attach wheel listener with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      containerRef.current?.focus();

      if (e.button === 1) {
        setIsPanning(true);
        startPan(e.clientX, e.clientY);
        return;
      }

      if (e.button !== 0) {
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      const bounds = getLayoutBounds(positionedFrames);
      if (!rect || !bounds) {
        setIsPanning(true);
        startPan(e.clientX, e.clientY);
        return;
      }

      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const offsetX = pan.x;
      const offsetY = pan.y;
      const hookHit = findHookAtPoint(positionedFrames, point, {
        offsetX,
        offsetY,
        scale,
        radius: 12,
      });

      if (hookHit) {
        return;
      }

      const frameHit = findFrameAtPoint(positionedFrames, point, {
        offsetX,
        offsetY,
        scale,
      });
      if (frameHit) {
        setSelectedFrameId(frameHit.frameId);
        frameDragRef.current = {
          frameId: frameHit.frameId,
          bounds,
          mode:
            e.altKey || positionedFrames.length === 1 ? 'layout' : 'gallery',
          moved: false,
          originalPosition: frameHit.position,
          startClientX: e.clientX,
          startClientY: e.clientY,
        };
        lastManualPositionRef.current = {
          x: bounds.minX,
          y: bounds.minY,
        };
        setDragPreviewFrames(null);
        setDragPreviewOffset(null);
        return;
      }

      setIsPanning(true);
      startPan(e.clientX, e.clientY);
    },
    [pan, positionedFrames, scale, startPan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dragSession = frameDragRef.current;
      if (dragSession) {
        const deltaX = (e.clientX - dragSession.startClientX) / scale;
        const deltaY = (e.clientY - dragSession.startClientY) / scale;
        const moveDistance = Math.hypot(
          e.clientX - dragSession.startClientX,
          e.clientY - dragSession.startClientY,
        );

        if (!dragSession.moved && moveDistance > 4) {
          dragSession.moved = true;
          suppressCanvasClickRef.current = true;
          setIsDraggingFrame(true);
        }

        if (!dragSession.moved) {
          return;
        }

        setDragPreviewOffset({ x: deltaX, y: deltaY });

        if (dragSession.mode === 'layout') {
          moveLayoutTo(
            dragSession.bounds.minX + deltaX,
            dragSession.bounds.minY + deltaY,
            dragSession.bounds,
          );
          return;
        }

        const dragPoint = {
          x:
            dragSession.originalPosition.x +
            dragSession.originalPosition.width / 2 +
            deltaX,
          y:
            dragSession.originalPosition.y +
            dragSession.originalPosition.height / 2 +
            deltaY,
        };
        const nextArrangement = reorderFramesForCanvasDrag(
          displayedFrames,
          displayedPositionedFrames,
          dragSession.frameId,
          dragPoint,
        );

        if (
          !nextArrangement ||
          nextArrangement.arrangementKey === dragSession.lastArrangementKey
        ) {
          return;
        }

        dragSession.lastArrangementKey = nextArrangement.arrangementKey;
        setDragPreviewFrames(nextArrangement.frames);
        return;
      }

      updatePan(e.clientX, e.clientY);
    },
    [
      displayedFrames,
      displayedPositionedFrames,
      moveLayoutTo,
      scale,
      updatePan,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selectedFrameId) {
        return;
      }

      const bounds = getLayoutBounds(positionedFrames);
      if (!bounds) {
        return;
      }

      const step = fromDisplayUnit(e.shiftKey ? 5 : 1, state.unit);
      let deltaX = 0;
      let deltaY = 0;

      switch (e.key) {
        case 'ArrowLeft':
          deltaX = -step;
          break;
        case 'ArrowRight':
          deltaX = step;
          break;
        case 'ArrowUp':
          deltaY = -step;
          break;
        case 'ArrowDown':
          deltaY = step;
          break;
        default:
          return;
      }

      e.preventDefault();
      moveLayoutTo(bounds.minX + deltaX, bounds.minY + deltaY, bounds);
    },
    [moveLayoutTo, positionedFrames, selectedFrameId, state.unit],
  );

  const handleMouseUp = useCallback(() => {
    const dragSession = frameDragRef.current;
    if (dragSession) {
      if (dragSession.mode === 'gallery' && dragPreviewFrames) {
        setFrames(dragPreviewFrames);
      }
      frameDragRef.current = null;
      lastManualPositionRef.current = null;
      setIsDraggingFrame(false);
      setDragPreviewFrames(null);
      setDragPreviewOffset(null);
      return;
    }

    setIsPanning(false);
    stopPan();
  }, [dragPreviewFrames, setFrames, stopPan]);

  // Also handle mouse leave to stop panning
  const handleMouseLeave = useCallback(() => {
    const dragSession = frameDragRef.current;
    if (dragSession) {
      if (dragSession.mode === 'gallery' && dragPreviewFrames) {
        setFrames(dragPreviewFrames);
      }
      frameDragRef.current = null;
      lastManualPositionRef.current = null;
      setIsDraggingFrame(false);
      setDragPreviewFrames(null);
      setDragPreviewOffset(null);
    }
    setIsPanning(false);
    stopPan();
  }, [dragPreviewFrames, setFrames, stopPan]);

  // Draw background on canvas (wall, rulers, furniture - but NOT frames for gallery mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear (transparent to show app gradient behind)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Apply pan offset to wall position
    const offsetX = pan.x;
    const offsetY = pan.y;

    // Draw wall background
    const wallWidthPx = state.wallWidth * scale;
    const wallHeightPx = state.wallHeight * scale;
    ctx.fillStyle = isDark ? '#1e293b' : '#fff';
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.12)';
    ctx.lineWidth = 2;
    ctx.fillRect(offsetX, offsetY, wallWidthPx, wallHeightPx);

    const majorTickInterval = state.unit === 'in' ? 12 : 30;
    const minorTickInterval = state.unit === 'in' ? 3 : 10;

    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, wallWidthPx, wallHeightPx);
    ctx.clip();

    ctx.strokeStyle = isDark
      ? 'rgba(255,255,255,0.03)'
      : 'rgba(15,23,42,0.035)';
    ctx.lineWidth = 1;
    for (
      let i = minorTickInterval;
      i < state.wallWidth;
      i += minorTickInterval
    ) {
      if (i % majorTickInterval === 0) continue;
      const x = Math.round(offsetX + i * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + wallHeightPx);
      ctx.stroke();
    }
    for (
      let i = minorTickInterval;
      i < state.wallHeight;
      i += minorTickInterval
    ) {
      if (i % majorTickInterval === 0) continue;
      const y = Math.round(offsetY + i * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + wallWidthPx, y);
      ctx.stroke();
    }

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
    for (
      let i = majorTickInterval;
      i < state.wallWidth;
      i += majorTickInterval
    ) {
      const x = Math.round(offsetX + i * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + wallHeightPx);
      ctx.stroke();
    }
    for (
      let i = majorTickInterval;
      i < state.wallHeight;
      i += majorTickInterval
    ) {
      const y = Math.round(offsetY + i * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + wallWidthPx, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeRect(offsetX, offsetY, wallWidthPx, wallHeightPx);

    // Draw ruler marks on top
    ctx.fillStyle = isDark ? '#94a3b8' : '#666';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= state.wallWidth; i += majorTickInterval) {
      const x = offsetX + i * scale;
      ctx.beginPath();
      ctx.moveTo(x, offsetY - 10);
      ctx.lineTo(x, offsetY);
      ctx.strokeStyle = isDark
        ? 'rgba(148,163,184,0.7)'
        : 'rgba(71,85,105,0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(fmtShort(i), x, offsetY - 14);
    }

    // Left ruler
    ctx.textAlign = 'right';
    for (let i = 0; i <= state.wallHeight; i += majorTickInterval) {
      const y = offsetY + (state.wallHeight - i) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX - 10, y);
      ctx.lineTo(offsetX, y);
      ctx.strokeStyle = isDark
        ? 'rgba(148,163,184,0.7)'
        : 'rgba(71,85,105,0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(fmtShort(i), offsetX - 14, y + 4);
    }

    // Draw floor label
    ctx.fillStyle = isDark ? '#94a3b8' : '#666';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'FLOOR',
      offsetX + (state.wallWidth * scale) / 2,
      offsetY + state.wallHeight * scale + 16,
    );

    // Draw ceiling indicator
    ctx.fillStyle = isDark ? '#94a3b8' : '#666';
    ctx.fillText(
      'CEILING',
      offsetX + (state.wallWidth * scale) / 2,
      offsetY - 30,
    );

    // Draw anchor reference line
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1;

    if (state.anchorType === 'center') {
      const centerY = offsetY + (state.wallHeight / 2) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, centerY);
      ctx.lineTo(offsetX + state.wallWidth * scale, centerY);
      ctx.stroke();
    } else if (state.anchorType === 'ceiling') {
      const lineY = offsetY + state.anchorValue * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, lineY);
      ctx.lineTo(offsetX + state.wallWidth * scale, lineY);
      ctx.stroke();
    } else if (state.anchorType === 'furniture') {
      const furnitureTop = state.wallHeight - state.furnitureHeight;
      const lineY = offsetY + (furnitureTop - state.anchorValue) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, lineY);
      ctx.lineTo(offsetX + state.wallWidth * scale, lineY);
      ctx.stroke();
    } else {
      const lineY = offsetY + (state.wallHeight - state.anchorValue) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, lineY);
      ctx.lineTo(offsetX + state.wallWidth * scale, lineY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw furniture
    if (state.anchorType === 'furniture') {
      // Calculate furniture left edge based on anchor
      let furnitureLeft: number;
      if (state.furnitureAnchor === 'center') {
        furnitureLeft = (state.wallWidth - state.furnitureWidth) / 2;
      } else if (state.furnitureAnchor === 'left') {
        furnitureLeft = state.furnitureOffset;
      } else {
        furnitureLeft =
          state.wallWidth - state.furnitureWidth - state.furnitureOffset;
      }
      const furnitureTop = state.wallHeight - state.furnitureHeight;

      const fx = offsetX + furnitureLeft * scale;
      const fy = offsetY + furnitureTop * scale;
      const fw = state.furnitureWidth * scale;
      const fh = state.furnitureHeight * scale;

      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(fx + 2, fy + 2, fw, fh);
      ctx.fillStyle = isDark ? '#475569' : '#e5e7eb';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = isDark ? '#64748b' : '#9ca3af';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.fillStyle = isDark ? '#94a3b8' : '#6b7280';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FURNITURE', fx + fw / 2, fy + fh / 2 + 4);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(fmtShort(state.furnitureWidth), fx + fw / 2, fy - 6);
    }

    const activeDragSession = frameDragRef.current;
    const activeDraggedFrameId =
      activeDragSession?.mode === 'gallery' ? activeDragSession.frameId : null;

    // Draw frames on canvas
    displayedPositionedFrames.forEach(({ frameId, position: frame }) => {
      const isDraggedPlaceholder = frameId === activeDraggedFrameId;
      const fx = offsetX + frame.x * scale;
      const fy = offsetY + frame.y * scale;
      const fw = frame.width * scale;
      const fh = frame.height * scale;
      const isSelected = frameId === selectedFrameId;

      if (isDraggedPlaceholder) {
        ctx.save();
        ctx.globalAlpha = 0.28;
      }

      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(fx + 3, fy + 3, fw, fh);
      ctx.fillStyle = frame.isOutOfBounds
        ? isDark
          ? '#450a0a'
          : '#fef2f2'
        : isDark
          ? '#334155'
          : '#f8f8f8';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = frame.isOutOfBounds
        ? '#ef4444'
        : isSelected
          ? isDark
            ? '#67e8f9'
            : '#0891b2'
          : isDark
            ? '#64748b'
            : '#333';
      ctx.lineWidth = frame.isOutOfBounds ? 3 : isSelected ? 3 : 2;
      ctx.strokeRect(fx, fy, fw, fh);

      const matInset = Math.min(fw, fh) * 0.1;
      ctx.strokeStyle = isDark ? '#475569' : '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        fx + matInset,
        fy + matInset,
        fw - matInset * 2,
        fh - matInset * 2,
      );

      // Draw hook(s) - use actual positions from frame
      const hookY = fy + frame.hangingOffset * scale;
      const hookX1 = offsetX + frame.hookX * scale;

      // Draw first (or only) hook
      ctx.beginPath();
      ctx.arc(hookX1, hookY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw second hook if dual hanging
      if (frame.hookX2 !== undefined) {
        const hookX2 = offsetX + frame.hookX2 * scale;
        ctx.beginPath();
        ctx.arc(hookX2, hookY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = isDark ? '#94a3b8' : '#666';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(frame.name, fx + fw / 2, fy + fh / 2 + 4);

      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = isDark ? '#818cf8' : '#4f46e5';
      ctx.fillText(fmtShort(frame.width), fx + fw / 2, fy - 6);

      ctx.save();
      ctx.translate(fx - 6, fy + fh / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(fmtShort(frame.height), 0, 0);
      ctx.restore();

      if (isDraggedPlaceholder) {
        ctx.restore();
      }
    });

    if (
      activeDragSession?.mode === 'gallery' &&
      dragPreviewOffset &&
      activeDragSession.originalPosition
    ) {
      const frame = activeDragSession.originalPosition;
      const fx = offsetX + (frame.x + dragPreviewOffset.x) * scale;
      const fy = offsetY + (frame.y + dragPreviewOffset.y) * scale;
      const fw = frame.width * scale;
      const fh = frame.height * scale;

      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.14)';
      ctx.fillRect(fx + 4, fy + 4, fw, fh);
      ctx.fillStyle = isDark ? '#334155' : '#f8f8f8';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = isDark ? '#67e8f9' : '#0891b2';
      ctx.lineWidth = 3;
      ctx.strokeRect(fx, fy, fw, fh);

      const matInset = Math.min(fw, fh) * 0.1;
      ctx.strokeStyle = isDark ? '#475569' : '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        fx + matInset,
        fy + matInset,
        fw - matInset * 2,
        fh - matInset * 2,
      );

      ctx.fillStyle = isDark ? '#94a3b8' : '#666';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(frame.name, fx + fw / 2, fy + fh / 2 + 4);

      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = isDark ? '#818cf8' : '#4f46e5';
      ctx.fillText(fmtShort(frame.width), fx + fw / 2, fy - 6);

      ctx.save();
      ctx.translate(fx - 6, fy + fh / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(fmtShort(frame.height), 0, 0);
      ctx.restore();
      ctx.restore();
    }

    // Helper to draw full measurements for a specific hook
    const drawFullMeasurements = (
      f: (typeof layoutPositions)[0],
      hookIndex: number,
    ) => {
      const hookX =
        offsetX + (hookIndex === 1 && f.hookX2 ? f.hookX2 : f.hookX) * scale;
      const hookY = offsetY + f.hookY * scale;
      const fromLeft = hookIndex === 1 && f.hookX2 ? f.hookX2 : f.fromLeft;

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Line from wall left to hook
      ctx.beginPath();
      ctx.moveTo(offsetX, hookY);
      ctx.lineTo(hookX, hookY);
      ctx.stroke();

      // Vertical line from hook to floor
      ctx.beginPath();
      ctx.moveTo(hookX, hookY);
      ctx.lineTo(hookX, offsetY + state.wallHeight * scale);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';

      // "From left" label with background
      const fromLeftText = fmt(fromLeft);
      const fromLeftX = offsetX + (fromLeft * scale) / 2;
      const fromLeftWidth = ctx.measureText(fromLeftText).width;
      ctx.fillStyle = isDark ? '#1e293b' : '#fff';
      ctx.fillRect(
        fromLeftX - fromLeftWidth / 2 - 2,
        hookY - 14,
        fromLeftWidth + 4,
        12,
      );
      ctx.fillStyle = '#22c55e';
      ctx.fillText(fromLeftText, fromLeftX, hookY - 5);

      // "From floor" label (rotated)
      ctx.save();
      ctx.font = 'bold 10px -apple-system, sans-serif';
      const fromFloorText = fmt(f.fromFloor);
      const fromFloorY =
        offsetY + state.wallHeight * scale - (f.fromFloor * scale) / 2;
      ctx.translate(hookX + 10, fromFloorY);
      ctx.rotate(-Math.PI / 2);
      const floorTextWidth = ctx.measureText(fromFloorText).width;
      ctx.fillStyle = isDark ? '#1e293b' : '#fff';
      ctx.fillRect(-floorTextWidth / 2 - 2, -9, floorTextWidth + 4, 12);
      ctx.fillStyle = '#22c55e';
      ctx.fillText(fromFloorText, 0, 0);
      ctx.restore();

      // When "from ceiling" mode: also draw line and label from ceiling to hook
      if (state.anchorType === 'ceiling') {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Vertical line from ceiling to hook
        ctx.beginPath();
        ctx.moveTo(hookX, offsetY);
        ctx.lineTo(hookX, hookY);
        ctx.stroke();
        ctx.setLineDash([]);

        // "From ceiling" label (rotated, on left side of line)
        ctx.save();
        ctx.font = 'bold 10px -apple-system, sans-serif';
        const fromCeilingText = fmt(f.fromCeiling);
        const fromCeilingY = offsetY + (f.fromCeiling * scale) / 2;
        ctx.translate(hookX - 10, fromCeilingY);
        ctx.rotate(-Math.PI / 2);
        const ceilingTextWidth = ctx.measureText(fromCeilingText).width;
        ctx.fillStyle = isDark ? '#1e293b' : '#fff';
        ctx.fillRect(-ceilingTextWidth / 2 - 2, -9, ceilingTextWidth + 4, 12);
        ctx.fillStyle = '#22c55e';
        ctx.fillText(fromCeilingText, 0, 0);
        ctx.restore();
      }
    };

    // Always show hook gap for dual hooks (for all frames)
    previewLayoutPositions.forEach((f) => {
      if (f.hookX2 !== undefined && f.hookGap !== undefined) {
        const hookX = offsetX + f.hookX * scale;
        const hookX2 = offsetX + f.hookX2 * scale;
        const hookY = offsetY + f.hookY * scale;

        ctx.strokeStyle = '#f59e0b'; // Amber for gap
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hookX, hookY);
        ctx.lineTo(hookX2, hookY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hook gap measurement label
        const gapText = fmt(f.hookGap);
        const textX = (hookX + hookX2) / 2;
        ctx.font = 'bold 10px -apple-system, sans-serif';
        const textWidth = ctx.measureText(gapText).width;
        ctx.fillStyle = isDark ? '#1e293b' : '#fff';
        ctx.beginPath();
        ctx.roundRect(
          textX - textWidth / 2 - 4,
          hookY - 7,
          textWidth + 8,
          14,
          3,
        );
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.fillText(gapText, textX, hookY + 4);
      }
    });

    // Draw full measurements for reference hook (first by default)
    if (referenceHook) {
      const frame = previewLayoutPositions.find(
        (f) => f.id === referenceHook.frameId,
      );
      if (frame) {
        drawFullMeasurements(frame, referenceHook.hookIndex);

        // Show contextual tooltip if no compare hook selected yet
        if (!compareHook) {
          const hookX =
            offsetX +
            (referenceHook.hookIndex === 1 && frame.hookX2
              ? frame.hookX2
              : frame.hookX) *
              scale;
          const hookY = offsetY + frame.hookY * scale;

          const tooltipText = 'Shift+click another hook to compare';
          ctx.font = '11px -apple-system, sans-serif';
          const textWidth = ctx.measureText(tooltipText).width;

          // Position tooltip above the hook
          const tooltipX = hookX;
          const tooltipY = hookY - 25;

          // Draw tooltip background
          ctx.fillStyle = isDark ? '#f1f5f9' : '#1f2937';
          ctx.beginPath();
          ctx.roundRect(
            tooltipX - textWidth / 2 - 8,
            tooltipY - 12,
            textWidth + 16,
            22,
            4,
          );
          ctx.fill();

          // Draw arrow pointing down
          ctx.beginPath();
          ctx.moveTo(tooltipX - 6, tooltipY + 10);
          ctx.lineTo(tooltipX + 6, tooltipY + 10);
          ctx.lineTo(tooltipX, tooltipY + 16);
          ctx.closePath();
          ctx.fill();

          // Draw text
          ctx.fillStyle = isDark ? '#1e293b' : '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(tooltipText, tooltipX, tooltipY + 2);
        }
      }
    } else if (selectedFrameId) {
      const selectedFrame = positionedFrames.find(
        ({ frameId }) => frameId === selectedFrameId,
      )?.position;
      if (selectedFrame) {
        drawFullMeasurements(selectedFrame, 0);
      }
    } else if (previewLayoutPositions.length > 0) {
      // Default: show first hook measurements
      drawFullMeasurements(previewLayoutPositions[0], 0);
    }

    // Draw comparison measurements between reference and compare hooks
    if (referenceHook && compareHook) {
      const refFrame = previewLayoutPositions.find(
        (f) => f.id === referenceHook.frameId,
      );
      const cmpFrame = previewLayoutPositions.find(
        (f) => f.id === compareHook.frameId,
      );

      if (refFrame && cmpFrame) {
        // Get hook positions
        const refX =
          referenceHook.hookIndex === 1 && refFrame.hookX2
            ? refFrame.hookX2
            : refFrame.hookX;
        const refY = refFrame.hookY;
        const cmpX =
          compareHook.hookIndex === 1 && cmpFrame.hookX2
            ? cmpFrame.hookX2
            : cmpFrame.hookX;
        const cmpY = cmpFrame.hookY;

        // Screen positions
        const refScreenX = offsetX + refX * scale;
        const refScreenY = offsetY + refY * scale;
        const cmpScreenX = offsetX + cmpX * scale;
        const cmpScreenY = offsetY + cmpY * scale;

        // Calculate deltas
        const deltaX = cmpX - refX;
        const deltaY = cmpY - refY;

        // Draw connecting line (cyan/teal for comparison)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(refScreenX, refScreenY);
        ctx.lineTo(cmpScreenX, cmpScreenY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw reference hook highlight (ring)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(refScreenX, refScreenY, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Draw compare hook highlight (filled ring)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cmpScreenX, cmpScreenY, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Format distance labels
        const hText =
          Math.abs(deltaX) > 0.1 ? `${fmt(Math.abs(deltaX))} horizontal` : '';
        const vText =
          Math.abs(deltaY) > 0.1 ? `${fmt(Math.abs(deltaY))} vertical` : '';

        // Draw label at midpoint
        const midX = (refScreenX + cmpScreenX) / 2;
        const midY = (refScreenY + cmpScreenY) / 2;

        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';

        // Build label text
        const labels = [hText, vText].filter(Boolean);
        const labelText = labels.join(', ');

        if (labelText) {
          const textWidth = ctx.measureText(labelText).width;

          // Draw background pill
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.roundRect(
            midX - textWidth / 2 - 8,
            midY - 10,
            textWidth + 16,
            20,
            4,
          );
          ctx.fill();

          // Draw text
          ctx.fillStyle = '#fff';
          ctx.fillText(labelText, midX, midY + 4);
        }
      }
    }
  }, [
    displayedPositionedFrames,
    positionedFrames,
    state,
    scale,
    canvasWidth,
    canvasHeight,
    fmtShort,
    fmt,
    referenceHook,
    compareHook,
    pan,
    isDark,
    selectedFrameId,
    dragPreviewOffset,
    previewLayoutPositions,
  ]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      role="application"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      aria-label="Picture layout canvas"
      style={{
        cursor: isDraggingFrame || isPanning ? 'grabbing' : 'grab',
      }}
    >
      <div
        className="relative"
        style={{ height: canvasHeight, width: canvasWidth }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            cursor: isDraggingFrame || isPanning ? 'grabbing' : 'grab',
          }}
          onClick={handleCanvasClick}
        />
      </div>

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
        <CanvasLegendPopover
          hasOutOfBoundsItems={layoutPositions.some((f) => f.isOutOfBounds)}
        />
        <CanvasSettingsPopover setUnit={setUnit} unit={state.unit} />
      </ViewportToolbar>
    </div>
  );
}
