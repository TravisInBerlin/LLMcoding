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

type LibraryView = 'library' | 'history' | 'playlists' | 'my-files' | 'downloaded' | 'neural-mix';

interface HistoryItem {
  deckId: DeckId;
  trackName: string;
  bpm: number;
  key: string;
  playedAt: number;
  trackIndex: number;
}

export class LibraryUI {
  private decks: Deck[];
  private el: HTMLElement;
  private tracks: TrackItem[] = [];
  private history: HistoryItem[] = [];
  private searchQuery = '';

  private trackListEl!: HTMLElement;
  private matchEl!: HTMLElement;
  private dropZoneEl!: HTMLElement;
  private searchInputEl!: HTMLInputElement;
  private historyListEl!: HTMLElement;
  private playlistsListEl!: HTMLElement;
  private myFilesListEl!: HTMLElement;
  private downloadedListEl!: HTMLElement;
  private neuralMixListEl!: HTMLElement;
  private sidebarButtons = new Map<LibraryView, HTMLButtonElement>();

  constructor(container: HTMLElement, decks: Deck[]) {
    this.decks = decks;
    this.el = container;
    this.render();
    this.bind();
    this.renderAllViews();
  }

  async importFiles(fileList: FileList): Promise<void> {
    await this.addFiles(fileList);
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
            <input type="file" id="file-picker" class="file-picker-input" multiple accept="audio/*">
          </div>
        </div>

        <div class="library-body">
          <aside class="library-sidebar">
            <button class="sidebar-item active" data-view="library">Library</button>
            <button class="sidebar-item" data-view="history">History</button>
            <button class="sidebar-item" data-view="playlists">Playlists</button>
            <button class="sidebar-item" data-view="my-files">My Files</button>
            <button class="sidebar-item" data-view="downloaded">Downloaded</button>
            <button class="sidebar-item" data-view="neural-mix">Neural Mix</button>
          </aside>

          <div class="library-content">
            <section class="library-view active" id="view-library">
              <div class="track-grid" id="track-list"></div>
              <div class="drop-zone" id="drop-zone">
                <div class="drop-zone-inner">
                  <span class="drop-copy">Drop audio files here</span>
                  <span class="drop-subcopy">Supports iPad Files / local storage / drag & drop</span>
                </div>
              </div>
            </section>

            <section class="library-view" id="view-history">
              <div class="browser-list" id="history-list"></div>
            </section>

            <section class="library-view" id="view-playlists">
              <div class="browser-list" id="playlists-list"></div>
            </section>

            <section class="library-view" id="view-my-files">
              <div class="browser-list" id="my-files-list"></div>
            </section>

            <section class="library-view" id="view-downloaded">
              <div class="browser-list" id="downloaded-list"></div>
            </section>

            <section class="library-view" id="view-neural-mix">
              <div class="browser-list" id="neural-mix-list"></div>
            </section>
          </div>
        </div>
      </div>
    `;

    this.trackListEl = this.el.querySelector('#track-list')!;
    this.matchEl = this.el.querySelector('#library-match')!;
    this.dropZoneEl = this.el.querySelector('#drop-zone')!;
    this.searchInputEl = this.el.querySelector('#search-input') as HTMLInputElement;
    this.historyListEl = this.el.querySelector('#history-list')!;
    this.playlistsListEl = this.el.querySelector('#playlists-list')!;
    this.myFilesListEl = this.el.querySelector('#my-files-list')!;
    this.downloadedListEl = this.el.querySelector('#downloaded-list')!;
    this.neuralMixListEl = this.el.querySelector('#neural-mix-list')!;

    this.el.querySelectorAll<HTMLButtonElement>('.sidebar-item[data-view]').forEach((btn) => {
      const view = btn.dataset.view as LibraryView;
      this.sidebarButtons.set(view, btn);
    });
  }

  private bind(): void {
    const filePicker = this.el.querySelector('#file-picker') as HTMLInputElement;

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
      if (filePicker.files) void this.importFiles(filePicker.files);
    });

    window.addEventListener('library-open-picker', () => {
      filePicker.click();
    });

    this.searchInputEl.addEventListener('input', () => {
      this.searchQuery = this.searchInputEl.value.trim().toLowerCase();
      this.renderAllViews();
    });

    this.sidebarButtons.forEach((btn, view) => {
      btn.addEventListener('click', () => this.switchView(view));
    });

    this.historyListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.myFilesListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.downloadedListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.trackListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));

    const updateMatch = () => this.renderMatchSuggestions();
    this.decks.forEach((deck) => {
      deck.on('loaded', () => {
        updateMatch();
        this.pushHistory(deck);
        this.renderHistory();
        this.renderNeuralMix();
      });
      deck.on('play', updateMatch);
      deck.on('bpm', updateMatch);
      deck.on('statechange', () => this.renderNeuralMix());
    });
  }

  private switchView(view: LibraryView): void {
    this.sidebarButtons.forEach((btn, key) => btn.classList.toggle('active', key === view));

    this.el.querySelectorAll<HTMLElement>('.library-view').forEach((panel) => {
      const isActive = panel.id === `view-${view}`;
      panel.classList.toggle('active', isActive);
    });

    const searchable = view === 'library' || view === 'my-files' || view === 'downloaded';
    this.searchInputEl.disabled = !searchable;
    this.searchInputEl.placeholder = searchable ? 'Search tracks...' : 'Search unavailable in this tab';
  }

  private async addFiles(fileList: FileList): Promise<void> {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('audio/')) continue;
      const exists = this.tracks.some(
        (t) => t.file.name === file.name && t.file.size === file.size && t.file.lastModified === file.lastModified,
      );
      if (exists) continue;

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

    this.renderAllViews();
    this.renderMatchSuggestions();
  }

  private renderAllViews(): void {
    this.renderTracks(this.searchQuery);
    this.renderHistory();
    this.renderPlaylists();
    this.renderMyFiles();
    this.renderDownloaded();
    this.renderNeuralMix();
    this.dropZoneEl.classList.toggle('hidden', this.tracks.length > 0);
  }

  private renderTracks(filter = ''): void {
    const indices = this.filteredTrackIndices(filter);
    this.trackListEl.innerHTML = this.renderTrackCards(indices);
  }

  private renderHistory(): void {
    if (this.history.length === 0) {
      this.historyListEl.innerHTML = this.emptyState('No history yet', 'Load tracks into decks to populate play history.');
      return;
    }

    this.historyListEl.innerHTML = this.history
      .map((entry) => {
        const title = this.escapeHtml(entry.trackName);
        const detail = `${entry.bpm > 0 ? entry.bpm.toFixed(1) : '--'} BPM • ${this.escapeHtml(entry.key)} • ${this.formatAgo(entry.playedAt)}`;
        return `
          <article class="browser-row">
            <div class="browser-main">
              <div class="browser-title">${title}</div>
              <div class="browser-meta">Deck ${entry.deckId} • ${detail}</div>
            </div>
            <div class="browser-actions">
              ${this.renderDeckLoadButtons(entry.trackIndex, entry.trackIndex < 0)}
            </div>
          </article>
        `;
      })
      .join('');
  }

  private renderPlaylists(): void {
    if (this.tracks.length === 0) {
      this.playlistsListEl.innerHTML = this.emptyState('No playlists yet', 'Add tracks first and smart playlists appear here.');
      return;
    }

    const warmup = this.tracks.filter((t) => t.bpm < 110).slice(0, 6);
    const groove = this.tracks.filter((t) => t.bpm >= 110 && t.bpm < 124).slice(0, 6);
    const peak = this.tracks.filter((t) => t.bpm >= 124).slice(0, 6);

    const playlists = [
      { name: 'Warmup Flow', tracks: warmup, description: 'Low BPM opening blend' },
      { name: 'Main Groove', tracks: groove, description: 'Mid-tempo dance set' },
      { name: 'Peak Time', tracks: peak, description: 'High energy prime-time tracks' },
    ];

    this.playlistsListEl.innerHTML = playlists
      .map((pl) => {
        const samples = pl.tracks.map((t) => `<span class="browser-chip">${this.escapeHtml(t.name)}</span>`).join('');
        return `
          <article class="playlist-card">
            <div class="playlist-head">
              <strong>${pl.name}</strong>
              <span>${pl.tracks.length} tracks</span>
            </div>
            <div class="browser-meta">${pl.description}</div>
            <div class="browser-chip-row">${samples || '<span class="browser-chip muted">No matching tracks</span>'}</div>
          </article>
        `;
      })
      .join('');
  }

  private renderMyFiles(): void {
    const indices = this.filteredTrackIndices(this.searchQuery);
    if (indices.length === 0) {
      this.myFilesListEl.innerHTML = this.emptyState('No files found', 'Import files or clear the search filter.');
      return;
    }

    this.myFilesListEl.innerHTML = indices
      .map((idx) => {
        const track = this.tracks[idx];
        return `
          <article class="browser-row">
            <div class="browser-main">
              <div class="browser-title">${this.escapeHtml(track.name)}</div>
              <div class="browser-meta">${track.bpm.toFixed(1)} BPM • ${this.escapeHtml(track.key)} • ${track.size}</div>
            </div>
            <div class="browser-actions">
              ${this.renderDeckLoadButtons(idx)}
            </div>
          </article>
        `;
      })
      .join('');
  }

  private renderDownloaded(): void {
    const indices = this.filteredTrackIndices(this.searchQuery).slice().reverse();
    if (indices.length === 0) {
      this.downloadedListEl.innerHTML = this.emptyState('No downloaded cache', 'Imported tracks are shown here as offline-ready items.');
      return;
    }

    this.downloadedListEl.innerHTML = indices
      .map((idx) => {
        const track = this.tracks[idx];
        return `
          <article class="browser-row">
            <div class="browser-main">
              <div class="browser-title">${this.escapeHtml(track.name)}</div>
              <div class="browser-meta">Cached • ${track.size} • EN ${Math.round(track.energy * 100)}</div>
            </div>
            <div class="browser-actions">
              ${this.renderDeckLoadButtons(idx)}
            </div>
          </article>
        `;
      })
      .join('');
  }

  private renderNeuralMix(): void {
    this.neuralMixListEl.innerHTML = this.decks
      .map((deck) => {
        const mode =
          deck.stemMode === 'analyzing'
            ? `Analyzing ${Math.round(deck.separationProgress * 100)}%`
            : deck.stemMode === 'none'
              ? 'Unavailable'
              : deck.stemMode.toUpperCase();
        const title = this.escapeHtml(deck.trackName || `Deck ${deck.id} empty`);
        return `
          <article class="neural-card">
            <div class="playlist-head">
              <strong>Deck ${deck.id}</strong>
              <span>${mode}</span>
            </div>
            <div class="browser-title">${title}</div>
            <div class="neural-bars">
              ${this.renderStemBar('Drums', deck.getStemLevel('drums'))}
              ${this.renderStemBar('Inst', deck.getStemLevel('instruments'))}
              ${this.renderStemBar('Vocals', deck.getStemLevel('vocals'))}
            </div>
          </article>
        `;
      })
      .join('');
  }

  private renderStemBar(label: string, level: number): string {
    const pct = Math.round(level * 100);
    return `
      <div class="neural-row">
        <span>${label}</span>
        <div class="neural-meter"><i style="width:${pct}%"></i></div>
        <span>${pct}%</span>
      </div>
    `;
  }

  private pushHistory(deck: Deck): void {
    if (!deck.trackName) return;
    const now = Date.now();
    const index = this.tracks.findIndex((track) => track.name === deck.trackName);
    const previous = this.history[0];
    if (previous && previous.deckId === deck.id && previous.trackName === deck.trackName && now - previous.playedAt < 1500) return;

    this.history.unshift({
      deckId: deck.id,
      trackName: deck.trackName,
      bpm: deck.bpm,
      key: deck.musicalKey,
      playedAt: now,
      trackIndex: index,
    });

    if (this.history.length > 60) this.history.length = 60;
  }

  private handleLoadButtonClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-load-deck][data-track-index]');
    if (!target) return;

    const idx = parseInt(target.dataset.trackIndex || '-1', 10);
    const deckId = target.dataset.loadDeck as DeckId;
    const deck = this.decks.find((d) => d.id === deckId);
    if (!deck || idx < 0 || !this.tracks[idx]) return;
    const track = this.tracks[idx];
    void deck
      .loadFile(track.file)
      .then(() => {
        this.emitStatus(`Loaded "${track.name}" to Deck ${deckId}`);
      })
      .catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : 'unsupported or corrupted audio';
        this.emitStatus(`Load failed: ${track.name} (${reason})`);
      });
  }

  private filteredTrackIndices(filter = ''): number[] {
    const query = filter.trim().toLowerCase();
    const indices: number[] = [];
    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      if (!query || track.name.toLowerCase().includes(query)) indices.push(i);
    }
    return indices;
  }

  private renderTrackCards(indices: number[]): string {
    return indices
      .map((idx) => {
        const track = this.tracks[idx];
        const title = this.escapeHtml(track.name);
        return `
          <div class="track-card">
            <div class="track-art" style="--track-hue:${track.hue}">
              <span class="track-art-letter">${title.charAt(0) || '♪'}</span>
            </div>
            <div class="track-info">
              <div class="track-name" title="${title}">${title}</div>
              <div class="track-meta">${track.bpm.toFixed(1)} BPM • ${track.key} • EN ${Math.round(track.energy * 100)} • ${track.size}</div>
            </div>
            <div class="track-load-row">
              ${this.renderDeckLoadButtons(idx)}
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderDeckLoadButtons(trackIndex: number, disabled = false): string {
    return this.decks
      .map((deck) => {
        const attrs = disabled ? 'disabled' : `data-load-deck="${deck.id}" data-track-index="${trackIndex}"`;
        return `<button class="btn btn-load-${deck.id.toLowerCase()}" ${attrs}>${deck.id}</button>`;
      })
      .join('');
  }

  private emptyState(title: string, copy: string): string {
    return `
      <div class="browser-empty">
        <strong>${this.escapeHtml(title)}</strong>
        <span>${this.escapeHtml(copy)}</span>
      </div>
    `;
  }

  private formatAgo(when: number): string {
    const sec = Math.max(1, Math.floor((Date.now() - when) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}h ago`;
    return `${Math.floor(hour / 24)}d ago`;
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

  private emitStatus(message: string): void {
    window.dispatchEvent(new CustomEvent('status-message', { detail: { message } }));
  }
}
