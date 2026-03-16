import { describe, expect, it } from "vite-plus/test";

import {
  getPulloutSofaDimensions,
  normalizePulloutSofaState,
  syncPulloutSofaItem,
} from "@/lib/pullout-sofa";
import type { FurnitureItem, PulloutSofaState } from "@/types";

function createPulloutState(overrides: Partial<PulloutSofaState> = {}): PulloutSofaState {
  return {
    bedSize: "queen",
    isOpen: false,
    closedWidth: 72,
    closedDepth: 38,
    openWidth: 72,
    openDepth: 75,
    ...overrides,
  };
}

function createItem(overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  const pulloutSofa = createPulloutState();

  return {
    id: "sofa",
    type: "pullout-sofa",
    name: "Pull-out Sofa",
    shape: "rectangle",
    width: pulloutSofa.closedWidth,
    depth: pulloutSofa.closedDepth,
    x: 100,
    y: 200,
    rotation: 0,
    color: "#000",
    locked: false,
    pulloutSofa,
    ...overrides,
  };
}

describe("pullout-sofa", () => {
  it("returns dimensions for the active open or closed state", () => {
    expect(getPulloutSofaDimensions(createPulloutState())).toEqual({
      width: 72,
      depth: 38,
    });
    expect(getPulloutSofaDimensions(createPulloutState({ isOpen: true }))).toEqual({
      width: 72,
      depth: 75,
    });
  });

  it("normalizes widths so the open state cannot be narrower", () => {
    expect(
      normalizePulloutSofaState(createPulloutState({ closedWidth: 72, openWidth: 60 })),
    ).toMatchObject({
      closedWidth: 72,
      openWidth: 72,
    });
  });

  it("syncs the item dimensions to the active sofa state", () => {
    const item = createItem();
    const next = syncPulloutSofaItem(item, createPulloutState({ isOpen: true, openDepth: 80 }));

    expect(next.width).toBe(72);
    expect(next.depth).toBe(80);
    expect(next.x).toBe(100);
    expect(next.y).toBe(200);
  });

  it("preserves the top edge when opening at 0 degrees", () => {
    const item = createItem({ y: 100, depth: 38 });
    const next = syncPulloutSofaItem(item, createPulloutState({ isOpen: true, openDepth: 74 }), {
      preserveTop: true,
    });

    expect(next.y).toBe(118);
    expect(next.x).toBe(100);
  });

  it("preserves the top edge when opening at 90 degrees", () => {
    const item = createItem({ x: 100, y: 200, rotation: 90, depth: 38 });
    const next = syncPulloutSofaItem(item, createPulloutState({ isOpen: true, openDepth: 74 }), {
      preserveTop: true,
    });

    expect(next.x).toBe(82);
    expect(next.y).toBeCloseTo(200);
  });
});
