import * as ort from 'onnxruntime-web';
import type { StemName } from './Deck';

export type SeparationMode = 'onnx-webgpu' | 'onnx-wasm' | 'hybrid';

export interface SeparationResult {
  stems: Record<StemName, AudioBuffer>;
  mode: SeparationMode;
}

interface SeparationOptions {
  onProgress?: (value: number) => void;
}

interface NeuralModelConfig {
  inputName?: string;
  outputNames?: {
    drums?: string;
    instruments?: string;
    vocals?: string;
  };
  frameSize?: number;
  overlapRatio?: number;
}

const joinBasePath = (base: string, path: string): string => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

/**
 * NeuralSeparator
 * - Uses ONNX Runtime Web (WebGPU/WASM) when model is available.
 * - Falls back to hybrid spectral split so the app always remains usable.
 */
export class NeuralSeparator {
  private ctx: AudioContext;
  private session: ort.InferenceSession | null = null;
  private mode: SeparationMode = 'hybrid';
  private config: NeuralModelConfig = {
    frameSize: 262144,
    overlapRatio: 0.25,
  };

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async separate(buffer: AudioBuffer, options: SeparationOptions = {}): Promise<SeparationResult> {
    options.onProgress?.(0.01);
    const ready = await this.ensureSession();

    if (ready && this.session) {
      try {
        const stems = await this.runOnnxChunked(buffer, options.onProgress);
        options.onProgress?.(1);
        return {
          stems,
          mode: this.mode,
        };
      } catch {
        // Fall through to robust fallback.
      }
    }

    const stems = await this.runHybridSeparation(buffer, options.onProgress);
    options.onProgress?.(1);
    return {
      stems,
      mode: 'hybrid',
    };
  }

