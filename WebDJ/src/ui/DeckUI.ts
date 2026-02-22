import { Deck } from '../audio/Deck';
import { Waveform, type WaveformMode } from '../visualizer/Waveform';

export class DeckUI {
  private deck: Deck;
  private el: HTMLElement;
  private waveform!: Waveform;
  private jogAngle = 0;
  private deckSurfaceEl!: HTMLElement;
  private jogEl!: HTMLElement;
  private vinylTextEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private bpmEl!: HTMLElement;
  private keyEl!: HTMLElement;
  private stemModeEl!: HTMLElement;
  private stemProgressBarEl!: HTMLElement;
  private trackEl!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private pitchSlider!: HTMLInputElement;
  private pitchLabel!: HTMLElement;
  private keySlider!: HTMLInputElement;
  private keyLabel!: HTMLElement;
  private keyLockBtn!: HTMLButtonElement;
  private cueButtons: HTMLButtonElement[] = [];
  private cueBankButtons: HTMLButtonElement[] = [];
  private cueBank = 0;
  private accentColor: string;

  constructor(container: HTMLElement, deck: Deck, accentColor: string) {
    this.deck = deck;
    this.el = container;
    this.accentColor = accentColor;
    this.render();
    this.bind();
  }

  setWaveformMode(mode: WaveformMode): void {
    this.waveform.setMode(mode);
  }

  private render(): void {
    const side = this.deck.id;
    this.el.innerHTML = `
      <div class="deck-surface deck-${side.toLowerCase()}" style="--deck-accent:${this.accentColor};">
        <div class="deck-strip">
          <div class="deck-strip-art">${side}</div>
          <div class="deck-strip-main">
            <div class="deck-strip-title-row">
              <span class="deck-strip-label" style="color:${this.accentColor}">DECK ${side}</span>
              <span class="deck-strip-title" id="track-${side}">No Track Loaded</span>
            </div>
            <div class="deck-strip-meta-row">
              <span class="deck-time" id="time-${side}">0:00 / 0:00</span>
              <span class="deck-bpm" id="bpm-${side}">-- BPM</span>
              <span class="deck-key" id="key-${side}">Key: --</span>
              <span class="deck-stem-mode" id="stem-mode-${side}">Neural: --</span>
            </div>
          </div>
          <button class="btn btn-mini" id="key-lock-${side}">KEY LOCK</button>
        </div>

        <canvas class="waveform-canvas deck-wave-strip" id="waveform-${side}"></canvas>

        <div class="deck-neural-progress">
          <div class="deck-neural-progress-bar" id="stem-progress-${side}"></div>
        </div>

        <div class="deck-main">
          <div class="jog-zone">
            <div class="turntable-shell">
              <div class="platter-rim"></div>
              <div class="jog-wheel" id="jog-${side}">
                <img src="/assets/vinyl.png" class="vinyl-record-img" alt="Vinyl Record">
                <div class="vinyl-text" id="vinyl-text-${side}">${side}</div>
                <div class="vinyl-highlight"></div>
              </div>
            </div>
            <div class="platter-label">DISC</div>
          </div>

          <div class="deck-controls-stack">
            <div class="transport-row">
              <button class="btn btn-cue" id="cue-btn-${side}" title="Return to cue">CUE</button>
              <button class="btn btn-play" id="play-btn-${side}" title="Play/Pause">▶</button>
              <button class="btn btn-mini btn-sync" id="sync-btn-${side}" title="Sync tempo">SYNC</button>
              <button class="btn btn-mini btn-key" id="key-match-${side}" title="Match key">KEY MATCH</button>
            </div>

            <div class="loop-controls">
              <button class="btn btn-loop btn-muted" id="loop-in-${side}" title="Set loop in">IN</button>
              <button class="btn btn-loop btn-muted" id="loop-out-${side}" title="Set loop out">OUT</button>
              <button class="btn btn-loop-toggle btn-muted" id="loop-toggle-${side}" title="Toggle loop">LOOP</button>
              <button class="btn btn-loop btn-muted" id="loop-save-${side}" title="Save loop">SAVE</button>
              ${[1, 2, 4, 8, 16]
        .map((b) => `<button class="btn btn-auto-loop btn-muted" id="loop-${side}-${b}" title="${b} beat loop">${b}B</button>`)
        .join('')}
            </div>

            <div class="cue-bank-row">
              ${Array.from({ length: 4 }, (_, i) => `<button class="btn cue-bank-btn ${i === 0 ? 'active' : ''}" id="cue-bank-${side}-${i}" title="Show cues ${i * 4 + 1}-${i * 4 + 4}">${i * 4 + 1}-${i * 4 + 4}</button>`).join('')}
            </div>

            <div class="cue-points cue-grid" id="cue-grid-${side}">
              ${Array.from({ length: 4 }, (_, i) => `<button class="btn btn-hot-cue" id="hot-cue-${side}-${i}" title="Hot Cue ${i + 1} (Shift+Click to set)">${i + 1}</button>`).join('')}
            </div>
            <div class="deck-hint">Tap: jump/set cue. Shift+Tap: overwrite</div>
          </div>

          <div class="pitch-control">
            <label class="pitch-label" id="pitch-label-${side}">+0.0%</label>
            <input type="range" class="pitch-slider" id="pitch-${side}" min="-75" max="75" value="0" orient="vertical" aria-label="Tempo">
            <label class="pitch-label" id="key-shift-label-${side}">KEY +0</label>
            <input type="range" class="pitch-slider" id="key-shift-${side}" min="-12" max="12" value="0" orient="vertical" aria-label="Key">
          </div>
        </div>
      </div>
    `;

    const canvas = this.el.querySelector(`#waveform-${side}`) as HTMLCanvasElement;
    this.waveform = new Waveform(canvas, this.deck, this.accentColor);

    this.deckSurfaceEl = this.el.querySelector('.deck-surface') as HTMLElement;
    this.jogEl = this.el.querySelector(`#jog-${side}`)!;
    this.vinylTextEl = this.el.querySelector(`#vinyl-text-${side}`)!;
    this.timeEl = this.el.querySelector(`#time-${side}`)!;
    this.bpmEl = this.el.querySelector(`#bpm-${side}`)!;
    this.keyEl = this.el.querySelector(`#key-${side}`)!;
    this.stemModeEl = this.el.querySelector(`#stem-mode-${side}`)!;
    this.stemProgressBarEl = this.el.querySelector(`#stem-progress-${side}`)!;
    this.trackEl = this.el.querySelector(`#track-${side}`)!;
    this.playBtn = this.el.querySelector(`#play-btn-${side}`)!;
    this.pitchSlider = this.el.querySelector(`#pitch-${side}`)!;
    this.pitchLabel = this.el.querySelector(`#pitch-label-${side}`)!;
    this.keySlider = this.el.querySelector(`#key-shift-${side}`)!;
    this.keyLabel = this.el.querySelector(`#key-shift-label-${side}`)!;
    this.keyLockBtn = this.el.querySelector(`#key-lock-${side}`)!;

    this.cueButtons = Array.from({ length: 4 }, (_, i) => this.el.querySelector(`#hot-cue-${side}-${i}`) as HTMLButtonElement);
    this.cueBankButtons = Array.from({ length: 4 }, (_, i) => this.el.querySelector(`#cue-bank-${side}-${i}`) as HTMLButtonElement);
  }

