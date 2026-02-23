import { detectBPM } from '../audio/BPMDetector';
import type { Deck, DeckId } from '../audio/Deck';

interface TrackItem {
  id: string;
  file: File;
  name: string;
  size: string;
  bpm: number;
  key: string;
  energy: number;
  hue: number;
}

type LibraryView = 'library' | 'history' | 'playlists' | 'my-files' | 'downloaded' | 'neural-mix';
type TrackDisplayMode = 'grid' | 'compact' | 'list';

interface HistoryItem {
  deckId: DeckId;
  trackName: string;
  bpm: number;
  key: string;
  playedAt: number;
  trackIndex: number;
}

interface SmartPlaylist {
  name: string;
  description: string;
  trackIndices: number[];
}

interface ManualPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

interface StoredManualPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export class LibraryUI {
  private decks: Deck[];
  private el: HTMLElement;
  private tracks: TrackItem[] = [];
  private history: HistoryItem[] = [];
  private manualPlaylists: ManualPlaylist[] = [];
  private activeManualPlaylistId: string | null = null;
  private searchQuery = '';
  private trackDisplayMode: TrackDisplayMode = 'grid';
  private pageSize = 24;
  private currentPage = 1;
  private readonly playlistsStorageKey = 'webdj.manual.playlists.v1';

  private trackListEl!: HTMLElement;
  private matchEl!: HTMLElement;
  private dropZoneEl!: HTMLElement;
  private searchInputEl!: HTMLInputElement;
  private displayControlsEl!: HTMLElement;
  private pageSizeSelectEl!: HTMLSelectElement;
  private pagerInfoEl!: HTMLElement;
  private pagerSummaryEl!: HTMLElement;
  private pagerPrevEl!: HTMLButtonElement;
  private pagerNextEl!: HTMLButtonElement;
  private historyListEl!: HTMLElement;
  private playlistsListEl!: HTMLElement;
  private myFilesListEl!: HTMLElement;
  private downloadedListEl!: HTMLElement;
  private neuralMixListEl!: HTMLElement;
  private sidebarButtons = new Map<LibraryView, HTMLButtonElement>();
  private displayModeButtons = new Map<TrackDisplayMode, HTMLButtonElement>();

