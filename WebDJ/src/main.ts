import { AudioEngine } from './audio/AudioEngine';
import { Deck, type DeckId } from './audio/Deck';
import { Crossfader } from './audio/Crossfader';
import {
  AUTO_DROP_ROUTES,
  getAutoDropPair,
  isAutoDropRoute,
  runAutoDropTransition,
  type AutoDropRoute,
  type TransitionStyle,
} from './audio/AutoDrop';
import { isSfxName, triggerSfx } from './audio/SfxEngine';
import { DeckUI } from './ui/DeckUI';
import { MixerUI } from './ui/MixerUI';
import { LibraryUI } from './ui/LibraryUI';
import { MidiController, type MidiLearnTarget } from './midi/MidiController';
import type { WaveformMode } from './visualizer/Waveform';
import './style.css';

let transitionStyle: TransitionStyle = 'smooth';
type CueDeckId = 'A' | 'B';

type SinkCapableMediaElement = HTMLMediaElement & {
  setSinkId: (sinkId: string) => Promise<void>;
};
type SelectOutputCapableMediaDevices = MediaDevices & {
  selectAudioOutput: () => Promise<MediaDeviceInfo>;
};

const engine = new AudioEngine();
const deckIds: DeckId[] = ['A', 'B', 'C', 'D'];

const decks = deckIds.map((id) => new Deck(engine, id));
const deckMap = new Map<DeckId, Deck>(decks.map((d) => [d.id, d]));

const crossfader = new Crossfader(deckMap.get('A')!.crossfadeGain, deckMap.get('B')!.crossfadeGain);
crossfader.onChange((pos) => {
  enforceCrossfadeOutput(pos);
  applyCrossfaderFusion(pos);
});

