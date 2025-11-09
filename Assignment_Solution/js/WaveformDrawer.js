/**
 * WaveformDrawer - Class for drawing audio waveforms on canvas
 */
export default class WaveformDrawer {
  constructor() {
    this.decodedAudioBuffer = null;
    this.peaks = null;
    this.canvas = null;
    this.displayWidth = 0;
    this.displayHeight = 0;
    this.color = "#667eea";
    this.sampleStep = null;
  }

  /**
   * Initialize the waveform drawer
   */
  init(decodedAudioBuffer, canvas, color, sampleStep) {
    this.decodedAudioBuffer = decodedAudioBuffer;
    this.canvas = canvas;
    this.displayWidth = canvas.width;
    this.displayHeight = canvas.height;
    this.color = color || "#667eea";
    this.sampleStep = sampleStep;
    // Don't calculate peaks yet - do it asynchronously
  }

  /**
   * Find maximum value in array
   */
  max(values) {
    let max = -Infinity;
    for (let i = 0, len = values.length; i < len; i++) {
      if (values[i] > max) {
        max = values[i];
      }
    }
    return max;
  }

  /**
   * Draw the waveform
   */
  drawWave(startY, height) {
    // Calculate peaks asynchronously if not done yet
    if (!this.peaks) {
      this.getPeaksAsync().then(() => {
        this._drawWaveform(startY, height);
      });
      // Draw placeholder while loading
      this._drawLoadingPlaceholder();
      return;
    }

    this._drawWaveform(startY, height);
  }

  /**
   * Internal method to draw waveform
   */
  _drawWaveform(startY, height) {
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(0, startY);

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;

    const width = this.displayWidth;
    const coef = height / (2 * this.max(this.peaks));
    const halfH = height / 2;

    // Draw center line
    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(width, halfH);
    ctx.stroke();

    // Draw waveform
    ctx.beginPath();
    ctx.moveTo(0, halfH);

    // Upper part
    for (let i = 0; i < width; i++) {
      const h = Math.round(this.peaks[i] * coef);
      ctx.lineTo(i, halfH + h);
    }
    ctx.lineTo(width, halfH);

    // Lower part
    ctx.moveTo(0, halfH);
    for (let i = 0; i < width; i++) {
      const h = Math.round(this.peaks[i] * coef);
      ctx.lineTo(i, halfH - h);
    }
    ctx.lineTo(width, halfH);

    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw loading placeholder
   */
  _drawLoadingPlaceholder() {
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#ccc";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Loading waveform...",
      this.canvas.width / 2,
      this.canvas.height / 2
    );
  }

  /**
   * Calculate peaks asynchronously using requestAnimationFrame
   */
  async getPeaksAsync() {
    return new Promise((resolve) => {
      this._getPeaksChunked(resolve);
    });
  }

  /**
   * Calculate peaks in chunks to avoid blocking UI
   */
  _getPeaksChunked(callback) {
    const buffer = this.decodedAudioBuffer;
    const sampleSize = Math.ceil(buffer.length / this.displayWidth);

    this.sampleStep = this.sampleStep || ~~(sampleSize / 10);

    const channels = buffer.numberOfChannels;
    this.peaks = new Float32Array(this.displayWidth);

    const chunkSize = 300; // Process 300 pixels at a time (increased from 100)
    let currentPixel = 0;

    const processChunk = () => {
      const endPixel = Math.min(currentPixel + chunkSize, this.displayWidth);

      for (let i = currentPixel; i < endPixel; i++) {
        let peak = 0;

        for (let c = 0; c < channels; c++) {
          const chan = buffer.getChannelData(c);
          const start = ~~(i * sampleSize);
          const end = start + sampleSize;
          let channelPeak = 0;

          for (let j = start; j < end; j += this.sampleStep) {
            const absValue = Math.abs(chan[j]);
            if (absValue > channelPeak) {
              channelPeak = absValue;
            }
          }

          peak += channelPeak / channels;
        }

        this.peaks[i] = peak;
      }

      currentPixel = endPixel;

      if (currentPixel < this.displayWidth) {
        // Schedule next chunk
        requestAnimationFrame(processChunk);
      } else {
        // Done processing
        callback();
      }
    };

    requestAnimationFrame(processChunk);
  }

  /**
   * Calculate peaks for drawing (legacy synchronous version - not used)
   */
  getPeaks() {
    const buffer = this.decodedAudioBuffer;
    const sampleSize = Math.ceil(buffer.length / this.displayWidth);

    this.sampleStep = this.sampleStep || ~~(sampleSize / 10);

    const channels = buffer.numberOfChannels;
    this.peaks = new Float32Array(this.displayWidth);

    for (let c = 0; c < channels; c++) {
      const chan = buffer.getChannelData(c);

      for (let i = 0; i < this.displayWidth; i++) {
        const start = ~~(i * sampleSize);
        const end = start + sampleSize;
        let peak = 0;

        for (let j = start; j < end; j += this.sampleStep) {
          const value = chan[j];
          if (value > peak) {
            peak = value;
          } else if (-value > peak) {
            peak = -value;
          }
        }

        if (c > 0) {
          this.peaks[i] += peak / channels;
        } else {
          this.peaks[i] = peak / channels;
        }
      }
    }
  }
}
