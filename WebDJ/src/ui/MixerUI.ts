import { Deck, type StemName } from '../audio/Deck';
import { Crossfader } from '../audio/Crossfader';

/**
 * MixerUI — multi-channel mixer with EQ, filter, stems, FX and VU.
 */
export class MixerUI {
  private decks: Deck[];
  private crossfader: Crossfader;
  private el: HTMLElement;
  private vuMap: Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> = new Map();

  constructor(container: HTMLElement, decks: Deck[], crossfader: Crossfader) {
    this.decks = decks;
    this.crossfader = crossfader;
    this.el = container;
    this.render();
    this.bind();
    this.startVU();
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="mixer-panel">
        <div class="mixer-header">PRO MIXER</div>
        <div class="mixer-channels">
          ${this.decks
            .map(
              (deck) => `
            <div class="mixer-channel" data-deck="${deck.id}">
              <div class="channel-label">${deck.id}</div>

              <div class="eq-group">
                <div class="eq-knob-wrap"><label>HI</label><input type="range" class="eq-knob" id="eq-hi-${deck.id}" min="-18" max="18" value="0" step="0.5"></div>
                <div class="eq-knob-wrap"><label>MID</label><input type="range" class="eq-knob" id="eq-mid-${deck.id}" min="-18" max="18" value="0" step="0.5"></div>
                <div class="eq-knob-wrap"><label>LO</label><input type="range" class="eq-knob" id="eq-lo-${deck.id}" min="-18" max="18" value="0" step="0.5"></div>
                <div class="eq-knob-wrap"><label>HP/LP</label><input type="range" class="eq-knob" id="filter-${deck.id}" min="-100" max="100" value="0" step="1"></div>
              </div>

              <div class="stems-group">
                <div class="stem-row"><label>DRM</label><input type="range" class="stem-slider" id="stem-drums-${deck.id}" min="0" max="100" value="100"></div>
                <div class="stem-row"><label>INS</label><input type="range" class="stem-slider" id="stem-instruments-${deck.id}" min="0" max="100" value="100"></div>
                <div class="stem-row"><label>VOC</label><input type="range" class="stem-slider" id="stem-vocals-${deck.id}" min="0" max="100" value="100"></div>
              </div>

              <div class="fx-selector">
                <div class="fx-knob-wrap"><label>ECHO</label><input type="range" class="fx-knob" id="fx-echo-${deck.id}" min="0" max="100" value="0"></div>
                <div class="fx-knob-wrap"><label>RVB</label><input type="range" class="fx-knob" id="fx-reverb-${deck.id}" min="0" max="100" value="0"></div>
                <div class="fx-knob-wrap"><label>FX FLT</label><input type="range" class="fx-knob" id="fx-filter-${deck.id}" min="0" max="100" value="0"></div>
              </div>
              <div class="neural-fx-row">
                <button class="btn btn-neural-fx" id="nfx-vocal-echo-${deck.id}">VOCAL ECHO</button>
                <button class="btn btn-neural-fx" id="nfx-drum-filter-${deck.id}">DRUM FILTER</button>
              </div>

              <canvas class="vu-meter" id="vu-${deck.id}" width="24" height="120"></canvas>
              <input type="range" class="volume-fader" id="vol-${deck.id}" min="0" max="100" value="80" orient="vertical">
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

    [hiSlider, midSlider, loSlider, filterSlider].forEach((s) => {
      s.addEventListener('dblclick', () => {
        s.value = '0';
        s.dispatchEvent(new Event('input'));
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
        const buf = buffers.get(deck.id)!;
        const entry = this.vuMap.get(deck.id)!;
        deck.analyser.getByteFrequencyData(buf);
        this.drawVU(entry.ctx, buf);
      });
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  private drawVU(ctx: CanvasRenderingContext2D, data: Uint8Array<ArrayBuffer>): void {
    const w = 24;
    const h = 120;
    ctx.clearRect(0, 0, w, h);

    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;
    const level = avg / 255;

    const barH = level * h;
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, '#21d4fd');
    gradient.addColorStop(0.65, '#b721ff');
    gradient.addColorStop(0.9, '#ffd166');
    gradient.addColorStop(1, '#ff4d6d');

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = gradient;
    ctx.fillRect(2, h - barH, w - 4, barH);

    ctx.fillStyle = 'rgba(6, 10, 26, 0.6)';
    for (let y = 0; y < h; y += 5) {
      ctx.fillRect(0, y, w, 1);
    }
  }
}
