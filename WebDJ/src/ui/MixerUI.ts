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
                  <label class="compact-item">HI<input type="range" class="eq-knob" id="eq-hi-${deck.id}" min="-18" max="18" value="0" step="0.5"></label>
                  <label class="compact-item">MID<input type="range" class="eq-knob" id="eq-mid-${deck.id}" min="-18" max="18" value="0" step="0.5"></label>
                  <label class="compact-item">LOW<input type="range" class="eq-knob" id="eq-lo-${deck.id}" min="-18" max="18" value="0" step="0.5"></label>
                  <label class="compact-item">FLT<input type="range" class="eq-knob" id="filter-${deck.id}" min="-100" max="100" value="0" step="1"></label>
                </div>

                <div class="compact-row compact-row-3">
                  <label class="compact-item">DRM<input type="range" class="stem-slider" id="stem-drums-${deck.id}" min="0" max="100" value="100"></label>
                  <label class="compact-item">INS<input type="range" class="stem-slider" id="stem-instruments-${deck.id}" min="0" max="100" value="100"></label>
                  <label class="compact-item">VOC<input type="range" class="stem-slider" id="stem-vocals-${deck.id}" min="0" max="100" value="100"></label>
                </div>

                <div class="compact-row compact-row-3">
                  <label class="compact-item">ECHO<input type="range" class="fx-knob" id="fx-echo-${deck.id}" min="0" max="100" value="0"></label>
                  <label class="compact-item">RVB<input type="range" class="fx-knob" id="fx-reverb-${deck.id}" min="0" max="100" value="0"></label>
                  <label class="compact-item">FX FLT<input type="range" class="fx-knob" id="fx-filter-${deck.id}" min="0" max="100" value="0"></label>
                </div>

                <div class="channel-foot">
                  <div class="neural-fx-row">
                    <button class="btn btn-neural-fx" id="nfx-vocal-echo-${deck.id}">VOCAL ECHO</button>
                    <button class="btn btn-neural-fx" id="nfx-drum-filter-${deck.id}">DRUM FILTER</button>
                  </div>

                  <div class="meter-fader-stack">
                    <canvas class="vu-meter" id="vu-${deck.id}" width="24" height="86"></canvas>
                    <input type="range" class="volume-fader" id="vol-${deck.id}" min="0" max="100" value="80" orient="vertical">
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
    slider.addEventListener('input', () => {
      deck.volume = parseFloat(slider.value) / 100;
    });
    deck.volume = 0.8;
  }

  private bindEQ(deck: Deck): void {
    const hiSlider = this.el.querySelector(`#eq-hi-${deck.id}`) as HTMLInputElement;
    const midSlider = this.el.querySelector(`#eq-mid-${deck.id}`) as HTMLInputElement;
    const loSlider = this.el.querySelector(`#eq-lo-${deck.id}`) as HTMLInputElement;
    const filterSlider = this.el.querySelector(`#filter-${deck.id}`) as HTMLInputElement;

    hiSlider.addEventListener('input', () => {
      deck.eqHigh.gain.value = parseFloat(hiSlider.value);
    });
    midSlider.addEventListener('input', () => {
      deck.eqMid.gain.value = parseFloat(midSlider.value);
    });
    loSlider.addEventListener('input', () => {
      deck.eqLow.gain.value = parseFloat(loSlider.value);
    });
    filterSlider.addEventListener('input', () => {
      deck.setFilterBlend(parseFloat(filterSlider.value) / 100);
    });

    [hiSlider, midSlider, loSlider, filterSlider].forEach((slider) => {
      slider.addEventListener('dblclick', () => {
        slider.value = '0';
        slider.dispatchEvent(new Event('input'));
      });
    });
  }

  private bindFX(deck: Deck): void {
    const echoSlider = this.el.querySelector(`#fx-echo-${deck.id}`) as HTMLInputElement;
    const reverbSlider = this.el.querySelector(`#fx-reverb-${deck.id}`) as HTMLInputElement;
    const filterSlider = this.el.querySelector(`#fx-filter-${deck.id}`) as HTMLInputElement;

    echoSlider.addEventListener('input', () => {
      deck.effects[0].setWet(parseFloat(echoSlider.value) / 100);
    });
    reverbSlider.addEventListener('input', () => {
      deck.effects[1].setWet(parseFloat(reverbSlider.value) / 100);
    });
    filterSlider.addEventListener('input', () => {
      deck.effects[2].setWet(parseFloat(filterSlider.value) / 100);
    });
  }

  private bindStems(deck: Deck): void {
    const stemIds: StemName[] = ['drums', 'instruments', 'vocals'];
    stemIds.forEach((stem) => {
      const slider = this.el.querySelector(`#stem-${stem}-${deck.id}`) as HTMLInputElement;
      slider.addEventListener('input', () => {
        deck.setStemLevel(stem, parseFloat(slider.value) / 100);
      });

      slider.addEventListener('dblclick', () => {
        const next = parseFloat(slider.value) > 0 ? 0 : 100;
        slider.value = `${next}`;
        slider.dispatchEvent(new Event('input'));
      });
    });
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
