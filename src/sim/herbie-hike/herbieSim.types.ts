// Constants extracted verbatim from herbie_toc_hike.html globals
export const N = 8;
export const SPREAD_LIMIT = 25;
export const TMIN = 32;
export const TMAX = 86;
export const VMAX = 8.0;
export const VMIN = 4.0;
export const TRAIL_GAP_OPEN = 2.0;
export const TRAIL_GAP_REGROUP = 1.2;

export const SCOUT_SHIRTS = [
  0xC2A878, 0x9FB08A, 0xB7986A, 0x8FA7B0,
  0xCBB488, 0xA98E5E, 0xB0826B, 0x97A36F,
] as const;

export const SCOUT_SKIN = [0xE8C2A0, 0xD9A878, 0xC68C5E, 0xF0D2B4] as const;

// Trail control points from HTML: [[-46,0,9],[-28,0,-9],[-10,0,8],[9,0,-8],[27,0,9],[46,0,-4]]
export const TRAIL_CONTROL_POINTS = [
  [-46, 0, 9], [-28, 0, -9], [-10, 0, 8], [9, 0, -8], [27, 0, 9], [46, 0, -4],
] as const;

export type Rng = () => number;

export interface ScoutState {
  id: number;
  dist: number;
  body: number;
  pack0: number;
  pack: number;
  vel: number;
  arrivedAt: number | null;
  slot: number;
  lat: number;
}

export interface HikeToggles {
  highlight: boolean;
  slowestFront: boolean;
  inspect: boolean;
  shareLoad: boolean;
  regroup: boolean;
}

export interface HikeState {
  scouts: ScoutState[];
  baseOrder: number[];
  line: number[];
  herbieId: number;
  pool: number;
  theSlowestId: number;
  toggles: HikeToggles;
  elapsed: number;
  arrivedCount: number;
  waiting: boolean;
  halts: number;
  playing: boolean;
  trailLength: number;
}

export interface HikeStats {
  arrivedCount: number;
  spread: number;
  velMin: number;
  velMax: number;
  elapsed: number;
  halts: number;
  waiting: boolean;
}

export interface HikeSceneHandle {
  setState(state: HikeState): void;
  getTrailLength(): number;
  dispose(): void;
}
