/**
 * WaveformDrawer - Class for drawing audio waveforms on canvas
 */

export class WaveformDrawer {
  private decodedAudioBuffer: AudioBuffer | null = null;
  private peaks: Float32Array | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private displayWidth: number = 0;
  private displayHeight: number = 0;
  private color: string = "#667eea";
  private sampleStep: number | undefined;

  /**
   * Initialize the waveform drawer
   */
  init(
    decodedAudioBuffer: AudioBuffer,
    canvas: HTMLCanvasElement,
    color?: string,
    sampleStep?: number
  ): void {
    this.decodedAudioBuffer = decodedAudioBuffer;
    this.canvas = canvas;
    this.displayWidth = canvas.width;
    this.displayHeight = canvas.height;
    this.color = color || "#667eea";
    this.sampleStep = sampleStep;
  }

  /**
   * Find maximum value in array
   */
  private max(values: Float32Array): number {
    let max = -Infinity;
    for (let i = 0, len = values.length; i < len; i++) {
      if (values[i] > max) {
        max = values[i];
      }
    }
    return max;
  }

  /**
   * Get peaks asynchronously
   */
  private async getPeaksAsync(): Promise<void> {
    if (!this.decodedAudioBuffer) return;

    const buffer = this.decodedAudioBuffer;
    const rawData = buffer.getChannelData(0);
    const samples = this.displayWidth;
    const blockSize = Math.floor(rawData.length / samples);
    const peaks = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      peaks[i] = sum / blockSize;
    }

    this.peaks = peaks;
  }

  /**
   * Draw placeholder while loading
   */
  private _drawLoadingPlaceholder(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(102, 126, 234, 0.2)";
    ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
  }

  /**
   * Draw the waveform
   */
  drawWave(startY: number, height: number): void {
    if (!this.peaks) {
      this.getPeaksAsync().then(() => {
        this._drawWaveform(startY, height);
      });
      this._drawLoadingPlaceholder();
      return;
    }

    this._drawWaveform(startY, height);
  }

  /**
   * Internal method to draw waveform
   */
  private _drawWaveform(startY: number, height: number): void {
    if (!this.canvas || !this.peaks) return;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(0, startY);

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;

    const width = this.displayWidth;
    const coef = height / (2 * this.max(this.peaks));
    const halfH = height / 2;

    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(width, halfH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, halfH);

    for (let i = 0; i < width; i++) {
      const h = Math.round(this.peaks[i] * coef);
      ctx.lineTo(i, halfH + h);
    }
    ctx.lineTo(width, halfH);

    ctx.moveTo(0, halfH);
    for (let i = 0; i < width; i++) {
      const h = Math.round(this.peaks[i] * coef);
      ctx.lineTo(i, halfH - h);
    }
    ctx.lineTo(width, halfH);

    ctx.fill();
    ctx.restore();
  }
}

export default WaveformDrawer;
