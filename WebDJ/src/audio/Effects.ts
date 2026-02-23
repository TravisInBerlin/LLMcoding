/**
 * Effects chain: Echo, Reverb, Filter.
 * Each effect has a wet/dry mix.
 */
export interface EffectNode {
    input: AudioNode;
    output: AudioNode;
    setWet(value: number): void;
    name: string;
}

export class EchoEffect implements EffectNode {
    name = 'Echo';
    input: GainNode;
    output: GainNode;
    private dry: GainNode;
    private wet: GainNode;
    private delay: DelayNode;
    private feedback: GainNode;

    constructor(ctx: AudioContext) {
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.dry = ctx.createGain();
        this.wet = ctx.createGain();
        this.delay = ctx.createDelay(2);
        this.feedback = ctx.createGain();

        this.delay.delayTime.value = 0.35;
        this.feedback.gain.value = 0.4;
        this.dry.gain.value = 1;
        this.wet.gain.value = 0;

        // dry path
        this.input.connect(this.dry);
        this.dry.connect(this.output);

        // wet path
        this.input.connect(this.delay);
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        this.delay.connect(this.wet);
        this.wet.connect(this.output);
    }

    setWet(value: number): void {
        this.wet.gain.value = value;
        this.dry.gain.value = 1 - value * 0.5;
    }
}

export class ReverbEffect implements EffectNode {
    name = 'Reverb';
    input: GainNode;
    output: GainNode;
    private dry: GainNode;
    private wet: GainNode;
    private convolver: ConvolverNode;

    constructor(ctx: AudioContext) {
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.dry = ctx.createGain();
        this.wet = ctx.createGain();
        this.convolver = ctx.createConvolver();

        this.dry.gain.value = 1;
        this.wet.gain.value = 0;

        // generate impulse response
        this.convolver.buffer = this.createImpulse(ctx, 2, 2);

        // dry
        this.input.connect(this.dry);
        this.dry.connect(this.output);

        // wet
        this.input.connect(this.convolver);
        this.convolver.connect(this.wet);
        this.wet.connect(this.output);
    }

    private createImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
        const length = ctx.sampleRate * duration;
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    setWet(value: number): void {
        this.wet.gain.value = value;
        this.dry.gain.value = 1 - value * 0.5;
    }
}

export class FilterEffect implements EffectNode {
    name = 'Filter';
    input: GainNode;
    output: GainNode;
    private filter: BiquadFilterNode;
    private bypass: GainNode;
    private filtered: GainNode;

    constructor(ctx: AudioContext) {
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.bypass = ctx.createGain();
        this.filtered = ctx.createGain();
        this.filter = ctx.createBiquadFilter();

        this.filter.type = 'lowpass';
        this.filter.frequency.value = 20000;
        this.filter.Q.value = 1;

        this.bypass.gain.value = 1;
        this.filtered.gain.value = 0;

        this.input.connect(this.bypass);
        this.bypass.connect(this.output);

        this.input.connect(this.filter);
        this.filter.connect(this.filtered);
        this.filtered.connect(this.output);
    }

    /** 0 = bypass, 0.5 = LP sweep down, 1 = full filter */
    setWet(value: number): void {
        if (value < 0.01) {
            this.bypass.gain.value = 1;
            this.filtered.gain.value = 0;
            return;
        }
        this.bypass.gain.value = 0;
        this.filtered.gain.value = 1;
        // sweep frequency: 20kHz → 200Hz
        const minFreq = 200;
        const maxFreq = 20000;
        const freq = maxFreq * Math.pow(minFreq / maxFreq, value);
        this.filter.frequency.value = freq;
    }
}
