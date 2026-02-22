/**
 * BPM Detector — offline peak-interval analysis on decoded AudioBuffer.
 */
export function detectBPM(buffer: AudioBuffer): number {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Down-sample by factor of 4 for speed
    const step = 4;
    const len = Math.floor(data.length / step);
    const samples = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        samples[i] = Math.abs(data[i * step]);
    }

    // Apply low-pass envelope
    const smoothed = new Float32Array(len);
    const alpha = 0.05;
    smoothed[0] = samples[0];
    for (let i = 1; i < len; i++) {
        smoothed[i] = alpha * samples[i] + (1 - alpha) * smoothed[i - 1];
    }

    // Find peaks
    const threshold = getThreshold(smoothed);
    const minInterval = Math.floor((sampleRate / step) * 60 / 200); // 200 BPM max
    const maxInterval = Math.floor((sampleRate / step) * 60 / 60);  // 60 BPM min

    const peaks: number[] = [];
    for (let i = 1; i < len - 1; i++) {
        if (
            smoothed[i] > threshold &&
            smoothed[i] > smoothed[i - 1] &&
            smoothed[i] > smoothed[i + 1]
        ) {
            if (peaks.length === 0 || i - peaks[peaks.length - 1] > minInterval) {
                peaks.push(i);
            }
        }
    }

    if (peaks.length < 2) return 120; // default fallback

    // Compute intervals and find most common
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
        const interval = peaks[i] - peaks[i - 1];
        if (interval >= minInterval && interval <= maxInterval) {
            intervals.push(interval);
        }
    }

    if (intervals.length === 0) return 120;

    // Cluster intervals with histogram
    const buckets = new Map<number, number>();
    for (const iv of intervals) {
        const rounded = Math.round(iv / 10) * 10;
        buckets.set(rounded, (buckets.get(rounded) || 0) + 1);
    }

    let bestBucket = 0;
    let bestCount = 0;
    for (const [bucket, count] of buckets) {
        if (count > bestCount) {
            bestCount = count;
            bestBucket = bucket;
        }
    }

    const bpm = (60 * sampleRate) / (bestBucket * step);
    // Normalize to 70-180 range
    let result = bpm;
    while (result > 180) result /= 2;
    while (result < 70) result *= 2;

    return Math.round(result * 10) / 10;
}

function getThreshold(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
    }
    return (sum / data.length) * 1.5;
}
