import { Deck } from '../audio/Deck';

export type WaveformMode = 'horizontal' | 'vertical';

/**
 * Waveform — renders waveform with beat-grid, playhead, loop & cue markers.
 */
export class Waveform {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private deck: Deck;
  private _rafId = 0;
  private accentColor: string;
  private mode: WaveformMode = 'horizontal';

  constructor(canvas: HTMLCanvasElement, deck: Deck, accentColor: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.deck = deck;
    this.accentColor = accentColor;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.deck.duration) return;
      this.seekFromPointer(e);
      e.preventDefault();
    }, { passive: false });

    this.startRender();
  }

  setMode(mode: WaveformMode): void {
    this.mode = mode;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  private startRender(): void {
    const render = () => {
      this.draw();
      this._rafId = requestAnimationFrame(render);
    };
    this._rafId = requestAnimationFrame(render);
  }

  private draw(): void {
    const { canvas, ctx, deck } = this;
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    const bgGradient = ctx.createLinearGradient(0, 0, w, h);
    bgGradient.addColorStop(0, 'rgba(4, 10, 24, 0.85)');
    bgGradient.addColorStop(1, 'rgba(13, 16, 40, 0.85)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    if (!deck.peaks || deck.peaks.length === 0) {
      this.drawPlaceholder(w, h);
      return;
    }

    if (this.mode === 'horizontal') {
      this.drawHorizontal(w, h);
    } else {
      this.drawVertical(w, h);
    }
  }

  private drawPlaceholder(w: number, h: number): void {
    const { ctx } = this;
    const centerY = h / 2;

    ctx.strokeStyle = 'rgba(190, 205, 230, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(122, 200, 255, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const points = 96;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const x = t * w;
      const amp = (Math.sin(t * 12.4) + Math.sin(t * 28.2) * 0.5 + Math.cos(t * 43.8) * 0.35) * (h * 0.12);
      const y = centerY - amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 166, 124, 0.34)';
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const x = t * w;
      const amp = (Math.cos(t * 10.8) + Math.sin(t * 31.2) * 0.42 + Math.cos(t * 58.5) * 0.2) * (h * 0.08);
      const y = centerY + amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(235, 243, 255, 0.62)';
    ctx.font = '600 11px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Load track to analyze waveform', w / 2, h / 2 + 4);
  }

  private drawHorizontal(w: number, h: number): void {
    const { ctx, deck } = this;
    const peaks = deck.peaks!;
    const progress = deck.duration > 0 ? deck.currentTime / deck.duration : 0;

    this.drawLoopAreaHorizontal(w, h);
    this.drawBeatGridHorizontal(w, h);

    const mid = h / 2;
    const baseColor = 'rgba(78, 112, 168, 0.55)';
    const playedColor = this.accentColor;
    const centerColor = 'rgba(236, 246, 255, 0.82)';
    const numCols = Math.max(1, Math.floor(w));
    const samplesPerCol = peaks.length / numCols;
    const progressX = progress * w;

    for (let x = 0; x < numCols; x++) {
      const from = Math.floor(x * samplesPerCol);
      const to = Math.max(from + 1, Math.floor((x + 1) * samplesPerCol));
      let maxPeak = 0;
      for (let i = from; i < to && i < peaks.length; i++) {
        const v = peaks[i];
        if (v > maxPeak) maxPeak = v;
      }
      const barH = Math.max(1, maxPeak * mid * 0.92);
      const isPlayed = x <= progressX;

      ctx.fillStyle = isPlayed ? playedColor : baseColor;
      ctx.globalAlpha = isPlayed ? 0.94 : 0.96;
      ctx.fillRect(x, Math.round(mid - barH), 1, Math.round(barH * 2));

      ctx.fillStyle = isPlayed ? '#ffffff' : centerColor;
      ctx.globalAlpha = isPlayed ? 0.74 : 0.58;
      ctx.fillRect(x, Math.round(mid - barH * 0.14), 1, Math.max(1, Math.round(barH * 0.28)));
    }

    ctx.globalAlpha = 1.0;

    const playheadX = Math.floor(progress * w) + 0.5;
    ctx.strokeStyle = '#ff2f9b';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX + 1, 0);
    ctx.lineTo(playheadX + 1, h);
    ctx.stroke();

    for (const cue of deck.cuePoints) {
      const cueX = (cue.position / deck.duration) * w;
      ctx.fillStyle = cue.color;
      ctx.fillRect(Math.floor(cueX), 0, 2, h);
    }
  }

  private drawVertical(w: number, h: number): void {
    const { ctx, deck } = this;
    const peaks = deck.peaks!;
    const progress = deck.duration > 0 ? deck.currentTime / deck.duration : 0;

    this.drawLoopAreaVertical(w, h);
    this.drawBeatGridVertical(w, h);

    const mid = w / 2;
    const baseColor = 'rgba(78, 112, 168, 0.55)';
    const playedColor = this.accentColor;
    const centerColor = 'rgba(236, 246, 255, 0.82)';
    const numRows = Math.max(1, Math.floor(h));
    const samplesPerRow = peaks.length / numRows;
    const progressY = h - progress * h;

    for (let y = 0; y < numRows; y++) {
      const from = Math.floor(y * samplesPerRow);
      const to = Math.max(from + 1, Math.floor((y + 1) * samplesPerRow));
      let maxPeak = 0;
      for (let i = from; i < to && i < peaks.length; i++) {
        const idx = peaks.length - i - 1;
        const v = peaks[idx];
        if (v > maxPeak) maxPeak = v;
      }
      const halfW = Math.max(1, maxPeak * mid * 0.9);
      const isPlayed = y >= progressY;

      ctx.fillStyle = isPlayed ? playedColor : baseColor;
      ctx.globalAlpha = isPlayed ? 0.94 : 0.96;
      ctx.fillRect(Math.round(mid - halfW), y, Math.round(halfW * 2), 1);

      ctx.fillStyle = isPlayed ? '#ffffff' : centerColor;
      ctx.globalAlpha = isPlayed ? 0.74 : 0.58;
      ctx.fillRect(Math.round(mid - halfW * 0.14), y, Math.max(1, Math.round(halfW * 0.28)), 1);
    }

    ctx.globalAlpha = 1.0;

    const playheadY = Math.floor(h - progress * h) + 0.5;
    ctx.strokeStyle = '#ff2f9b';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, playheadY);
    ctx.lineTo(w, playheadY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, playheadY + 1);
    ctx.lineTo(w, playheadY + 1);
    ctx.stroke();

    for (const cue of deck.cuePoints) {
      const cueY = h - (cue.position / deck.duration) * h;
      ctx.fillStyle = cue.color;
      ctx.fillRect(0, Math.floor(cueY), w, 2);
    }
  }

  private seekFromPointer(e: PointerEvent): void {
    if (!this.deck.duration) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let ratio: number;
    if (this.mode === 'horizontal') {
      ratio = x / rect.width;
    } else {
      ratio = 1 - y / rect.height;
    }
    ratio = Math.max(0, Math.min(1, ratio));
    this.deck.seek(ratio * this.deck.duration);
  }

  private drawLoopAreaHorizontal(w: number, h: number): void {
    const { ctx, deck } = this;
    if (!(deck.loopActive && deck.loopIn >= 0 && deck.loopOut > deck.loopIn && deck.duration > 0)) return;

    const x1 = (deck.loopIn / deck.duration) * w;
    const x2 = (deck.loopOut / deck.duration) * w;
    ctx.fillStyle = 'rgba(255, 206, 86, 0.1)';
    ctx.fillRect(x1, 0, x2 - x1, h);

    ctx.strokeStyle = '#ffce56';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, h);
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawLoopAreaVertical(w: number, h: number): void {
    const { ctx, deck } = this;
    if (!(deck.loopActive && deck.loopIn >= 0 && deck.loopOut > deck.loopIn && deck.duration > 0)) return;

    const y1 = h - (deck.loopOut / deck.duration) * h;
    const y2 = h - (deck.loopIn / deck.duration) * h;
    ctx.fillStyle = 'rgba(255, 206, 86, 0.1)';
    ctx.fillRect(0, y1, w, y2 - y1);

    ctx.strokeStyle = '#ffce56';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
    ctx.moveTo(0, y2);
    ctx.lineTo(w, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawBeatGridHorizontal(w: number, h: number): void {
    const { ctx, deck } = this;
    const beatInterval = deck.beatInterval;
    if (beatInterval <= 0 || deck.duration <= 0) return;

    ctx.strokeStyle = 'rgba(240,246,255,0.16)';
    ctx.lineWidth = 1;

    let beat = 0;
    for (let t = 0; t < deck.duration; t += beatInterval) {
      const x = (t / deck.duration) * w;
      const strong = beat % 4 === 0;
      ctx.globalAlpha = strong ? 0.52 : 0.2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      beat += 1;
    }
    ctx.globalAlpha = 1;
  }

  private drawBeatGridVertical(w: number, h: number): void {
    const { ctx, deck } = this;
    const beatInterval = deck.beatInterval;
    if (beatInterval <= 0 || deck.duration <= 0) return;

    ctx.strokeStyle = 'rgba(240,246,255,0.16)';
    ctx.lineWidth = 1;

    let beat = 0;
    for (let t = 0; t < deck.duration; t += beatInterval) {
      const y = h - (t / deck.duration) * h;
      const strong = beat % 4 === 0;
      ctx.globalAlpha = strong ? 0.52 : 0.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      beat += 1;
    }
    ctx.globalAlpha = 1;
  }

  destroy(): void {
    cancelAnimationFrame(this._rafId);
  }
}