  constructor(container: HTMLElement, decks: Deck[]) {
    this.decks = decks;
    this.el = container;
    this.loadManualPlaylists();
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
            <div class="library-display-controls" id="library-display-controls">
              <div class="display-mode-group">
                <button class="display-mode-btn active" data-display-mode="grid" title="カード表示">GRID</button>
                <button class="display-mode-btn" data-display-mode="compact" title="高密度カード表示">COMPACT</button>
                <button class="display-mode-btn" data-display-mode="list" title="リスト表示">LIST</button>
              </div>
              <select class="library-page-size" id="library-page-size" title="1ページの表示件数">
                <option value="12">12 / page</option>
                <option value="24" selected>24 / page</option>
                <option value="48">48 / page</option>
                <option value="96">96 / page</option>
              </select>
            </div>
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
              <div class="track-grid mode-grid" id="track-list"></div>
              <div class="library-pager" id="library-pager">
                <button class="btn btn-mini btn-muted" id="library-page-prev">PREV</button>
                <span class="library-page-info" id="library-page-info">1/1</span>
                <button class="btn btn-mini btn-muted" id="library-page-next">NEXT</button>
                <span class="library-page-summary" id="library-page-summary">0 tracks</span>
              </div>
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
    this.displayControlsEl = this.el.querySelector('#library-display-controls') as HTMLElement;
    this.pageSizeSelectEl = this.el.querySelector('#library-page-size') as HTMLSelectElement;
    this.pagerInfoEl = this.el.querySelector('#library-page-info') as HTMLElement;
    this.pagerSummaryEl = this.el.querySelector('#library-page-summary') as HTMLElement;
    this.pagerPrevEl = this.el.querySelector('#library-page-prev') as HTMLButtonElement;
    this.pagerNextEl = this.el.querySelector('#library-page-next') as HTMLButtonElement;
    this.historyListEl = this.el.querySelector('#history-list')!;
    this.playlistsListEl = this.el.querySelector('#playlists-list')!;
    this.myFilesListEl = this.el.querySelector('#my-files-list')!;
    this.downloadedListEl = this.el.querySelector('#downloaded-list')!;
    this.neuralMixListEl = this.el.querySelector('#neural-mix-list')!;

    this.el.querySelectorAll<HTMLButtonElement>('.sidebar-item[data-view]').forEach((btn) => {
      const view = btn.dataset.view as LibraryView;
      this.sidebarButtons.set(view, btn);
    });

    this.el.querySelectorAll<HTMLButtonElement>('.display-mode-btn[data-display-mode]').forEach((btn) => {
      const mode = btn.dataset.displayMode as TrackDisplayMode;
      this.displayModeButtons.set(mode, btn);
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
      this.currentPage = 1;
      this.renderAllViews();
    });

    this.sidebarButtons.forEach((btn, view) => {
      btn.addEventListener('click', () => this.switchView(view));
    });

    this.displayModeButtons.forEach((btn, mode) => {
      btn.addEventListener('click', () => this.setTrackDisplayMode(mode));
    });

    this.pageSizeSelectEl.addEventListener('change', () => {
      const size = parseInt(this.pageSizeSelectEl.value, 10);
      if (Number.isNaN(size)) return;
      this.pageSize = Math.max(1, size);
      this.currentPage = 1;
      this.renderTracks(this.searchQuery);
    });

    this.pagerPrevEl.addEventListener('click', () => {
      if (this.currentPage <= 1) return;
      this.currentPage -= 1;
      this.renderTracks(this.searchQuery);
    });

    this.pagerNextEl.addEventListener('click', () => {
      this.currentPage += 1;
      this.renderTracks(this.searchQuery);
    });

    this.historyListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.playlistsListEl.addEventListener('click', (e) => {
      this.handlePlaylistClick(e);
      this.handleLoadButtonClick(e);
    });
    this.playlistsListEl.addEventListener('change', (e) => this.handlePlaylistChange(e));
    this.myFilesListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.downloadedListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.trackListEl.addEventListener('click', (e) => this.handleLoadButtonClick(e));
    this.neuralMixListEl.addEventListener('input', (e) => this.handleNeuralLevelInput(e));
    this.neuralMixListEl.addEventListener('click', (e) => this.handleNeuralActionClick(e));

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
    const customizable = view === 'library';
    this.searchInputEl.disabled = !searchable;
    this.searchInputEl.placeholder = searchable ? 'Search tracks...' : 'Search unavailable in this tab';
    this.displayControlsEl.classList.toggle('disabled', !customizable);
    this.pageSizeSelectEl.disabled = !customizable;
  }

  private setTrackDisplayMode(mode: TrackDisplayMode): void {
    if (this.trackDisplayMode === mode) return;
    this.trackDisplayMode = mode;
    this.currentPage = 1;
    this.updateDisplayModeButtons();
    this.renderTracks(this.searchQuery);
  }

  private updateDisplayModeButtons(): void {
    this.displayModeButtons.forEach((btn, mode) => {
      btn.classList.toggle('active', this.trackDisplayMode === mode);
    });
    this.trackListEl.classList.toggle('mode-grid', this.trackDisplayMode === 'grid');
    this.trackListEl.classList.toggle('mode-compact', this.trackDisplayMode === 'compact');
    this.trackListEl.classList.toggle('mode-list', this.trackDisplayMode === 'list');
  }

  private async addFiles(fileList: FileList): Promise<void> {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('audio/')) continue;
      const trackId = this.makeTrackId(file);
      const exists = this.tracks.some(
        (t) => t.id === trackId,
      );
      if (exists) continue;

