import type {
  RedBeadState,
  PullRecord,
  ChangeMark,
  ControlSegment,
  SignalResult,
  InterventionSet,
  PaddleSize,
  Rng,
} from './redBeadSim.types';
import { POP, DEFAULT_P, DEFAULT_N, WORKERS } from './redBeadSim.types';

export type {
  RedBeadState,
  PullRecord,
  ChangeMark,
  ControlSegment,
  SignalResult,
  InterventionSet,
  PaddleSize,
  Rng,
};
export { POP, DEFAULT_P, DEFAULT_N, WORKERS };
export { WORKER_COLORS } from './redBeadSim.types';

function defaultInterventions(): InterventionSet {
  return {
    supplierPct: DEFAULT_P,
    removeReds: false,
    paddleSize: DEFAULT_N,
    keepBest: false,
    reworkPasses: 0,
    incentives: false,
    quota: 0,
    tampering: false,
    limitsFromData: false,
    showRate: false,
    workersOn: false,
  };
}

export function freshState(_rng?: Rng): RedBeadState {
  const red = Math.round(POP * DEFAULT_P);
  return {
    bin: { red, white: POP - red },
    results: [],
    changeMarks: [],
    supplierPct: DEFAULT_P,
    paddleSize: DEFAULT_N,
    basisP: DEFAULT_P,
    basisN: DEFAULT_N,
    interventions: defaultInterventions(),
    tamperOffset: 0,
    workerIdx: 0,
    cost: 0,
    morale: 100,
    animating: false,
  };
}

// Hypergeometric draw: pull N beads from bin without replacement
export function scoopOnce(state: RedBeadState, rng: Rng): number {
  const { red, white } = state.bin;
  const total = red + white;
  const n = state.paddleSize;
  let reds = 0;
  let remaining = total;
  let remainingRed = red;
  for (let i = 0; i < n; i++) {
    if (rng() < remainingRed / remaining) {
      reds++;
      remainingRed--;
    }
    remaining--;
  }
  return reds;
}

// Each red bead is re-drawn; survives if rng() < binFrac
export function applyRework(reds: number, state: RedBeadState, rng: Rng): number {
  const { reworkPasses } = state.interventions;
  if (reworkPasses === 0) return reds;
  let remaining = reds;
  for (let pass = 0; pass < reworkPasses; pass++) {
    let kept = 0;
    const binFrac = state.bin.red / (state.bin.red + state.bin.white);
    for (let i = 0; i < remaining; i++) {
      if (rng() < binFrac) kept++;
    }
    remaining = kept;
  }
  return remaining;
}

export function doPull(
  state: RedBeadState,
  rng: Rng,
): { record: PullRecord; nextState: RedBeadState } {
  const { interventions } = state;

  // Step 1: scoop (once or twice, keep best)
  let trueReds = scoopOnce(state, rng);
  if (interventions.keepBest) {
    const second = scoopOnce(state, rng);
    trueReds = Math.min(trueReds, second);
  }

  // Step 2: rework
  trueReds = applyRework(trueReds, state, rng);

  // Step 3: bin mutation (removeReds)
  let newBin = { ...state.bin };
  if (interventions.removeReds) {
    const removed = Math.min(trueReds, newBin.red);
    newBin = { red: newBin.red - removed, white: newBin.white };
  }

  // Step 4: tamper offset
  let reported = trueReds;
  let newOffset = state.tamperOffset;
  let tampered = false;
  if (interventions.tampering) {
    reported = Math.round(trueReds + state.tamperOffset);
    const target = state.basisN * state.basisP;
    newOffset = state.tamperOffset - (reported - target);
    tampered = true;
  }

  // Step 5: incentives
  let newCost = state.cost;
  let newMorale = state.morale;
  if (interventions.incentives) {
    newCost += 250;
    newMorale = Math.max(0, state.morale - 1.2);
  }

  // Step 6: worker assignment
  const worker = interventions.workersOn ? state.workerIdx : null;
  const nextWorkerIdx = interventions.workersOn
    ? (state.workerIdx + 1) % WORKERS.length
    : state.workerIdx;

  const record: PullRecord = {
    reds: Math.max(0, reported),
    trueReds,
    n: state.paddleSize,
    worker,
    tampered,
    basisN: state.basisN,
    basisP: state.basisP,
  };

  const nextState: RedBeadState = {
    ...state,
    bin: newBin,
    results: [...state.results, record],
    tamperOffset: newOffset,
    workerIdx: nextWorkerIdx,
    cost: newCost,
    morale: newMorale,
  };

  return { record, nextState };
}

const CHART_OPTION_KEYS: ReadonlySet<keyof InterventionSet> = new Set([
  'limitsFromData',
  'showRate',
  'workersOn',
]);

export function applyIntervention(
  state: RedBeadState,
  key: keyof InterventionSet,
  value: unknown,
): RedBeadState {
  let next: RedBeadState = {
    ...state,
    interventions: { ...state.interventions, [key]: value },
  };

  // Key-specific side effects
  if (key === 'supplierPct') {
    const pct = value as number;
    const p = pct / 100;
    const red = Math.round(POP * p);
    next = {
      ...next,
      supplierPct: p,
      basisP: p,
      tamperOffset: 0,
      bin: { red, white: POP - red },
      interventions: { ...next.interventions, supplierPct: p },
    };
  } else if (key === 'paddleSize') {
    const n = value as PaddleSize;
    next = {
      ...next,
      paddleSize: n,
      basisN: n,
      interventions: { ...next.interventions, paddleSize: n },
    };
  } else if (key === 'tampering' && value === false) {
    next = { ...next, tamperOffset: 0 };
  }

  // Add ChangeMark unless this is a chart-option key or quota (view-only line)
  if (!CHART_OPTION_KEYS.has(key) && key !== 'quota') {
    const label = changeLabel(key, value);
    next = {
      ...next,
      changeMarks: [...next.changeMarks, { i: next.results.length, label }],
    };
  }

  return next;
}

