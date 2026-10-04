export interface NavigationRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

export interface NavigationEdgeMotion {
  direction: -1 | 0 | 1;
  intensity: number;
  velocity: number;
}

export function getNavigationEdgeMotion(rect: NavigationRect, x: number, y: number): NavigationEdgeMotion {
  if (y < rect.top || y > rect.bottom || x < rect.left || x > rect.right) return { direction: 0, intensity: 0, velocity: 0 };
  const zone = Math.min(96, Math.max(38, rect.width * 0.17));
  const leftDepth = Math.max(0, rect.left + zone - x) / zone;
  const rightDepth = Math.max(0, x - (rect.right - zone)) / zone;
  const direction = leftDepth > 0 ? -1 : rightDepth > 0 ? 1 : 0;
  const intensity = Math.min(1, Math.max(leftDepth, rightDepth));
  const eased = intensity * intensity * (3 - 2 * intensity);
  return { direction, intensity, velocity: direction * (70 + eased * 430) };
}

export function clampNavigationScroll(current: number, delta: number, scrollWidth: number, clientWidth: number) {
  return Math.min(Math.max(0, scrollWidth - clientWidth), Math.max(0, current + delta));
}

export function mapPageScrollDelta(deltaY: number) {
  return -deltaY * 920;
}