  private async ensureSession(): Promise<boolean> {
    if (this.session) return true;

    await this.loadConfig();

    const baseUrl = import.meta.env.BASE_URL || '/';
    const modelUrl = joinBasePath(baseUrl, 'models/neuralmix.onnx');

    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: unknown }) : null;
    if (nav?.gpu) {
      try {
        this.session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['webgpu'],
          graphOptimizationLevel: 'all',
        });
        this.mode = 'onnx-webgpu';
        return true;
      } catch {
        // Continue to WASM attempt.
      }
    }

    try {
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      this.mode = 'onnx-wasm';
      return true;
    } catch {
      this.session = null;
      this.mode = 'hybrid';
      return false;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const configUrl = joinBasePath(baseUrl, 'models/neuralmix.config.json');
      const res = await fetch(configUrl, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as NeuralModelConfig;
      this.config = {
        ...this.config,
        ...json,
      };
    } catch {
      // Optional config file.
    }
  }

  private async runOnnxChunked(
    buffer: AudioBuffer,
    onProgress?: (value: number) => void,
  ): Promise<Record<StemName, AudioBuffer>> {
    if (!this.session) throw new Error('ONNX session unavailable');

    const mono = this.toMono(buffer);
    const frameSize = Math.max(16384, this.config.frameSize || 262144);
    const overlapRatio = Math.max(0, Math.min(0.5, this.config.overlapRatio || 0.25));
    const hop = Math.max(1, Math.floor(frameSize * (1 - overlapRatio)));
    const fade = this.makeHann(frameSize);

    const drumsAcc = new Float32Array(mono.length);
    const instrumentsAcc = new Float32Array(mono.length);
    const vocalsAcc = new Float32Array(mono.length);
    const weightAcc = new Float32Array(mono.length);

    const totalChunks = Math.max(1, Math.ceil(mono.length / hop));
    let chunkIndex = 0;
    for (let start = 0; start < mono.length; start += hop) {
      const frame = new Float32Array(frameSize);
      const frameLen = Math.min(frameSize, mono.length - start);
      frame.set(mono.subarray(start, start + frameLen));

      const out = await this.runOnnxFrame(frame);

      for (let i = 0; i < frameLen; i++) {
        const idx = start + i;
        const w = fade[i];
        drumsAcc[idx] += out.drums[i] * w;
        instrumentsAcc[idx] += out.instruments[i] * w;
        vocalsAcc[idx] += out.vocals[i] * w;
        weightAcc[idx] += w;
      }

      // Yield briefly so UI remains responsive on long files.
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0);
      });
      chunkIndex += 1;
      onProgress?.(Math.min(0.96, chunkIndex / totalChunks));

      if (start + frameLen >= mono.length) break;
    }

    for (let i = 0; i < mono.length; i++) {
      const w = weightAcc[i] || 1;
      drumsAcc[i] /= w;
      instrumentsAcc[i] /= w;
      vocalsAcc[i] /= w;
    }

    return {
      drums: this.toStereoBuffer(drumsAcc, buffer.sampleRate),
      instruments: this.toStereoBuffer(instrumentsAcc, buffer.sampleRate),
      vocals: this.toStereoBuffer(vocalsAcc, buffer.sampleRate),
    };
  }

  private async runOnnxFrame(frame: Float32Array): Promise<Record<StemName, Float32Array>> {
    if (!this.session) throw new Error('ONNX session unavailable');

    const inputName = this.config.inputName || this.session.inputNames[0];
    const input = new ort.Tensor('float32', frame, [1, 1, frame.length]);
    const output = await this.session.run({ [inputName]: input });

    const drumsKey = this.config.outputNames?.drums || 'drums';
    const instrumentsKey = this.config.outputNames?.instruments || 'instruments';
    const vocalsKey = this.config.outputNames?.vocals || 'vocals';

    return {
      drums: this.extractStemTensor(output, drumsKey, 0, frame.length),
      instruments: this.extractStemTensor(output, instrumentsKey, 1, frame.length),
      vocals: this.extractStemTensor(output, vocalsKey, 2, frame.length),
    };
  }

  private extractStemTensor(
    output: Record<string, ort.Tensor>,
    namedKey: string,
    index: number,
    expectedLength: number,
  ): Float32Array {
    if (output[namedKey]) {
      const t = output[namedKey];
      return this.reshapeToMono(t.data as Float32Array, t.dims, expectedLength, index);
    }

    const first = output[Object.keys(output)[0]];
    if (!first) throw new Error('ONNX output is empty');

    return this.reshapeToMono(first.data as Float32Array, first.dims, expectedLength, index);
  }

  private reshapeToMono(data: Float32Array, dims: readonly number[], expectedLength: number, index: number): Float32Array {
    if (dims.length === 1) {
      if (data.length !== expectedLength) throw new Error('Unexpected 1D output shape');
      return new Float32Array(data);
    }

    if (dims.length === 2) {
      const [a, b] = dims;
      if (a === 3 && b >= expectedLength) {
        return data.slice(index * b, index * b + expectedLength);
      }
      if (b === 3 && a >= expectedLength) {
        const out = new Float32Array(expectedLength);
        for (let i = 0; i < expectedLength; i++) out[i] = data[i * 3 + index];
        return out;
      }
    }

    if (dims.length === 3) {
      const [n, c, t] = dims;
      if (n === 1 && c >= 3 && t >= expectedLength) {
        return data.slice(index * t, index * t + expectedLength);
      }
    }

    throw new Error('Unsupported ONNX output shape for stems');
  }

  private async runHybridSeparation(
    buffer: AudioBuffer,
    onProgress?: (value: number) => void,
  ): Promise<Record<StemName, AudioBuffer>> {
    onProgress?.(0.15);
    const drums = await this.renderFiltered(buffer, {
      type: 'lowpass',
      frequency: 220,
      q: 0.8,
    });
    onProgress?.(0.45);

    const vocals = await this.renderFiltered(buffer, {
      type: 'bandpass',
      frequency: 1700,
      q: 0.85,
    });
    onProgress?.(0.7);

    const instruments = this.createResidual(buffer, drums, vocals, 0.58, 0.62);

    this.normalize(drums);
    this.normalize(vocals);
    this.normalize(instruments);
    onProgress?.(0.95);

    return { drums, instruments, vocals };
  }

  private async renderFiltered(
    sourceBuffer: AudioBuffer,
    opts: { type: BiquadFilterType; frequency: number; q: number },
  ): Promise<AudioBuffer> {
    const offline = new OfflineAudioContext(sourceBuffer.numberOfChannels, sourceBuffer.length, sourceBuffer.sampleRate);
    const src = offline.createBufferSource();
    src.buffer = sourceBuffer;

    const filter = offline.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.frequency;
    filter.Q.value = opts.q;

    src.connect(filter);
    filter.connect(offline.destination);
    src.start();

    return await offline.startRendering();
  }

  private createResidual(
    original: AudioBuffer,
    a: AudioBuffer,
    b: AudioBuffer,
    aGain: number,
    bGain: number,
  ): AudioBuffer {
    const out = this.ctx.createBuffer(original.numberOfChannels, original.length, original.sampleRate);

    for (let ch = 0; ch < original.numberOfChannels; ch++) {
      const src = original.getChannelData(ch);
      const da = a.getChannelData(ch);
      const db = b.getChannelData(ch);
      const dst = out.getChannelData(ch);

      for (let i = 0; i < original.length; i++) {
        dst[i] = src[i] - da[i] * aGain - db[i] * bGain;
      }
    }

    return out;
  }

  private normalize(buffer: AudioBuffer): void {
    let peak = 0;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }

    if (peak < 1e-6 || peak <= 0.98) return;
    const gain = 0.98 / peak;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] *= gain;
    }
  }

  private toMono(buffer: AudioBuffer): Float32Array {
    const out = new Float32Array(buffer.length);
    const channels = buffer.numberOfChannels;

    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) out[i] += data[i];
    }

    const inv = 1 / channels;
    for (let i = 0; i < out.length; i++) out[i] *= inv;
    return out;
  }

  private toStereoBuffer(mono: Float32Array, sampleRate: number): AudioBuffer {
    const out = this.ctx.createBuffer(2, mono.length, sampleRate);
    out.getChannelData(0).set(mono);
    out.getChannelData(1).set(mono);
    return out;
  }

  private makeHann(size: number): Float32Array {
    const w = new Float32Array(size);
    if (size <= 1) {
      w[0] = 1;
      return w;
    }

    for (let i = 0; i < size; i++) {
      w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    return w;
  }
}
