import { AudioEngine } from './AudioEngine';
import { EchoEffect, ReverbEffect, FilterEffect } from './Effects';
import type { EffectNode } from './Effects';
import { detectBPM } from './BPMDetector';
import { NeuralSeparator, type SeparationMode } from './NeuralSeparator';
import { CUE_COLOR_PALETTE } from './cuePalette';

export type DeckId = 'A' | 'B' | 'C' | 'D';

export interface CuePoint {
  id: number;
  position: number;
  color: string;
}

export interface LoopSlot {
  id: number;
  inPoint: number;
  outPoint: number;
  beats: number;
}

export type StemName = 'drums' | 'instruments' | 'vocals';

export type DeckEventType =
  | 'loaded'
  | 'play'
  | 'pause'
  | 'timeupdate'
  | 'bpm'
  | 'statechange';
type DeckListener = (deck: Deck) => void;

/**
 * Deck — per-deck audio graph with playback, EQ, loops, cues, and neural stems.
 */
export class Deck {
  private static separationCache = new Map<string, { stems: Record<StemName, AudioBuffer>; mode: SeparationMode }>();
  private static cacheOrder: string[] = [];
  private static readonly maxCacheEntries = 8;

  readonly id: DeckId;
  private engine: AudioEngine;
  private separator: NeuralSeparator;

  // source + transport
  private stemSourceNodes: Record<StemName, AudioBufferSourceNode | null> = {
    drums: null,
    instruments: null,
    vocals: null,
  };
  private _playing = false;
  private _startTime = 0;
  private _offset = 0;

  // mixer state
  private _volume = 0.8;
  private _cueEnabled = false;
  private _cueLevel = 1;
  private _tempoPercent = 0;
  private _keySemitone = 0;
  private _keyLock = false;

  // audio nodes
  private channelGain: GainNode;
  private cueSendGain: GainNode;
  private stemSum: GainNode;
  private stemNodes: Record<StemName, { gain: GainNode }>;
  private stemLevels: Record<StemName, number> = {
    drums: 1,
    instruments: 1,
    vocals: 1,
  };

  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  private toneFilter: BiquadFilterNode;
  analyser: AnalyserNode;
  crossfadeGain: GainNode;

  // effects
  effects: EffectNode[];
  private echoEffect: EchoEffect;
  private reverbEffect: ReverbEffect;
  private filterEffect: FilterEffect;

  // track metadata/state
  buffer: AudioBuffer | null = null;
  private stemBuffers: Record<StemName, AudioBuffer | null> = {
    drums: null,
    instruments: null,
    vocals: null,
  };

  bpm = 0;
  trackName = '';
  trackArtist = '';
  duration = 0;
  musicalKey = 'Unknown';
  stemMode: SeparationMode | 'analyzing' | 'none' = 'none';
  separationProgress = 0;

  // loops & cues
  loopIn = -1;
  loopOut = -1;
  loopActive = false;
  autoLoopBeats: number | null = null;
  cuePoints: CuePoint[] = [];
  savedLoops: LoopSlot[] = [];
  private _loopTimerId: number | null = null;

  // events
  private listeners: Map<DeckEventType, DeckListener[]> = new Map();
  private _rafId = 0;

  // waveform data
  peaks: Float32Array | null = null;

