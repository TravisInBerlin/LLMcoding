import { Deck, type DeckId, type StemName } from '../audio/Deck';
import { Crossfader } from '../audio/Crossfader';

export class MixerUI {
  private decks: Deck[];
  private crossfader: Crossfader;
  private el: HTMLElement;
  private vuMap: Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> = new Map();
  private centerTrackEls = new Map<DeckId, HTMLElement>();
  private centerMetaEls = new Map<DeckId, HTMLElement>();
  private centerTimeEls = new Map<DeckId, HTMLElement>();
  private channelBpmEls = new Map<DeckId, HTMLElement>();
  private volumeValueEls = new Map<DeckId, HTMLElement>();

  constructor(container: HTMLElement, decks: Deck[], crossfader: Crossfader) {
    this.decks = decks;
    this.crossfader = crossfader;
    this.el = container;
    this.render();
    this.bind();
    this.bindCenterMeta();
    this.startVU();
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="center-panel">
        <div class="center-trackline">
          <div class="center-track center-track-a">
            <div class="center-track-top">
              <span class="center-deck-tag">A</span>
              <span class="center-track-name" id="center-track-A">No Track Loaded</span>
              <span class="center-track-time" id="center-time-A">0:00</span>
            </div>
            <span class="center-track-meta" id="center-meta-A">-- BPM / Key --</span>
          </div>
          <div class="center-divider-text">MIX STATUS</div>
          <div class="center-track center-track-b">
            <div class="center-track-top">
              <span class="center-deck-tag">B</span>
              <span class="center-track-name" id="center-track-B">No Track Loaded</span>
              <span class="center-track-time" id="center-time-B">0:00</span>
            </div>
            <span class="center-track-meta" id="center-meta-B">-- BPM / Key --</span>
          </div>
        </div>

        <div class="mixer-channels">
          ${this.decks
        .map(
          (deck) => `
              <div class="mixer-channel" data-deck="${deck.id}">
                <div class="channel-head">
                  <span class="channel-label">${deck.id}</span>
                  <span class="channel-bpm" id="chan-bpm-${deck.id}">-- BPM</span>
                </div>

                <div class="compact-row compact-row-4">
                  <div class="compact-item"><span>HI</span><button class="mixer-knob" id="eq-hi-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>MID</span><button class="mixer-knob" id="eq-mid-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>LOW</span><button class="mixer-knob" id="eq-lo-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>FLT</span><button class="mixer-knob" id="filter-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                </div>

                <div class="compact-row compact-row-3">
                  <div class="compact-item"><span>DRM</span><button class="mixer-knob" id="stem-drums-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>INS</span><button class="mixer-knob" id="stem-instruments-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>VOC</span><button class="mixer-knob" id="stem-vocals-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                </div>

                <div class="compact-row compact-row-3">
                  <div class="compact-item"><span>ECHO</span><button class="mixer-knob" id="fx-echo-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>RVB</span><button class="mixer-knob" id="fx-reverb-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                  <div class="compact-item"><span>FX FLT</span><button class="mixer-knob" id="fx-filter-${deck.id}" type="button"><span class="mixer-knob-indicator"></span></button></div>
                </div>

                <div class="channel-foot">
                  <div class="neural-fx-row">
                    <button class="btn btn-neural-fx" id="nfx-vocal-echo-${deck.id}">VOCAL ECHO</button>
                    <button class="btn btn-neural-fx" id="nfx-drum-filter-${deck.id}">DRUM FILTER</button>
                  </div>

                  <div class="meter-fader-stack">
                    <div class="meter-stack">
                      <span class="meter-label">VU</span>
                      <canvas class="vu-meter" id="vu-${deck.id}" width="24" height="86" title="Output meter"></canvas>
                    </div>
                    <div class="fader-stack">
                      <span class="meter-label">VOL</span>
                      <input type="range" class="volume-fader" id="vol-${deck.id}" min="0" max="100" value="80" orient="vertical" title="Channel volume">
                      <span class="meter-value" id="vol-value-${deck.id}">80%</span>
                    </div>
                  </div>
                </div>
              </div>
            `,
        )
        .join('')}
        </div>

        <div class="crossfader-section">
          <span class="cf-label">A</span>
          <input type="range" class="crossfader-slider" id="crossfader" min="0" max="100" value="50">
          <span class="cf-label">B</span>
        </div>
      </div>
    `;

    this.decks.forEach((deck) => {
      const canvas = this.el.querySelector(`#vu-${deck.id}`) as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      this.vuMap.set(deck.id, { canvas, ctx });
      this.channelBpmEls.set(deck.id, this.el.querySelector(`#chan-bpm-${deck.id}`) as HTMLElement);
      this.volumeValueEls.set(deck.id, this.el.querySelector(`#vol-value-${deck.id}`) as HTMLElement);
    });

    (['A', 'B'] as DeckId[]).forEach((id) => {
      this.centerTrackEls.set(id, this.el.querySelector(`#center-track-${id}`) as HTMLElement);
      this.centerMetaEls.set(id, this.el.querySelector(`#center-meta-${id}`) as HTMLElement);
      this.centerTimeEls.set(id, this.el.querySelector(`#center-time-${id}`) as HTMLElement);
    });
  }

  private bind(): void {
    const cf = this.el.querySelector('#crossfader') as HTMLInputElement;
    cf.addEventListener('input', () => {
      this.crossfader.setPosition(parseFloat(cf.value) / 100);
    });

    this.decks.forEach((deck) => {
      this.bindVolume(deck);
      this.bindEQ(deck);
      this.bindFX(deck);
      this.bindStems(deck);
      this.bindNeuralFX(deck);
    });
  }

  private bindCenterMeta(): void {
    (['A', 'B'] as DeckId[]).forEach((id) => {
      const deck = this.decks.find((d) => d.id === id);
      if (!deck) return;

      const update = () => this.updateCenterDeckMeta(deck);
      deck.on('loaded', update);
      deck.on('play', update);
      deck.on('pause', update);
      deck.on('timeupdate', update);
      deck.on('bpm', update);
      deck.on('statechange', update);
      update();
    });

    this.decks.forEach((deck) => {
      const updateBpm = () => {
        const bpmEl = this.channelBpmEls.get(deck.id);
        if (!bpmEl) return;
        bpmEl.textContent = deck.bpm > 0 ? `${deck.bpm.toFixed(1)} BPM` : '-- BPM';
      };
      deck.on('loaded', updateBpm);
      deck.on('bpm', updateBpm);
      updateBpm();
    });
  }

  private updateCenterDeckMeta(deck: Deck): void {
    const trackEl = this.centerTrackEls.get(deck.id);
    const metaEl = this.centerMetaEls.get(deck.id);
    const timeEl = this.centerTimeEls.get(deck.id);
    if (!trackEl || !metaEl || !timeEl) return;

    trackEl.textContent = deck.trackName || 'No Track Loaded';
    const bpmText = deck.bpm > 0 ? `${deck.bpm.toFixed(1)} BPM` : '-- BPM';
    metaEl.textContent = `${bpmText} / Key ${deck.musicalKey}`;
    timeEl.textContent = this.formatTime(deck.currentTime);
    trackEl.classList.toggle('playing', deck.playing);
  }

  private bindVolume(deck: Deck): void {
    const slider = this.el.querySelector(`#vol-${deck.id}`) as HTMLInputElement;
    const valueEl = this.volumeValueEls.get(deck.id);
    const apply = (value: number): void => {
      const clamped = Math.max(0, Math.min(100, value));
      deck.volume = clamped / 100;
      if (valueEl) valueEl.textContent = `${Math.round(clamped)}%`;
    };

    slider.addEventListener('input', () => {
      apply(parseFloat(slider.value));
    });

    slider.value = '80';
    apply(80);
  }

  private bindEQ(deck: Deck): void {
    const hiKnob = this.el.querySelector(`#eq-hi-${deck.id}`) as HTMLElement;
    const midKnob = this.el.querySelector(`#eq-mid-${deck.id}`) as HTMLElement;
    const loKnob = this.el.querySelector(`#eq-lo-${deck.id}`) as HTMLElement;
    const filterKnob = this.el.querySelector(`#filter-${deck.id}`) as HTMLElement;

    this.bindMixerKnob(hiKnob, {
      get: () => deck.eqHigh.gain.value,
      set: (v) => {
        deck.eqHigh.gain.value = v;
      },
      min: -18,
      max: 18,
      step: 0.5,
      reset: 0,
    });

    this.bindMixerKnob(midKnob, {
      get: () => deck.eqMid.gain.value,
      set: (v) => {
        deck.eqMid.gain.value = v;
      },
      min: -18,
      max: 18,
      step: 0.5,
      reset: 0,
    });

    this.bindMixerKnob(loKnob, {
      get: () => deck.eqLow.gain.value,
      set: (v) => {
        deck.eqLow.gain.value = v;
      },
      min: -18,
      max: 18,
      step: 0.5,
      reset: 0,
    });

    let filterValue = 0;
    this.bindMixerKnob(filterKnob, {
      get: () => filterValue,
      set: (v) => {
        filterValue = v;
        deck.setFilterBlend(v / 100);
      },
      min: -100,
      max: 100,
      step: 1,
      reset: 0,
    });
  }

  private bindFX(deck: Deck): void {
    const echoKnob = this.el.querySelector(`#fx-echo-${deck.id}`) as HTMLElement;
    const reverbKnob = this.el.querySelector(`#fx-reverb-${deck.id}`) as HTMLElement;
    const filterKnob = this.el.querySelector(`#fx-filter-${deck.id}`) as HTMLElement;

    let echoValue = 0;
    this.bindMixerKnob(echoKnob, {
      get: () => echoValue,
      set: (v) => {
        echoValue = v;
        deck.effects[0].setWet(v / 100);
      },
      min: 0,
      max: 100,
      step: 1,
      reset: 0,
    });

    let reverbValue = 0;
    this.bindMixerKnob(reverbKnob, {
      get: () => reverbValue,
      set: (v) => {
        reverbValue = v;
        deck.effects[1].setWet(v / 100);
      },
      min: 0,
      max: 100,
      step: 1,
      reset: 0,
    });

    let fxFilterValue = 0;
    this.bindMixerKnob(filterKnob, {
      get: () => fxFilterValue,
      set: (v) => {
        fxFilterValue = v;
        deck.effects[2].setWet(v / 100);
      },
      min: 0,
      max: 100,
      step: 1,
      reset: 0,
    });
  }

  private bindStems(deck: Deck): void {
    const stemIds: StemName[] = ['drums', 'instruments', 'vocals'];
    stemIds.forEach((stem) => {
      const knob = this.el.querySelector(`#stem-${stem}-${deck.id}`) as HTMLElement;
      this.bindMixerKnob(knob, {
        get: () => deck.getStemLevel(stem) * 100,
        set: (v) => {
          deck.setStemLevel(stem, v / 100);
        },
        min: 0,
        max: 100,
        step: 1,
        reset: 100,
      });
    });
  }

  private bindMixerKnob(
    el: HTMLElement,
    opts: {
      get: () => number;
      set: (next: number) => void;
      min: number;
      max: number;
      step: number;
      reset: number;
    },
  ): void {
    const { get, set, min, max, step, reset } = opts;
    let dragging = false;
    let pointerId: number | null = null;
    let startY = 0;
    let startValue = 0;
    const sensitivity = (max - min) / 200;

    const apply = (raw: number): void => {
      const snapped = Math.round(raw / step) * step;
      const next = this.clamp(snapped, min, max);
      set(next);
      this.setMixerKnobAngle(el, next, min, max);
    };

    this.setMixerKnobAngle(el, get(), min, max);

    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      startValue = get();
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging || pointerId !== e.pointerId) return;
      const delta = startY - e.clientY;
      apply(startValue + delta * sensitivity);
    });

    const stop = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      dragging = false;
      pointerId = null;
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      apply(get() + direction * step);
    });

    el.addEventListener('dblclick', () => {
      apply(reset);
    });
  }

  private setMixerKnobAngle(el: HTMLElement, value: number, min: number, max: number): void {
    const normalized = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, normalized));
    const deg = -140 + clamped * 280;
    el.style.setProperty('--knob-angle', `${deg}deg`);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  private bindNeuralFX(deck: Deck): void {
    const vocalBtn = this.el.querySelector(`#nfx-vocal-echo-${deck.id}`) as HTMLButtonElement;
    const drumBtn = this.el.querySelector(`#nfx-drum-filter-${deck.id}`) as HTMLButtonElement;

    let vocalEchoOn = false;
    let drumFilterOn = false;

    vocalBtn.addEventListener('click', () => {
      vocalEchoOn = !vocalEchoOn;
      vocalBtn.classList.toggle('active', vocalEchoOn);
      if (vocalEchoOn) {
        deck.setStemLevel('vocals', 1);
        deck.setStemLevel('instruments', Math.min(deck.getStemLevel('instruments'), 0.45));
        deck.effects[0].setWet(0.62);
        deck.effects[1].setWet(0.3);
      } else {
        deck.effects[0].setWet(0);
        deck.effects[1].setWet(0);
      }
    });

    drumBtn.addEventListener('click', () => {
      drumFilterOn = !drumFilterOn;
      drumBtn.classList.toggle('active', drumFilterOn);
      if (drumFilterOn) {
        deck.setStemLevel('drums', 1);
        deck.setStemLevel('vocals', Math.min(deck.getStemLevel('vocals'), 0.45));
        deck.setFilterBlend(-0.72);
      } else {
        deck.setFilterBlend(0);
      }
    });
  }

  private startVU(): void {
    const buffers = new Map<string, Uint8Array<ArrayBuffer>>();
    this.decks.forEach((deck) => {
      buffers.set(deck.id, new Uint8Array(new ArrayBuffer(deck.analyser.frequencyBinCount)));
    });

    const draw = () => {
      this.decks.forEach((deck) => {
        const buf = buffers.get(deck.id);
        const entry = this.vuMap.get(deck.id);
        if (!buf || !entry) return;
        deck.analyser.getByteFrequencyData(buf);
        this.drawVU(entry.ctx, buf);
      });
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  private drawVU(ctx: CanvasRenderingContext2D, data: Uint8Array<ArrayBuffer>): void {
    const w = 24;
    const h = 86;
    ctx.clearRect(0, 0, w, h);

    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;
    const level = avg / 255;

    const barH = level * h;
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, '#1491ba');
    gradient.addColorStop(0.7, '#8ce6ff');
    gradient.addColorStop(1, '#d6f9ff');

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = gradient;
    ctx.fillRect(2, h - barH, w - 4, barH);

    ctx.fillStyle = 'rgba(6, 10, 24, 0.6)';
    for (let y = 0; y < h; y += 5) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
