import { describe, expect, it } from 'vitest';

import {
  distSq,
  findRoomPolygon,
  getBounds,
  getWallAngle,
  getWallLength,
  getWallMeasurementSpans,
  projectOntoSegment,
  rotatePointAround,
} from '@/lib/room-geometry';
import type { Wall, WallEndpoint } from '@/types';

function createSquareRoom() {
  const endpoints: WallEndpoint[] = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 100, y: 0 },
    { id: 'c', x: 100, y: 80 },
    { id: 'd', x: 0, y: 80 },
  ];
  const walls: Wall[] = [
    { id: 'w1', startId: 'a', endId: 'b', features: [] },
    { id: 'w2', startId: 'b', endId: 'c', features: [] },
    { id: 'w3', startId: 'c', endId: 'd', features: [] },
    { id: 'w4', startId: 'd', endId: 'a', features: [] },
  ];

  return { endpoints, walls };
}

describe('room-geometry', () => {
  it('computes wall length and angle', () => {
    expect(getWallLength({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(getWallAngle({ x: 0, y: 0 }, { x: 0, y: 5 })).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it('computes squared distance', () => {
    expect(distSq({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(25);
  });

  it('computes bounds for a point set', () => {
    expect(
      getBounds([
        { x: 10, y: 20 },
        { x: -5, y: 8 },
        { x: 12, y: 30 },
      ]),
    ).toEqual({
      minX: -5,
      maxX: 12,
      minY: 8,
      maxY: 30,
    });
    expect(getBounds([])).toBeNull();
  });

  it('projects onto a segment interior', () => {
    const projection = projectOntoSegment(3, 4, 0, 0, 10, 0);

    expect(projection.projX).toBeCloseTo(3);
    expect(projection.projY).toBeCloseTo(0);
    expect(projection.dist).toBeCloseTo(4);
    expect(projection.t).toBeCloseTo(0.3);
  });

  it('clamps projection to the nearest endpoint', () => {
    const projection = projectOntoSegment(-5, 3, 0, 0, 10, 0);

    expect(projection.projX).toBe(0);
    expect(projection.projY).toBe(0);
    expect(projection.t).toBe(0);
  });

  it('rotates a point around a center without accumulating floating point drift', () => {
    expect(rotatePointAround({ x: 10, y: 0 }, { x: 0, y: 0 }, 90)).toEqual({
      x: 0,
      y: 10,
    });

    expect(rotatePointAround({ x: 10, y: 0 }, { x: 0, y: 0 }, 180)).toEqual({
      x: -10,
      y: 0,
    });
  });

  it('finds the main closed loop for a room', () => {
    const { endpoints, walls } = createSquareRoom();

    expect(findRoomPolygon(endpoints, walls)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ]);
  });

  it('returns null for an incomplete loop', () => {
    const { endpoints, walls } = createSquareRoom();

    expect(findRoomPolygon(endpoints, walls.slice(0, 2))).toBeNull();
  });

  it('prefers the largest closed loop when extra branches exist', () => {
    const { endpoints, walls } = createSquareRoom();
    const branchedEndpoints = [
      ...endpoints,
      { id: 'e', x: 140, y: 40 },
      { id: 'f', x: 100, y: 40 },
    ];
    const branchedWalls: Wall[] = [
      ...walls,
      { id: 'w5', startId: 'b', endId: 'f', features: [] },
      { id: 'w6', startId: 'f', endId: 'e', features: [] },
    ];

    expect(findRoomPolygon(branchedEndpoints, branchedWalls)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ]);
  });

  it('computes uninterrupted wall spans around doors and openings', () => {
    expect(
      getWallMeasurementSpans(120, [
        {
          id: 'door-1',
          type: 'door',
          offset: 48,
          width: 24,
        },
      ]),
    ).toEqual([
      { startOffset: 0, endOffset: 48, length: 48 },
      { startOffset: 72, endOffset: 120, length: 48 },
    ]);

    expect(
      getWallMeasurementSpans(120, [
        {
          id: 'opening-1',
          type: 'opening',
          offset: 24,
          width: 18,
        },
        {
          id: 'opening-2',
          type: 'opening',
          offset: 36,
          width: 18,
        },
      ]),
    ).toEqual([
      { startOffset: 0, endOffset: 24, length: 24 },
      { startOffset: 54, endOffset: 120, length: 66 },
    ]);
  });

  it('treats closets as blocking wall space for span measurements', () => {
    expect(
      getWallMeasurementSpans(120, [
        {
          id: 'closet-1',
          type: 'closet',
          offset: 30,
          width: 36,
        },
      ]),
    ).toEqual([
      { startOffset: 0, endOffset: 30, length: 30 },
      { startOffset: 66, endOffset: 120, length: 54 },
    ]);
  });
});
