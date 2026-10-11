import { useEffect, useRef } from 'react';
import { gesturePointToViewport } from './coordinateTransform';
import { HandSkeletonRenderer } from './handSkeletonRenderer';
import type { GestureInteractionController } from './interactionController';
import type { GestureFrameStore } from './types';
import { drawTwinklingStarCursor } from '../interaction/twinklingStarRenderer';
import type { WorldInteractionController } from '../interaction/worldInteraction';

interface GestureOverlayProps {
  store: GestureFrameStore;
  interaction: GestureInteractionController;
  world: WorldInteractionController;
}

export function GestureOverlay({ store, interaction, world }: GestureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const skeletonRenderer = new HandSkeletonRenderer();
    let frame = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (timestamp: number) => {
      context.clearRect(0, 0, width, height);
      const snapshot = store.read();
      skeletonRenderer.render(context, snapshot.hands, width, height);

      const pointer = interaction.read().pointer;
      if (pointer) {
        const point = gesturePointToViewport(pointer.point, width, height);
        const spiritStage = document.querySelector<HTMLElement>('.music-stage[data-gesture-zone="spirit"]');
        const spiritRect = spiritStage?.getBoundingClientRect();
        const attractionPointer = Boolean(spiritRect
          && point.x >= spiritRect.left && point.x <= spiritRect.right
          && point.y >= spiritRect.top && point.y <= spiritRect.bottom);
        const interactionState = interaction.read();
        const progress = interactionState.dwellActive ? interactionState.dwellProgress : 0;
        const successPulse = Math.max(0, 1 - (timestamp - interactionState.dwellSuccessAt) / 180);
        drawTwinklingStarCursor(context, point.x, point.y, {
          timestamp,
          dwellActive: interactionState.dwellActive,
          dwellProgress: progress,
          successPulse,
          enhanced: attractionPointer,
        });
      }

      const worldAttraction = world.readAttraction();
      if (worldAttraction && worldAttraction.source !== 'gesture') {
        const point = gesturePointToViewport(worldAttraction.point, width, height);
        drawTwinklingStarCursor(context, point.x, point.y, {
          timestamp,
          enhanced: true,
          scale: worldAttraction.source === 'touch' ? 3.5 : 1,
        });
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      skeletonRenderer.clear();
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [interaction, store, world]);

  return <canvas ref={canvasRef} className="gesture-overlay" aria-hidden="true" />;
}
