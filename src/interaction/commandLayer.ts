import type { InteractionCommand, PointerPoint } from '../types';

export type CommandHandler = (command: InteractionCommand) => void;

export function createPointerCommand(
  event: React.PointerEvent<HTMLElement>,
  target: HTMLElement,
): InteractionCommand {
  const rect = target.getBoundingClientRect();
  const point = normalizePointer(event.clientX, event.clientY, rect);
  return { type: 'POINTER_MOVE', ...point };
}

export function normalizePointer(x: number, y: number, rect: DOMRect): PointerPoint {
  return {
    x: clamp01((x - rect.left) / Math.max(rect.width, 1)),
    y: clamp01((y - rect.top) / Math.max(rect.height, 1)),
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
