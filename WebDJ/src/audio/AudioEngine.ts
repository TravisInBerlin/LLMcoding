/**
 * AudioEngine — shared AudioContext manager and master output chain.
 */
export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  cueBus: GainNode;
  private recordTap: MediaStreamAudioDestinationNode;
  private cueTap: MediaStreamAudioDestinationNode;
  private cueGain: GainNode;
  private limiter: DynamicsCompressorNode;
  private limiterGain: GainNode;
  private bypassGain: GainNode;
  private outputBus: GainNode;
  private limiterEnabled = true;

  constructor() {
    this.ctx = new AudioContext({
      latencyHint: 'interactive',
    });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.cueBus = this.ctx.createGain();
    this.cueBus.gain.value = 1;

    this.recordTap = this.ctx.createMediaStreamDestination();
    this.cueTap = this.ctx.createMediaStreamDestination();
    this.cueGain = this.ctx.createGain();
    this.cueGain.gain.value = 0.85;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 18;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;

    this.limiterGain = this.ctx.createGain();
    this.bypassGain = this.ctx.createGain();
    this.outputBus = this.ctx.createGain();

    this.masterGain.connect(this.limiter);
    this.masterGain.connect(this.bypassGain);
    this.limiter.connect(this.limiterGain);
    this.limiterGain.connect(this.outputBus);
    this.bypassGain.connect(this.outputBus);
    this.outputBus.connect(this.ctx.destination);
    this.outputBus.connect(this.recordTap);

    this.cueBus.connect(this.cueGain);
    this.cueGain.connect(this.cueTap);
    this.setLimiterEnabled(true);
  }

  get recordingStream(): MediaStream {
    return this.recordTap.stream;
  }

  get cueStream(): MediaStream {
    return this.cueTap.stream;
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  get limiterActive(): boolean {
    return this.limiterEnabled;
  }

  setLimiterEnabled(enabled: boolean): void {
    this.limiterEnabled = enabled;
    this.limiterGain.gain.value = enabled ? 1 : 0;
    this.bypassGain.gain.value = enabled ? 0 : 1;
  }

  setCueLevel(level01: number): void {
    this.cueGain.gain.value = Math.max(0, Math.min(1, level01));
  }
}
