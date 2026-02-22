import { AudioEngine } from './audio/AudioEngine';
import { Deck, type DeckId } from './audio/Deck';
import { Crossfader } from './audio/Crossfader';
import { DeckUI } from './ui/DeckUI';
import { MixerUI } from './ui/MixerUI';
import { LibraryUI } from './ui/LibraryUI';
import { MidiController, type MidiLearnTarget } from './midi/MidiController';
import type { WaveformMode } from './visualizer/Waveform';
import './style.css';

type TransitionStyle = 'smooth' | 'power' | 'neural';

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
    <div class="logo-block">
      <span class="logo-text">WebDJ NEXUS</span>
      <span class="header-badge" id="status-badge">djay-style / iPad Performance</span>
    </div>
    <div class="header-actions">
      <button class="btn btn-mini btn-muted" id="midi-btn" title="MIDIコントローラーを接続/切断します">MIDI CONNECT</button>
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
      <button class="btn btn-mini btn-muted" id="library-toggle-btn" title="ライブラリパネルの表示/非表示を切り替えます">LIBRARY HIDE</button>
      <button class="btn btn-mini btn-muted" id="deck-mode-btn" title="2デッキ/4デッキを切り替えます">4 DECK</button>
      <button class="btn btn-mini btn-muted" id="waveform-mode-btn" title="波形表示を横/縦で切り替えます">WAVE: H</button>
      <select id="transition-style" class="midi-learn-select transition-select" title="クロスフェード時のミックス特性を選びます">
        <option value="smooth">XFADE: SMOOTH</option>
        <option value="power">XFADE: POWER</option>
        <option value="neural">XFADE: NEURAL</option>
      </select>
      <button class="btn btn-mini btn-accent" id="auto-drop-btn" title="A/Bの自動トランジションを一回実行します">AUTO DROP</button>
      <button class="btn btn-mini btn-muted" id="guide-toggle-btn" title="操作ガイドの表示/非表示を切り替えます">GUIDE</button>
      <button class="btn btn-mini btn-key" id="automix-btn" title="定期自動ミックスのON/OFFを切り替えます">AUTOMIX OFF</button>
      <button class="btn btn-mini btn-cue" id="record-btn" title="マスター出力の録音開始/停止">REC START</button>
    </div>
  </header>

  <section class="toolbar-help" id="toolbar-help">
    <span class="toolbar-help-item"><strong>MIDI CONNECT</strong>MIDI機器の接続</span>
    <span class="toolbar-help-item"><strong>Learn: Play A</strong>学習対象の操作を選択</span>
    <span class="toolbar-help-item"><strong>MIDI LEARN</strong>次のMIDI信号に割当</span>
    <span class="toolbar-help-item"><strong>MIXER / LIBRARY / 4 DECK / WAVE</strong>画面表示の切替</span>
    <span class="toolbar-help-item"><strong>AUTO DROP / AUTOMIX / REC</strong>自動遷移・自動MIX・録音</span>
  </section>

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

  <section class="library-container" id="library-container"></section>
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
new LibraryUI(document.getElementById('library-container')!, decks);

let deckMode: 2 | 4 = 2;
let waveformMode: WaveformMode = 'horizontal';
let mixerVisible = true;
let libraryVisible = true;
let transitionStyle: TransitionStyle = 'smooth';

const deckModeBtn = document.getElementById('deck-mode-btn') as HTMLButtonElement;
const waveformModeBtn = document.getElementById('waveform-mode-btn') as HTMLButtonElement;
const transitionStyleSelect = document.getElementById('transition-style') as HTMLSelectElement;
const autoDropBtn = document.getElementById('auto-drop-btn') as HTMLButtonElement;
const automixBtn = document.getElementById('automix-btn') as HTMLButtonElement;
const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
const midiBtn = document.getElementById('midi-btn') as HTMLButtonElement;
const midiLearnBtn = document.getElementById('midi-learn-btn') as HTMLButtonElement;
const midiLearnCancelBtn = document.getElementById('midi-learn-cancel-btn') as HTMLButtonElement;
const midiLearnTarget = document.getElementById('midi-learn-target') as HTMLSelectElement;
const mixerToggleBtn = document.getElementById('mixer-toggle-btn') as HTMLButtonElement;
const libraryToggleBtn = document.getElementById('library-toggle-btn') as HTMLButtonElement;
const guideToggleBtn = document.getElementById('guide-toggle-btn') as HTMLButtonElement;
const statusBadge = document.getElementById('status-badge') as HTMLSpanElement;
const guidePanel = document.getElementById('guide-panel') as HTMLElement;
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

