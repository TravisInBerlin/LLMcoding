import { AudioEngine } from './audio/AudioEngine';
import { Deck, type DeckId } from './audio/Deck';
import { Crossfader } from './audio/Crossfader';
import { DeckUI } from './ui/DeckUI';
import { MixerUI } from './ui/MixerUI';
import { LibraryUI } from './ui/LibraryUI';
import type { WaveformMode } from './visualizer/Waveform';
import './style.css';

const engine = new AudioEngine();
const deckIds: DeckId[] = ['A', 'B', 'C', 'D'];

const decks = deckIds.map((id) => new Deck(engine, id));
const deckMap = new Map<DeckId, Deck>(decks.map((d) => [d.id, d]));

const crossfader = new Crossfader(deckMap.get('A')!.crossfadeGain, deckMap.get('B')!.crossfadeGain);
crossfader.onChange((pos) => applyCrossfaderFusion(pos));

const root = document.querySelector<HTMLDivElement>('#app')!;
root.classList.add('mode-2');
root.innerHTML = `
  <header class="app-header">
    <div class="logo">
      <span class="logo-text">WebDJ NEXUS</span>
      <span class="header-badge">iPad-ready / Pro Mix</span>
    </div>
    <div class="header-actions">
      <button class="btn btn-mini" id="deck-mode-btn">4 DECK</button>
      <button class="btn btn-mini" id="waveform-mode-btn">WAVE: H</button>
      <button class="btn btn-mini" id="automix-btn">AUTOMIX OFF</button>
      <button class="btn btn-mini" id="record-btn">REC START</button>
    </div>
  </header>

  <main class="dj-layout">
    <section class="deck-grid" id="deck-grid">
      <section class="deck-container" id="deck-a-container"></section>
      <section class="deck-container" id="deck-b-container"></section>
      <section class="deck-container" id="deck-c-container"></section>
      <section class="deck-container" id="deck-d-container"></section>
    </section>
    <section class="mixer-container" id="mixer-container"></section>
  </main>

  <section class="library-container" id="library-container"></section>
`;

const accentMap: Record<DeckId, string> = {
  A: '#00d1ff',
  B: '#ff4f8b',
  C: '#70e000',
  D: '#f9c74f',
};

const deckUIs = new Map<DeckId, DeckUI>();
deckIds.forEach((id) => {
  const container = document.getElementById(`deck-${id.toLowerCase()}-container`)!;
  deckUIs.set(id, new DeckUI(container, deckMap.get(id)!, accentMap[id]));
});

new MixerUI(document.getElementById('mixer-container')!, decks, crossfader);
new LibraryUI(document.getElementById('library-container')!, decks);

let deckMode: 2 | 4 = 2;
let waveformMode: WaveformMode = 'horizontal';

const deckModeBtn = document.getElementById('deck-mode-btn') as HTMLButtonElement;
const waveformModeBtn = document.getElementById('waveform-mode-btn') as HTMLButtonElement;
const automixBtn = document.getElementById('automix-btn') as HTMLButtonElement;
const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;

const applyDeckMode = (): void => {
  root.classList.toggle('mode-2', deckMode === 2);
  root.classList.toggle('mode-4', deckMode === 4);
  deckModeBtn.textContent = deckMode === 2 ? '4 DECK' : '2 DECK';
};

const applyWaveformMode = (): void => {
  deckUIs.forEach((ui) => ui.setWaveformMode(waveformMode));
  waveformModeBtn.textContent = waveformMode === 'horizontal' ? 'WAVE: H' : 'WAVE: V';
};

applyDeckMode();
applyWaveformMode();

// Sync requests
window.addEventListener(
  'sync-request',
  ((e: CustomEvent) => {
    const sourceId = e.detail.deckId as DeckId;
    const sourceDeck = deckMap.get(sourceId);
    if (!sourceDeck) return;

    const targetDeck = decks
      .filter((d) => d.id !== sourceId && d.bpm > 0)
      .sort((a, b) => (b.playing ? 1 : 0) - (a.playing ? 1 : 0))[0];

    if (targetDeck) sourceDeck.syncTo(targetDeck.bpm);
  }) as EventListener,
);

// Key match requests
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

function applyCrossfaderFusion(pos: number): void {
  const deckA = deckMap.get('A')!;
  const deckB = deckMap.get('B')!;
  const clamped = Math.max(0, Math.min(1, pos));

  // A side: keep rhythm longer, pull vocal earlier.
  deckA.setStemLevel('drums', 1 - Math.max(0, clamped - 0.65) * 2.2);
  deckA.setStemLevel('instruments', 1 - Math.max(0, clamped - 0.45) * 2.0);
  deckA.setStemLevel('vocals', 1 - Math.max(0, clamped - 0.28) * 2.3);

  // B side: introduce drums first, vocals last for cleaner blend.
  deckB.setStemLevel('drums', Math.min(1, clamped * 1.9));
  deckB.setStemLevel('instruments', Math.min(1, Math.max(0, clamped - 0.18) * 1.7));
  deckB.setStemLevel('vocals', Math.min(1, Math.max(0, clamped - 0.38) * 1.8));
}

// Deck mode toggle

deckModeBtn.addEventListener('click', () => {
  deckMode = deckMode === 2 ? 4 : 2;
  applyDeckMode();
});

// Waveform mode toggle
waveformModeBtn.addEventListener('click', () => {
  waveformMode = waveformMode === 'horizontal' ? 'vertical' : 'horizontal';
  applyWaveformMode();
});

// Automix (A/B)
let automixEnabled = false;
let automixTimer: number | null = null;

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
    const deckA = deckMap.get('A')!;
    const deckB = deckMap.get('B')!;

    if (!deckA.buffer || !deckB.buffer) return;

    if (!deckA.playing && !deckB.playing) {
      deckA.play();
      crossfader.setPosition(0);
      return;
    }

    if (deckA.playing && !deckB.playing) {
      deckB.syncTo(deckA.bpm);
      deckB.play();
      fadeCrossfader(0, 1, 6000);
      return;
    }

    if (deckB.playing && !deckA.playing) {
      deckA.syncTo(deckB.bpm);
      deckA.play();
      fadeCrossfader(1, 0, 6000);
      return;
    }

    const nextToB = crossfader.position < 0.5;
    if (nextToB) {
      deckB.syncTo(deckA.bpm);
      fadeCrossfader(crossfader.position, 1, 6000);
    } else {
      deckA.syncTo(deckB.bpm);
      fadeCrossfader(crossfader.position, 0, 6000);
    }
  }, 12000);
};

function fadeCrossfader(from: number, to: number, durationMs: number): void {
  const start = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = t * t * (3 - 2 * t);
    crossfader.setPosition(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

automixBtn.addEventListener('click', () => {
  setAutomix(!automixEnabled);
});

// Recording
let recorder: MediaRecorder | null = null;
let recordChunks: Blob[] = [];

recordBtn.addEventListener('click', async () => {
  await engine.resume();

  if (!recorder || recorder.state === 'inactive') {
    recorder = new MediaRecorder(engine.recordingStream, { mimeType: 'audio/webm' });
    recordChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordChunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webdj-session-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    recordBtn.textContent = 'REC STOP';
    recordBtn.classList.add('recording');
    return;
  }

  recorder.stop();
  recordBtn.textContent = 'REC START';
  recordBtn.classList.remove('recording');
});

// Resume audio context on first interaction
document.addEventListener('click', () => engine.resume(), { once: true });
