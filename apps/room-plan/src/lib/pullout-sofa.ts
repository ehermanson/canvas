import type { FurnitureItem, PulloutSofaState } from '@/types';

export function getPulloutSofaDimensions(pulloutSofa: PulloutSofaState) {
  return pulloutSofa.isOpen
    ? {
        width: pulloutSofa.openWidth,
        depth: pulloutSofa.openDepth,
      }
    : {
        width: pulloutSofa.closedWidth,
        depth: pulloutSofa.closedDepth,
      };
}

export function normalizePulloutSofaState(
  pulloutSofa: PulloutSofaState,
): PulloutSofaState {
  const normalizedWidth = Math.max(
    pulloutSofa.closedWidth,
    pulloutSofa.openWidth,
  );

  return {
    ...pulloutSofa,
    closedWidth: normalizedWidth,
    openWidth: normalizedWidth,
  };
}

export function syncPulloutSofaItem(
  item: FurnitureItem,
  pulloutSofa: PulloutSofaState,
  options?: { preserveTop?: boolean },
): FurnitureItem {
  const normalizedPulloutSofa = normalizePulloutSofaState(pulloutSofa);
  const dimensions = getPulloutSofaDimensions(normalizedPulloutSofa);
  const shouldPreserveTop = options?.preserveTop ?? false;
  const depthDelta = dimensions.depth - item.depth;
  const rotationRadians = (item.rotation * Math.PI) / 180;

  return {
    ...item,
    ...dimensions,
    x: shouldPreserveTop
      ? item.x - Math.sin(rotationRadians) * (depthDelta / 2)
      : item.x,
    y: shouldPreserveTop
      ? item.y + Math.cos(rotationRadians) * (depthDelta / 2)
      : item.y,
    pulloutSofa: normalizedPulloutSofa,
  };
}
