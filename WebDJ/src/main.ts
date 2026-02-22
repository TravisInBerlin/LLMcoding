import { AudioEngine } from './audio/AudioEngine';
import { Deck, type DeckId } from './audio/Deck';
import { Crossfader } from './audio/Crossfader';
import { DeckUI } from './ui/DeckUI';
import { MixerUI } from './ui/MixerUI';
import { LibraryUI } from './ui/LibraryUI';
import { MidiController, type MidiLearnTarget } from './midi/MidiController';
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
const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
if (isTouch) root.classList.add('touch-mode');
if (isIPad) root.classList.add('ipad-mode');
root.innerHTML = `
  <header class="app-header">
    <div class="logo">
      <span class="logo-text">WebDJ NEXUS</span>
      <span class="header-badge" id="status-badge">iPad-ready / Pro Mix</span>
    </div>
    <div class="header-actions">
      <button class="btn btn-mini" id="midi-btn">MIDI CONNECT</button>
      <select id="midi-learn-target" class="midi-learn-select">
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
      <button class="btn btn-mini" id="midi-learn-btn">MIDI LEARN</button>
      <button class="btn btn-mini" id="midi-learn-cancel-btn">LEARN CANCEL</button>
      <button class="btn btn-mini" id="mixer-toggle-btn">MIXER HIDE</button>
      <button class="btn btn-mini" id="guide-toggle-btn">GUIDE</button>
      <button class="btn btn-mini" id="deck-mode-btn">4 DECK</button>
      <button class="btn btn-mini" id="waveform-mode-btn">WAVE: H</button>
      <button class="btn btn-mini" id="automix-btn">AUTOMIX OFF</button>
      <button class="btn btn-mini" id="record-btn">REC START</button>
    </div>
  </header>

  <section class="quickstart" id="quickstart">
    <div class="quickstart-title">Quick Start</div>
    <div class="quickstart-steps">
      <span>1) Add Filesから曲を読み込み</span>
      <span>2) A/Bにロードして再生</span>
      <span>3) SYNC → クロスフェーダーでミックス</span>
      <span>4) MIDIは CONNECT → LEARN → キャンセル可</span>
    </div>
    <button class="btn btn-mini" id="quickstart-close">HIDE GUIDE</button>
  </section>

  <main class="dj-layout">
    <section class="deck-container deck-slot-a" id="deck-a-container"></section>
    <section class="mixer-container mixer-slot" id="mixer-container"></section>
    <section class="deck-container deck-slot-b" id="deck-b-container"></section>
    <section class="deck-container deck-slot-c" id="deck-c-container"></section>
    <section class="deck-container deck-slot-d" id="deck-d-container"></section>
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
let mixerVisible = true;

const deckModeBtn = document.getElementById('deck-mode-btn') as HTMLButtonElement;
const waveformModeBtn = document.getElementById('waveform-mode-btn') as HTMLButtonElement;
const automixBtn = document.getElementById('automix-btn') as HTMLButtonElement;
const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
const midiBtn = document.getElementById('midi-btn') as HTMLButtonElement;
const midiLearnBtn = document.getElementById('midi-learn-btn') as HTMLButtonElement;
const midiLearnCancelBtn = document.getElementById('midi-learn-cancel-btn') as HTMLButtonElement;
const midiLearnTarget = document.getElementById('midi-learn-target') as HTMLSelectElement;
const mixerToggleBtn = document.getElementById('mixer-toggle-btn') as HTMLButtonElement;
const guideToggleBtn = document.getElementById('guide-toggle-btn') as HTMLButtonElement;
const statusBadge = document.getElementById('status-badge') as HTMLSpanElement;
const quickStartEl = document.getElementById('quickstart') as HTMLElement;
const quickStartCloseBtn = document.getElementById('quickstart-close') as HTMLButtonElement;
midiLearnCancelBtn.disabled = true;

const applyDeckMode = (): void => {
  root.classList.toggle('mode-2', deckMode === 2);
  root.classList.toggle('mode-4', deckMode === 4);
  deckModeBtn.textContent = deckMode === 2 ? '4 DECK' : '2 DECK';
};

const applyWaveformMode = (): void => {
  deckUIs.forEach((ui) => ui.setWaveformMode(waveformMode));
  waveformModeBtn.textContent = waveformMode === 'horizontal' ? 'WAVE: H' : 'WAVE: V';
};

const applyMixerVisibility = (): void => {
  root.classList.toggle('mixer-hidden', !mixerVisible);
  mixerToggleBtn.textContent = mixerVisible ? 'MIXER HIDE' : 'MIXER SHOW';
};

applyDeckMode();
applyWaveformMode();
applyMixerVisibility();

if (isIPad) {
  statusBadge.textContent = 'iPad Touch / Low Latency';
}

if (localStorage.getItem('webdj.quickstart.hidden') === '1') {
  quickStartEl.classList.remove('active');
} else {
  quickStartEl.classList.add('active');
}
guideToggleBtn.classList.toggle('active', quickStartEl.classList.contains('active'));

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
    midiLearnBtn.classList.toggle('active', learning);
    midiLearnCancelBtn.classList.toggle('active', learning);
    midiLearnCancelBtn.disabled = !learning;
    midiLearnBtn.textContent = learning ? 'LEARNING...' : 'MIDI LEARN';
  },
);

midiBtn.addEventListener('click', async () => {
  await engine.resume();
  await midi.connect();
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
  midiLearnBtn.textContent = 'MIDI LEARN';
});

mixerToggleBtn.addEventListener('click', () => {
  mixerVisible = !mixerVisible;
  applyMixerVisibility();
});

quickStartCloseBtn.addEventListener('click', () => {
  quickStartEl.classList.remove('active');
  localStorage.setItem('webdj.quickstart.hidden', '1');
  guideToggleBtn.classList.remove('active');
});

guideToggleBtn.addEventListener('click', () => {
  const visible = quickStartEl.classList.contains('active');
  if (visible) {
    quickStartEl.classList.remove('active');
    localStorage.setItem('webdj.quickstart.hidden', '1');
    guideToggleBtn.classList.remove('active');
  } else {
    quickStartEl.classList.add('active');
    localStorage.removeItem('webdj.quickstart.hidden');
    guideToggleBtn.classList.add('active');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    midi.cancelLearn();
    statusBadge.textContent = 'MIDI Learn canceled';
    midiLearnBtn.textContent = 'MIDI LEARN';
  }
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
document.addEventListener('touchstart', () => engine.resume(), { once: true, passive: true });
