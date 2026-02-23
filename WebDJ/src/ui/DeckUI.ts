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
  private tempoKnob!: HTMLElement;
  private pitchLabel!: HTMLElement;
  private keyShiftKnob!: HTMLElement;
  private keyLabel!: HTMLElement;
  private keyLockBtn!: HTMLButtonElement;
  private syncBtn!: HTMLButtonElement;
  private loopInBtn!: HTMLButtonElement;
  private loopOutBtn!: HTMLButtonElement;
  private loopToggleBtn!: HTMLButtonElement;
  private autoLoopButtons = new Map<number, HTMLButtonElement>();
  private cueButtons: HTMLButtonElement[] = [];
  private cueBankButtons: HTMLButtonElement[] = [];
  private cueClearBtn!: HTMLButtonElement;
  private cueClearArmed = false;
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
                <div class="vinyl-grooves"></div>
                <div class="vinyl-center">
                </div>
                <div class="vinyl-text" id="vinyl-text-${side}">${side}</div>
                <div class="vinyl-highlight"></div>
              </div>
            </div>
            <div class="platter-label">DISC</div>
          </div>

          <div class="deck-controls-stack">
            <div class="control-group">
              <div class="control-label">TRANSPORT</div>
              <div class="transport-row">
                <button class="btn btn-cue" id="cue-btn-${side}" title="先頭キューへ戻る">CUE</button>
                <button class="btn btn-play" id="play-btn-${side}" title="再生 / 停止">▶</button>
                <button class="btn btn-mini btn-sync" id="sync-btn-${side}" title="反対デッキにBPM同期">SYNC</button>
                <button class="btn btn-mini btn-key" id="key-match-${side}" title="反対デッキにキー同期">KEY MATCH</button>
              </div>
              <div class="control-explain">CUE: 頭出し / PLAY: 再生停止 / SYNC: BPM合わせ / KEY MATCH: キー合わせ</div>
            </div>

            <div class="control-group">
              <div class="control-label">LOOP</div>
              <div class="loop-controls">
                <button class="btn btn-loop btn-muted" id="loop-in-${side}" title="ループ開始点 ON / OFF">IN</button>
                <button class="btn btn-loop btn-muted" id="loop-out-${side}" title="ループ終了点 ON / OFF">OUT</button>
                <button class="btn btn-loop-toggle btn-muted" id="loop-toggle-${side}" title="ループ有効 ON / OFF">LOOP</button>
                <button class="btn btn-loop btn-muted" id="loop-save-${side}" title="現在のループを保存">SAVE</button>
                ${[1, 2, 4, 8, 16]
          .map((b) => `<button class="btn btn-auto-loop btn-muted" id="loop-${side}-${b}" title="${b} beat auto loop (tap again to OFF)">${b}B</button>`)
          .join('')}
              </div>
              <div class="control-explain">IN/OUT/LOOP: 再クリックでOFF / 1B-16B: 長さ指定オートループ</div>
            </div>

            <div class="control-group">
              <div class="control-label">HOT CUE</div>
              <div class="cue-bank-row">
                ${Array.from({ length: 4 }, (_, i) => `<button class="btn cue-bank-btn ${i === 0 ? 'active' : ''}" id="cue-bank-${side}-${i}" title="Show cues ${i * 4 + 1}-${i * 4 + 4}">${i * 4 + 1}-${i * 4 + 4}</button>`).join('')}
                <button class="btn cue-clear-btn" id="cue-clear-${side}" title="CLR ONで次のタップを削除にする">CLR</button>
              </div>
              <div class="cue-points cue-grid" id="cue-grid-${side}">
                ${Array.from({ length: 4 }, (_, i) => `<button class="btn btn-hot-cue" id="hot-cue-${side}-${i}" title="Tap: set/jump, long press: clear">${i + 1}</button>`).join('')}
              </div>
              <div class="control-explain">Hot Cue: タップ=セット/ジャンプ、長押し=解除、CLR=次のタップで削除</div>
            </div>

            <div class="control-group">
              <div class="control-label">DJ SHOTS</div>
              <div class="sfx-shot-row">
                <button class="btn btn-sfx-shot" data-sfx="airhorn" id="sfx-airhorn-${side}" title="Airhorn one-shot">HORN</button>
                <button class="btn btn-sfx-shot" data-sfx="laser" id="sfx-laser-${side}" title="Laser one-shot">LASER</button>
                <button class="btn btn-sfx-shot" data-sfx="clap" id="sfx-clap-${side}" title="Clap one-shot">CLAP</button>
                <button class="btn btn-sfx-shot" data-sfx="impact" id="sfx-impact-${side}" title="Impact one-shot">IMPACT</button>
              </div>
              <div class="control-explain">DJ FX: ワンタップで効果音</div>
            </div>
          </div>

          <div class="pitch-control">
            <div class="knob-column">
              <div class="slider-role">TEMPO (速度)</div>
              <button class="deck-knob" id="tempo-knob-${side}" type="button" aria-label="Tempo knob">
                <span class="deck-knob-indicator"></span>
              </button>
              <label class="pitch-label" id="pitch-label-${side}">+0.0%</label>
            </div>
            <div class="knob-column">
              <div class="slider-role">KEY SHIFT (半音)</div>
              <button class="deck-knob" id="key-knob-${side}" type="button" aria-label="Key shift knob">
                <span class="deck-knob-indicator"></span>
              </button>
              <label class="pitch-label" id="key-shift-label-${side}">KEY +0 st</label>
            </div>
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
    this.tempoKnob = this.el.querySelector(`#tempo-knob-${side}`)!;
    this.pitchLabel = this.el.querySelector(`#pitch-label-${side}`)!;
    this.keyShiftKnob = this.el.querySelector(`#key-knob-${side}`)!;
    this.keyLabel = this.el.querySelector(`#key-shift-label-${side}`)!;
    this.keyLockBtn = this.el.querySelector(`#key-lock-${side}`)!;
    this.syncBtn = this.el.querySelector(`#sync-btn-${side}`)!;
    this.loopInBtn = this.el.querySelector(`#loop-in-${side}`)!;
    this.loopOutBtn = this.el.querySelector(`#loop-out-${side}`)!;
    this.loopToggleBtn = this.el.querySelector(`#loop-toggle-${side}`)!;
    this.autoLoopButtons = new Map(
      [1, 2, 4, 8, 16].map((beats) => [beats, this.el.querySelector(`#loop-${side}-${beats}`) as HTMLButtonElement] as const),
    );

    this.cueButtons = Array.from({ length: 4 }, (_, i) => this.el.querySelector(`#hot-cue-${side}-${i}`) as HTMLButtonElement);
    this.cueBankButtons = Array.from({ length: 4 }, (_, i) => this.el.querySelector(`#cue-bank-${side}-${i}`) as HTMLButtonElement);
    this.cueClearBtn = this.el.querySelector(`#cue-clear-${side}`) as HTMLButtonElement;
  }

  private bind(): void {
    const side = this.deck.id;

    this.deckSurfaceEl.addEventListener('pointerdown', () => {
      window.dispatchEvent(new CustomEvent('deck-focus', { detail: { deckId: this.deck.id } }));
    });

    window.addEventListener(
      'deck-focus',
      ((e: CustomEvent) => {
        const focused = e.detail.deckId === this.deck.id;
        this.deckSurfaceEl.classList.toggle('is-focused', focused);
      }) as EventListener,
    );

    this.playBtn.addEventListener('click', () => this.deck.togglePlay());

    this.el.querySelector(`#cue-btn-${side}`)!.addEventListener('click', () => {
      this.deck.seek(0);
    });

    this.loopInBtn.addEventListener('click', () => {
      if (this.deck.loopIn >= 0) {
        this.deck.clearLoopIn();
      } else {
        this.deck.setLoopIn();
      }
    });
    this.loopOutBtn.addEventListener('click', () => {
      if (this.deck.loopOut > this.deck.loopIn && this.deck.loopOut >= 0) {
        this.deck.clearLoopOut();
      } else {
        this.deck.setLoopOut();
      }
    });
    this.loopToggleBtn.addEventListener('click', () => {
      if (this.deck.loopActive) {
        this.deck.toggleLoop(false);
        return;
      }

      const hasRange = this.deck.loopIn >= 0 && this.deck.loopOut > this.deck.loopIn;
      if (hasRange) {
        this.deck.toggleLoop(true);
      } else {
        this.deck.setAutoLoop(4);
      }
    });

    this.el.querySelector(`#loop-save-${side}`)!.addEventListener('click', () => {
      this.deck.saveCurrentLoop(0, 4);
    });

    for (const beats of [1, 2, 4, 8, 16]) {
      this.autoLoopButtons.get(beats)!.addEventListener('click', () => {
        this.deck.toggleAutoLoop(beats);
      });
    }

    this.cueButtons.forEach((btn, i) => {
      let holdTimer: number | null = null;
      let holdTriggered = false;

      const cueId = (): number => this.getCueId(i);
      const clearCue = (): void => {
        const id = cueId();
        const exists = this.deck.cuePoints.find((c) => c.id === id);
        if (!exists) return;
        this.deck.clearCuePoint(id);
      };
      const stopHold = (): void => {
        if (holdTimer !== null) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      btn.addEventListener('pointerdown', () => {
        holdTriggered = false;
        stopHold();
        holdTimer = window.setTimeout(() => {
          holdTriggered = true;
          clearCue();
        }, 520);
      });

      btn.addEventListener('pointerup', stopHold);
      btn.addEventListener('pointercancel', stopHold);
      btn.addEventListener('pointerleave', stopHold);

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        stopHold();
        clearCue();
      });

      btn.addEventListener('click', () => {
        stopHold();
        if (holdTriggered) {
          holdTriggered = false;
          return;
        }

        const id = cueId();
        const exists = this.deck.cuePoints.find((c) => c.id === id);
        if (this.cueClearArmed) {
          if (exists) this.deck.clearCuePoint(id);
          this.setCueClearArmed(false);
          return;
        }
        if (!exists) {
          this.deck.setCuePoint(id);
          return;
        }
        this.deck.jumpToCue(id);
      });
    });

    this.cueBankButtons.forEach((btn, bank) => {
      btn.addEventListener('click', () => {
        this.cueBank = bank;
        this.updateCueBankUI();
        this.syncCueState();
      });
    });

    this.cueClearBtn.addEventListener('click', () => {
      this.setCueClearArmed(!this.cueClearArmed);
    });

    this.el.querySelectorAll<HTMLButtonElement>('.btn-sfx-shot[data-sfx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sfx = btn.dataset.sfx;
        if (!sfx) return;
        window.dispatchEvent(new CustomEvent('sfx-trigger', { detail: { deckId: side, sfx } }));
        btn.classList.add('active');
        window.setTimeout(() => btn.classList.remove('active'), 180);
      });
    });

    this.bindKnobControl(
      this.tempoKnob,
      () => this.deck.tempoPercent,
      (v) => {
        this.deck.tempoPercent = v;
      },
      -75,
      75,
      0.1,
      0,
    );

    this.bindKnobControl(
      this.keyShiftKnob,
      () => this.deck.keySemitone,
      (v) => {
        this.deck.keySemitone = Math.round(v);
      },
      -12,
      12,
      1,
      0,
    );

    this.keyLockBtn.addEventListener('click', () => {
      this.deck.keyLock = !this.deck.keyLock;
    });

    this.syncBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('sync-request', { detail: { deckId: side } }));
    });

    this.el.querySelector(`#key-match-${side}`)!.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('keymatch-request', { detail: { deckId: side } }));
    });

    window.addEventListener(
      'sync-feedback',
      ((e: CustomEvent) => {
        if (e.detail.deckId !== this.deck.id) return;
        this.syncBtn.classList.add('active');
        window.setTimeout(() => this.syncBtn.classList.remove('active'), 340);
      }) as EventListener,
    );

    this.setupJogWheel();

    this.deck.on('loaded', () => {
      this.trackEl.textContent = this.deck.trackName;
      this.syncCueState();
      this.syncLoopState();
      this.updateMeta();
      this.updateVinylStyle();
      this.updateDeckSurfaceState();
    });

    this.deck.on('play', () => {
      this.playBtn.textContent = '⏸';
      this.playBtn.classList.add('playing');
      this.updateDeckSurfaceState();
    });

    this.deck.on('pause', () => {
      this.playBtn.textContent = '▶';
      this.playBtn.classList.remove('playing');
      this.updateDeckSurfaceState();
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
      this.syncLoopState();
      this.updateMeta();
      this.syncTempoKeyUI();
      this.keyLockBtn.classList.toggle('active', this.deck.keyLock);
      this.keyLockBtn.setAttribute('aria-pressed', String(this.deck.keyLock));
    });

    this.updateCueBankUI();
    this.setCueClearArmed(false);
    this.syncCueState();
    this.syncLoopState();
    this.syncTempoKeyUI();
    this.keyLockBtn.setAttribute('aria-pressed', String(this.deck.keyLock));
    this.updateVinylStyle();
    this.updateDeckSurfaceState();
    if (this.deck.id === 'A') {
      this.deckSurfaceEl.classList.add('is-focused');
    }
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
        btn.setAttribute('aria-pressed', 'true');
        btn.title = 'Tap: jump, long press: clear';
      } else {
        btn.classList.remove('active');
        btn.style.removeProperty('--cue-color');
        btn.setAttribute('aria-pressed', 'false');
        btn.title = 'Tap: set cue';
      }
    });
  }

  private syncLoopState(): void {
    const hasLoopIn = this.deck.loopIn >= 0;
    const hasLoopOut = this.deck.loopOut >= 0;
    const loopOn = this.deck.loopActive;

    this.loopInBtn.classList.toggle('active', hasLoopIn);
    this.loopOutBtn.classList.toggle('active', hasLoopOut);
    this.loopToggleBtn.classList.toggle('active', loopOn);
    this.loopInBtn.setAttribute('aria-pressed', String(hasLoopIn));
    this.loopOutBtn.setAttribute('aria-pressed', String(hasLoopOut));
    this.loopToggleBtn.setAttribute('aria-pressed', String(loopOn));

    this.autoLoopButtons.forEach((btn, beats) => {
      const active = loopOn && this.deck.autoLoopBeats === beats;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  private syncTempoKeyUI(): void {
    const tempo = this.deck.tempoPercent;
    const tempoSign = tempo >= 0 ? '+' : '';
    this.pitchLabel.textContent = `${tempoSign}${tempo.toFixed(1)}%`;
    this.setKnobRotation(this.tempoKnob, tempo, -75, 75);

    const key = Math.round(this.deck.keySemitone);
    const keySign = key >= 0 ? '+' : '';
    this.keyLabel.textContent = `KEY ${keySign}${key} st`;
    this.setKnobRotation(this.keyShiftKnob, key, -12, 12);
  }

  private setKnobRotation(el: HTMLElement, value: number, min: number, max: number): void {
    const normalized = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, normalized));
    const deg = -140 + clamped * 280;
    el.style.setProperty('--knob-angle', `${deg}deg`);
    el.style.setProperty('--knob-fill', `${Math.round(clamped * 100)}%`);
  }

  private bindKnobControl(
    el: HTMLElement,
    getValue: () => number,
    setValue: (next: number) => void,
    min: number,
    max: number,
    step: number,
    resetValue: number,
  ): void {
    let dragging = false;
    let pointerId: number | null = null;
    let startY = 0;
    let startX = 0;
    let startValue = 0;
    const sensitivity = (max - min) / 300;

    const apply = (raw: number): void => {
      const snapped = Math.round(raw / step) * step;
      const next = this.clamp(snapped, min, max);
      setValue(next);
      this.syncTempoKeyUI();
    };

    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      startX = e.clientX;
      startValue = getValue();
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging || pointerId !== e.pointerId) return;
      const deltaY = startY - e.clientY;
      const deltaX = e.clientX - startX;
      const precision = e.shiftKey ? 0.35 : 1;
      apply(startValue + (deltaY + deltaX) * sensitivity * precision);
      e.preventDefault();
    });

    const stop = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      pointerId = null;
    };

    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      apply(getValue() + direction * step);
    });

    el.addEventListener('dblclick', () => {
      apply(resetValue);
    });
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  private getCueId(visibleSlot: number): number {
    return this.cueBank * 4 + visibleSlot;
  }

  private updateCueBankUI(): void {
    this.cueBankButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.cueBank);
    });
  }

  private setCueClearArmed(armed: boolean): void {
    this.cueClearArmed = armed;
    this.cueClearBtn.classList.toggle('active', armed);
    this.cueClearBtn.setAttribute('aria-pressed', String(armed));
    this.cueClearBtn.textContent = armed ? 'CLR ON' : 'CLR';
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

  private updateDeckSurfaceState(): void {
    const loaded = Boolean(this.deck.trackName.trim());
    this.deckSurfaceEl.classList.toggle('is-loaded', loaded);
    this.deckSurfaceEl.classList.toggle('is-playing', this.deck.playing);
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
