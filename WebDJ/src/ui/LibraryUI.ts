import { detectBPM } from '../audio/BPMDetector';
import type { Deck, DeckId } from '../audio/Deck';

interface TrackItem {
  file: File;
  name: string;
  size: string;
  bpm: number;
  key: string;
  energy: number;
  hue: number;
}

export class LibraryUI {
  private decks: Deck[];
  private el: HTMLElement;
  private tracks: TrackItem[] = [];
  private trackListEl!: HTMLElement;
  private matchEl!: HTMLElement;
  private dropZoneEl!: HTMLElement;

  constructor(container: HTMLElement, decks: Deck[]) {
    this.decks = decks;
    this.el = container;
    this.render();
    this.bind();
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="library-panel">
        <div class="library-header">
          <div class="library-left">
            <span class="library-title">LIBRARY</span>
            <span class="library-match" id="library-match">Match: load tracks to get suggestions.</span>
          </div>
          <div class="library-actions">
            <input type="text" class="search-input" id="search-input" placeholder="Search tracks...">
            <label class="btn btn-add-files" for="file-picker">+ Add Files</label>
            <input type="file" id="file-picker" multiple accept="audio/*" style="display:none">
          </div>
        </div>

        <div class="library-body">
          <aside class="library-sidebar">
            <button class="sidebar-item active">Library</button>
            <button class="sidebar-item">History</button>
            <button class="sidebar-item">Playlists</button>
            <button class="sidebar-item">My Files</button>
            <button class="sidebar-item">Downloaded</button>
            <button class="sidebar-item">Neural Mix</button>
          </aside>

          <div class="library-content">
            <div class="track-grid" id="track-list"></div>
            <div class="drop-zone" id="drop-zone">
              <div class="drop-zone-inner">
                <span class="drop-copy">Drop audio files here</span>
                <span class="drop-subcopy">Supports iPad Files / local storage / drag & drop</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.trackListEl = this.el.querySelector('#track-list')!;
    this.matchEl = this.el.querySelector('#library-match')!;
    this.dropZoneEl = this.el.querySelector('#drop-zone')!;
  }

