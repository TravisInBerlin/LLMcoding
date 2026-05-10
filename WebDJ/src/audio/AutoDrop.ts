import { Crossfader } from './Crossfader';
import { Deck, type DeckId } from './Deck';

export type TransitionStyle = 'smooth' | 'power' | 'neural';
export type AutoDropRoute = 'A-B' | 'B-A' | 'C-D' | 'D-C';

export const AUTO_DROP_ROUTES: AutoDropRoute[] = ['A-B', 'B-A', 'C-D', 'D-C'];

const AUTO_DROP_PAIRS: Record<AutoDropRoute, { sourceId: DeckId; targetId: DeckId; usesMainCrossfader: boolean }> = {
  'A-B': { sourceId: 'A', targetId: 'B', usesMainCrossfader: true },
  'B-A': { sourceId: 'B', targetId: 'A', usesMainCrossfader: true },
  'C-D': { sourceId: 'C', targetId: 'D', usesMainCrossfader: false },
  'D-C': { sourceId: 'D', targetId: 'C', usesMainCrossfader: false },
};

export const isAutoDropRoute = (value: unknown): value is AutoDropRoute =>
  typeof value === 'string' && AUTO_DROP_ROUTES.includes(value as AutoDropRoute);

export const getAutoDropPair = (route: AutoDropRoute): { sourceId: DeckId; targetId: DeckId; usesMainCrossfader: boolean } =>
  AUTO_DROP_PAIRS[route];

type AutoDropOptions = {
  route: AutoDropRoute;
  transitionStyle: TransitionStyle;
  deckMap: Map<DeckId, Deck>;
  crossfader: Crossfader;
  autoSyncBpm: boolean;
  autoMatchKey: boolean;
  parseKeyRoot: (key: string) => number | null;
  onStatus: (message: string) => void;
};

export const runAutoDropTransition = async ({
  route,
  transitionStyle,
  deckMap,
  crossfader,
  autoSyncBpm,
  autoMatchKey,
  parseKeyRoot,
  onStatus,
}: AutoDropOptions): Promise<void> => {
  const pair = AUTO_DROP_PAIRS[route];
  const source = deckMap.get(pair.sourceId)!;
  const target = deckMap.get(pair.targetId)!;

  if (!source.buffer || !target.buffer) {
    onStatus(`Auto Drop ${pair.sourceId} -> ${pair.targetId}: load both tracks first`);
    return;
  }

  if (!source.playing && !target.playing) {
    await source.play();
    if (pair.usesMainCrossfader) {
      crossfader.setPosition(source.id === 'A' ? 0 : 1);
    } else {
      source.crossfadeGain.gain.value = 1;
      target.crossfadeGain.gain.value = 0;
    }
    onStatus(`Auto Drop: started Deck ${source.id}`);
    return;
  }

  if (!target.playing) {
    if (!pair.usesMainCrossfader) {
      target.crossfadeGain.gain.value = 0;
      if (!source.playing) source.crossfadeGain.gain.value = 1;
    }
    if (autoSyncBpm && source.bpm > 0) {
      target.syncTo(source.bpm);
    }

    if (autoMatchKey) {
      const srcRoot = parseKeyRoot(source.musicalKey);
      const tgtRoot = parseKeyRoot(target.musicalKey);
      if (srcRoot !== null && tgtRoot !== null) {
        let diff = srcRoot - tgtRoot;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        target.matchKey(diff);
      }
    }
    await target.play();
  }

  const baseDuration = transitionStyle === 'power' ? 3600 : transitionStyle === 'neural' ? 5600 : 6800;

  if (transitionStyle === 'power') {
    source.effects[0].setWet(0.42);
    source.effects[2].setWet(0.25);
    target.effects[1].setWet(0.24);
  } else if (transitionStyle === 'neural') {
    source.setStemLevel('vocals', Math.min(source.getStemLevel('vocals'), 0.45));
    target.setStemLevel('drums', 1);
    target.setStemLevel('instruments', Math.max(0.72, target.getStemLevel('instruments')));
    target.effects[0].setWet(0.2);
  } else {
    source.effects[0].setWet(0.26);
    target.effects[1].setWet(0.16);
  }

  if (pair.usesMainCrossfader) {
    const to = target.id === 'A' ? 0 : 1;
    fadeCrossfader(crossfader, crossfader.position, to, baseDuration);
  } else {
    fadeDeckPair(source, target, baseDuration);
  }

  window.setTimeout(() => {
    source.effects[0].setWet(0);
    source.effects[1].setWet(0);
    source.effects[2].setWet(0);
    target.effects[0].setWet(0);
    target.effects[1].setWet(0);
    target.effects[2].setWet(0);
  }, baseDuration + 400);

  onStatus(`Auto Drop: ${source.id} -> ${target.id} (${transitionStyle.toUpperCase()})`);
};

const fadeDeckPair = (source: Deck, target: Deck, durationMs: number): void => {
  const sourceFrom = source.crossfadeGain.gain.value;
  const targetFrom = target.crossfadeGain.gain.value;
  const start = performance.now();
  const sourceTo = 0;
  const targetTo = 1;

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = t * t * (3 - 2 * t);
    source.crossfadeGain.gain.value = sourceFrom + (sourceTo - sourceFrom) * eased;
    target.crossfadeGain.gain.value = targetFrom + (targetTo - targetFrom) * eased;
    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
};

const fadeCrossfader = (crossfader: Crossfader, from: number, to: number, durationMs: number): void => {
  const start = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = t * t * (3 - 2 * t);
    crossfader.setPosition(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
};
