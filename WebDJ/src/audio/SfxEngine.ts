import { AudioEngine } from './AudioEngine';

export type SfxName =
  | 'airhorn'
  | 'laser'
  | 'clap'
  | 'impact'
  | 'siren'
  | 'whistle'
  | 'cowbell'
  | 'riser';

const SFX_NAMES: SfxName[] = ['airhorn', 'laser', 'clap', 'impact', 'siren', 'whistle', 'cowbell', 'riser'];

export const isSfxName = (value: unknown): value is SfxName =>
  typeof value === 'string' && SFX_NAMES.includes(value as SfxName);

const createNoiseSource = (ctx: AudioContext, durationSec: number): AudioBufferSourceNode => {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
};

export const triggerSfx = async (engine: AudioEngine, name: SfxName): Promise<void> => {
  await engine.resume();
  const ctx = engine.ctx;
  const now = ctx.currentTime + 0.003;

  if (name === 'airhorn') {
    const master = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.2, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    tone.type = 'bandpass';
    tone.frequency.setValueAtTime(780, now);
    tone.Q.value = 1.1;
    oscA.type = 'sawtooth';
    oscB.type = 'square';
    oscA.frequency.setValueAtTime(560, now);
    oscA.frequency.linearRampToValueAtTime(460, now + 0.44);
    oscB.frequency.setValueAtTime(820, now);
    oscB.frequency.linearRampToValueAtTime(700, now + 0.44);
    oscA.connect(tone);
    oscB.connect(tone);
    tone.connect(master);
    master.connect(engine.masterGain);
    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.5);
    oscB.stop(now + 0.5);
    return;
  }

  if (name === 'laser') {
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 220;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(engine.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
    return;
  }

  if (name === 'clap') {
    const delays = [0, 0.038, 0.076];
    delays.forEach((offset, idx) => {
      const src = createNoiseSource(ctx, 0.13);
      const hp = ctx.createBiquadFilter();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 850;
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 0.9;
      const start = now + offset;
      const level = idx === 0 ? 0.22 : idx === 1 ? 0.16 : 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
      src.connect(hp);
      hp.connect(bp);
      bp.connect(gain);
      gain.connect(engine.masterGain);
      src.start(start);
      src.stop(start + 0.11);
    });
    return;
  }

  if (name === 'siren') {
    const carrier = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const band = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    band.type = 'bandpass';
    band.frequency.setValueAtTime(940, now);
    band.Q.value = 1.2;

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(560, now);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(4.4, now);
    lfoGain.gain.setValueAtTime(175, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);

    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);
    carrier.connect(band);
    band.connect(gain);
    gain.connect(engine.masterGain);

    carrier.start(now);
    lfo.start(now);
    carrier.stop(now + 0.86);
    lfo.stop(now + 0.86);
    return;
  }

  if (name === 'whistle') {
    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    hp.type = 'highpass';
    hp.frequency.setValueAtTime(900, now);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.19);
    osc.frequency.exponentialRampToValueAtTime(1700, now + 0.42);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(9.5, now);
    vibratoGain.gain.setValueAtTime(40, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.17, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

    osc.connect(hp);
    hp.connect(gain);
    gain.connect(engine.masterGain);
    osc.start(now);
    vibrato.start(now);
    osc.stop(now + 0.5);
    vibrato.stop(now + 0.5);
    return;
  }

  if (name === 'cowbell') {
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscA.type = 'square';
    oscB.type = 'square';
    oscA.frequency.setValueAtTime(560, now);
    oscB.frequency.setValueAtTime(845, now);
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1320, now);
    bp.Q.value = 5.2;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscA.connect(bp);
    oscB.connect(bp);
    bp.connect(gain);
    gain.connect(engine.masterGain);
    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.23);
    oscB.stop(now + 0.23);
    return;
  }

  if (name === 'riser') {
    const riseNoise = createNoiseSource(ctx, 1.05);
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    const toneFilter = ctx.createBiquadFilter();
    const master = ctx.createGain();

    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(240, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.95);

    tone.type = 'sawtooth';
    tone.frequency.setValueAtTime(150, now);
    tone.frequency.exponentialRampToValueAtTime(1120, now + 0.94);
    toneFilter.type = 'lowpass';
    toneFilter.frequency.setValueAtTime(1500, now);
    toneFilter.frequency.exponentialRampToValueAtTime(5200, now + 0.95);

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.14, now + 0.86);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.12, now + 0.9);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.92);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.04);

    riseNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    tone.connect(toneFilter);
    toneFilter.connect(toneGain);
    toneGain.connect(master);
    master.connect(engine.masterGain);

    riseNoise.start(now);
    riseNoise.stop(now + 1.02);
    tone.start(now);
    tone.stop(now + 1.02);
    return;
  }

  const src = createNoiseSource(ctx, 0.95);
  const lp = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(260, now);
  lp.frequency.exponentialRampToValueAtTime(65, now + 0.8);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.26, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.88);
  src.connect(lp);
  lp.connect(gain);
  gain.connect(engine.masterGain);
  src.start(now);
  src.stop(now + 0.92);
};