const root = document.querySelector<HTMLDivElement>('#app')!;
root.classList.add('mode-2');
const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
const autoDropRouteLabels: Record<AutoDropRoute, string> = {
  'A-B': 'AUTO: A -> B',
  'B-A': 'AUTO: B -> A',
  'C-D': 'AUTO: C -> D',
  'D-C': 'AUTO: D -> C',
};
if (isTouch) root.classList.add('touch-mode');
if (isIPad) root.classList.add('ipad-mode');
root.innerHTML = `
  <header class="app-header">
    <div class="topbar-left">
      <span class="logo-text">WebDJ NEXUS</span>
      <span class="header-badge" id="status-badge">Ready to mix</span>
    </div>
    <div class="topbar-center">
      <button class="btn btn-mini btn-muted topbar-toggle" id="deck-mode-btn" title="2デッキ/4デッキを切り替えます">4 DECK</button>
      <button class="btn btn-mini btn-muted topbar-toggle" id="waveform-mode-btn" title="波形表示を横/縦で切り替えます">WAVE: H</button>
      <button class="btn btn-mini btn-muted topbar-toggle" id="library-toggle-btn" title="ライブラリパネルの表示/非表示を切り替えます">LIB: ON</button>
      <select id="auto-drop-route" class="midi-learn-select auto-drop-route-select" title="AUTO DROPの遷移方向を選択します">
        ${AUTO_DROP_ROUTES.map((route) => `<option value="${route}">${autoDropRouteLabels[route]}</option>`).join('')}
      </select>
      <button class="btn btn-mini btn-accent" id="auto-drop-btn" title="選択したペアで自動トランジションを一回実行します">AUTO DROP</button>
    </div>
    <div class="topbar-right">
      <button class="btn btn-mini btn-muted settings-btn" id="settings-btn" title="MIDI/CUE/機能設定">FEATURES</button>
      <button class="btn btn-mini btn-cue rec-btn" id="record-btn" title="マスター出力の録音開始/停止">REC START</button>
    </div>
    <div class="settings-popover hidden-control" id="settings-popover">
      <div class="settings-grid">
        <button class="btn btn-mini btn-muted" id="midi-btn" title="MIDIコントローラーを接続/切断します">MIDI CONNECT</button>
        <button class="btn btn-mini btn-muted" id="cue-init-btn" title="ヘッドホンCUE出力を有効化します">CUE OUT</button>
        <select id="cue-output-select" class="midi-learn-select cue-output-select" title="CUEの出力先オーディオデバイスを選びます">
          <option value="default">CUE: Default Device</option>
        </select>
        <button class="btn btn-mini btn-muted" id="cue-refresh-btn" title="出力デバイスを再取得します">OUTPUT SCAN</button>
        <button class="btn btn-mini btn-muted" id="cue-a-btn" title="Deck AをヘッドホンCUEへ送ります">CUE A OFF</button>
        <button class="btn btn-mini btn-muted" id="cue-b-btn" title="Deck BをヘッドホンCUEへ送ります">CUE B OFF</button>
        <select id="cue-level-select" class="midi-learn-select cue-level-select" title="ヘッドホンCUE音量">
          <option value="0.55">CUE LV 55%</option>
          <option value="0.7" selected>CUE LV 70%</option>
          <option value="0.85">CUE LV 85%</option>
          <option value="1">CUE LV 100%</option>
        </select>
        <select id="midi-learn-target" class="midi-learn-select" title="MIDI LEARNで割り当てる操作を選択します">
          <option value="playA">Learn: Play A</option>
          <option value="playB">Learn: Play B</option>
          <option value="cueA">Learn: Cue A</option>
          <option value="cueB">Learn: Cue B</option>
          <option value="syncA">Learn: Sync A</option>
          <option value="syncB">Learn: Sync B</option>
          <option value="keyA">Learn: Key A</option>
          <option value="keyB">Learn: Key B</option>
          <option value="crossfader">Learn: Crossfader</option>
          <option value="volA">Learn: Volume A</option>
          <option value="volB">Learn: Volume B</option>
          <option value="tempoA">Learn: Tempo A</option>
          <option value="tempoB">Learn: Tempo B</option>
          <option value="filterA">Learn: Filter A</option>
          <option value="filterB">Learn: Filter B</option>
          <option value="stemVocalA">Learn: Vocal A</option>
          <option value="stemVocalB">Learn: Vocal B</option>
          <option value="stemDrumsA">Learn: Drums A</option>
          <option value="stemDrumsB">Learn: Drums B</option>
          <option value="stemInstA">Learn: Inst A</option>
          <option value="stemInstB">Learn: Inst B</option>
        </select>
        <button class="btn btn-mini btn-muted" id="midi-learn-btn" title="選択した操作を次に受けたMIDI信号へ割り当てます">MIDI LEARN</button>
        <button class="btn btn-mini btn-muted" id="midi-learn-cancel-btn" title="MIDI学習モードを中断します">LEARN CANCEL</button>
        <button class="btn btn-mini btn-muted" id="mixer-toggle-btn" title="中央MIXERの表示/非表示を切り替えます">MIXER HIDE</button>
        <select id="transition-style" class="midi-learn-select transition-select" title="クロスフェード時のミックス特性を選びます">
          <option value="smooth">XFADE: SMOOTH</option>
          <option value="power">XFADE: POWER</option>
          <option value="neural">XFADE: NEURAL</option>
        </select>
        <button class="btn btn-mini btn-muted" id="guide-toggle-btn" title="操作ガイドの表示/非表示を切り替えます">GUIDE</button>
        <button class="btn btn-mini btn-key" id="automix-btn" title="定期自動ミックスのON/OFFを切り替えます">AUTOMIX OFF</button>
      </div>
    </div>
  </header>

  <section class="guide-panel" id="guide-panel">
    <span><strong>1.</strong> Add Files でライブラリに曲を追加</span>
    <span><strong>2.</strong> A/B ボタンでデッキにロード</span>
    <span><strong>3.</strong> PLAY + SYNC で再生開始</span>
    <span><strong>4.</strong> XY PAD で Filter/Reverb を同時操作</span>
    <span><strong>5.</strong> 中央クロスフェーダーでミックス</span>
    <span><strong>6.</strong> MIDI LEARN は ESC または LEARN CANCEL で中断</span>
  </section>

  <main class="dj-stage">
    <section class="stage-row primary-row">
      <section class="deck-container deck-slot-a" id="deck-a-container"></section>
      <section class="center-container mixer-slot" id="mixer-container"></section>
      <section class="deck-container deck-slot-b" id="deck-b-container"></section>
    </section>

    <section class="stage-row aux-row" id="aux-row">
      <section class="deck-container deck-slot-c" id="deck-c-container"></section>
      <section class="deck-container deck-slot-d" id="deck-d-container"></section>
    </section>
  </main>

  <input type="file" id="global-file-picker" class="file-picker-input" multiple accept="audio/*">
  <section class="library-container" id="library-container"></section>
  <button class="btn btn-accent quick-import-fab" id="quick-import-btn" title="曲を取り込む">+ ADD FILES</button>
`;

const accentMap: Record<DeckId, string> = {
  A: '#20c9ff',
  B: '#ff4e92',
  C: '#76df38',
  D: '#ffc659',
};

const deckUIs = new Map<DeckId, DeckUI>();
deckIds.forEach((id) => {
  const container = document.getElementById(`deck-${id.toLowerCase()}-container`)!;
  deckUIs.set(id, new DeckUI(container, deckMap.get(id)!, accentMap[id]));
});

new MixerUI(document.getElementById('mixer-container')!, decks, crossfader);
const libraryUI = new LibraryUI(document.getElementById('library-container')!, decks);

let deckMode: 2 | 4 = 2;
let waveformMode: WaveformMode = 'horizontal';
let mixerVisible = true;
let libraryVisible = true;

