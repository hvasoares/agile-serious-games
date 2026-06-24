export type PaddleSize = 50 | 25 | 10;

export const WORKERS = ['Aiko', 'Ben', 'Carmen', 'Dev', 'Ella', 'Frank'] as const;
export type WorkerName = typeof WORKERS[number];

export const WORKER_COLORS: Record<number, string> = {
  0: '#5fb39a',
  1: '#e6a13c',
  2: '#6f9be6',
  3: '#c77dd6',
  4: '#e07a5f',
  5: '#9ec96b',
};

export const POP = 4000;
export const DEFAULT_P = 0.20;
export const DEFAULT_N: PaddleSize = 50;

export type Rng = () => number;

export interface InterventionSet {
  supplierPct: number;
  removeReds: boolean;
  paddleSize: PaddleSize;
  keepBest: boolean;
  reworkPasses: 0 | 1 | 2;
  incentives: boolean;
  quota: number;
  tampering: boolean;
  limitsFromData: boolean;
  showRate: boolean;
  workersOn: boolean;
}

export interface PullRecord {
  reds: number;
  trueReds: number;
  n: PaddleSize;
  worker: number | null;
  tampered: boolean;
  basisN: PaddleSize;
  basisP: number;
}

export interface ChangeMark {
  i: number;
  label: string;
}

export interface RedBeadState {
  bin: { red: number; white: number };
  results: PullRecord[];
  changeMarks: ChangeMark[];
  supplierPct: number;
  paddleSize: PaddleSize;
  basisP: number;
  basisN: PaddleSize;
  interventions: InterventionSet;
  tamperOffset: number;
  workerIdx: number;
  cost: number;
  morale: number;
  animating: boolean;
}

export interface ControlSegment {
  a0: number;
  a1: number;
  center: number;
  ucl: number;
  lcl: number;
  fromData: boolean;
}

export interface SignalResult {
  flagged: boolean[];
  rules: {
    r1: boolean;
    r2: boolean;
    r3: boolean;
    r4: boolean;
  };
}
