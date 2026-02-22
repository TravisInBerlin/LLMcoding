/**
 * AudioEngine — shared AudioContext manager and master output chain.
 */
export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  private recordTap: MediaStreamAudioDestinationNode;

  constructor() {
    this.ctx = new AudioContext({
      latencyHint: 'interactive',
    });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;

    this.recordTap = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.connect(this.recordTap);
  }

  get recordingStream(): MediaStream {
    return this.recordTap.stream;
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