  constructor(engine: AudioEngine, id: DeckId) {
    this.engine = engine;
    this.id = id;
    this.separator = new NeuralSeparator(engine.ctx);
    const ctx = engine.ctx;

    this.channelGain = ctx.createGain();
    this.channelGain.gain.value = this._volume;
    this.cueSendGain = ctx.createGain();
    this.cueSendGain.gain.value = 0;

    this.stemSum = ctx.createGain();

    this.stemNodes = {
      drums: { gain: ctx.createGain() },
      instruments: { gain: ctx.createGain() },
      vocals: { gain: ctx.createGain() },
    };

    this.stemNodes.drums.gain.gain.value = 1;
    this.stemNodes.instruments.gain.gain.value = 1;
    this.stemNodes.vocals.gain.gain.value = 1;

    this.eqLow = ctx.createBiquadFilter();
    this.eqMid = ctx.createBiquadFilter();
    this.eqHigh = ctx.createBiquadFilter();
    this.toneFilter = ctx.createBiquadFilter();
    this.analyser = ctx.createAnalyser();
    this.crossfadeGain = ctx.createGain();

    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 320;
    this.eqLow.gain.value = 0;

    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.8;
    this.eqMid.gain.value = 0;

    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 3600;
    this.eqHigh.gain.value = 0;

    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 22000;
    this.toneFilter.Q.value = 0.8;

    this.analyser.fftSize = 512;

    this.echoEffect = new EchoEffect(ctx);
    this.reverbEffect = new ReverbEffect(ctx);
    this.filterEffect = new FilterEffect(ctx);
    this.effects = [this.echoEffect, this.reverbEffect, this.filterEffect];

    // Chain
    this.stemNodes.drums.gain.connect(this.stemSum);
    this.stemNodes.instruments.gain.connect(this.stemSum);
    this.stemNodes.vocals.gain.connect(this.stemSum);

    this.stemSum.connect(this.channelGain);
    this.channelGain.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.toneFilter);
    this.toneFilter.connect(this.echoEffect.input);
    this.echoEffect.output.connect(this.reverbEffect.input);
    this.reverbEffect.output.connect(this.filterEffect.input);
    this.filterEffect.output.connect(this.analyser);
    this.analyser.connect(this.crossfadeGain);
    this.analyser.connect(this.cueSendGain);
    this.crossfadeGain.connect(engine.masterGain);
    this.cueSendGain.connect(engine.cueBus);
  }

  on(event: DeckEventType, listener: DeckListener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: DeckEventType): void {
    this.listeners.get(event)?.forEach((fn) => fn(this));
  }

  get playing(): boolean {
    return this._playing;
  }

  get currentTime(): number {
    if (!this._playing) return this._offset;
    return this._offset + (this.engine.ctx.currentTime - this._startTime) * this.playbackRate;
  }

  get playbackRate(): number {
    return 1 + this._tempoPercent / 100;
  }

  get tempoPercent(): number {
    return this._tempoPercent;
  }

  set tempoPercent(v: number) {
    this._tempoPercent = Math.max(-75, Math.min(75, v));
    this.refreshSourceRate();
    this.emit('statechange');
  }

  get keySemitone(): number {
    return this._keySemitone;
  }

  set keySemitone(v: number) {
    this._keySemitone = Math.max(-12, Math.min(12, Math.round(v)));
    this.refreshSourceRate();
    this.emit('statechange');
  }

  get keyLock(): boolean {
    return this._keyLock;
  }

  set keyLock(v: boolean) {
    this._keyLock = v;
    this.refreshSourceRate();
    this.emit('statechange');
  }

  get volume(): number {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.channelGain.gain.value = this._volume;
  }

  get cueEnabled(): boolean {
    return this._cueEnabled;
  }

  setCueEnabled(enabled: boolean): void {
    this._cueEnabled = enabled;
    this.applyCueSend();
    this.emit('statechange');
  }

  toggleCueEnabled(): void {
    this.setCueEnabled(!this._cueEnabled);
  }

  setCueLevel(level: number): void {
    this._cueLevel = Math.max(0, Math.min(1, level));
    this.applyCueSend();
  }

  get beatInterval(): number {
    if (this.bpm <= 0) return 0;
    return 60 / this.bpm;
  }

  getStemLevel(stem: StemName): number {
    return this.stemLevels[stem];
  }

  setStemLevel(stem: StemName, level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.stemLevels[stem] = clamped;
    this.stemNodes[stem].gain.gain.value = clamped;
    this.emit('statechange');
  }

  toggleStemMute(stem: StemName): void {
    const current = this.getStemLevel(stem);
    this.setStemLevel(stem, current > 0.001 ? 0 : 1);
  }

  setFilterBlend(value: number): void {
    const v = Math.max(-1, Math.min(1, value));
    if (Math.abs(v) < 0.02) {
      this.toneFilter.type = 'lowpass';
      this.toneFilter.frequency.value = 22000;
      return;
    }

    if (v < 0) {
      this.toneFilter.type = 'lowpass';
      const minFreq = 160;
      const maxFreq = 22000;
      const norm = Math.abs(v);
      const freq = maxFreq * Math.pow(minFreq / maxFreq, norm);
      this.toneFilter.frequency.value = freq;
      return;
    }

    this.toneFilter.type = 'highpass';
    const minFreq = 60;
    const maxFreq = 9000;
    const freq = minFreq * Math.pow(maxFreq / minFreq, v);
    this.toneFilter.frequency.value = freq;
  }

  async loadFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    this.buffer = await this.engine.ctx.decodeAudioData(arrayBuffer);
    this.duration = this.buffer.duration;
    this.trackName = file.name.replace(/\.[^/.]+$/, '');
    this.trackArtist = '';

    this.peaks = this.computePeaks(this.buffer, 3200);
    this.bpm = detectBPM(this.buffer);
    this.musicalKey = this.estimateKey(this.buffer);

    this._offset = 0;
    this._playing = false;
    this.loopIn = -1;
    this.loopOut = -1;
    this.loopActive = false;
    this.autoLoopBeats = null;
    this.cuePoints = [];
    this.savedLoops = [];
    this._tempoPercent = 0;
    this._keySemitone = 0;
    this._keyLock = false;

    this.stemMode = 'analyzing';
    this.separationProgress = 0;
    this.emit('bpm');
    this.emit('loaded');
    this.emit('statechange');

    const cacheKey = `${file.name}:${file.size}:${file.lastModified}`;
    const cached = Deck.separationCache.get(cacheKey);
    if (cached) {
      this.stemBuffers = cached.stems;
      this.stemMode = cached.mode;
      this.separationProgress = 1;
      this.emit('statechange');
      return;
    }

    // Run AI separation after decode.
    const result = await this.separator.separate(this.buffer, {
      onProgress: (value) => {
        this.separationProgress = Math.max(0, Math.min(1, value));
        this.emit('statechange');
      },
    });
    this.stemBuffers = result.stems;
    this.stemMode = result.mode;
    this.separationProgress = 1;
    Deck.separationCache.set(cacheKey, { stems: result.stems, mode: result.mode });
    Deck.cacheOrder = Deck.cacheOrder.filter((k) => k !== cacheKey);
    Deck.cacheOrder.push(cacheKey);
    while (Deck.cacheOrder.length > Deck.maxCacheEntries) {
      const oldest = Deck.cacheOrder.shift();
      if (oldest) Deck.separationCache.delete(oldest);
    }
    if (this._playing) {
      const pos = this.currentTime;
      this.pause();
      this._offset = pos;
      void this.play();
    }

    this.emit('statechange');
  }

  async play(): Promise<void> {
    if (!this.buffer || this._playing) return;
    await this.engine.resume();
    if (!this.buffer || this._playing) return;

    this.ensureStemBuffers();

    (['drums', 'instruments', 'vocals'] as StemName[]).forEach((stem) => {
      const source = this.engine.ctx.createBufferSource();
      source.buffer = this.stemBuffers[stem]!;
      source.connect(this.stemNodes[stem].gain);
      this.stemSourceNodes[stem] = source;
    });

    this.refreshSourceRate();

    const offset = Math.max(0, Math.min(this._offset, this.duration));
    (['drums', 'instruments', 'vocals'] as StemName[]).forEach((stem) => {
      this.stemSourceNodes[stem]!.start(0, offset);
    });

    this._startTime = this.engine.ctx.currentTime;
    this._offset = offset;
    this._playing = true;

    const instrumentSource = this.stemSourceNodes.instruments!;
    instrumentSource.onended = () => {
      // Ignore stale onended callbacks from previous sources (e.g. while seeking).
      if (this.stemSourceNodes.instruments !== instrumentSource) return;
      if (this._playing) {
        this._playing = false;
        this._offset = 0;
        this.cleanupSources();
        this.emit('pause');
      }
    };

    this.startTimeUpdate();
    this.startLoopCheck();
    this.emit('play');
  }

  pause(): void {
    if (!this._playing) return;
    this._offset = this.currentTime;
    this._playing = false;

    (['drums', 'instruments', 'vocals'] as StemName[]).forEach((stem) => {
      const src = this.stemSourceNodes[stem];
      if (!src) return;
      src.stop();
      src.disconnect();
      this.stemSourceNodes[stem] = null;
    });

    this.stopTimeUpdate();
    this.stopLoopCheck();
    this.emit('pause');
  }

  togglePlay(): void {
    if (this._playing) {
      this.pause();
    } else {
      void this.play();
    }
  }

  seek(time: number): void {
    const wasPlaying = this._playing;
    if (wasPlaying) this.pause();
    this._offset = Math.max(0, Math.min(time, this.duration));
    if (wasPlaying) void this.play();
    this.emit('timeupdate');
  }

  // Loop controls
  setLoopIn(): void {
    this.loopIn = this.currentTime;
    this.autoLoopBeats = null;
    if (this.loopOut > 0 && this.loopIn < this.loopOut) {
      this.loopActive = true;
    }
    this.emit('statechange');
  }

  clearLoopIn(): void {
    this.loopIn = -1;
    this.autoLoopBeats = null;
    this.loopActive = false;
    this.emit('statechange');
  }

  setLoopOut(): void {
    this.loopOut = this.currentTime;
    this.autoLoopBeats = null;
    if (this.loopIn >= 0 && this.loopIn < this.loopOut) {
      this.loopActive = true;
    }
    this.emit('statechange');
  }

  clearLoopOut(): void {
    this.loopOut = -1;
    this.autoLoopBeats = null;
    this.loopActive = false;
    this.emit('statechange');
  }

  setAutoLoop(beats: number): void {
    const safeBeats = Math.max(1, Math.min(64, beats));
    const loopLen = this.beatInterval > 0 ? this.beatInterval * safeBeats : safeBeats * 0.5;
    this.loopIn = this.currentTime;
    this.loopOut = Math.min(this.duration, this.loopIn + loopLen);
    this.loopActive = this.loopOut > this.loopIn;
    this.autoLoopBeats = this.loopActive ? safeBeats : null;
    this.emit('statechange');
  }

  toggleAutoLoop(beats: number): void {
    const safeBeats = Math.max(1, Math.min(64, beats));
    if (this.loopActive && this.autoLoopBeats === safeBeats) {
      this.loopActive = false;
      this.autoLoopBeats = null;
      this.emit('statechange');
      return;
    }
    this.setAutoLoop(safeBeats);
  }

  toggleLoop(force?: boolean): void {
    this.loopActive = typeof force === 'boolean' ? force : !this.loopActive;
    if (!this.loopActive) {
      this.autoLoopBeats = null;
    }
    this.emit('statechange');
  }

  saveCurrentLoop(slot: number, beats = 4): void {
    if (this.loopIn < 0 || this.loopOut <= this.loopIn) return;
    const idx = this.savedLoops.findIndex((s) => s.id === slot);
    const loop: LoopSlot = {
      id: slot,
      inPoint: this.loopIn,
      outPoint: this.loopOut,
      beats,
    };
    if (idx >= 0) {
      this.savedLoops[idx] = loop;
    } else {
      this.savedLoops.push(loop);
    }
    this.emit('statechange');
  }

  loadSavedLoop(slot: number): void {
    const loop = this.savedLoops.find((s) => s.id === slot);
    if (!loop) return;
    this.loopIn = loop.inPoint;
    this.loopOut = loop.outPoint;
    this.loopActive = true;
    this.autoLoopBeats = null;
    this.seek(loop.inPoint);
    this.emit('statechange');
  }

  // Cue points
  setCuePoint(id: number): void {
    const existing = this.cuePoints.find((c) => c.id === id);
    if (existing) {
      existing.position = this.currentTime;
    } else {
      this.cuePoints.push({
        id,
        position: this.currentTime,
        color: CUE_COLOR_PALETTE[id % CUE_COLOR_PALETTE.length],
      });
    }
    this.emit('statechange');
  }

  jumpToCue(id: number): void {
    const cue = this.cuePoints.find((c) => c.id === id);
    if (cue) this.seek(cue.position);
  }

  clearCuePoint(id: number): void {
    const index = this.cuePoints.findIndex((c) => c.id === id);
    if (index >= 0) {
      this.cuePoints.splice(index, 1);
      this.emit('statechange');
    }
  }

  syncTo(targetBPM: number): void {
    if (this.bpm <= 0 || targetBPM <= 0) return;
    const targetRate = targetBPM / this.bpm;
    this.tempoPercent = (targetRate - 1) * 100;
  }

  matchKey(targetSemitone: number): void {
    this.keySemitone = targetSemitone;
  }

  private ensureStemBuffers(): void {
    if (this.stemBuffers.drums && this.stemBuffers.instruments && this.stemBuffers.vocals) return;
    if (!this.buffer) return;
    const silence = this.engine.ctx.createBuffer(this.buffer.numberOfChannels, this.buffer.length, this.buffer.sampleRate);
    this.stemBuffers = {
      drums: silence,
      instruments: this.buffer,
      vocals: silence,
    };
  }

  private cleanupSources(): void {
    (['drums', 'instruments', 'vocals'] as StemName[]).forEach((stem) => {
      const src = this.stemSourceNodes[stem];
      if (!src) return;
      src.disconnect();
      this.stemSourceNodes[stem] = null;
    });
  }

  private startLoopCheck(): void {
    this.stopLoopCheck();
    const check = () => {
      if (this.loopActive && this.loopIn >= 0 && this.loopOut > this.loopIn) {
        if (this.currentTime >= this.loopOut) {
          this.seek(this.loopIn);
        }
      }
      if (this._playing) {
        this._loopTimerId = window.setTimeout(check, 20);
      }
    };
    check();
  }

  private stopLoopCheck(): void {
    if (this._loopTimerId !== null) {
      clearTimeout(this._loopTimerId);
      this._loopTimerId = null;
    }
  }

  private startTimeUpdate(): void {
    this.stopTimeUpdate();
    const update = () => {
      this.emit('timeupdate');
      if (this._playing) {
        this._rafId = requestAnimationFrame(update);
      }
    };
    this._rafId = requestAnimationFrame(update);
  }

  private stopTimeUpdate(): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  private refreshSourceRate(): void {
    (['drums', 'instruments', 'vocals'] as StemName[]).forEach((stem) => {
      const src = this.stemSourceNodes[stem];
      if (!src) return;
      src.playbackRate.value = this.playbackRate;
      const detune = this._keyLock ? 0 : this._keySemitone * 100;
      src.detune.value = detune;
    });

    if (this._playing) {
      this._offset = this.currentTime;
      this._startTime = this.engine.ctx.currentTime;
    }
  }

  private applyCueSend(): void {
    this.cueSendGain.gain.value = this._cueEnabled ? this._cueLevel : 0;
  }

  private computePeaks(buffer: AudioBuffer, numPeaks: number): Float32Array {
    const data = buffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(data.length / numPeaks));
    const peaks = new Float32Array(numPeaks);

    for (let i = 0; i < numPeaks; i++) {
      let max = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, data.length);
      for (let j = start; j < end; j++) {
        const abs = Math.abs(data[j]);
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }

    return peaks;
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
        if ((data[j - 1] <= 0 && data[j] > 0) || (data[j - 1] >= 0 && data[j] < 0)) {
          crossings++;
        }
      }

      const freq = (crossings * sampleRate) / (2 * hop);
      if (freq < 55 || freq > 1760) continue;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      const pc = ((midi % 12) + 12) % 12;
      pcEnergy[pc] += 1;
    }

    const rotate = (arr: number[], n: number): number[] => {
      const out = new Array<number>(arr.length);
      for (let i = 0; i < arr.length; i++) {
        out[i] = arr[(i + n) % arr.length];
      }
      return out;
    };

    const corr = (a: number[], b: number[]): number => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += a[i] * b[i];
      return s;
    };

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
}