  private bind(): void {
    const filePicker = this.el.querySelector('#file-picker') as HTMLInputElement;
    const searchInput = this.el.querySelector('#search-input') as HTMLInputElement;

    this.dropZoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZoneEl.classList.add('drag-over');
    });

    this.dropZoneEl.addEventListener('dragleave', () => {
      this.dropZoneEl.classList.remove('drag-over');
    });

    this.dropZoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZoneEl.classList.remove('drag-over');
      const dt = (e as DragEvent).dataTransfer;
      if (dt?.files) void this.addFiles(dt.files);
    });

    filePicker.addEventListener('change', () => {
      if (filePicker.files) void this.addFiles(filePicker.files);
    });

    window.addEventListener('library-open-picker', () => {
      filePicker.click();
    });

    searchInput.addEventListener('input', () => {
      this.renderTracks(searchInput.value.toLowerCase());
    });

    const updateMatch = () => this.renderMatchSuggestions();
    this.decks.forEach((deck) => {
      deck.on('loaded', updateMatch);
      deck.on('play', updateMatch);
      deck.on('bpm', updateMatch);
    });
  }

  private async addFiles(fileList: FileList): Promise<void> {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('audio/')) continue;
      const analysis = await this.analyzeTrack(file);
      const hue = (this.tracks.length * 47 + file.name.length * 13) % 360;
      this.tracks.push({
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        size: this.formatSize(file.size),
        bpm: analysis.bpm,
        key: analysis.key,
        energy: analysis.energy,
        hue,
      });
    }

    this.renderTracks();
    this.renderMatchSuggestions();
    this.dropZoneEl.classList.toggle('hidden', this.tracks.length > 0);
  }

  private async analyzeTrack(file: File): Promise<{ bpm: number; key: string; energy: number }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const tempCtx = new AudioContext();
      const decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
      const bpm = detectBPM(decoded);
      const key = this.estimateKey(decoded);
      const energy = this.estimateEnergy(decoded);
      await tempCtx.close();
      return { bpm, key, energy };
    } catch {
      return { bpm: 120, key: 'Unknown', energy: 0.5 };
    }
  }

  private renderTracks(filter = ''): void {
    const filtered = this.tracks.filter((track) => track.name.toLowerCase().includes(filter));

    this.trackListEl.innerHTML = filtered
      .map((track) => {
        const idx = this.tracks.indexOf(track);
        const title = this.escapeHtml(track.name);
        return `
          <div class="track-card" data-index="${idx}">
            <div class="track-art" style="--track-hue:${track.hue}">
              <span class="track-art-letter">${title.charAt(0) || '♪'}</span>
            </div>
            <div class="track-info">
              <div class="track-name" title="${title}">${title}</div>
              <div class="track-meta">${track.bpm.toFixed(1)} BPM • ${track.key} • EN ${Math.round(track.energy * 100)} • ${track.size}</div>
            </div>
            <div class="track-load-row">
              ${this.decks
                .map(
                  (deck) =>
                    `<button class="btn btn-load-${deck.id.toLowerCase()}" data-deck="${deck.id}" data-index="${idx}">${deck.id}</button>`,
                )
                .join('')}
            </div>
          </div>
        `;
      })
      .join('');

    this.trackListEl.querySelectorAll('[data-deck]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const idx = parseInt(el.dataset.index || '-1', 10);
        const deckId = el.dataset.deck as DeckId;
        const deck = this.decks.find((d) => d.id === deckId);
        if (!deck || idx < 0) return;
        void deck.loadFile(this.tracks[idx].file);
      });
    });
  }

  private renderMatchSuggestions(): void {
    const activeDeck = this.decks.find((d) => d.playing) || this.decks.find((d) => d.bpm > 0);
    if (!activeDeck || this.tracks.length === 0 || activeDeck.bpm <= 0) {
      this.matchEl.textContent = 'Match: play or load a deck to see harmonic suggestions.';
      return;
    }

    const activeEnergy = this.estimateDeckEnergy(activeDeck);
    const activeKeyRoot = this.parseKeyRoot(activeDeck.musicalKey);

    const matches = this.tracks
      .map((track) => ({
        track,
        score:
          Math.abs(track.bpm - activeDeck.bpm) * 1.8 +
          this.keyDistance(activeKeyRoot, this.parseKeyRoot(track.key)) * 1.6 +
          Math.abs(track.energy - activeEnergy) * 85,
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((m) => `${m.track.name} (${m.track.bpm.toFixed(1)} BPM, ${m.track.key}, EN ${Math.round(m.track.energy * 100)})`);

    this.matchEl.textContent = `Smart Match for Deck ${activeDeck.id} (${activeDeck.bpm.toFixed(1)} BPM, ${activeDeck.musicalKey}): ${matches.join(' / ')}`;
  }

  private estimateDeckEnergy(deck: Deck): number {
    if (!deck.peaks || deck.peaks.length === 0) return 0.5;
    let sum = 0;
    for (let i = 0; i < deck.peaks.length; i++) sum += deck.peaks[i];
    return Math.max(0, Math.min(1, sum / deck.peaks.length));
  }

  private estimateEnergy(buffer: AudioBuffer): number {
    const data = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(data.length / 120000));
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += stride) {
      const v = data[i];
      sumSq += v * v;
      count++;
    }
    if (count === 0) return 0.5;
    const rms = Math.sqrt(sumSq / count);
    return Math.max(0, Math.min(1, rms * 2.4));
  }

  private estimateKey(buffer: AudioBuffer): string {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const maxSamples = Math.min(data.length, sampleRate * 25);

    const profiles = {
      major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
      minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
    };

    const pcEnergy = new Array<number>(12).fill(0);
    const hop = 2048;

    for (let i = 0; i + hop < maxSamples; i += hop) {
      let crossings = 0;
      for (let j = i + 1; j < i + hop; j++) {
        if ((data[j - 1] <= 0 && data[j] > 0) || (data[j - 1] >= 0 && data[j] < 0)) crossings++;
      }
      const freq = (crossings * sampleRate) / (2 * hop);
      if (freq < 55 || freq > 1760) continue;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      const pc = ((midi % 12) + 12) % 12;
      pcEnergy[pc] += 1;
    }

    const rotate = (arr: number[], n: number): number[] => arr.map((_, i) => arr[(i + n) % arr.length]);
    const corr = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i], 0);

    let bestScore = -Infinity;
    let bestRoot = 0;
    let bestMode: 'maj' | 'min' = 'maj';

    for (let r = 0; r < 12; r++) {
      const majScore = corr(pcEnergy, rotate(profiles.major, r));
      const minScore = corr(pcEnergy, rotate(profiles.minor, r));
      if (majScore > bestScore) {
        bestScore = majScore;
        bestRoot = r;
        bestMode = 'maj';
      }
      if (minScore > bestScore) {
        bestScore = minScore;
        bestRoot = r;
        bestMode = 'min';
      }
    }

    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[bestRoot]} ${bestMode}`;
  }

  private parseKeyRoot(key: string): number | null {
    const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const token = key.split(' ')[0];
    const idx = roots.indexOf(token);
    return idx < 0 ? null : idx;
  }

  private keyDistance(a: number | null, b: number | null): number {
    if (a === null || b === null) return 3.5;
    let diff = Math.abs(a - b);
    if (diff > 6) diff = 12 - diff;
    return diff;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
