import type { Bounds } from "@/lib/room-geometry";
import { projectOntoSegment } from "@/lib/room-geometry";
import type { FurnitureItem, Point } from "@/types";

export type FurnitureResizeEdge = "bottom" | "left" | "right" | "top";
export type FurnitureAlignmentReference = "center" | "end" | "start";

export interface FurnitureAlignmentMatch {
  delta: number;
  position: number;
  reference: FurnitureAlignmentReference;
  targetBounds: Bounds;
  targetReference: FurnitureAlignmentReference;
}

export interface FurnitureAlignmentMatches {
  x: FurnitureAlignmentMatch | null;
  y: FurnitureAlignmentMatch | null;
}

const MIN_FURNITURE_SIZE = 6;
const GEOMETRY_EPSILON = 1e-6;

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function normalizeVector(vector: Point) {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: vector.x / length, y: vector.y / length };
}

function crossProduct(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: Point, start: Point, end: Point) {
  if (Math.abs(crossProduct(start, end, point)) > GEOMETRY_EPSILON) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - GEOMETRY_EPSILON &&
    point.x <= Math.max(start.x, end.x) + GEOMETRY_EPSILON &&
    point.y >= Math.min(start.y, end.y) - GEOMETRY_EPSILON &&
    point.y <= Math.max(start.y, end.y) + GEOMETRY_EPSILON
  );
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];

    if (pointOnSegment(point, a, b)) {
      return true;
    }

    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function segmentsProperlyIntersect(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point) {
  const abStart = crossProduct(aStart, aEnd, bStart);
  const abEnd = crossProduct(aStart, aEnd, bEnd);
  const baStart = crossProduct(bStart, bEnd, aStart);
  const baEnd = crossProduct(bStart, bEnd, aEnd);

  if (
    Math.abs(abStart) <= GEOMETRY_EPSILON ||
    Math.abs(abEnd) <= GEOMETRY_EPSILON ||
    Math.abs(baStart) <= GEOMETRY_EPSILON ||
    Math.abs(baEnd) <= GEOMETRY_EPSILON
  ) {
    return false;
  }

  return Math.sign(abStart) !== Math.sign(abEnd) && Math.sign(baStart) !== Math.sign(baEnd);
}

