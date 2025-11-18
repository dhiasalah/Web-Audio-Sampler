/**
 * Utility functions for waveform and trimming operations
 */

export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const y = x2 - x1;
  const x = y2 - y1;
  return Math.sqrt(x * x + y * y);
}

export function pixelToSeconds(
  x: number,
  bufferDuration: number,
  canvasWidth: number
): number {
  return (x * bufferDuration) / canvasWidth;
}

export function secondsToPixel(
  seconds: number,
  bufferDuration: number,
  canvasWidth: number
): number {
  return (seconds / bufferDuration) * canvasWidth;
}
