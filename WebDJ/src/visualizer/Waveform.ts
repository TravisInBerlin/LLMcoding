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
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.mode === 'horizontal') {
        const ratio = x / rect.width;
        this.deck.seek(ratio * this.deck.duration);
      } else {
        const ratio = 1 - y / rect.height;
        this.deck.seek(ratio * this.deck.duration);
      }
    });

    this.startRender();
  }

  setMode(mode: WaveformMode): void {
    this.mode = mode;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Space Grotesk, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Load track to analyze waveform', w / 2, h / 2 + 4);
      return;
    }

    if (this.mode === 'horizontal') {
      this.drawHorizontal(w, h);
    } else {
      this.drawVertical(w, h);
    }
  }

  private drawHorizontal(w: number, h: number): void {
    const { ctx, deck } = this;
    const peaks = deck.peaks!;
    const numBars = peaks.length;
    const barWidth = w / numBars;
    const progress = deck.duration > 0 ? deck.currentTime / deck.duration : 0;
    const progressIndex = Math.floor(progress * numBars);

    this.drawLoopAreaHorizontal(w, h);
    this.drawBeatGridHorizontal(w, h);

    const mid = h / 2;
    const baseColor = 'rgba(225, 235, 252, 0.3)';
    const playedColor = this.accentColor;
    const centerColor = 'rgba(244, 248, 255, 0.78)';
    const drawWidth = Math.max(1, Math.ceil(barWidth * 0.78));

    for (let i = 0; i < numBars; i++) {
      const val = peaks[i];
      const barH = val * mid * 0.9;
      const x = Math.floor(i * barWidth);
      const isPlayed = i <= progressIndex;

      ctx.fillStyle = isPlayed ? playedColor : baseColor;
      ctx.globalAlpha = isPlayed ? 0.95 : 1;
      ctx.fillRect(x, mid - barH, drawWidth, barH * 2);

      ctx.fillStyle = isPlayed ? '#faffff' : centerColor;
      ctx.globalAlpha = isPlayed ? 0.86 : 0.52;
      ctx.fillRect(x, mid - barH * 0.18, drawWidth, barH * 0.36);
    }

    ctx.globalAlpha = 1.0;

    const playheadX = Math.floor(progress * w) + 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
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
    const numBars = peaks.length;
    const barHeight = h / numBars;
    const progress = deck.duration > 0 ? deck.currentTime / deck.duration : 0;
    const progressIndex = Math.floor(progress * numBars);

    this.drawLoopAreaVertical(w, h);
    this.drawBeatGridVertical(w, h);

    const mid = w / 2;
    const baseColor = 'rgba(225, 235, 252, 0.3)';
    const playedColor = this.accentColor;
    const centerColor = 'rgba(244, 248, 255, 0.78)';
    const drawHeight = Math.max(1, Math.ceil(barHeight * 0.74));

    for (let i = 0; i < numBars; i++) {
      const val = peaks[numBars - i - 1];
      const halfW = Math.max(1, val * mid * 0.85);
      const y = Math.floor(i * barHeight);
      const isPlayed = numBars - i - 1 <= progressIndex;

      ctx.fillStyle = isPlayed ? playedColor : baseColor;
      ctx.globalAlpha = isPlayed ? 0.95 : 1;
      ctx.fillRect(mid - halfW, y, halfW * 2, drawHeight);

      ctx.fillStyle = isPlayed ? '#faffff' : centerColor;
      ctx.globalAlpha = isPlayed ? 0.86 : 0.52;
      ctx.fillRect(mid - halfW * 0.2, y, halfW * 0.4, drawHeight);
    }

    ctx.globalAlpha = 1.0;

    const playheadY = Math.floor(h - progress * h) + 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, playheadY);
    ctx.lineTo(w, playheadY);
    ctx.stroke();

    for (const cue of deck.cuePoints) {
      const cueY = h - (cue.position / deck.duration) * h;
      ctx.fillStyle = cue.color;
      ctx.fillRect(0, Math.floor(cueY), w, 2);
    }
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