const deckModeBtn = document.getElementById('deck-mode-btn') as HTMLButtonElement;
const waveformModeBtn = document.getElementById('waveform-mode-btn') as HTMLButtonElement;
const autoDropRouteSelect = document.getElementById('auto-drop-route') as HTMLSelectElement;
const transitionStyleSelect = document.getElementById('transition-style') as HTMLSelectElement;
const autoDropBtn = document.getElementById('auto-drop-btn') as HTMLButtonElement;
const automixBtn = document.getElementById('automix-btn') as HTMLButtonElement;
const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsPopover = document.getElementById('settings-popover') as HTMLDivElement;
const midiBtn = document.getElementById('midi-btn') as HTMLButtonElement;
const cueInitBtn = document.getElementById('cue-init-btn') as HTMLButtonElement;
const cueOutputSelect = document.getElementById('cue-output-select') as HTMLSelectElement;
const cueRefreshBtn = document.getElementById('cue-refresh-btn') as HTMLButtonElement;
const cueABtn = document.getElementById('cue-a-btn') as HTMLButtonElement;
const cueBBtn = document.getElementById('cue-b-btn') as HTMLButtonElement;
const cueLevelSelect = document.getElementById('cue-level-select') as HTMLSelectElement;
const midiLearnBtn = document.getElementById('midi-learn-btn') as HTMLButtonElement;
const midiLearnCancelBtn = document.getElementById('midi-learn-cancel-btn') as HTMLButtonElement;
const midiLearnTarget = document.getElementById('midi-learn-target') as HTMLSelectElement;
const mixerToggleBtn = document.getElementById('mixer-toggle-btn') as HTMLButtonElement;
const libraryToggleBtn = document.getElementById('library-toggle-btn') as HTMLButtonElement;
const quickImportBtn = document.getElementById('quick-import-btn') as HTMLButtonElement;
const globalFilePicker = document.getElementById('global-file-picker') as HTMLInputElement;
const guideToggleBtn = document.getElementById('guide-toggle-btn') as HTMLButtonElement;
const statusBadge = document.getElementById('status-badge') as HTMLSpanElement;
const guidePanel = document.getElementById('guide-panel') as HTMLElement;
midiLearnCancelBtn.disabled = true;
midiLearnCancelBtn.classList.add('hidden-control');

const cueMonitorEl = document.createElement('audio');
cueMonitorEl.autoplay = true;
cueMonitorEl.setAttribute('playsinline', '');
cueMonitorEl.preload = 'auto';
cueMonitorEl.srcObject = engine.cueStream;
cueMonitorEl.className = 'cue-monitor-audio';
cueMonitorEl.setAttribute('aria-hidden', 'true');
root.appendChild(cueMonitorEl);

const hasSetSinkId = (el: HTMLMediaElement): el is SinkCapableMediaElement =>
  typeof (el as Partial<SinkCapableMediaElement>).setSinkId === 'function';
const hasSelectAudioOutput = (devices: MediaDevices): devices is SelectOutputCapableMediaDevices =>
  typeof (devices as Partial<SelectOutputCapableMediaDevices>).selectAudioOutput === 'function';
const isSetSinkIdSupported = hasSetSinkId(cueMonitorEl);
const cueEnabledDecks: Record<CueDeckId, boolean> = { A: false, B: false };
let cueMonitorReady = false;

const updateCueInitButton = (): void => {
  cueInitBtn.classList.toggle('active', cueMonitorReady);
  cueInitBtn.textContent = cueMonitorReady ? 'CUE ON' : 'CUE OUT';
  cueInitBtn.setAttribute('aria-pressed', String(cueMonitorReady));
};

const updateCueDeckButton = (deckId: CueDeckId): void => {
  const isOn = cueEnabledDecks[deckId];
  const btn = deckId === 'A' ? cueABtn : cueBBtn;
  btn.textContent = `CUE ${deckId} ${isOn ? 'ON' : 'OFF'}`;
  btn.classList.toggle('active', isOn);
  btn.setAttribute('aria-pressed', String(isOn));
};

const updateCueButtons = (): void => {
  updateCueDeckButton('A');
  updateCueDeckButton('B');
};

const populateCueOutputs = async (): Promise<void> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    cueOutputSelect.innerHTML = '<option value="default">CUE: Default Device</option>';
    cueOutputSelect.disabled = true;
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((device) => device.kind === 'audiooutput');
    cueOutputSelect.innerHTML = '';
    if (outputs.length === 0) {
      const option = document.createElement('option');
      option.value = 'default';
      option.textContent = 'CUE: Default Device';
      cueOutputSelect.appendChild(option);
    }

    outputs.forEach((device, idx) => {
      const option = document.createElement('option');
      option.value = device.deviceId || 'default';
      option.textContent = `CUE: ${device.label?.trim() || `Output ${idx + 1}`}`;
      cueOutputSelect.appendChild(option);
    });
    cueOutputSelect.disabled = !isSetSinkIdSupported;
  } catch {
    cueOutputSelect.innerHTML = '<option value="default">CUE: Default Device</option>';
    cueOutputSelect.disabled = !isSetSinkIdSupported;
  }
};

