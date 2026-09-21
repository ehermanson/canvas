import { getWallLength } from "@/lib/room-geometry";
import type { Room, Wall } from "@/types";

export interface RoomConstraintViolation {
  code: "locked-wall" | "feature-containment" | "invalid-wall";
  message: string;
  wallId: string;
}

const EPSILON = 1e-6;

function wallGeometry(room: Room, wall: Wall) {
  return {
    start: room.endpoints.find((endpoint) => endpoint.id === wall.startId),
    end: room.endpoints.find((endpoint) => endpoint.id === wall.endId),
  };
}

function samePoint(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
) {
  return !!a && !!b && Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function wallChanged(previous: Room, next: Room, wall: Wall) {
  const nextWall = next.walls.find((candidate) => candidate.id === wall.id);
  if (!nextWall) return true;
  const before = wallGeometry(previous, wall);
  const after = wallGeometry(next, nextWall);
  return (
    wall.startId !== nextWall.startId ||
    wall.endId !== nextWall.endId ||
    !samePoint(before.start, after.start) ||
    !samePoint(before.end, after.end) ||
    JSON.stringify(wall.features) !== JSON.stringify(nextWall.features)
  );
}

export function validateRoomMutation(previous: Room, next: Room): RoomConstraintViolation | null {
  for (const [index, wall] of previous.walls.entries()) {
    if (!wall.locked || !wallChanged(previous, next, wall)) continue;
    return {
      code: "locked-wall",
      wallId: wall.id,
      message: `Wall ${index + 1} is locked. Unlock it before changing its geometry or openings.`,
    };
  }

  const affectedWallIds = new Set<string>();
  for (const wall of next.walls) {
    const previousWall = previous.walls.find((candidate) => candidate.id === wall.id);
    if (!previousWall || wallChanged(previous, next, previousWall)) affectedWallIds.add(wall.id);
  }

  for (const wall of next.walls) {
    if (!affectedWallIds.has(wall.id)) continue;
    const { start, end } = wallGeometry(next, wall);
    const wallNumber = next.walls.findIndex((candidate) => candidate.id === wall.id) + 1;
    if (
      !start ||
      !end ||
      !Number.isFinite(start.x) ||
      !Number.isFinite(start.y) ||
      !Number.isFinite(end.x) ||
      !Number.isFinite(end.y)
    ) {
      return {
        code: "invalid-wall",
        wallId: wall.id,
        message: `Wall ${wallNumber} needs two valid endpoints.`,
      };
    }
    const length = getWallLength(start, end);
    if (!Number.isFinite(length) || length <= EPSILON) {
      return {
        code: "invalid-wall",
        wallId: wall.id,
        message: `Wall ${wallNumber} must have a positive length.`,
      };
    }
    const invalidFeature = wall.features.find(
      (feature) =>
        !Number.isFinite(feature.offset) ||
        !Number.isFinite(feature.width) ||
        feature.offset < 0 ||
        feature.width <= 0 ||
        feature.offset + feature.width > length + EPSILON,
    );
    if (invalidFeature) {
      return {
        code: "feature-containment",
        wallId: wall.id,
        message: `The ${invalidFeature.type} on wall ${wallNumber} must have a positive width and fit within its ${length.toFixed(1)} in length. Reposition or resize it first.`,
      };
    }
  }

  return null;
}