function rotatePointToLocalSpace(point: Point, origin: Point, rotation: number): Point {
  const radians = (-rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;

  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function rotateLocalVectorToWorld(vector: Point, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function snapValue(value: number, step: number) {
  return step > 0 ? Math.round(value / step) * step : value;
}

function getRectangleCorners(item: FurnitureItem): Point[] {
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  const localCorners = [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ];

  return localCorners.map((corner) => ({
    x: item.x + corner.x * cos - corner.y * sin,
    y: item.y + corner.x * sin + corner.y * cos,
  }));
}

function getPolygonEdges(points: Point[]) {
  return points.map((start, index) => ({
    start,
    end: points[(index + 1) % points.length],
  }));
}

function getPolygonCentroid(points: Point[]) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function getBoundsReferenceValue(
  bounds: Bounds,
  axis: "x" | "y",
  reference: FurnitureAlignmentReference,
) {
  if (axis === "x") {
    if (reference === "start") return bounds.minX;
    if (reference === "center") return (bounds.minX + bounds.maxX) / 2;
    return bounds.maxX;
  }

  if (reference === "start") return bounds.minY;
  if (reference === "center") return (bounds.minY + bounds.maxY) / 2;
  return bounds.maxY;
}

export function getFurnitureBounds(item: FurnitureItem) {
  if (item.shape === "circle") {
    const radians = (item.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const radiusX = item.width / 2;
    const radiusY = item.depth / 2;
    const extentX = Math.hypot(radiusX * cos, radiusY * sin);
    const extentY = Math.hypot(radiusX * sin, radiusY * cos);
    return {
      minX: item.x - extentX,
      maxX: item.x + extentX,
      minY: item.y - extentY,
      maxY: item.y + extentY,
    };
  }

  const corners = getRectangleCorners(item);

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

export function getFurnitureResizeHandlePoints(
  item: FurnitureItem,
): Record<FurnitureResizeEdge, Point> {
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  const localPoints = {
    left: { x: -halfWidth, y: 0 },
    right: { x: halfWidth, y: 0 },
    top: { x: 0, y: -halfDepth },
    bottom: { x: 0, y: halfDepth },
  } satisfies Record<FurnitureResizeEdge, Point>;

  return Object.fromEntries(
    Object.entries(localPoints).map(([edge, point]) => [
      edge,
      {
        x: item.x + point.x * cos - point.y * sin,
        y: item.y + point.x * sin + point.y * cos,
      },
    ]),
  ) as Record<FurnitureResizeEdge, Point>;
}

export function resizeFurnitureFromEdge(
  item: FurnitureItem,
  edge: FurnitureResizeEdge,
  pointerWorld: Point,
  step = 1,
) {
  const localPointer = rotatePointToLocalSpace(
    pointerWorld,
    { x: item.x, y: item.y },
    item.rotation,
  );
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  let left = -halfWidth;
  let right = halfWidth;
  let top = -halfDepth;
  let bottom = halfDepth;

  if (edge === "left") {
    left = Math.min(right - MIN_FURNITURE_SIZE, snapValue(localPointer.x, step));
  } else if (edge === "right") {
    right = Math.max(left + MIN_FURNITURE_SIZE, snapValue(localPointer.x, step));
  } else if (edge === "top") {
    top = Math.min(bottom - MIN_FURNITURE_SIZE, snapValue(localPointer.y, step));
  } else {
    bottom = Math.max(top + MIN_FURNITURE_SIZE, snapValue(localPointer.y, step));
  }

  const centerShiftWorld = rotateLocalVectorToWorld(
    {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
    },
    item.rotation,
  );

  return {
    x: item.x + centerShiftWorld.x,
    y: item.y + centerShiftWorld.y,
    width: right - left,
    depth: bottom - top,
  };
}

export function resizeFurnitureByHandleDelta(
  item: FurnitureItem,
  edge: FurnitureResizeEdge,
  delta: Point,
  step = 1,
) {
  const handlePoint = getFurnitureResizeHandlePoints(item)[edge];

  return resizeFurnitureFromEdge(
    item,
    edge,
    {
      x: handlePoint.x + delta.x,
      y: handlePoint.y + delta.y,
    },
    step,
  );
}

export function getNearestFurnitureClearances(item: FurnitureItem, roomBounds: Bounds) {
  const bounds = getFurnitureBounds(item);

  return getNearestBoundsClearances(bounds, roomBounds, {
    x: item.x,
    y: item.y,
  });
}

export function getNearestBoundsClearances(bounds: Bounds, roomBounds: Bounds, anchor: Point) {
  const leftDistance = bounds.minX - roomBounds.minX;
  const rightDistance = roomBounds.maxX - bounds.maxX;
  const topDistance = bounds.minY - roomBounds.minY;
  const bottomDistance = roomBounds.maxY - bounds.maxY;

  return [
    leftDistance <= rightDistance
      ? {
          fromX: bounds.minX,
          fromY: anchor.y,
          toX: roomBounds.minX,
          toY: anchor.y,
          dist: leftDistance,
        }
      : {
          fromX: bounds.maxX,
          fromY: anchor.y,
          toX: roomBounds.maxX,
          toY: anchor.y,
          dist: rightDistance,
        },
    topDistance <= bottomDistance
      ? {
          fromX: anchor.x,
          fromY: bounds.minY,
          toX: anchor.x,
          toY: roomBounds.minY,
          dist: topDistance,
        }
      : {
          fromX: anchor.x,
          fromY: bounds.maxY,
          toX: anchor.x,
          toY: roomBounds.maxY,
          dist: bottomDistance,
        },
  ].filter((measurement) => measurement.dist >= 1);
}

export function getFurnitureAlignmentMatches(
  bounds: Bounds,
  otherBounds: Bounds[],
  threshold: number,
  axes: { x?: boolean; y?: boolean } = { x: true, y: true },
): FurnitureAlignmentMatches {
  if (threshold <= 0 || otherBounds.length === 0) {
    return {
      x: null,
      y: null,
    };
  }

  const references = ["start", "center", "end"] as const;
  let bestX: FurnitureAlignmentMatch | null = null;
  let bestY: FurnitureAlignmentMatch | null = null;

  for (const candidateBounds of otherBounds) {
    if (axes.x) {
      for (const sourceReference of references) {
        const sourceValue = getBoundsReferenceValue(bounds, "x", sourceReference);
        for (const targetReference of references) {
          const targetValue = getBoundsReferenceValue(candidateBounds, "x", targetReference);
          const delta = targetValue - sourceValue;
          const distance = Math.abs(delta);
          if (distance > threshold + GEOMETRY_EPSILON) {
            continue;
          }

          if (!bestX || distance < Math.abs(bestX.delta)) {
            bestX = {
              delta,
              position: targetValue,
              reference: sourceReference,
              targetBounds: candidateBounds,
              targetReference,
            };
          }
        }
      }
    }

    if (axes.y) {
      for (const sourceReference of references) {
        const sourceValue = getBoundsReferenceValue(bounds, "y", sourceReference);
        for (const targetReference of references) {
          const targetValue = getBoundsReferenceValue(candidateBounds, "y", targetReference);
          const delta = targetValue - sourceValue;
          const distance = Math.abs(delta);
          if (distance > threshold + GEOMETRY_EPSILON) {
            continue;
          }

          if (!bestY || distance < Math.abs(bestY.delta)) {
            bestY = {
              delta,
              position: targetValue,
              reference: sourceReference,
              targetBounds: candidateBounds,
              targetReference,
            };
          }
        }
      }
    }
  }

  return {
    x: bestX,
    y: bestY,
  };
}

export function snapFurnitureToBoundsGrid(
  item: FurnitureItem,
  roomBounds: Bounds,
  step: number,
  axes: { x?: boolean; y?: boolean } = { x: true, y: true },
) {
  if (step <= 0) {
    return item;
  }

  const bounds = getFurnitureBounds(item);
  let nextX = item.x;
  let nextY = item.y;

  if (axes.x) {
    const leftDistance = bounds.minX - roomBounds.minX;
    const rightDistance = roomBounds.maxX - bounds.maxX;
    if (leftDistance <= rightDistance) {
      const snappedLeftDistance = Math.round(leftDistance / step) * step;
      nextX += snappedLeftDistance - leftDistance;
    } else {
      const snappedRightDistance = Math.round(rightDistance / step) * step;
      nextX += rightDistance - snappedRightDistance;
    }
  }

  if (axes.y) {
    const topDistance = bounds.minY - roomBounds.minY;
    const bottomDistance = roomBounds.maxY - bounds.maxY;
    if (topDistance <= bottomDistance) {
      const snappedTopDistance = Math.round(topDistance / step) * step;
      nextY += snappedTopDistance - topDistance;
    } else {
      const snappedBottomDistance = Math.round(bottomDistance / step) * step;
      nextY += bottomDistance - snappedBottomDistance;
    }
  }

  return {
    ...item,
    x: nextX,
    y: nextY,
  };
}

function projectPointsOntoAxis(points: Point[], axis: Point) {
  let min = dot(points[0], axis);
  let max = min;

  for (let index = 1; index < points.length; index++) {
    const projection = dot(points[index], axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }

  return { min, max };
}

function intervalsOverlap(a: { min: number; max: number }, b: { min: number; max: number }) {
  return a.max > b.min && b.max > a.min;
}

function getRectangleAxes(points: Point[]) {
  return [
    normalizeVector({
      x: -(points[1].y - points[0].y),
      y: points[1].x - points[0].x,
    }),
    normalizeVector({
      x: -(points[2].y - points[1].y),
      y: points[2].x - points[1].x,
    }),
  ];
}

function checkRectangleCollision(a: FurnitureItem, b: FurnitureItem) {
  const aCorners = getRectangleCorners(a);
  const bCorners = getRectangleCorners(b);
  const axes = [...getRectangleAxes(aCorners), ...getRectangleAxes(bCorners)];

  return axes.every((axis) =>
    intervalsOverlap(projectPointsOntoAxis(aCorners, axis), projectPointsOntoAxis(bCorners, axis)),
  );
}

export function getFurnitureSupportPoint(item: FurnitureItem, direction: Point): Point {
  const localDirection = rotatePointToLocalSpace(direction, { x: 0, y: 0 }, item.rotation);
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  let localSupport: Point;

  if (item.shape === "circle") {
    const denominator = Math.hypot(halfWidth * localDirection.x, halfDepth * localDirection.y);
    localSupport =
      denominator <= GEOMETRY_EPSILON
        ? { x: 0, y: 0 }
        : {
            x: (halfWidth * halfWidth * localDirection.x) / denominator,
            y: (halfDepth * halfDepth * localDirection.y) / denominator,
          };
  } else {
    localSupport = {
      x: localDirection.x < 0 ? -halfWidth : halfWidth,
      y: localDirection.y < 0 ? -halfDepth : halfDepth,
    };
  }

  const world = rotateLocalVectorToWorld(localSupport, item.rotation);
  return { x: item.x + world.x, y: item.y + world.y };
}

export function isPointInFurniture(point: Point, item: FurnitureItem) {
  const local = rotatePointToLocalSpace(point, item, item.rotation);
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  if (halfWidth <= 0 || halfDepth <= 0) return false;
  if (item.shape === "circle") {
    return (local.x / halfWidth) ** 2 + (local.y / halfDepth) ** 2 <= 1 + GEOMETRY_EPSILON;
  }
  return (
    Math.abs(local.x) <= halfWidth + GEOMETRY_EPSILON &&
    Math.abs(local.y) <= halfDepth + GEOMETRY_EPSILON
  );
}

function supportDifference(a: FurnitureItem, b: FurnitureItem, direction: Point) {
  const aPoint = getFurnitureSupportPoint(a, direction);
  const bPoint = getFurnitureSupportPoint(b, { x: -direction.x, y: -direction.y });
  return { x: aPoint.x - bPoint.x, y: aPoint.y - bPoint.y };
}

function tripleProduct(a: Point, b: Point, c: Point): Point {
  const ac = dot(a, c);
  const bc = dot(b, c);
  return { x: b.x * ac - a.x * bc, y: b.y * ac - a.y * bc };
}

// Gilbert-Johnson-Keerthi intersection using exact support functions for ellipses and rectangles.
function checkConvexFurnitureCollision(a: FurnitureItem, b: FurnitureItem) {
  let direction = { x: b.x - a.x, y: b.y - a.y };
  if (Math.hypot(direction.x, direction.y) <= GEOMETRY_EPSILON) direction = { x: 1, y: 0 };
  const simplex: Point[] = [supportDifference(a, b, direction)];
  direction = { x: -simplex[0].x, y: -simplex[0].y };

  for (let iteration = 0; iteration < 32; iteration++) {
    const point = supportDifference(a, b, direction);
    if (dot(point, direction) <= GEOMETRY_EPSILON) return false;
    simplex.push(point);
    const newest = simplex[simplex.length - 1];
    const ao = { x: -newest.x, y: -newest.y };
    const previous = simplex[simplex.length - 2];
    const ab = { x: previous.x - newest.x, y: previous.y - newest.y };

    if (simplex.length === 2) {
      direction = tripleProduct(ab, ao, ab);
      if (Math.hypot(direction.x, direction.y) <= GEOMETRY_EPSILON) return true;
      continue;
    }

    const oldest = simplex[0];
    const ac = { x: oldest.x - newest.x, y: oldest.y - newest.y };
    const abPerpendicular = tripleProduct(ac, ab, ab);
    if (dot(abPerpendicular, ao) > 0) {
      simplex.splice(0, 1);
      direction = abPerpendicular;
      continue;
    }
    const acPerpendicular = tripleProduct(ab, ac, ac);
    if (dot(acPerpendicular, ao) > 0) {
      simplex.splice(1, 1);
      direction = acPerpendicular;
      continue;
    }
    return true;
  }
  return false;
}

export function checkFurnitureCollision(a: FurnitureItem, b: FurnitureItem) {
  if (a.type === "rug" || b.type === "rug") {
    return false;
  }

  return a.shape === "rectangle" && b.shape === "rectangle"
    ? checkRectangleCollision(a, b)
    : checkConvexFurnitureCollision(a, b);
}

export function snapFurnitureToRoomWalls(
  item: FurnitureItem,
  roomPolygon: Point[],
  threshold: number,
) {
  if (roomPolygon.length < 3 || threshold <= 0) {
    return item;
  }

  const roomEdges = getPolygonEdges(roomPolygon);
  const roomCentroid = getPolygonCentroid(roomPolygon);
  let bestDelta: Point | null = null;
  let bestDistance = threshold + GEOMETRY_EPSILON;

  for (const { start, end } of roomEdges) {
    const wallVector = { x: end.x - start.x, y: end.y - start.y };
    const wallLength = Math.hypot(wallVector.x, wallVector.y);
    if (wallLength === 0) continue;

    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const candidateNormal = normalizeVector({
      x: -wallVector.y,
      y: wallVector.x,
    });
    const toCentroid = {
      x: roomCentroid.x - midpoint.x,
      y: roomCentroid.y - midpoint.y,
    };
    const inwardNormal =
      dot(candidateNormal, toCentroid) >= 0
        ? candidateNormal
        : {
            x: -candidateNormal.x,
            y: -candidateNormal.y,
          };

    const snapPoints =
      item.shape === "circle"
        ? [getFurnitureSupportPoint(item, { x: -inwardNormal.x, y: -inwardNormal.y })]
        : [...getRectangleCorners(item), ...getFurnitureEdgePoints(item)];
    for (const snapPoint of snapPoints) {
      const projection = projectOntoSegment(
        snapPoint.x,
        snapPoint.y,
        start.x,
        start.y,
        end.x,
        end.y,
      );
      if (projection.dist > threshold + GEOMETRY_EPSILON) {
        continue;
      }

      const signedDistance = dot(
        {
          x: snapPoint.x - start.x,
          y: snapPoint.y - start.y,
        },
        inwardNormal,
      );
      const distanceToWall = Math.abs(signedDistance);

      if (distanceToWall > threshold + GEOMETRY_EPSILON) {
        continue;
      }

      const candidateDelta = {
        x: inwardNormal.x * -signedDistance,
        y: inwardNormal.y * -signedDistance,
      };
      const candidate = {
        ...item,
        x: item.x + candidateDelta.x,
        y: item.y + candidateDelta.y,
      };

      if (checkFurnitureRoomCollision(candidate, roomPolygon)) {
        continue;
      }

      if (distanceToWall < bestDistance) {
        bestDistance = distanceToWall;
        bestDelta = candidateDelta;
      }
    }
  }

  return bestDelta
    ? {
        ...item,
        x: item.x + bestDelta.x,
        y: item.y + bestDelta.y,
      }
    : item;
}

export function checkFurnitureRoomCollision(item: FurnitureItem, roomPolygon: Point[]) {
  if (roomPolygon.length < 3) {
    return false;
  }

  const roomEdges = getPolygonEdges(roomPolygon);

  if (item.shape === "circle") {
    if (!pointInPolygon(item, roomPolygon)) {
      return true;
    }

    return roomEdges.some(({ start, end }) => {
      const localStart = rotatePointToLocalSpace(start, item, item.rotation);
      const localEnd = rotatePointToLocalSpace(end, item, item.rotation);
      const radiusX = item.width / 2;
      const radiusY = item.depth / 2;
      if (radiusX <= 0 || radiusY <= 0) return true;
      const scaledStart = { x: localStart.x / radiusX, y: localStart.y / radiusY };
      const scaledEnd = { x: localEnd.x / radiusX, y: localEnd.y / radiusY };
      const projection = projectOntoSegment(
        0,
        0,
        scaledStart.x,
        scaledStart.y,
        scaledEnd.x,
        scaledEnd.y,
      );
      return projection.dist < 1 - GEOMETRY_EPSILON;
    });
  }

  const corners = getRectangleCorners(item);
  if (corners.some((corner) => !pointInPolygon(corner, roomPolygon))) {
    return true;
  }

  const furnitureEdges = getPolygonEdges(corners);

  return furnitureEdges.some((furnitureEdge) =>
    roomEdges.some((roomEdge) =>
      segmentsProperlyIntersect(
        furnitureEdge.start,
        furnitureEdge.end,
        roomEdge.start,
        roomEdge.end,
      ),
    ),
  );
}

export function getFurnitureEdgePoints(item: FurnitureItem): Point[] {
  if (item.shape === "circle") {
    const directions = [
      rotateLocalVectorToWorld({ x: 0, y: -1 }, item.rotation),
      rotateLocalVectorToWorld({ x: 1, y: 0 }, item.rotation),
      rotateLocalVectorToWorld({ x: 0, y: 1 }, item.rotation),
      rotateLocalVectorToWorld({ x: -1, y: 0 }, item.rotation),
    ];
    return directions.map((direction) => getFurnitureSupportPoint(item, direction));
  }
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  const localPoints = [
    { x: 0, y: -halfDepth },
    { x: halfWidth, y: 0 },
    { x: 0, y: halfDepth },
    { x: -halfWidth, y: 0 },
  ];

  return localPoints.map((point) => ({
    x: item.x + point.x * cos - point.y * sin,
    y: item.y + point.x * sin + point.y * cos,
  }));
}
