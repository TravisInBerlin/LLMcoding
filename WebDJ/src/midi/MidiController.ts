import type { DeckId } from '../audio/Deck';

export interface MidiActionHandlers {
  onPlayToggle: (deckId: DeckId) => void;
  onCue: (deckId: DeckId) => void;
  onSync: (deckId: DeckId) => void;
  onKeyMatch: (deckId: DeckId) => void;
  onCrossfader: (value01: number) => void;
  onVolume: (deckId: DeckId, value01: number) => void;
  onTempo: (deckId: DeckId, tempoPercent: number) => void;
  onFilter: (deckId: DeckId, value: number) => void;
  onStemVocal: (deckId: DeckId, value01: number) => void;
  onStemDrums: (deckId: DeckId, value01: number) => void;
  onStemInst: (deckId: DeckId, value01: number) => void;
}

export type MidiStatus =
  | { state: 'unsupported' }
  | { state: 'disconnected' }
  | { state: 'connected'; inputName: string };

interface MidiAccessLike {
  inputs: { values(): IterableIterator<MidiInputLike> };
  outputs: { values(): IterableIterator<MidiOutputLike> };
  onstatechange: ((event: Event) => void) | null;
}

interface MidiInputLike {
  name?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

interface MidiOutputLike {
  send(data: number[]): void;
}

interface MidiMessageEventLike {
  data: Uint8Array;
}

const NOTE_MAP: Array<{ note: number; deckId: DeckId; action: 'play' | 'cue' | 'sync' | 'key' }> = [
  { note: 36, deckId: 'A', action: 'play' },
  { note: 37, deckId: 'B', action: 'play' },
  { note: 38, deckId: 'C', action: 'play' },
  { note: 39, deckId: 'D', action: 'play' },
  { note: 40, deckId: 'A', action: 'cue' },
  { note: 41, deckId: 'B', action: 'cue' },
  { note: 42, deckId: 'A', action: 'sync' },
  { note: 43, deckId: 'B', action: 'sync' },
  { note: 44, deckId: 'A', action: 'key' },
  { note: 45, deckId: 'B', action: 'key' },
];

const CC_MAP = {
  crossfader: 0,
  volA: 1,
  volB: 2,
  volC: 3,
  volD: 4,
  tempoA: 5,
  tempoB: 6,
  tempoC: 7,
  tempoD: 8,
  filterA: 9,
  filterB: 10,
  stemVocalA: 11,
  stemVocalB: 12,
  stemDrumsA: 13,
  stemDrumsB: 14,
  stemInstA: 15,
  stemInstB: 16,
} as const;

export class MidiController {
  private handlers: MidiActionHandlers;
  private statusListener?: (status: MidiStatus) => void;
  private access: MidiAccessLike | null = null;
  private output: MidiOutputLike | null = null;

  constructor(handlers: MidiActionHandlers, statusListener?: (status: MidiStatus) => void) {
    this.handlers = handlers;
    this.statusListener = statusListener;
  }

  async connect(): Promise<void> {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccessLike>;
    };

    if (!nav.requestMIDIAccess) {
      this.emitStatus({ state: 'unsupported' });
      return;
    }

    const access = await nav.requestMIDIAccess({ sysex: false });
    this.access = access as unknown as MidiAccessLike;
    this.access.onstatechange = () => this.bindPorts();
    this.bindPorts();
  }

  private bindPorts(): void {
    if (!this.access) return;

    const firstInput = this.access.inputs.values().next().value as MidiInputLike | undefined;
    const firstOutput = this.access.outputs.values().next().value as MidiOutputLike | undefined;

    this.output = firstOutput || null;

    if (!firstInput) {
      this.emitStatus({ state: 'disconnected' });
      return;
    }

    firstInput.onmidimessage = (event) => {
      this.handleMidiMessage(event.data);
    };

    this.emitStatus({
      state: 'connected',
      inputName: firstInput.name || 'MIDI Input',
    });
  }

  private handleMidiMessage(data: Uint8Array): void {
    if (data.length < 3) return;

    const status = data[0] & 0xf0;
    const d1 = data[1];
    const d2 = data[2];

    // Note on
    if (status === 0x90 && d2 > 0) {
      const m = NOTE_MAP.find((n) => n.note === d1);
      if (!m) return;

      if (m.action === 'play') this.handlers.onPlayToggle(m.deckId);
      if (m.action === 'cue') this.handlers.onCue(m.deckId);
      if (m.action === 'sync') this.handlers.onSync(m.deckId);
      if (m.action === 'key') this.handlers.onKeyMatch(m.deckId);

      this.flashLed(d1);
      return;
    }

    // CC
    if (status === 0xb0) {
      const v = d2 / 127;
      if (d1 === CC_MAP.crossfader) this.handlers.onCrossfader(v);
      if (d1 === CC_MAP.volA) this.handlers.onVolume('A', v);
      if (d1 === CC_MAP.volB) this.handlers.onVolume('B', v);
      if (d1 === CC_MAP.volC) this.handlers.onVolume('C', v);
      if (d1 === CC_MAP.volD) this.handlers.onVolume('D', v);
      if (d1 === CC_MAP.tempoA) this.handlers.onTempo('A', v * 150 - 75);
      if (d1 === CC_MAP.tempoB) this.handlers.onTempo('B', v * 150 - 75);
      if (d1 === CC_MAP.tempoC) this.handlers.onTempo('C', v * 150 - 75);
      if (d1 === CC_MAP.tempoD) this.handlers.onTempo('D', v * 150 - 75);
      if (d1 === CC_MAP.filterA) this.handlers.onFilter('A', v * 2 - 1);
      if (d1 === CC_MAP.filterB) this.handlers.onFilter('B', v * 2 - 1);
      if (d1 === CC_MAP.stemVocalA) this.handlers.onStemVocal('A', v);
      if (d1 === CC_MAP.stemVocalB) this.handlers.onStemVocal('B', v);
      if (d1 === CC_MAP.stemDrumsA) this.handlers.onStemDrums('A', v);
      if (d1 === CC_MAP.stemDrumsB) this.handlers.onStemDrums('B', v);
      if (d1 === CC_MAP.stemInstA) this.handlers.onStemInst('A', v);
      if (d1 === CC_MAP.stemInstB) this.handlers.onStemInst('B', v);
    }
  }

  private flashLed(note: number): void {
    if (!this.output) return;
    this.output.send([0x90, note, 127]);
    setTimeout(() => {
      this.output?.send([0x80, note, 0]);
    }, 80);
  }

  private emitStatus(status: MidiStatus): void {
    this.statusListener?.(status);
  }
}
