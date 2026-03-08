import { HelpCircle } from 'lucide-react';
import {
  ViewportToolbar,
  ViewportToolbarButton,
  ViewportToolbarValue,
} from '@canvas-tools/ui';
import type { ViewportBounds } from '@canvas-tools/viewport';
import { useElementSize, useViewportController } from '@canvas-tools/viewport';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { UseCalculatorReturn } from '@/hooks/use-calculator';
import { useTheme } from '@/hooks/use-theme';
import {
  formatMeasurement,
  formatShort,
  toDisplayUnit,
} from '@/utils/calculations';

interface PreviewProps {
  calculator: UseCalculatorReturn;
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

export function Preview({ calculator }: PreviewProps) {
  const { state, layoutPositions } = calculator;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSize = useElementSize(containerRef);
  const [isPanning, setIsPanning] = useState(false);

  // Track reference hook (shows wall measurements) and compare hook (shows distance from reference)
  const [referenceHook, setReferenceHook] = useState<{
    frameId: number;
    hookIndex: number;
  } | null>(null);
  const [compareHook, setCompareHook] = useState<{
    frameId: number;
    hookIndex: number;
  } | null>(null);

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
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const hookRadius = 12; // Slightly larger than visual for easier clicking
      const isShiftClick = e.shiftKey;

      // Account for pan offset when calculating hook positions
      const offsetX = pan.x;
      const offsetY = pan.y;

      // Check if click is on any hook
      for (const frame of layoutPositions) {
        const hookX1 = offsetX + frame.hookX * scale;
        const hookY = offsetY + frame.hookY * scale;

        // Check first hook
        const dist1 = Math.hypot(clickX - hookX1, clickY - hookY);
        if (dist1 <= hookRadius) {
          const hookData = { frameId: frame.id, hookIndex: 0 };
          if (isShiftClick && referenceHook) {
            // Shift+click: set as compare hook (if we have a reference)
            setCompareHook(hookData);
          } else {
            // Regular click: set as reference, clear compare
            setReferenceHook(hookData);
            setCompareHook(null);
          }
          return;
        }

        // Check second hook if dual
        if (frame.hookX2 !== undefined) {
          const hookX2 = offsetX + frame.hookX2 * scale;
          const dist2 = Math.hypot(clickX - hookX2, clickY - hookY);
          if (dist2 <= hookRadius) {
            const hookData = { frameId: frame.id, hookIndex: 1 };
            if (isShiftClick && referenceHook) {
              setCompareHook(hookData);
            } else {
              setReferenceHook(hookData);
              setCompareHook(null);
            }
            return;
          }
        }
      }

      // Click elsewhere clears selection (back to first hook default)
      setReferenceHook(null);
      setCompareHook(null);
    },
    [layoutPositions, scale, referenceHook, pan],
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
      // Left-click or middle-click to pan
      if (e.button === 0 || e.button === 1) {
        setIsPanning(true);
        startPan(e.clientX, e.clientY);
      }
    },
    [startPan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePan(e.clientX, e.clientY);
    },
    [updatePan],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    stopPan();
  }, [stopPan]);

  // Also handle mouse leave to stop panning
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    stopPan();
  }, [stopPan]);

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
    ctx.fillStyle = isDark ? '#1e293b' : '#fff';
    ctx.strokeStyle = isDark ? '#475569' : '#ccc';
    ctx.lineWidth = 2;
    ctx.fillRect(
      offsetX,
      offsetY,
      state.wallWidth * scale,
      state.wallHeight * scale,
    );
    ctx.strokeRect(
      offsetX,
      offsetY,
      state.wallWidth * scale,
      state.wallHeight * scale,
    );

    // Draw ruler marks on top
    ctx.fillStyle = isDark ? '#94a3b8' : '#666';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const tickInterval = state.unit === 'in' ? 12 : 30;
    for (let i = 0; i <= state.wallWidth; i += tickInterval) {
      const x = offsetX + i * scale;
      ctx.beginPath();
      ctx.moveTo(x, offsetY - 10);
      ctx.lineTo(x, offsetY);
      ctx.strokeStyle = isDark ? '#64748b' : '#999';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(fmtShort(i), x, offsetY - 14);
    }

    // Left ruler
    ctx.textAlign = 'right';
    for (let i = 0; i <= state.wallHeight; i += tickInterval) {
      const y = offsetY + (state.wallHeight - i) * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX - 10, y);
      ctx.lineTo(offsetX, y);
      ctx.strokeStyle = isDark ? '#64748b' : '#999';
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

    // Draw frames on canvas
    layoutPositions.forEach((frame) => {
      const fx = offsetX + frame.x * scale;
      const fy = offsetY + frame.y * scale;
      const fw = frame.width * scale;
      const fh = frame.height * scale;

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
        : isDark
          ? '#64748b'
          : '#333';
      ctx.lineWidth = frame.isOutOfBounds ? 3 : 2;
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
    });

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
    layoutPositions.forEach((f) => {
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
      const frame = layoutPositions.find((f) => f.id === referenceHook.frameId);
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
    } else if (layoutPositions.length > 0) {
      // Default: show first hook measurements
      drawFullMeasurements(layoutPositions[0], 0);
    }

    // Draw comparison measurements between reference and compare hooks
    if (referenceHook && compareHook) {
      const refFrame = layoutPositions.find(
        (f) => f.id === referenceHook.frameId,
      );
      const cmpFrame = layoutPositions.find(
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
    layoutPositions,
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
  ]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      <div
        className="relative"
        style={{ height: canvasHeight, width: canvasWidth }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
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
        <ViewportToolbarButton onClick={fitToView}>
          Fit
        </ViewportToolbarButton>
        <CanvasLegendPopover
          hasOutOfBoundsItems={layoutPositions.some((f) => f.isOutOfBounds)}
        />
      </ViewportToolbar>
    </div>
  );
}