      const analysis = await this.analyzeTrack(file);
      const hue = (this.tracks.length * 47 + file.name.length * 13) % 360;
      this.tracks.push({
        id: trackId,
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        size: this.formatSize(file.size),
        bpm: analysis.bpm,
        key: analysis.key,
        energy: analysis.energy,
        hue,
      });
    }

    this.cleanupManualPlaylists();
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
    const total = indices.length;
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(1, this.currentPage), maxPage);
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);
    const pageIndices = indices.slice(start, end);

    this.trackListEl.innerHTML = this.renderTrackEntries(pageIndices, total);
    this.pagerInfoEl.textContent = `${this.currentPage}/${maxPage}`;
    this.pagerSummaryEl.textContent = total === 0 ? '0 tracks' : `${start + 1}-${end} / ${total}`;
    const navDisabled = total === 0;
    this.pagerPrevEl.disabled = navDisabled || this.currentPage <= 1;
    this.pagerNextEl.disabled = navDisabled || this.currentPage >= maxPage;
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
    this.ensureActiveManualPlaylist();
    const playlists = this.getSmartPlaylists();
    const activePlaylist = this.manualPlaylists.find((pl) => pl.id === this.activeManualPlaylistId) || null;

    const playlistOptions = this.manualPlaylists
      .map(
        (pl) =>
          `<option value="${this.escapeHtml(pl.id)}" ${pl.id === this.activeManualPlaylistId ? 'selected' : ''}>${this.escapeHtml(pl.name)} (${pl.trackIds.length})</option>`,
      )
      .join('');

    const trackEditorRows =
      this.tracks.length === 0
        ? this.emptyState('No tracks imported', 'Import files to assign tracks to playlists.')
        : this.tracks
            .map((track, idx) => {
              const inActive = activePlaylist ? activePlaylist.trackIds.includes(track.id) : false;
              return `
                <div class="playlist-track-row">
                  <div class="playlist-track-main">
                    <div class="playlist-track-title">${this.escapeHtml(track.name)}</div>
                    <div class="playlist-track-meta">${track.bpm.toFixed(1)} BPM • ${this.escapeHtml(track.key)} • ${track.size}</div>
                  </div>
                  <button class="btn btn-mini ${inActive ? 'btn-warning' : 'btn-muted'}" data-pl-action="toggle-track" data-pl-id="${this.escapeHtml(activePlaylist?.id || '')}" data-pl-track-id="${this.escapeHtml(track.id)}" ${activePlaylist ? '' : 'disabled'}>
                    ${inActive ? 'REMOVE' : 'ADD'}
                  </button>
                  <div class="browser-actions">
                    ${this.renderDeckLoadButtons(idx)}
                  </div>
                </div>
              `;
            })
            .join('');

    const manualCards =
      this.manualPlaylists.length === 0
        ? this.emptyState('No manual playlists', 'Create one with a name and then add tracks.')
        : this.manualPlaylists
            .map((pl) => {
              const rows = pl.trackIds
                .map((trackId) => {
                  const idx = this.findTrackIndexById(trackId);
                  if (idx < 0) return '';
                  const track = this.tracks[idx];
                  return `
                    <div class="playlist-track-row">
                      <div class="playlist-track-main">
                        <div class="playlist-track-title">${this.escapeHtml(track.name)}</div>
                        <div class="playlist-track-meta">${track.bpm.toFixed(1)} BPM • ${this.escapeHtml(track.key)} • ${track.size}</div>
                      </div>
                      <button class="btn btn-mini btn-warning" data-pl-action="toggle-track" data-pl-id="${this.escapeHtml(pl.id)}" data-pl-track-id="${this.escapeHtml(track.id)}">
                        REMOVE
                      </button>
                      <div class="browser-actions">
                        ${this.renderDeckLoadButtons(idx)}
                      </div>
                    </div>
                  `;
                })
                .join('');

              return `
                <article class="playlist-card ${pl.id === this.activeManualPlaylistId ? 'is-active' : ''}">
                  <div class="playlist-head">
                    <strong>${this.escapeHtml(pl.name)}</strong>
                    <span>${pl.trackIds.length} tracks</span>
                  </div>
                  <div class="browser-meta">Manual playlist • saved locally</div>
                  <div class="playlist-card-actions">
                    <button class="btn btn-mini btn-muted" data-pl-action="select" data-pl-id="${this.escapeHtml(pl.id)}">EDIT</button>
                    <button class="btn btn-mini btn-warning" data-pl-action="delete" data-pl-id="${this.escapeHtml(pl.id)}">DELETE</button>
                  </div>
                  <div class="playlist-track-list">
                    ${rows || '<span class="browser-chip muted">No tracks in this playlist</span>'}
                  </div>
                </article>
              `;
            })
            .join('');

    const smartCards = playlists
      .map((pl) => {
        const rows = pl.trackIndices
          .map((idx) => {
            const track = this.tracks[idx];
            if (!track) return '';
            return `
              <div class="playlist-track-row">
                <div class="playlist-track-main">
                  <div class="playlist-track-title">${this.escapeHtml(track.name)}</div>
                  <div class="playlist-track-meta">${track.bpm.toFixed(1)} BPM • ${this.escapeHtml(track.key)} • ${track.size}</div>
                </div>
                <div class="browser-actions">
                  ${this.renderDeckLoadButtons(idx)}
                </div>
              </div>
            `;
          })
          .join('');
        return `
          <article class="playlist-card">
            <div class="playlist-head">
              <strong>${pl.name}</strong>
              <span>${pl.trackIndices.length} tracks</span>
            </div>
            <div class="browser-meta">${pl.description}</div>
            <div class="playlist-track-list">
              ${rows || '<span class="browser-chip muted">No matching tracks</span>'}
            </div>
          </article>
        `;
      })
      .join('');

    this.playlistsListEl.innerHTML = `
      <section class="playlist-section">
        <div class="playlist-section-head">
          <strong>Manual Playlists</strong>
          <span>Create / save / edit</span>
        </div>
        <div class="playlist-editor-toolbar">
          <input type="text" class="search-input playlist-name-input" id="playlist-name-input" placeholder="New playlist name">
          <button class="btn btn-mini btn-add-files" data-pl-action="create">CREATE</button>
          <select class="library-page-size playlist-select" id="playlist-select" ${this.manualPlaylists.length === 0 ? 'disabled' : ''}>
            ${playlistOptions || '<option value="">No playlist</option>'}
          </select>
          <button class="btn btn-mini btn-warning" data-pl-action="delete-selected" ${activePlaylist ? '' : 'disabled'}>DELETE SELECTED</button>
        </div>
        <div class="playlist-editor-grid">
          <div class="playlist-editor-column">
            <div class="playlist-editor-title">Track Assignment</div>
            <div class="playlist-track-list">
              ${trackEditorRows}
            </div>
          </div>
          <div class="playlist-editor-column">
            <div class="playlist-editor-title">Saved Manual Playlists</div>
            <div class="playlist-track-list">
              ${manualCards}
            </div>
          </div>
        </div>
      </section>
      <section class="playlist-section">
        <div class="playlist-section-head">
          <strong>Smart Playlists</strong>
          <span>Auto generated from BPM / energy</span>
        </div>
        <div class="playlist-track-list">
          ${smartCards}
        </div>
      </section>
    `;
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
        const hasTrack = Boolean(deck.trackName);
        const mode =
          deck.stemMode === 'analyzing'
            ? `Analyzing ${Math.round(deck.separationProgress * 100)}%`
            : deck.stemMode === 'none'
              ? 'Unavailable'
              : deck.stemMode.toUpperCase();
        const title = this.escapeHtml(deck.trackName || `Deck ${deck.id} empty`);
        const drums = hasTrack ? deck.getStemLevel('drums') : 0;
        const instruments = hasTrack ? deck.getStemLevel('instruments') : 0;
        const vocals = hasTrack ? deck.getStemLevel('vocals') : 0;
        const disabledAttr = hasTrack ? '' : 'disabled';
        return `
          <article class="neural-card">
            <div class="playlist-head">
              <strong>Deck ${deck.id}</strong>
              <span>${mode}</span>
            </div>
            <div class="browser-title">${title}</div>
            <div class="neural-bars">
              ${this.renderStemBar('Drums', drums)}
              ${this.renderStemBar('Inst', instruments)}
              ${this.renderStemBar('Vocals', vocals)}
            </div>
            <div class="neural-controls">
              <label class="neural-control-row">
                <span>Drums</span>
                <input type="range" min="0" max="100" value="${Math.round(drums * 100)}" data-neural-level-deck="${deck.id}" data-neural-level-stem="drums" ${disabledAttr}>
              </label>
              <label class="neural-control-row">
                <span>Inst</span>
                <input type="range" min="0" max="100" value="${Math.round(instruments * 100)}" data-neural-level-deck="${deck.id}" data-neural-level-stem="instruments" ${disabledAttr}>
              </label>
              <label class="neural-control-row">
                <span>Vocals</span>
                <input type="range" min="0" max="100" value="${Math.round(vocals * 100)}" data-neural-level-deck="${deck.id}" data-neural-level-stem="vocals" ${disabledAttr}>
              </label>
            </div>
            <div class="neural-preset-row">
              <button class="btn btn-mini btn-muted" data-neural-action="vocal-focus" data-neural-deck="${deck.id}" ${disabledAttr}>VOCAL FOCUS</button>
              <button class="btn btn-mini btn-muted" data-neural-action="drum-focus" data-neural-deck="${deck.id}" ${disabledAttr}>DRUM FOCUS</button>
              <button class="btn btn-mini btn-muted" data-neural-action="reset" data-neural-deck="${deck.id}" ${disabledAttr}>RESET</button>
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

  private handlePlaylistClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-pl-action]');
    if (!target) return;
    const action = target.dataset.plAction || '';
    const playlistId = target.dataset.plId || '';
    const trackId = target.dataset.plTrackId || '';

    if (action === 'create') {
      const input = this.playlistsListEl.querySelector<HTMLInputElement>('#playlist-name-input');
      const name = input?.value.trim() || '';
      if (!name) {
        this.emitStatus('Playlist name is required.');
        return;
      }
      this.createManualPlaylist(name);
      if (input) input.value = '';
      return;
    }

    if (action === 'delete-selected') {
      if (!this.activeManualPlaylistId) return;
      this.deleteManualPlaylist(this.activeManualPlaylistId);
      return;
    }

    if (action === 'delete' && playlistId) {
      this.deleteManualPlaylist(playlistId);
      return;
    }

    if (action === 'select' && playlistId) {
      this.activeManualPlaylistId = playlistId;
      this.renderPlaylists();
      return;
    }

    if (action === 'toggle-track' && playlistId && trackId) {
      this.toggleTrackInManualPlaylist(playlistId, trackId);
    }
  }

  private handlePlaylistChange(e: Event): void {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id !== 'playlist-select') return;
    const nextId = target.value || null;
    this.activeManualPlaylistId = nextId;
    this.renderPlaylists();
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

  private getSmartPlaylists(): SmartPlaylist[] {
    const warmup = this.indexTracks((t) => t.bpm < 110, 8);
    const groove = this.indexTracks((t) => t.bpm >= 110 && t.bpm < 124, 8);
    const peak = this.indexTracks((t) => t.bpm >= 124, 8);
    const recent = [...this.tracks.keys()].slice(Math.max(0, this.tracks.length - 8)).reverse();

    return [
      { name: 'Warmup Flow', description: 'Low BPM opening blend', trackIndices: warmup },
      { name: 'Main Groove', description: 'Mid-tempo dance set', trackIndices: groove },
      { name: 'Peak Time', description: 'High energy prime-time tracks', trackIndices: peak },
      { name: 'Recent Imports', description: 'Latest added tracks', trackIndices: recent },
    ];
  }

  private indexTracks(predicate: (track: TrackItem) => boolean, limit: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.tracks.length; i++) {
      if (!predicate(this.tracks[i])) continue;
      out.push(i);
      if (out.length >= limit) break;
    }
    return out;
  }

  private createManualPlaylist(name: string): void {
    const normalized = name.trim();
    if (!normalized) return;
    const id = `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.manualPlaylists.unshift({
      id,
      name: normalized,
      trackIds: [],
      createdAt: Date.now(),
    });
    this.activeManualPlaylistId = id;
    this.persistManualPlaylists();
    this.renderPlaylists();
    this.emitStatus(`Playlist "${normalized}" created.`);
  }

  private deleteManualPlaylist(id: string): void {
    const index = this.manualPlaylists.findIndex((pl) => pl.id === id);
    if (index < 0) return;
    const name = this.manualPlaylists[index].name;
    this.manualPlaylists.splice(index, 1);
    this.ensureActiveManualPlaylist();
    this.persistManualPlaylists();
    this.renderPlaylists();
    this.emitStatus(`Playlist "${name}" deleted.`);
  }

  private toggleTrackInManualPlaylist(playlistId: string, trackId: string): void {
    const playlist = this.manualPlaylists.find((pl) => pl.id === playlistId);
    if (!playlist) return;
    const index = playlist.trackIds.indexOf(trackId);
    if (index >= 0) {
      playlist.trackIds.splice(index, 1);
      this.emitStatus(`Removed track from "${playlist.name}".`);
    } else {
      playlist.trackIds.push(trackId);
      this.emitStatus(`Added track to "${playlist.name}".`);
    }
    this.persistManualPlaylists();
    this.renderPlaylists();
  }

  private ensureActiveManualPlaylist(): void {
    const activeExists =
      this.activeManualPlaylistId !== null && this.manualPlaylists.some((pl) => pl.id === this.activeManualPlaylistId);
    if (activeExists) return;
    this.activeManualPlaylistId = this.manualPlaylists[0]?.id || null;
  }

  private loadManualPlaylists(): void {
    try {
      const raw = localStorage.getItem(this.playlistsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredManualPlaylist[];
      if (!Array.isArray(parsed)) return;
      this.manualPlaylists = parsed
        .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.trackIds))
        .map((item) => ({
          id: item.id,
          name: item.name,
          trackIds: item.trackIds.filter((v) => typeof v === 'string'),
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        }));
      this.ensureActiveManualPlaylist();
    } catch {
      this.manualPlaylists = [];
      this.activeManualPlaylistId = null;
    }
  }

  private persistManualPlaylists(): void {
    const serializable: StoredManualPlaylist[] = this.manualPlaylists.map((pl) => ({
      id: pl.id,
      name: pl.name,
      trackIds: [...pl.trackIds],
      createdAt: pl.createdAt,
    }));
    localStorage.setItem(this.playlistsStorageKey, JSON.stringify(serializable));
  }

  private cleanupManualPlaylists(): void {
    if (this.manualPlaylists.length === 0) return;
    const validTrackIds = new Set(this.tracks.map((track) => track.id));
    this.manualPlaylists.forEach((pl) => {
      pl.trackIds = pl.trackIds.filter((id, idx, arr) => validTrackIds.has(id) && arr.indexOf(id) === idx);
    });
    this.persistManualPlaylists();
  }

  private makeTrackId(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  private findTrackIndexById(trackId: string): number {
    return this.tracks.findIndex((track) => track.id === trackId);
  }

  private handleNeuralLevelInput(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLInputElement>('[data-neural-level-deck][data-neural-level-stem]');
    if (!target) return;
    const deckId = target.dataset.neuralLevelDeck as DeckId;
    const stem = target.dataset.neuralLevelStem as 'drums' | 'instruments' | 'vocals';
    const deck = this.decks.find((d) => d.id === deckId);
    if (!deck || !deck.trackName) return;
    const value = parseInt(target.value, 10);
    if (Number.isNaN(value)) return;
    deck.setStemLevel(stem, value / 100);
  }

  private handleNeuralActionClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-neural-action][data-neural-deck]');
    if (!target) return;
    const deckId = target.dataset.neuralDeck as DeckId;
    const action = target.dataset.neuralAction;
    const deck = this.decks.find((d) => d.id === deckId);
    if (!deck || !deck.trackName) return;

    if (action === 'vocal-focus') {
      deck.setStemLevel('vocals', 1);
      deck.setStemLevel('instruments', 0.55);
      deck.setStemLevel('drums', 0.45);
      this.emitStatus(`Deck ${deck.id}: Vocal Focus preset`);
      return;
    }

    if (action === 'drum-focus') {
      deck.setStemLevel('drums', 1);
      deck.setStemLevel('instruments', 0.55);
      deck.setStemLevel('vocals', 0.35);
      this.emitStatus(`Deck ${deck.id}: Drum Focus preset`);
      return;
    }

    if (action === 'reset') {
      deck.setStemLevel('drums', 1);
      deck.setStemLevel('instruments', 1);
      deck.setStemLevel('vocals', 1);
      this.emitStatus(`Deck ${deck.id}: Neural levels reset`);
    }
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

  private renderTrackEntries(indices: number[], totalMatches: number): string {
    if (indices.length === 0) {
      if (this.tracks.length === 0) return '';
      return this.emptyState('No tracks in this page', totalMatches === 0 ? 'Try a different search keyword.' : 'Move to another page.');
    }
    if (this.trackDisplayMode === 'list') return this.renderTrackRows(indices);
    return this.renderTrackCards(indices, this.trackDisplayMode === 'compact');
  }

  private renderTrackCards(indices: number[], compact = false): string {
    return indices
      .map((idx) => {
        const track = this.tracks[idx];
        const title = this.escapeHtml(track.name);
        return `
          <div class="track-card${compact ? ' compact' : ''}">
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

  private renderTrackRows(indices: number[]): string {
    return indices
      .map((idx) => {
        const track = this.tracks[idx];
        const title = this.escapeHtml(track.name);
        return `
          <article class="track-row">
            <div class="track-row-main">
              <div class="track-row-title" title="${title}">${title}</div>
              <div class="track-row-meta">${track.bpm.toFixed(1)} BPM • ${this.escapeHtml(track.key)} • EN ${Math.round(track.energy * 100)} • ${track.size}</div>
            </div>
            <div class="track-load-row track-load-row-inline">
              ${this.renderDeckLoadButtons(idx)}
            </div>
          </article>
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