const applyLibraryVisibility = (): void => {
  root.classList.toggle('library-hidden', !libraryVisible);
  libraryToggleBtn.textContent = libraryVisible ? 'LIBRARY HIDE' : 'LIBRARY SHOW';
};

applyDeckMode();
applyWaveformMode();
applyMixerVisibility();
applyLibraryVisibility();

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
    void runAutoDropTransition();
  }, 12000);
};

async function runAutoDropTransition(): Promise<void> {
  const deckA = deckMap.get('A')!;
  const deckB = deckMap.get('B')!;

  if (!deckA.buffer || !deckB.buffer) {
    statusBadge.textContent = 'Auto Drop: load tracks on A/B first';
    return;
  }

  if (!deckA.playing && !deckB.playing) {
    deckA.play();
    crossfader.setPosition(0);
    statusBadge.textContent = 'Auto Drop: started Deck A';
    return;
  }

  const source = deckA.playing ? deckA : deckB;
  const target = source.id === 'A' ? deckB : deckA;

  if (!target.playing) {
    if (source.bpm > 0) target.syncTo(source.bpm);

    const srcRoot = parseKeyRoot(source.musicalKey);
    const tgtRoot = parseKeyRoot(target.musicalKey);
    if (srcRoot !== null && tgtRoot !== null) {
      let diff = srcRoot - tgtRoot;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      target.matchKey(diff);
    }
    target.play();
  }

  const to = target.id === 'A' ? 0 : 1;
  const from = crossfader.position;
  const baseDuration = transitionStyle === 'power' ? 3600 : transitionStyle === 'neural' ? 5600 : 6800;

  if (transitionStyle === 'power') {
    source.effects[0].setWet(0.42);
    source.effects[2].setWet(0.25);
    target.effects[1].setWet(0.24);
  } else if (transitionStyle === 'neural') {
    source.setStemLevel('vocals', Math.min(source.getStemLevel('vocals'), 0.45));
    target.setStemLevel('drums', 1);
    target.setStemLevel('instruments', Math.max(0.72, target.getStemLevel('instruments')));
    target.effects[0].setWet(0.2);
  } else {
    source.effects[0].setWet(0.26);
    target.effects[1].setWet(0.16);
  }

  fadeCrossfader(from, to, baseDuration);

  window.setTimeout(() => {
    source.effects[0].setWet(0);
    source.effects[1].setWet(0);
    source.effects[2].setWet(0);
    target.effects[0].setWet(0);
    target.effects[1].setWet(0);
    target.effects[2].setWet(0);
  }, baseDuration + 400);

  statusBadge.textContent = `Auto Drop: ${source.id} -> ${target.id} (${transitionStyle.toUpperCase()})`;
}

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

autoDropBtn.addEventListener('click', () => {
  void runAutoDropTransition();
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

libraryToggleBtn.addEventListener('click', () => {
  libraryVisible = !libraryVisible;
  applyLibraryVisibility();
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
    midi.cancelLearn();
    statusBadge.textContent = 'MIDI Learn canceled';
    midiLearnBtn.textContent = 'MIDI LEARN';
  }
});

let recorder: MediaRecorder | null = null;
let recordChunks: Blob[] = [];
let recordTimer: number | null = null;
let recordStartMs = 0;

const formatRecTimer = (elapsedMs: number): string => {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

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
document.addEventListener('touchstart', () => engine.resume(), { once: true, passive: true });
