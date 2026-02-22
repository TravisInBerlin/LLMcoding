import { Deck } from '../audio/Deck';
import { Waveform, type WaveformMode } from '../visualizer/Waveform';

/**
 * DeckUI — renders a deck panel with transport, waveform, cues, and advanced controls.
 */
export class DeckUI {
  private deck: Deck;
  private el: HTMLElement;
  private waveform!: Waveform;
  private jogAngle = 0;
  private jogEl!: HTMLElement;
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
      <div class="deck-panel deck-${side.toLowerCase()}">
        <div class="deck-header">
          <span class="deck-label" style="color:${this.accentColor}">DECK ${side}</span>
          <span class="deck-track-name" id="track-${side}">No Track Loaded</span>
          <button class="btn btn-mini" id="key-lock-${side}">KEY LOCK</button>
        </div>
        <canvas class="waveform-canvas" id="waveform-${side}"></canvas>
        <div class="deck-info-row">
          <span class="deck-time" id="time-${side}">0:00 / 0:00</span>
          <span class="deck-bpm" id="bpm-${side}">-- BPM</span>
          <span class="deck-key" id="key-${side}">Key: --</span>
          <span class="deck-stem-mode" id="stem-mode-${side}">Neural: --</span>
        </div>
        <div class="deck-neural-progress">
          <div class="deck-neural-progress-bar" id="stem-progress-${side}"></div>
        </div>

        <div class="deck-controls">
          <div class="jog-container">
            <div class="jog-wheel" id="jog-${side}">
              <div class="jog-dot"></div>
              <div class="jog-label">${side}</div>
            </div>
            <div class="platter-label">DISC</div>
          </div>

          <div class="transport-controls performance-layout">
            <div class="control-section">
              <div class="section-title">TRANSPORT</div>
              <div class="transport-row transport-strip">
                <button class="btn btn-cue" id="cue-btn-${side}" title="Return to start cue">CUE</button>
                <button class="btn btn-play" id="play-btn-${side}" title="Play/Pause">▶</button>
                <button class="btn btn-mini" id="sync-btn-${side}" title="Sync tempo to opposite deck">SYNC</button>
                <button class="btn btn-mini" id="key-match-${side}" title="Match harmonic key">KEY MATCH</button>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">LOOP</div>
              <div class="loop-controls">
                <button class="btn btn-loop" id="loop-in-${side}" title="Set loop start">IN</button>
                <button class="btn btn-loop" id="loop-out-${side}" title="Set loop end">OUT</button>
                <button class="btn btn-loop-toggle" id="loop-toggle-${side}" title="Enable/disable loop">LOOP</button>
                <button class="btn btn-loop" id="loop-save-${side}" title="Save current loop">SAVE</button>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">AUTO LOOP</div>
              <div class="auto-loop-row">
                ${[1, 2, 4, 8, 16].map((b) => `<button class="btn btn-auto-loop" id="loop-${side}-${b}" title="Create ${b} beat auto-loop">${b}B</button>`).join('')}
              </div>
            </div>

            <div class="control-section pad-section">
              <div class="section-title">PERFORMANCE PADS</div>
              <div class="cue-points cue-grid" id="cue-grid-${side}">
                ${Array.from({ length: 16 }, (_, i) => `<button class="btn btn-hot-cue" id="hot-cue-${side}-${i}" title="Hot Cue ${i + 1} (Shift+Click to set)">${i + 1}</button>`).join('')}
              </div>
              <div class="pad-help">Tap: jump / set, Shift+Tap: overwrite cue</div>
            </div>
          </div>

          <div class="pitch-control">
            <label class="pitch-label" id="pitch-label-${side}">+0.0%</label>
            <input type="range" class="pitch-slider" id="pitch-${side}" min="-75" max="75" value="0" orient="vertical">
            <label class="pitch-label" id="key-shift-label-${side}">KEY +0</label>
            <input type="range" class="pitch-slider" id="key-shift-${side}" min="-12" max="12" value="0" orient="vertical">
          </div>
        </div>
      </div>
    `;

    const canvas = this.el.querySelector(`#waveform-${side}`) as HTMLCanvasElement;
    this.waveform = new Waveform(canvas, this.deck, this.accentColor);

    this.jogEl = this.el.querySelector(`#jog-${side}`)!;
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

    this.cueButtons = Array.from({ length: 16 }, (_, i) => this.el.querySelector(`#hot-cue-${side}-${i}`) as HTMLButtonElement);
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
        if ((e as MouseEvent).shiftKey) {
          this.deck.setCuePoint(i);
        } else {
          if (this.deck.cuePoints.find((c) => c.id === i)) {
            this.deck.jumpToCue(i);
          } else {
            this.deck.setCuePoint(i);
          }
        }
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
      const event = new CustomEvent('sync-request', { detail: { deckId: side } });
      window.dispatchEvent(event);
    });

    this.el.querySelector(`#key-match-${side}`)!.addEventListener('click', () => {
      const event = new CustomEvent('keymatch-request', { detail: { deckId: side } });
      window.dispatchEvent(event);
    });

    this.setupJogWheel();

    this.deck.on('loaded', () => {
      this.trackEl.textContent = this.deck.trackName;
      this.syncCueState();
      this.updateMeta();
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
      const cue = this.deck.cuePoints.find((c) => c.id === i);
      if (cue) {
        btn.classList.add('active');
        btn.style.setProperty('--cue-color', cue.color);
      } else {
        btn.classList.remove('active');
      }
    });
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
