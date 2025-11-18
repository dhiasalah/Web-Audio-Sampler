import { distance } from "./utils";

interface TrimBar {
  x: number;
  color: string;
  selectedColor: string;
  selected: boolean;
  dragged: boolean;
}

/**
 * TrimbarsDrawer - Class for drawing and managing trim bars on canvas overlay
 */
export class TrimbarsDrawer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private leftTrimBar: TrimBar;
  private rightTrimBar: TrimBar;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(
    canvas: HTMLCanvasElement,
    leftTrimBarX: number,
    rightTrimBarX: number
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    this.leftTrimBar = {
      x: leftTrimBarX,
      color: "#00ff00",
      selectedColor: "#ff6b6b",
      selected: false,
      dragged: false,
    };

    this.rightTrimBar = {
      x: rightTrimBarX,
      color: "#00ff00",
      selectedColor: "#ff6b6b",
      selected: false,
      dragged: false,
    };

    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
  }

  /**
   * Clear the overlay canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw the trim bars
   */
  draw(): void {
    const ctx = this.ctx;
    const leftX = this.leftTrimBar.x;
    const rightX = this.rightTrimBar.x;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    ctx.save();

    ctx.lineWidth = 12;

    // Left trim bar line - thicker for easier clicking
    ctx.strokeStyle = this.leftTrimBar.color;
    ctx.beginPath();
    ctx.moveTo(leftX, 0);
    ctx.lineTo(leftX, canvasHeight);
    ctx.stroke();

    // Right trim bar line - thicker for easier clicking
    ctx.strokeStyle = this.rightTrimBar.color;
    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX, canvasHeight);
    ctx.stroke();

    // Left triangle handle
    ctx.fillStyle = this.leftTrimBar.color;
    ctx.beginPath();
    ctx.moveTo(leftX, 0);
    ctx.lineTo(leftX + 20, 18);
    ctx.lineTo(leftX, 36);
    ctx.fill();

    // Right triangle handle
    ctx.fillStyle = this.rightTrimBar.color;
    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX - 20, 18);
    ctx.lineTo(rightX, 36);
    ctx.fill();

    // Grey overlay for trimmed regions
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    if (leftX > 0) {
      ctx.fillRect(0, 0, leftX, canvasHeight);
    }
    if (rightX < canvasWidth) {
      ctx.fillRect(rightX, 0, canvasWidth - rightX, canvasHeight);
    }

    ctx.restore();
  }

  /**
   * Highlight trim bars when mouse is close
   */
  highLightTrimBarsWhenClose(mousePos: { x: number; y: number }): void {
    const distanceFromLeft = distance(
      this.leftTrimBar.x,
      0,
      mousePos.x,
      mousePos.y
    );
    const distanceFromRight = distance(
      this.rightTrimBar.x,
      0,
      mousePos.x,
      mousePos.y
    );

    this.leftTrimBar.selected = distanceFromLeft < 60;
    this.rightTrimBar.selected = distanceFromRight < 60;

    this.leftTrimBar.color = this.leftTrimBar.selected
      ? this.leftTrimBar.selectedColor
      : "#00ff00";
    this.rightTrimBar.color = this.rightTrimBar.selected
      ? this.rightTrimBar.selectedColor
      : "#00ff00";
  }

  /**
   * Move trim bars
   */
  moveTrimBars(mousePos: { x: number; y: number }): void {
    this.highLightTrimBarsWhenClose(mousePos);

    if (this.leftTrimBar.dragged) {
      this.leftTrimBar.x = mousePos.x;
    }

    if (this.rightTrimBar.dragged) {
      this.rightTrimBar.x = mousePos.x;
    }

    if (this.leftTrimBar.x > this.rightTrimBar.x) {
      [this.leftTrimBar.x, this.rightTrimBar.x] = [
        this.rightTrimBar.x,
        this.leftTrimBar.x,
      ];
    }
  }

  /**
   * Start dragging trim bar
   */
  startDrag(): void {
    if (this.leftTrimBar.selected) {
      this.leftTrimBar.dragged = true;
    }

    if (this.rightTrimBar.selected) {
      this.rightTrimBar.dragged = true;
    }
  }

  /**
   * Stop dragging trim bar
   */
  stopDrag(): void {
    this.leftTrimBar.dragged = false;
    this.rightTrimBar.dragged = false;
  }

  /**
   * Get left trim bar
   */
  getLeftTrimBar(): TrimBar {
    return this.leftTrimBar;
  }

  /**
   * Get right trim bar
   */
  getRightTrimBar(): TrimBar {
    return this.rightTrimBar;
  }
}

export default TrimbarsDrawer;