const unlockOutputDeviceLabels = async (): Promise<void> => {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // Permission denied is okay; we still try enumerateDevices afterwards.
  }
};

const scanCueOutputs = async (): Promise<void> => {
  await unlockOutputDeviceLabels();
  await populateCueOutputs();

  const count = cueOutputSelect.options.length;
  if (count <= 1) {
    if (!isSetSinkIdSupported) {
      statusBadge.textContent = 'CUE output split is unsupported in this browser (setSinkId unavailable)';
    } else {
      statusBadge.textContent = 'Only default output found. Connect audio interface/headphones and scan again.';
    }
    return;
  }
  statusBadge.textContent = `CUE outputs detected: ${count}`;
};

const initCueMonitor = async (): Promise<boolean> => {
  try {
    await engine.resume();
    cueMonitorEl.srcObject = engine.cueStream;
    await cueMonitorEl.play();
    cueMonitorReady = true;
    updateCueInitButton();
    return true;
  } catch (error) {
    cueMonitorReady = false;
    updateCueInitButton();
    const message = error instanceof Error ? error.message : 'failed';
    statusBadge.textContent = `CUE init failed: ${message}`;
    return false;
  }
};

const disableCueMonitor = (): void => {
  (Object.keys(cueEnabledDecks) as CueDeckId[]).forEach((deckId) => {
    cueEnabledDecks[deckId] = false;
    deckMap.get(deckId)?.setCueEnabled(false);
  });
  updateCueButtons();
  cueMonitorEl.pause();
  cueMonitorEl.srcObject = null;
  cueMonitorReady = false;
  updateCueInitButton();
  statusBadge.textContent = 'Headphone CUE disabled';
};

const setCueSink = async (sinkId: string): Promise<void> => {
  if (!isSetSinkIdSupported) {
    statusBadge.textContent = 'setSinkId unsupported: browser only uses default output';
    return;
  }
  if (!cueMonitorReady) {
    const ok = await initCueMonitor();
    if (!ok) return;
  }

  try {
    if (!hasSetSinkId(cueMonitorEl)) {
      statusBadge.textContent = 'setSinkId unsupported: browser only uses default output';
      return;
    }
    await cueMonitorEl.setSinkId(sinkId);
    const selectedLabel = cueOutputSelect.options[cueOutputSelect.selectedIndex]?.textContent ?? 'CUE output changed';
    statusBadge.textContent = selectedLabel.replace(/^CUE:\s*/, 'CUE output: ');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';
    statusBadge.textContent = `CUE output switch failed: ${message}`;
  }
};

const setDeckCue = async (deckId: CueDeckId, enabled: boolean): Promise<void> => {
  const deck = deckMap.get(deckId);
  if (!deck) return;
  if (enabled && !cueMonitorReady) {
    const ok = await initCueMonitor();
    if (!ok) return;
  }

  cueEnabledDecks[deckId] = enabled;
  deck.setCueEnabled(enabled);
  updateCueDeckButton(deckId);
  const activeDecks = (Object.entries(cueEnabledDecks) as [CueDeckId, boolean][])
    .filter(([, on]) => on)
    .map(([id]) => id)
    .join(' / ');
  statusBadge.textContent = activeDecks ? `Headphone CUE: ${activeDecks}` : 'Headphone CUE: OFF';
};

engine.setCueLevel(Number(cueLevelSelect.value || '0.7'));
deckMap.get('A')?.setCueLevel(1);
deckMap.get('B')?.setCueLevel(1);
cueInitBtn.disabled = false;
cueOutputSelect.disabled = !isSetSinkIdSupported;
updateCueInitButton();
updateCueButtons();
void populateCueOutputs();
if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    void populateCueOutputs();
  });
}

window.addEventListener(
  'sfx-trigger',
  ((e: CustomEvent) => {
    const raw = e.detail?.sfx;
    if (!isSfxName(raw)) return;
    void triggerSfx(engine, raw);
    statusBadge.textContent = `DJ FX: ${raw.toUpperCase()}`;
  }) as EventListener,
);

const applyDeckMode = (): void => {
  root.classList.toggle('mode-2', deckMode === 2);
  root.classList.toggle('mode-4', deckMode === 4);
  deckModeBtn.textContent = deckMode === 2 ? '4 DECK' : '2 DECK';
  const auxRow = document.getElementById('aux-row') as HTMLElement | null;
  const deckC = document.getElementById('deck-c-container') as HTMLElement | null;
  const deckD = document.getElementById('deck-d-container') as HTMLElement | null;
  if (auxRow) {
    auxRow.style.display = deckMode === 4 ? 'grid' : 'none';
  }
  if (deckC) deckC.style.display = deckMode === 4 ? '' : 'none';
  if (deckD) deckD.style.display = deckMode === 4 ? '' : 'none';
  statusBadge.textContent = deckMode === 4 ? 'Deck mode: 4 Deck' : 'Deck mode: 2 Deck';
};

