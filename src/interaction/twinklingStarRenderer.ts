export interface TwinklingStarOptions {
  timestamp: number;
  dwellActive?: boolean;
  dwellProgress?: number;
  successPulse?: number;
  enhanced?: boolean;
}

export function drawTwinklingStarCursor(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: TwinklingStarOptions,
) {
  const { timestamp, dwellActive = false, dwellProgress = 0, successPulse = 0, enhanced = false } = options;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.translate(x, y);
  const breath = 1 + Math.sin(timestamp * 0.0053) * 0.11;
  const stateBoost = enhanced ? 1.24 : dwellActive ? 1.1 : 1;
  const flashBoost = 1 + successPulse * 0.75;
  const haloRadius = 18 * breath * stateBoost + successPulse * 10;
  const halo = context.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
  halo.addColorStop(0, `rgba(255,255,238,${0.48 + successPulse * 0.38})`);
  halo.addColorStop(0.28, `rgba(255,210,102,${0.2 + successPulse * 0.18})`);
  halo.addColorStop(1, 'rgba(255,174,44,0)');
  context.fillStyle = halo;
  context.fillRect(-haloRadius, -haloRadius, haloRadius * 2, haloRadius * 2);

  context.rotate(timestamp * 0.00032);
  for (let ray = 0; ray < 8; ray += 1) {
    const primary = ray % 2 === 0;
    const phase = primary ? Math.sin(timestamp * 0.0047 + ray * 1.7) : Math.sin(timestamp * 0.011 + ray * 2.3);
    const angle = ray / 8 * Math.PI * 2;
    const inner = primary ? 3.2 : 5.5;
    const baseLength = primary ? 13.5 : 9;
    const outer = (baseLength + phase * (primary ? 3.8 : 2.4)) * stateBoost * flashBoost;
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.strokeStyle = `rgba(255, ${primary ? 244 : 207}, ${primary ? 205 : 92}, ${primary ? 0.96 : 0.66})`;
    context.lineWidth = primary ? 1.5 : 0.75;
    context.shadowColor = 'rgba(255, 181, 45, 0.98)';
    context.shadowBlur = primary ? 13 : 8;
    context.stroke();
  }

  const asymmetricAngle = timestamp * 0.0011 + 0.7;
  const asymmetricPulse = Math.max(0, Math.sin(timestamp * 0.0087)) ** 4;
  if (asymmetricPulse > 0.02) {
    context.beginPath();
    context.moveTo(Math.cos(asymmetricAngle) * 12, Math.sin(asymmetricAngle) * 12);
    context.lineTo(Math.cos(asymmetricAngle) * (19 + asymmetricPulse * 8), Math.sin(asymmetricAngle) * (19 + asymmetricPulse * 8));
    context.strokeStyle = `rgba(255, 247, 210, ${asymmetricPulse * 0.9})`;
    context.lineWidth = 1;
    context.stroke();
  }

  context.rotate(-timestamp * 0.00085);
  const dustCount = enhanced ? 5 : 3;
  for (let spark = 0; spark < dustCount; spark += 1) {
    const angle = spark / dustCount * Math.PI * 2 + timestamp * (0.0007 + spark * 0.00006);
    const orbit = (enhanced ? 21 : 17) + (spark % 2) * 4;
    const twinkle = 0.32 + Math.max(0, Math.sin(timestamp * 0.009 + spark * 2.1)) * 0.68;
    context.beginPath();
    context.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 0.6 + twinkle * 0.75, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 226, 137, ${twinkle * 0.78})`;
    context.fill();
  }

  if (dwellActive) {
    context.beginPath();
    context.arc(0, 0, 20.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dwellProgress);
    context.strokeStyle = 'rgba(255, 249, 218, 0.94)';
    context.lineWidth = 2.4;
    context.shadowColor = 'rgba(255, 184, 54, 0.95)';
    context.shadowBlur = 12;
    context.stroke();
  }

  context.beginPath();
  context.arc(0, 0, 2.8 + successPulse * 2.4, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 255, 245, 0.99)';
  context.shadowColor = 'rgba(255, 202, 76, 1)';
  context.shadowBlur = 18 + successPulse * 16;
  context.fill();
  context.restore();
}
