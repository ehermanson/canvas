import { describe, expect, it } from 'vitest';
import {
  fitBoxToViewport,
  screenToWorld,
  worldToScreen,
  zoomPanAtPoint,
} from './index';

describe('viewport utilities', () => {
  it('centers a box inside the viewport', () => {
    const fit = fitBoxToViewport(
      { centerX: 100, centerY: 60, height: 120, width: 200 },
      { maxX: 50, maxY: 30, minX: 0, minY: 0 },
      { padding: 10 },
    );

    expect(fit).not.toBeNull();
    expect(fit?.zoom).toBeCloseTo(10 / 3);
    expect(fit?.pan.x).toBeCloseTo(50 / 3);
    expect(fit?.pan.y).toBeCloseTo(10);
  });

  it('keeps the anchored world point stable when zooming', () => {
    const next = zoomPanAtPoint({
      currentPan: { x: 30, y: 40 },
      currentZoom: 2,
      maxZoom: 10,
      minZoom: 0.1,
      screenPoint: { x: 130, y: 140 },
      targetZoom: 4,
    });

    const worldBefore = screenToWorld(
      { x: 130, y: 140 },
      { pan: { x: 30, y: 40 }, zoom: 2 },
    );
    const worldAfter = screenToWorld(
      { x: 130, y: 140 },
      { pan: next.pan, zoom: next.zoom },
    );

    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
  });

  it('round-trips world and screen coordinates', () => {
    const worldPoint = { x: 42, y: 17 };
    const screenPoint = worldToScreen(worldPoint, {
      pan: { x: 12, y: -5 },
      zoom: 3,
    });

    expect(
      screenToWorld(screenPoint, {
        pan: { x: 12, y: -5 },
        zoom: 3,
      }),
    ).toEqual(worldPoint);
  });
});