const applyWaveformMode = (): void => {
  deckUIs.forEach((ui) => ui.setWaveformMode(waveformMode));
  waveformModeBtn.textContent = waveformMode === 'horizontal' ? 'WAVE: H' : 'WAVE: V';
};

const applyMixerVisibility = (): void => {
  root.classList.toggle('mixer-hidden', !mixerVisible);
  mixerToggleBtn.textContent = mixerVisible ? 'MIXER HIDE' : 'MIXER SHOW';
};

const applyLibraryVisibility = (): void => {
  root.classList.toggle('library-hidden', !libraryVisible);
  libraryToggleBtn.textContent = libraryVisible ? 'LIB: ON' : 'LIB: OFF';
};

const setSettingsOpen = (open: boolean): void => {
  settingsPopover.classList.toggle('hidden-control', !open);
  settingsBtn.classList.toggle('active', open);
  settingsBtn.setAttribute('aria-expanded', String(open));
};

const openFileImport = (): void => {
  if (!libraryVisible) {
    libraryVisible = true;
    applyLibraryVisibility();
  }
  if (globalFilePicker) {
    globalFilePicker.value = '';
    globalFilePicker.click();
  }
  statusBadge.textContent = 'Choose audio files to import';
};

applyDeckMode();
applyWaveformMode();
applyMixerVisibility();
applyLibraryVisibility();
setSettingsOpen(false);

(['A', 'B'] as DeckId[]).forEach((id) => {
  const deck = deckMap.get(id);
  if (!deck) return;
  const syncOutput = () => enforceCrossfadeOutput(crossfader.position);
  deck.on('play', syncOutput);
  deck.on('pause', syncOutput);
});

if (isIPad) {
  statusBadge.textContent = 'iPad touch / low latency';
}

if (localStorage.getItem('webdj.guide.hidden') !== '0') {
  guidePanel.classList.remove('active');
  guideToggleBtn.classList.remove('active');
} else {
  guidePanel.classList.add('active');
  guideToggleBtn.classList.add('active');
}

window.addEventListener(
  'status-message',
  ((e: CustomEvent) => {
    const message = typeof e.detail?.message === 'string' ? e.detail.message.trim() : '';
    if (!message) return;
    statusBadge.textContent = message;
  }) as EventListener,
);

window.addEventListener(
  'sync-request',
  ((e: CustomEvent) => {
    const sourceId = e.detail.deckId as DeckId;
    const sourceDeck = deckMap.get(sourceId);
    if (!sourceDeck) return;

    const targetDeck = decks
      .filter((d) => d.id !== sourceId && d.bpm > 0)
      .sort((a, b) => (b.playing ? 1 : 0) - (a.playing ? 1 : 0))[0];

    if (!targetDeck) {
      statusBadge.textContent = `SYNC ${sourceId}: no target deck with BPM`;
      window.dispatchEvent(new CustomEvent('sync-feedback', { detail: { deckId: sourceId, ok: false } }));
      return;
    }

    if (sourceDeck.bpm <= 0) {
      statusBadge.textContent = `SYNC ${sourceId}: source BPM unknown`;
      window.dispatchEvent(new CustomEvent('sync-feedback', { detail: { deckId: sourceId, ok: false } }));
      return;
    }

    const beforeTempo = sourceDeck.tempoPercent;
    const beforeEffectiveBpm = sourceDeck.bpm * (1 + beforeTempo / 100);

    sourceDeck.syncTo(targetDeck.bpm);

    const afterTempo = sourceDeck.tempoPercent;
    const afterEffectiveBpm = sourceDeck.bpm * (1 + afterTempo / 100);
    const tempoDelta = afterTempo - beforeTempo;
    const nearTarget = Math.abs(afterEffectiveBpm - targetDeck.bpm) < 0.15;
    const clamped = Math.abs(afterTempo) >= 74.9 && !nearTarget;
    const noChange = Math.abs(tempoDelta) < 0.05;

    const signTempo = afterTempo >= 0 ? '+' : '';
    const signDelta = tempoDelta >= 0 ? '+' : '';

    if (noChange) {
      statusBadge.textContent = `SYNC ${sourceId} -> ${targetDeck.id}: already matched (${afterEffectiveBpm.toFixed(1)} BPM)`;
    } else {
      statusBadge.textContent = `SYNC ${sourceId} -> ${targetDeck.id}: ${beforeEffectiveBpm.toFixed(1)} -> ${afterEffectiveBpm.toFixed(1)} BPM (${signTempo}${afterTempo.toFixed(1)}%, ${signDelta}${tempoDelta.toFixed(1)}%)${clamped ? ' [tempo limit]' : ''}`;
    }

    window.dispatchEvent(
      new CustomEvent('sync-feedback', {
        detail: {
          deckId: sourceId,
          ok: true,
          targetDeckId: targetDeck.id,
          tempoPercent: afterTempo,
        },
      }),
    );
  }) as EventListener,
);