function changeLabel(key: keyof InterventionSet, value: unknown): string {
  switch (key) {
    case 'supplierPct': return `supplier ${Math.round((value as number))}%`;
    case 'removeReds': return value ? 'remove reds on' : 'remove reds off';
    case 'paddleSize': return `paddle ${value}`;
    case 'keepBest': return value ? 'keep best on' : 'keep best off';
    case 'reworkPasses': return `rework ${value} pass`;
    case 'incentives': return value ? 'incentives on' : 'incentives off';
    case 'tampering': return value ? 'tamper on' : 'tamper off';
    default: return String(key);
  }
}

export function resetState(state: RedBeadState): RedBeadState {
  const red = Math.round(POP * state.supplierPct);
  return {
    ...state,
    bin: { red, white: POP - red },
    results: [],
    changeMarks: [],
    tamperOffset: 0,
    cost: 0,
    morale: 100,
    workerIdx: 0,
  };
}

export function segLimits(
  vals: number[],
  basisN: PaddleSize,
  basisP: number,
  limitsFromData: boolean,
  showRate: boolean,
): { center: number; sd: number; fromData: boolean } {
  const useData = limitsFromData && vals.length >= 4;
  let center: number;
  let sd: number;

  if (useData) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    center = mean;
    sd = Math.sqrt(variance);
  } else if (showRate) {
    center = basisP * 100;
    sd = Math.sqrt((basisP * (1 - basisP)) / basisN) * 100;
  } else {
    center = basisN * basisP;
    sd = Math.sqrt(basisN * basisP * (1 - basisP));
  }

  return { center, sd, fromData: useData };
}

export function detectSignals(
  vals: number[],
  center: number,
  sd: number,
): SignalResult {
  const n = vals.length;
  const flagged = new Array<boolean>(n).fill(false);
  const r1 = new Array<boolean>(n).fill(false);
  const r2 = new Array<boolean>(n).fill(false);
  const r3 = new Array<boolean>(n).fill(false);
  const r4 = new Array<boolean>(n).fill(false);

  // R1: 1 point beyond 3σ
  for (let i = 0; i < n; i++) {
    if (Math.abs(vals[i] - center) > 3 * sd) {
      r1[i] = true;
      flagged[i] = true;
    }
  }

  // R2: 8 consecutive on the same side
  for (let i = 7; i < n; i++) {
    const run = vals.slice(i - 7, i + 1);
    const allAbove = run.every(v => v > center);
    const allBelow = run.every(v => v < center);
    if (allAbove || allBelow) {
      for (let j = i - 7; j <= i; j++) {
        r2[j] = true;
        flagged[j] = true;
      }
    }
  }

  // R3: 6 consecutive monotone (strictly increasing or decreasing)
  for (let i = 5; i < n; i++) {
    const run = vals.slice(i - 5, i + 1);
    const inc = run.every((v, j) => j === 0 || v > run[j - 1]);
    const dec = run.every((v, j) => j === 0 || v < run[j - 1]);
    if (inc || dec) {
      for (let j = i - 5; j <= i; j++) {
        r3[j] = true;
        flagged[j] = true;
      }
    }
  }

  // R4: 2 of 3 consecutive beyond 2σ on the same side
  for (let i = 2; i < n; i++) {
    const window = [vals[i - 2], vals[i - 1], vals[i]];
    const aboveTwoSigma = window.filter(v => v > center + 2 * sd).length;
    const belowTwoSigma = window.filter(v => v < center - 2 * sd).length;
    if (aboveTwoSigma >= 2 || belowTwoSigma >= 2) {
      r4[i - 2] = true; r4[i - 1] = true; r4[i] = true;
      flagged[i - 2] = true; flagged[i - 1] = true; flagged[i] = true;
    }
  }

  return {
    flagged,
    rules: {
      r1: r1.some(Boolean),
      r2: r2.some(Boolean),
      r3: r3.some(Boolean),
      r4: r4.some(Boolean),
    },
  };
}

export function computeSegments(
  state: RedBeadState,
  options: { limitsFromData: boolean; showRate: boolean },
): ControlSegment[] {
  const { results, changeMarks, basisN, basisP } = state;
  const { limitsFromData, showRate } = options;

  // Build segment boundary indices from change marks (only interior marks)
  const boundaries = changeMarks
    .map(m => m.i)
    .filter(i => i > 0 && i < results.length);
  const uniqueBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);

  const starts = [0, ...uniqueBoundaries];
  const ends = [...uniqueBoundaries, results.length];

  return starts.map((a0, idx) => {
    const a1 = ends[idx];
    const segResults = results.slice(a0, a1);
    const vals = showRate
      ? segResults.map(r => (r.reds / r.n) * 100)
      : segResults.map(r => r.reds);

    const segBasisN = segResults[0]?.basisN ?? basisN;
    const segBasisP = segResults[0]?.basisP ?? basisP;

    const { center, sd, fromData } = segLimits(vals, segBasisN, segBasisP, limitsFromData, showRate);
    const ucl = center + 3 * sd;
    const lcl = Math.max(0, center - 3 * sd);

    return { a0, a1, center, ucl, lcl, fromData };
  });
}