  private bind(): void {
    const side = this.deck.id;

    this.playBtn.addEventListener('click', () => this.deck.togglePlay());

    this.el.querySelector(`#cue-btn-${side}`)!.addEventListener('click', () => {
      this.deck.seek(0);
    });

    this.el.querySelector(`#loop-in-${side}`)!.addEventListener('click', () => this.deck.setLoopIn());
    this.el.querySelector(`#loop-out-${side}`)!.addEventListener('click', () => this.deck.setLoopOut());
    this.el.querySelector(`#loop-toggle-${side}`)!.addEventListener('click', () => this.deck.toggleLoop());

    this.el.querySelector(`#loop-save-${side}`)!.addEventListener('click', () => {
      this.deck.saveCurrentLoop(0, 4);
    });

    for (const beats of [1, 2, 4, 8, 16]) {
      this.el.querySelector(`#loop-${side}-${beats}`)!.addEventListener('click', () => {
        this.deck.setAutoLoop(beats);
      });
    }

    this.cueButtons.forEach((btn, i) => {
      btn.addEventListener('click', (e) => {
        const cueId = this.getCueId(i);
        const exists = this.deck.cuePoints.find((c) => c.id === cueId);

        if ((e as MouseEvent).shiftKey) {
          if (exists) {
            // Shift click on an existing cue clears it
            this.deck.clearCuePoint(cueId);
          } else {
            // Shift click on an empty cue sets it
            this.deck.setCuePoint(cueId);
          }
        } else if (exists) {
          this.deck.jumpToCue(cueId);
        } else {
          this.deck.setCuePoint(cueId);
        }
      });
    });

    this.cueBankButtons.forEach((btn, bank) => {
      btn.addEventListener('click', () => {
        this.cueBank = bank;
        this.updateCueBankUI();
        this.syncCueState();
      });
    });

    this.pitchSlider.addEventListener('input', () => {
      const val = parseFloat(this.pitchSlider.value);
      this.deck.tempoPercent = val;
      const sign = val >= 0 ? '+' : '';
      this.pitchLabel.textContent = `${sign}${val.toFixed(1)}%`;
    });

    this.pitchSlider.addEventListener('dblclick', () => {
      this.pitchSlider.value = '0';
      this.deck.tempoPercent = 0;
      this.pitchLabel.textContent = '+0.0%';
    });

    this.keySlider.addEventListener('input', () => {
      const semi = parseFloat(this.keySlider.value);
      this.deck.keySemitone = semi;
      const sign = semi >= 0 ? '+' : '';
      this.keyLabel.textContent = `KEY ${sign}${Math.round(semi)}`;
    });

    this.keySlider.addEventListener('dblclick', () => {
      this.keySlider.value = '0';
      this.deck.keySemitone = 0;
      this.keyLabel.textContent = 'KEY +0';
    });

    this.keyLockBtn.addEventListener('click', () => {
      this.deck.keyLock = !this.deck.keyLock;
    });

    this.el.querySelector(`#sync-btn-${side}`)!.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('sync-request', { detail: { deckId: side } }));
    });

    this.el.querySelector(`#key-match-${side}`)!.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('keymatch-request', { detail: { deckId: side } }));
    });

    this.setupJogWheel();

    this.deck.on('loaded', () => {
      this.trackEl.textContent = this.deck.trackName;
      this.syncCueState();
      this.updateMeta();
      this.updateVinylStyle();
    });

    this.deck.on('play', () => {
      this.playBtn.textContent = '⏸';
      this.playBtn.classList.add('playing');
    });

    this.deck.on('pause', () => {
      this.playBtn.textContent = '▶';
      this.playBtn.classList.remove('playing');
    });

    this.deck.on('timeupdate', () => {
      this.timeEl.textContent = `${this.formatTime(this.deck.currentTime)} / ${this.formatTime(this.deck.duration)}`;
      if (this.deck.playing) {
        this.jogAngle += 1.3 * this.deck.playbackRate;
        this.jogEl.style.transform = `rotate(${this.jogAngle}deg)`;
      }
    });

    this.deck.on('bpm', () => {
      this.updateMeta();
    });

    this.deck.on('statechange', () => {
      this.syncCueState();
      this.updateMeta();
      this.keyLockBtn.classList.toggle('active', this.deck.keyLock);
    });

    this.updateCueBankUI();
    this.syncCueState();
    this.updateVinylStyle();
  }

  private updateMeta(): void {
    this.bpmEl.textContent = this.deck.bpm > 0 ? `${this.deck.bpm.toFixed(1)} BPM` : '-- BPM';
    this.keyEl.textContent = `Key: ${this.deck.musicalKey}`;
    if (this.deck.stemMode === 'analyzing') {
      const p = Math.round(this.deck.separationProgress * 100);
      this.stemModeEl.textContent = `Neural: analyzing ${p}%`;
    } else {
      this.stemModeEl.textContent = `Neural: ${this.deck.stemMode}`;
    }
    this.stemProgressBarEl.style.width = `${Math.round(this.deck.separationProgress * 100)}%`;
  }

  private syncCueState(): void {
    this.cueButtons.forEach((btn, i) => {
      const cueId = this.getCueId(i);
      btn.textContent = `${cueId + 1}`;
      const cue = this.deck.cuePoints.find((c) => c.id === cueId);
      if (cue) {
        btn.classList.add('active');
        btn.style.setProperty('--cue-color', cue.color);
      } else {
        btn.classList.remove('active');
      }
    });
  }

  private getCueId(visibleSlot: number): number {
    return this.cueBank * 4 + visibleSlot;
  }

  private updateCueBankUI(): void {
    this.cueBankButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.cueBank);
    });
  }

  private updateVinylStyle(): void {
    const title = this.deck.trackName.trim();
    const seed = title || this.deck.id;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
    }
    const hue = Math.abs(hash) % 360;
    const hue2 = (hue + 46) % 360;
    this.jogEl.style.setProperty('--vinyl-hue', `${hue}`);
    this.jogEl.style.setProperty('--vinyl-hue2', `${hue2}`);
    this.jogEl.classList.toggle('loaded', Boolean(title));
    this.vinylTextEl.textContent = title ? title.slice(0, 2).toUpperCase() : this.deck.id;
    this.deckSurfaceEl.style.setProperty('--deck-accent-secondary', `hsl(${hue2} 82% 62%)`);
  }

  private setupJogWheel(): void {
    let dragging = false;
    let activePointerId: number | null = null;
    let lastAngle = 0;

    const getAngle = (e: PointerEvent): number => {
      const rect = this.jogEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    };

    this.jogEl.addEventListener('pointerdown', (e) => {
      activePointerId = e.pointerId;
      dragging = true;
      lastAngle = getAngle(e);
      this.jogEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    this.jogEl.addEventListener('pointermove', (e) => {
      if (activePointerId !== e.pointerId) return;
      if (!dragging || !this.deck.buffer) return;
      const angle = getAngle(e);
      let delta = angle - lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngle = angle;

      const nudge = (delta / 360) * 1.5;
      this.deck.seek(this.deck.currentTime + nudge);
      this.jogAngle += delta;
      this.jogEl.style.transform = `rotate(${this.jogAngle}deg)`;
    });

    const stop = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      dragging = false;
      activePointerId = null;
    };

    this.jogEl.addEventListener('pointerup', stop);
    this.jogEl.addEventListener('pointercancel', stop);

  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