window.addEventListener(
  'keymatch-request',
  ((e: CustomEvent) => {
    const sourceId = e.detail.deckId as DeckId;
    const sourceDeck = deckMap.get(sourceId);
    if (!sourceDeck) return;

    const targetDeck = decks
      .filter((d) => d.id !== sourceId && d.musicalKey !== 'Unknown')
      .sort((a, b) => (b.playing ? 1 : 0) - (a.playing ? 1 : 0))[0];

    if (!targetDeck) return;

    const srcRoot = parseKeyRoot(sourceDeck.musicalKey);
    const tgtRoot = parseKeyRoot(targetDeck.musicalKey);
    if (srcRoot === null || tgtRoot === null) return;

    let diff = tgtRoot - srcRoot;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;

    sourceDeck.matchKey(diff);
  }) as EventListener,
);

function parseKeyRoot(key: string): number | null {
  const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const token = key.split(' ')[0];
  const idx = roots.indexOf(token);
  return idx < 0 ? null : idx;
}

function enforceCrossfadeOutput(pos: number): void {
  const deckA = deckMap.get('A')!;
  const deckB = deckMap.get('B')!;
  const playingA = deckA.playing;
  const playingB = deckB.playing;

  if (playingA && !playingB) {
    deckA.crossfadeGain.gain.value = 1;
    deckB.crossfadeGain.gain.value = 0;
    return;
  }

  if (playingB && !playingA) {
    deckA.crossfadeGain.gain.value = 0;
    deckB.crossfadeGain.gain.value = 1;
    return;
  }

  const clamped = Math.max(0, Math.min(1, pos));
  deckA.crossfadeGain.gain.value = Math.cos(clamped * Math.PI / 2);
  deckB.crossfadeGain.gain.value = Math.sin(clamped * Math.PI / 2);
}

function applyCrossfaderFusion(pos: number): void {
  const deckA = deckMap.get('A')!;
  const deckB = deckMap.get('B')!;
  if (!deckA.playing || !deckB.playing) return;
  const clamped = Math.max(0, Math.min(1, pos));

  if (transitionStyle === 'power') {
    deckA.setStemLevel('drums', 1 - Math.max(0, clamped - 0.5) * 2.5);
    deckA.setStemLevel('instruments', 1 - Math.max(0, clamped - 0.36) * 2.4);
    deckA.setStemLevel('vocals', 1 - Math.max(0, clamped - 0.18) * 2.8);

    deckB.setStemLevel('drums', Math.min(1, clamped * 2.2));
    deckB.setStemLevel('instruments', Math.min(1, Math.max(0, clamped - 0.12) * 2.0));
    deckB.setStemLevel('vocals', Math.min(1, Math.max(0, clamped - 0.28) * 2.2));
    return;
  }

  if (transitionStyle === 'neural') {
    deckA.setStemLevel('drums', 1 - Math.max(0, clamped - 0.72) * 2.2);
    deckA.setStemLevel('instruments', 1 - Math.max(0, clamped - 0.5) * 1.8);
    deckA.setStemLevel('vocals', 1 - Math.max(0, clamped - 0.2) * 2.4);

    deckB.setStemLevel('drums', Math.min(1, clamped * 2.0));
    deckB.setStemLevel('instruments', Math.min(1, Math.max(0, clamped - 0.2) * 1.6));
    deckB.setStemLevel('vocals', Math.min(1, Math.max(0, clamped - 0.42) * 2.0));
    return;
  }

  deckA.setStemLevel('drums', 1 - Math.max(0, clamped - 0.65) * 2.2);
  deckA.setStemLevel('instruments', 1 - Math.max(0, clamped - 0.45) * 2.0);
  deckA.setStemLevel('vocals', 1 - Math.max(0, clamped - 0.28) * 2.3);

  deckB.setStemLevel('drums', Math.min(1, clamped * 1.9));
  deckB.setStemLevel('instruments', Math.min(1, Math.max(0, clamped - 0.18) * 1.7));
  deckB.setStemLevel('vocals', Math.min(1, Math.max(0, clamped - 0.38) * 1.8));
}

deckModeBtn.addEventListener('click', () => {
  deckMode = deckMode === 2 ? 4 : 2;
  applyDeckMode();
});

waveformModeBtn.addEventListener('click', () => {
  waveformMode = waveformMode === 'horizontal' ? 'vertical' : 'horizontal';
  applyWaveformMode();
});

transitionStyleSelect.addEventListener('change', () => {
  transitionStyle = transitionStyleSelect.value as TransitionStyle;
  statusBadge.textContent = `Transition style: ${transitionStyle.toUpperCase()}`;
});

let automixEnabled = false;
let automixTimer: number | null = null;

const getSelectedAutoDropRoute = (): AutoDropRoute => {
  const selected = autoDropRouteSelect?.value;
  return isAutoDropRoute(selected) ? selected : 'A-B';
};

