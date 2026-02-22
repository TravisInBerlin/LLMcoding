/**
 * Crossfader — equal-power crossfade between two gain nodes.
 */
export class Crossfader {
    private gainA: GainNode;
    private gainB: GainNode;
    private _position = 0.5; // 0=full A, 1=full B

    constructor(gainA: GainNode, gainB: GainNode) {
        this.gainA = gainA;
        this.gainB = gainB;
        this.setPosition(0.5);
    }

    get position(): number {
        return this._position;
    }

    setPosition(value: number): void {
        this._position = Math.max(0, Math.min(1, value));
        // Equal-power crossfade
        this.gainA.gain.value = Math.cos(this._position * Math.PI / 2);
        this.gainB.gain.value = Math.sin(this._position * Math.PI / 2);
    }
}
