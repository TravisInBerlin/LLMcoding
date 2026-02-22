import { detectBPM } from '../audio/BPMDetector';
import type { Deck, DeckId } from '../audio/Deck';

interface TrackItem {
  file: File;
  name: string;
  size: string;
  bpm: number;
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
            <span class="library-title">LIBRARY + MATCH</span>
            <span class="library-match" id="library-match">Match: load tracks to get suggestions.</span>
          </div>
          <div class="library-actions">
            <input type="text" class="search-input" id="search-input" placeholder="Search tracks...">
            <label class="btn btn-add-files" for="file-picker">+ Add Files</label>
            <input type="file" id="file-picker" multiple accept="audio/*" style="display:none">
          </div>
        </div>

        <div class="drop-zone" id="drop-zone">
          <div class="drop-zone-inner">
            <span class="drop-copy">Drop audio files here</span>
            <span class="drop-subcopy">Supports iPad Files / local storage / drag & drop</span>
          </div>
        </div>

        <div class="track-grid" id="track-list"></div>
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
      const bpm = await this.estimateBpm(file);
      const hue = (this.tracks.length * 47 + file.name.length * 13) % 360;
      this.tracks.push({
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        size: this.formatSize(file.size),
        bpm,
        hue,
      });
    }

    this.renderTracks();
    this.renderMatchSuggestions();
    this.dropZoneEl.classList.toggle('hidden', this.tracks.length > 0);
  }

  private async estimateBpm(file: File): Promise<number> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const tempCtx = new AudioContext();
      const decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
      const bpm = detectBPM(decoded);
      await tempCtx.close();
      return bpm;
    } catch {
      return 120;
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
              <div class="track-meta">${track.bpm.toFixed(1)} BPM • ${track.size}</div>
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

    const matches = this.tracks
      .map((track) => ({
        track,
        score: Math.abs(track.bpm - activeDeck.bpm),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((m) => `${m.track.name} (${m.track.bpm.toFixed(1)} BPM)`);

    this.matchEl.textContent = `Match for Deck ${activeDeck.id} (${activeDeck.bpm.toFixed(1)} BPM): ${matches.join(' / ')}`;
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