const triggerAutoDrop = async (route: AutoDropRoute): Promise<void> => {
  await runAutoDropTransition({
    route,
    transitionStyle,
    deckMap,
    crossfader,
    parseKeyRoot,
    onStatus: (message) => {
      statusBadge.textContent = message;
    },
  });
};

const setAutomix = (enabled: boolean): void => {
  automixEnabled = enabled;
  automixBtn.textContent = enabled ? 'AUTOMIX ON' : 'AUTOMIX OFF';
  automixBtn.classList.toggle('active', enabled);

  if (automixTimer) {
    clearInterval(automixTimer);
    automixTimer = null;
  }

  if (!enabled) return;

  automixTimer = window.setInterval(() => {
    void triggerAutoDrop(getSelectedAutoDropRoute());
  }, 12000);
};

automixBtn.addEventListener('click', () => {
  setAutomix(!automixEnabled);
});

autoDropBtn.addEventListener('click', () => {
  void triggerAutoDrop(getSelectedAutoDropRoute());
});

autoDropRouteSelect.addEventListener('change', () => {
  const route = getSelectedAutoDropRoute();
  const pair = getAutoDropPair(route);
  statusBadge.textContent = `Auto Drop route: ${pair.sourceId} -> ${pair.targetId}`;
});

const midi = new MidiController(
  {
    onPlayToggle: (deckId) => deckMap.get(deckId)?.togglePlay(),
    onCue: (deckId) => deckMap.get(deckId)?.seek(0),
    onSync: (deckId) => window.dispatchEvent(new CustomEvent('sync-request', { detail: { deckId } })),
    onKeyMatch: (deckId) => window.dispatchEvent(new CustomEvent('keymatch-request', { detail: { deckId } })),
    onCrossfader: (value01) => crossfader.setPosition(value01),
    onVolume: (deckId, value01) => {
      const d = deckMap.get(deckId);
      if (!d) return;
      d.volume = value01;
    },
    onTempo: (deckId, tempoPercent) => {
      const d = deckMap.get(deckId);
      if (!d) return;
      d.tempoPercent = tempoPercent;
    },
    onFilter: (deckId, value) => {
      const d = deckMap.get(deckId);
      if (!d) return;
      d.setFilterBlend(value);
    },
    onStemVocal: (deckId, value01) => deckMap.get(deckId)?.setStemLevel('vocals', value01),
    onStemDrums: (deckId, value01) => deckMap.get(deckId)?.setStemLevel('drums', value01),
    onStemInst: (deckId, value01) => deckMap.get(deckId)?.setStemLevel('instruments', value01),
  },
  (status) => {
    if (status.state === 'unsupported') {
      midiBtn.textContent = 'MIDI UNSUPPORTED';
      midiBtn.disabled = true;
      statusBadge.textContent = 'Web MIDI unavailable';
      return;
    }
    if (status.state === 'disconnected') {
      midiBtn.textContent = 'MIDI CONNECT';
      midiBtn.classList.remove('active');
      statusBadge.textContent = 'MIDI not connected';
      return;
    }
    midiBtn.textContent = 'MIDI CONNECTED';
    midiBtn.classList.add('active');
    statusBadge.textContent = `MIDI: ${status.inputName}`;
  },
  (learnMsg) => {
    statusBadge.textContent = learnMsg;
    const learning = learnMsg.startsWith('Learning');
    if (learning) setSettingsOpen(true);
    midiLearnBtn.classList.toggle('active', learning);
    midiLearnCancelBtn.classList.toggle('active', learning);
    midiLearnCancelBtn.disabled = !learning;
    midiLearnCancelBtn.classList.toggle('hidden-control', !learning);
    midiLearnBtn.textContent = learning ? 'LEARNING...' : 'MIDI LEARN';
  },
);

midiBtn.addEventListener('click', async () => {
  await engine.resume();
  await midi.connect();
});

cueInitBtn.addEventListener('click', async () => {
  if (cueMonitorReady) {
    disableCueMonitor();
    return;
  }
  const ok = await initCueMonitor();
  if (!ok) return;
  await populateCueOutputs();
  const currentSink = cueOutputSelect.value || 'default';
  await setCueSink(currentSink);
  statusBadge.textContent = 'Headphone CUE initialized';
});

cueOutputSelect.addEventListener('change', () => {
  void setCueSink(cueOutputSelect.value || 'default');
});

cueABtn.addEventListener('click', () => {
  void setDeckCue('A', !cueEnabledDecks.A);
});

cueBBtn.addEventListener('click', () => {
  void setDeckCue('B', !cueEnabledDecks.B);
});

cueLevelSelect.addEventListener('change', () => {
  const level = Number(cueLevelSelect.value || '0.7');
  engine.setCueLevel(level);
  statusBadge.textContent = `CUE level: ${Math.round(level * 100)}%`;
});

