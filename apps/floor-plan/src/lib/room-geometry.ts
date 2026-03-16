import type { Point, Wall, WallEndpoint, WallFeature } from "@/types";

export interface Bounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export function getWallLength(a: Point, b: Point) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function getWallAngle(a: Point, b: Point) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function distSq(a: Point, b: Point) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function getBounds(points: Point[]): Bounds | null {
  if (points.length === 0) return null;

  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function rotatePointAround(point: Point, center: Point, rotationDegrees: number): Point {
  const radians = (rotationDegrees * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: roundCoordinate(center.x + dx * cos - dy * sin),
    y: roundCoordinate(center.y + dx * sin + dy * cos),
  };
}

export function projectOntoSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { projX: number; projY: number; dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return {
      projX: ax,
      projY: ay,
      dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2),
      t: 0,
    };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return {
    projX,
    projY,
    dist: Math.sqrt((px - projX) ** 2 + (py - projY) ** 2),
    t,
  };
}

export interface WallMeasurementSpan {
  startOffset: number;
  endOffset: number;
  length: number;
}

export function getWallMeasurementSpans(wallLength: number, features: WallFeature[]) {
  if (wallLength <= 0) {
    return [] as WallMeasurementSpan[];
  }

  const gapRanges = features
    .filter(
      (feature) =>
        feature.type === "door" || feature.type === "opening" || feature.type === "closet",
    )
    .map((feature) => ({
      start: Math.max(0, Math.min(wallLength, feature.offset)),
      end: Math.max(0, Math.min(wallLength, feature.offset + Math.max(feature.width, 0))),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (gapRanges.length === 0) {
    return [
      {
        startOffset: 0,
        endOffset: wallLength,
        length: wallLength,
      },
    ];
  }

  const mergedGaps = gapRanges.reduce<typeof gapRanges>((ranges, range) => {
    const previous = ranges[ranges.length - 1];
    if (!previous || range.start > previous.end) {
      ranges.push({ ...range });
      return ranges;
    }

    previous.end = Math.max(previous.end, range.end);
    return ranges;
  }, []);

  const spans: WallMeasurementSpan[] = [];
  let cursor = 0;

  for (const gap of mergedGaps) {
    if (gap.start > cursor) {
      spans.push({
        startOffset: cursor,
        endOffset: gap.start,
        length: gap.start - cursor,
      });
    }
    cursor = Math.max(cursor, gap.end);
  }

  if (cursor < wallLength) {
    spans.push({
      startOffset: cursor,
      endOffset: wallLength,
      length: wallLength - cursor,
    });
  }

  return spans;
}

export function findRoomPolygon(endpoints: WallEndpoint[], walls: Wall[]): Point[] | null {
  if (walls.length < 3) return null;

  const endpointMap = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const adjacency = new Map<string, { wallId: string; otherId: string }[]>();

  for (const wall of walls) {
    if (!adjacency.has(wall.startId)) adjacency.set(wall.startId, []);
    if (!adjacency.has(wall.endId)) adjacency.set(wall.endId, []);
    adjacency.get(wall.startId)?.push({
      wallId: wall.id,
      otherId: wall.endId,
    });
    adjacency.get(wall.endId)?.push({
      wallId: wall.id,
      otherId: wall.startId,
    });
  }

  let bestLoop: string[] | null = null;

  for (const startWall of walls) {
    const startId = startWall.startId;
    const visitedWalls = new Set<string>([startWall.id]);
    const path: string[] = [startId];

    let currentId = startWall.endId;
    path.push(currentId);

    while (currentId !== startId) {
      const nextWall = (adjacency.get(currentId) ?? []).find(
        (neighbor) => !visitedWalls.has(neighbor.wallId),
      );
      if (!nextWall) break;

      visitedWalls.add(nextWall.wallId);
      currentId = nextWall.otherId;
      if (currentId !== startId) {
        path.push(currentId);
      }
    }

    if (currentId === startId && path.length >= 3) {
      if (!bestLoop || path.length > bestLoop.length) {
        bestLoop = [...path];
      }
    }
  }

  if (!bestLoop) return null;

  return bestLoop.map((id) => {
    const endpoint = endpointMap.get(id);
    if (!endpoint) {
      throw new Error(`Missing endpoint ${id} while building room polygon`);
    }

    return { x: endpoint.x, y: endpoint.y };
  });
}
