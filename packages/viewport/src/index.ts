import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ViewportPoint {
  x: number;
  y: number;
}

export interface ViewportSize {
  height: number;
  width: number;
}

export interface ViewportBounds extends ViewportSize {
  centerX: number;
  centerY: number;
}

export interface ViewportBox {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface ViewportFitResult {
  centerX: number;
  centerY: number;
  pan: ViewportPoint;
  zoom: number;
}

export interface ViewportTransform {
  pan: ViewportPoint;
  zoom: number;
}

export interface ViewportController {
  containerSize: ViewportSize;
  fitToView: () => void;
  pan: ViewportPoint;
  screenToWorld: (point: ViewportPoint) => ViewportPoint;
  setPan: Dispatch<SetStateAction<ViewportPoint>>;
  setZoom: Dispatch<SetStateAction<number>>;
  startPan: (clientX: number, clientY: number) => void;
  stepZoom: (direction: 'in' | 'out') => void;
  stopPan: () => void;
  updatePan: (clientX: number, clientY: number) => void;
  viewportBounds: ViewportBounds | null;
  worldToScreen: (point: ViewportPoint) => ViewportPoint;
  zoom: number;
  zoomAtPoint: (targetZoom: number, point: ViewportPoint) => void;
  zoomPercent: number;
}

export function clampZoom(value: number, minZoom: number, maxZoom: number) {
  return Math.max(minZoom, Math.min(maxZoom, value));
}

export function getViewportBounds(size: ViewportSize): ViewportBounds | null {
  if (size.width <= 0 || size.height <= 0) {
    return null;
  }

  return {
    centerX: size.width / 2,
    centerY: size.height / 2,
    height: size.height,
    width: size.width,
  };
}

export function getBoxFromPoints(
  points: ViewportPoint[],
  fallbackSize = { height: 120, width: 144 },
): ViewportBox | null {
  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || fallbackSize.width;
  const height = maxY - minY || fallbackSize.height;

  return {
    maxX: minX + width,
    maxY: minY + height,
    minX,
    minY,
  };
}

export function fitBoxToViewport(
  viewport: ViewportBounds | null,
  box: ViewportBox | null,
  options: {
    maxZoom?: number;
    minZoom?: number;
    padding?: number;
  } = {},
): ViewportFitResult | null {
  if (!viewport || !box) {
    return null;
  }

  const { maxZoom = Number.POSITIVE_INFINITY, minZoom = 0, padding = 0 } =
    options;
  const availableWidth = viewport.width - padding * 2;
  const availableHeight = viewport.height - padding * 2;

  if (availableWidth <= 0 || availableHeight <= 0) {
    return null;
  }

  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const zoom = clampZoom(
    Math.min(availableWidth / width, availableHeight / height, maxZoom),
    minZoom,
    maxZoom,
  );
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;

  return {
    centerX,
    centerY,
    pan: {
      x: viewport.centerX - centerX * zoom,
      y: viewport.centerY - centerY * zoom,
    },
    zoom,
  };
}

export function fitPointsToViewport(
  viewport: ViewportBounds | null,
  points: ViewportPoint[],
  options: {
    fallbackSize?: { height: number; width: number };
    maxZoom?: number;
    minZoom?: number;
    padding?: number;
  } = {},
) {
  return fitBoxToViewport(
    viewport,
    getBoxFromPoints(points, options.fallbackSize),
    options,
  );
}

export function screenToWorld(
  point: ViewportPoint,
  transform: ViewportTransform,
): ViewportPoint {
  return {
    x: (point.x - transform.pan.x) / transform.zoom,
    y: (point.y - transform.pan.y) / transform.zoom,
  };
}

export function worldToScreen(
  point: ViewportPoint,
  transform: ViewportTransform,
): ViewportPoint {
  return {
    x: point.x * transform.zoom + transform.pan.x,
    y: point.y * transform.zoom + transform.pan.y,
  };
}

export function zoomPanAtPoint(options: {
  currentPan: ViewportPoint;
  currentZoom: number;
  maxZoom: number;
  minZoom: number;
  screenPoint: ViewportPoint;
  targetZoom: number;
}): ViewportTransform {
  const { currentPan, currentZoom, maxZoom, minZoom, screenPoint, targetZoom } =
    options;
  const zoom = clampZoom(targetZoom, minZoom, maxZoom);
  const worldPoint = screenToWorld(screenPoint, {
    pan: currentPan,
    zoom: currentZoom,
  });

  return {
    pan: {
      x: screenPoint.x - worldPoint.x * zoom,
      y: screenPoint.y - worldPoint.y * zoom,
    },
    zoom,
  };
}

export function zoomPanAtWorldPoint(options: {
  maxZoom: number;
  minZoom: number;
  screenAnchor: ViewportPoint;
  targetZoom: number;
  worldPoint: ViewportPoint;
}): ViewportTransform {
  const { maxZoom, minZoom, screenAnchor, targetZoom, worldPoint } = options;
  const zoom = clampZoom(targetZoom, minZoom, maxZoom);

  return {
    pan: {
      x: screenAnchor.x - worldPoint.x * zoom,
      y: screenAnchor.y - worldPoint.y * zoom,
    },
    zoom,
  };
}

export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
): ViewportSize {
  const [size, setSize] = useState<ViewportSize>({ height: 0, width: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setSize({ height: rect.height, width: rect.width });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          height: entry.contentRect.height,
          width: entry.contentRect.width,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export function useViewportController(options: {
  autoFit?: boolean;
  containerRef: RefObject<HTMLElement | null>;
  getFitTransform?: (viewport: ViewportBounds) => ViewportFitResult | null;
  getFitBox?: (viewport: ViewportBounds) => ViewportBox | null;
  maxZoom?: number;
  minZoom?: number;
  padding?: number;
  stepFactor?: number;
}): ViewportController {
  const {
    autoFit = true,
    containerRef,
    getFitTransform,
    getFitBox,
    maxZoom = 20,
    minZoom = 0.1,
    padding = 0,
    stepFactor = 1.15,
  } = options;
  const containerSize = useElementSize(containerRef);
  const viewportBounds = useMemo(
    () => getViewportBounds(containerSize),
    [containerSize],
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<ViewportPoint>({ x: 0, y: 0 });
  const [dragAnchor, setDragAnchor] = useState<ViewportPoint | null>(null);
  const hasAutoFitRef = useRef(false);

  const fitToView = useCallback(() => {
    if (!viewportBounds) {
      return;
    }

    const fit =
      getFitTransform?.(viewportBounds) ??
      (getFitBox
        ? fitBoxToViewport(viewportBounds, getFitBox(viewportBounds), {
            maxZoom,
            minZoom,
            padding,
          })
        : null);

    if (!fit) {
      return;
    }

    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [
    getFitBox,
    getFitTransform,
    maxZoom,
    minZoom,
    padding,
    viewportBounds,
  ]);

  useEffect(() => {
    if (!autoFit || hasAutoFitRef.current || !viewportBounds) {
      return;
    }

    fitToView();
    hasAutoFitRef.current = true;
  }, [autoFit, fitToView, viewportBounds]);

  const zoomAtPoint = useCallback(
    (targetZoom: number, point: ViewportPoint) => {
      setPan((currentPan) => {
        const next = zoomPanAtPoint({
          currentPan,
          currentZoom: zoom,
          maxZoom,
          minZoom,
          screenPoint: point,
          targetZoom,
        });
        setZoom(next.zoom);
        return next.pan;
      });
    },
    [maxZoom, minZoom, zoom],
  );

  const stepZoom = useCallback(
    (direction: 'in' | 'out') => {
      if (!viewportBounds) {
        return;
      }

      const targetZoom =
        direction === 'in' ? zoom * stepFactor : zoom / stepFactor;

      zoomAtPoint(targetZoom, {
        x: viewportBounds.centerX,
        y: viewportBounds.centerY,
      });
    },
    [stepFactor, viewportBounds, zoom, zoomAtPoint],
  );

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      setDragAnchor({
        x: clientX - pan.x,
        y: clientY - pan.y,
      });
    },
    [pan],
  );

  const updatePan = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragAnchor) {
        return;
      }

      setPan({
        x: clientX - dragAnchor.x,
        y: clientY - dragAnchor.y,
      });
    },
    [dragAnchor],
  );

  const stopPan = useCallback(() => {
    setDragAnchor(null);
  }, []);

  return {
    containerSize,
    fitToView,
    pan,
    screenToWorld: useCallback(
      (point: ViewportPoint) => screenToWorld(point, { pan, zoom }),
      [pan, zoom],
    ),
    setPan,
    setZoom,
    startPan,
    stepZoom,
    stopPan,
    updatePan,
    viewportBounds,
    worldToScreen: useCallback(
      (point: ViewportPoint) => worldToScreen(point, { pan, zoom }),
      [pan, zoom],
    ),
    zoom,
    zoomAtPoint,
    zoomPercent: Math.max(1, Math.round(zoom * 100)),
  };
}