cueRefreshBtn.addEventListener('click', async () => {
  if (hasSelectAudioOutput(navigator.mediaDevices)) {
    try {
      const selected = await navigator.mediaDevices.selectAudioOutput();
      await scanCueOutputs();
      if (selected?.deviceId) {
        cueOutputSelect.value = selected.deviceId;
        await setCueSink(selected.deviceId);
      }
      return;
    } catch {
      // User canceled picker or browser blocked it. Fallback to regular scan.
    }
  }
  await scanCueOutputs();
});

midiLearnBtn.addEventListener('click', async () => {
  await engine.resume();
  await midi.connect();
  const target = midiLearnTarget.value as MidiLearnTarget;
  midi.setLearnTarget(target);
  midiLearnCancelBtn.disabled = false;
});

midiLearnCancelBtn.addEventListener('click', () => {
  midi.cancelLearn();
  statusBadge.textContent = 'MIDI Learn canceled';
  midiLearnBtn.classList.remove('active');
  midiLearnCancelBtn.classList.remove('active');
  midiLearnCancelBtn.disabled = true;
  midiLearnBtn.textContent = 'MIDI LEARN';
  midiLearnCancelBtn.classList.add('hidden-control');
});

mixerToggleBtn.addEventListener('click', () => {
  mixerVisible = !mixerVisible;
  applyMixerVisibility();
});

libraryToggleBtn.addEventListener('click', () => {
  libraryVisible = !libraryVisible;
  applyLibraryVisibility();
});

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = settingsPopover.classList.contains('hidden-control');
  setSettingsOpen(willOpen);
});

settingsPopover.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.addEventListener('click', () => {
  if (!settingsPopover.classList.contains('hidden-control')) {
    setSettingsOpen(false);
  }
});

quickImportBtn.addEventListener('click', () => {
  openFileImport();
});

globalFilePicker.addEventListener('change', () => {
  if (!globalFilePicker.files || globalFilePicker.files.length === 0) return;
  void libraryUI.importFiles(globalFilePicker.files);
});

guideToggleBtn.addEventListener('click', () => {
  const visible = guidePanel.classList.contains('active');
  if (visible) {
    guidePanel.classList.remove('active');
    localStorage.setItem('webdj.guide.hidden', '1');
    guideToggleBtn.classList.remove('active');
  } else {
    guidePanel.classList.add('active');
    localStorage.setItem('webdj.guide.hidden', '0');
    guideToggleBtn.classList.add('active');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setSettingsOpen(false);
    midi.cancelLearn();
    statusBadge.textContent = 'MIDI Learn canceled';
    midiLearnBtn.classList.remove('active');
    midiLearnCancelBtn.classList.remove('active');
    midiLearnCancelBtn.disabled = true;
    midiLearnBtn.textContent = 'MIDI LEARN';
    midiLearnCancelBtn.classList.add('hidden-control');
  }
});

let recorder: MediaRecorder | null = null;
let recordChunks: Blob[] = [];
let recordTimer: number | null = null;
let recordStartMs = 0;
let recordMimeType = 'audio/webm';

const formatRecTimer = (elapsedMs: number): string => {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const pickRecordingMimeType = (): string | null => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
};

const extensionForMimeType = (mimeType: string): string => {
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  return 'webm';
};

recordBtn.addEventListener('click', async () => {
  await engine.resume();

  if (!recorder || recorder.state === 'inactive') {
    if (typeof MediaRecorder === 'undefined') {
      statusBadge.textContent = 'Recording unsupported in this browser';
      return;
    }

    const preferredMimeType = pickRecordingMimeType();
    try {
      recorder = preferredMimeType
        ? new MediaRecorder(engine.recordingStream, { mimeType: preferredMimeType })
        : new MediaRecorder(engine.recordingStream);
    } catch {
      statusBadge.textContent = 'Recording init failed on this browser';
      return;
    }

    recordMimeType = recorder.mimeType || preferredMimeType || 'audio/webm';
    recordChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordChunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordChunks, { type: recordMimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webdj-session-${new Date().toISOString().replace(/[:.]/g, '-')}.${extensionForMimeType(recordMimeType)}`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    recordStartMs = Date.now();
    const tick = () => {
      recordBtn.textContent = `REC ${formatRecTimer(Date.now() - recordStartMs)}`;
    };
    tick();
    recordTimer = window.setInterval(tick, 1000);
    recordBtn.classList.add('recording');
    statusBadge.textContent = 'Recording in progress';
    return;
  }

  recorder.stop();
  if (recordTimer) {
    clearInterval(recordTimer);
    recordTimer = null;
  }
  recordBtn.textContent = 'REC START';
  recordBtn.classList.remove('recording');
  statusBadge.textContent = 'Recording stopped and exported';
});

document.addEventListener('click', () => engine.resume(), { once: true });
document.addEventListener('pointerdown', () => engine.resume(), { once: true });
document.addEventListener('touchstart', () => engine.resume(), { once: true, passive: true });
