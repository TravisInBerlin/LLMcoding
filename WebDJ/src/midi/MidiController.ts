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

export type MidiLearnTarget =
  | 'playA'
  | 'playB'
  | 'cueA'
  | 'cueB'
  | 'syncA'
  | 'syncB'
  | 'keyA'
  | 'keyB'
  | 'crossfader'
  | 'volA'
  | 'volB'
  | 'tempoA'
  | 'tempoB'
  | 'filterA'
  | 'filterB'
  | 'stemVocalA'
  | 'stemVocalB'
  | 'stemDrumsA'
  | 'stemDrumsB'
  | 'stemInstA'
  | 'stemInstB';

interface MidiBinding {
  type: 'note' | 'cc';
  id: number;
}

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

const STORAGE_KEY = 'webdj.midi.learn.map.v1';

const DEFAULT_BINDINGS: Partial<Record<MidiLearnTarget, MidiBinding>> = {
  playA: { type: 'note', id: 36 },
  playB: { type: 'note', id: 37 },
  cueA: { type: 'note', id: 40 },
  cueB: { type: 'note', id: 41 },
  syncA: { type: 'note', id: 42 },
  syncB: { type: 'note', id: 43 },
  keyA: { type: 'note', id: 44 },
  keyB: { type: 'note', id: 45 },
  crossfader: { type: 'cc', id: 0 },
  volA: { type: 'cc', id: 1 },
  volB: { type: 'cc', id: 2 },
  tempoA: { type: 'cc', id: 5 },
  tempoB: { type: 'cc', id: 6 },
  filterA: { type: 'cc', id: 9 },
  filterB: { type: 'cc', id: 10 },
  stemVocalA: { type: 'cc', id: 11 },
  stemVocalB: { type: 'cc', id: 12 },
  stemDrumsA: { type: 'cc', id: 13 },
  stemDrumsB: { type: 'cc', id: 14 },
  stemInstA: { type: 'cc', id: 15 },
  stemInstB: { type: 'cc', id: 16 },
};

export class MidiController {
  private handlers: MidiActionHandlers;
  private statusListener?: (status: MidiStatus) => void;
  private learnListener?: (msg: string) => void;
  private access: MidiAccessLike | null = null;
  private output: MidiOutputLike | null = null;
  private learnTarget: MidiLearnTarget | null = null;
  private bindings: Partial<Record<MidiLearnTarget, MidiBinding>> = {};

  constructor(
    handlers: MidiActionHandlers,
    statusListener?: (status: MidiStatus) => void,
    learnListener?: (msg: string) => void,
  ) {
    this.handlers = handlers;
    this.statusListener = statusListener;
    this.learnListener = learnListener;
    this.bindings = {
      ...DEFAULT_BINDINGS,
      ...this.loadBindings(),
    };
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

  setLearnTarget(target: MidiLearnTarget | null): void {
    this.learnTarget = target;
    if (target) {
      this.learnListener?.(`Learning ${target}: move knob or press pad...`);
    } else {
      this.learnListener?.('MIDI Learn idle');
    }
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
    const isNoteOn = status === 0x90 && d2 > 0;
    const isCC = status === 0xb0;
    if (!isNoteOn && !isCC) return;

    const type: MidiBinding['type'] = isNoteOn ? 'note' : 'cc';

    if (this.learnTarget) {
      this.bindings[this.learnTarget] = { type, id: d1 };
      this.saveBindings();
      this.learnListener?.(`Mapped ${this.learnTarget} to ${type.toUpperCase()} ${d1}`);
      this.flashLed(d1);
      this.learnTarget = null;
      return;
    }

    const matchedTargets = this.findTargets(type, d1);
    if (matchedTargets.length === 0) return;

    const value01 = d2 / 127;
    matchedTargets.forEach((target) => this.executeTarget(target, value01, isNoteOn));
    this.flashLed(d1);
  }

  private findTargets(type: MidiBinding['type'], id: number): MidiLearnTarget[] {
    const out: MidiLearnTarget[] = [];
    (Object.keys(this.bindings) as MidiLearnTarget[]).forEach((target) => {
      const b = this.bindings[target];
      if (!b) return;
      if (b.type === type && b.id === id) out.push(target);
    });
    return out;
  }

  private executeTarget(target: MidiLearnTarget, value01: number, isNoteOn: boolean): void {
    switch (target) {
      case 'playA':
        if (isNoteOn || value01 > 0.5) this.handlers.onPlayToggle('A');
        return;
      case 'playB':
        if (isNoteOn || value01 > 0.5) this.handlers.onPlayToggle('B');
        return;
      case 'cueA':
        if (isNoteOn || value01 > 0.5) this.handlers.onCue('A');
        return;
      case 'cueB':
        if (isNoteOn || value01 > 0.5) this.handlers.onCue('B');
        return;
      case 'syncA':
        if (isNoteOn || value01 > 0.5) this.handlers.onSync('A');
        return;
      case 'syncB':
        if (isNoteOn || value01 > 0.5) this.handlers.onSync('B');
        return;
      case 'keyA':
        if (isNoteOn || value01 > 0.5) this.handlers.onKeyMatch('A');
        return;
      case 'keyB':
        if (isNoteOn || value01 > 0.5) this.handlers.onKeyMatch('B');
        return;
      case 'crossfader':
        this.handlers.onCrossfader(value01);
        return;
      case 'volA':
        this.handlers.onVolume('A', value01);
        return;
      case 'volB':
        this.handlers.onVolume('B', value01);
        return;
      case 'tempoA':
        this.handlers.onTempo('A', value01 * 150 - 75);
        return;
      case 'tempoB':
        this.handlers.onTempo('B', value01 * 150 - 75);
        return;
      case 'filterA':
        this.handlers.onFilter('A', value01 * 2 - 1);
        return;
      case 'filterB':
        this.handlers.onFilter('B', value01 * 2 - 1);
        return;
      case 'stemVocalA':
        this.handlers.onStemVocal('A', value01);
        return;
      case 'stemVocalB':
        this.handlers.onStemVocal('B', value01);
        return;
      case 'stemDrumsA':
        this.handlers.onStemDrums('A', value01);
        return;
      case 'stemDrumsB':
        this.handlers.onStemDrums('B', value01);
        return;
      case 'stemInstA':
        this.handlers.onStemInst('A', value01);
        return;
      case 'stemInstB':
        this.handlers.onStemInst('B', value01);
        return;
      default:
        return;
    }
  }

  private flashLed(noteOrCc: number): void {
    if (!this.output) return;
    this.output.send([0x90, noteOrCc, 127]);
    setTimeout(() => {
      this.output?.send([0x80, noteOrCc, 0]);
    }, 70);
  }

  private loadBindings(): Partial<Record<MidiLearnTarget, MidiBinding>> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<Record<MidiLearnTarget, MidiBinding>>;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  }

  private saveBindings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
  }

  private emitStatus(status: MidiStatus): void {
    this.statusListener?.(status);
  }
}
