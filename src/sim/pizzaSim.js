// pizzaSim.js — Pure simulation engine for the Kanban Pizza Game
// No React, no Three.js. ES module syntax throughout.

import { SPAWN_INTERVAL, STATION_DURATIONS, isOrderReadyToDeliver } from './simConfig.js'
import { sampleChartPoint } from './chartMetrics.js'

// ═══ CONSTANTS ═══

const CFD_INTERVAL = 0.4;    // seconds between CFD samples
const CHART_INTERVAL = 1.0;  // seconds between chart history samples

export const STATION_DEFS = [
  { key: 'cut',     dur: STATION_DURATIONS.cut,     slots: 1, fixedCap: false },
  { key: 'sauce',   dur: STATION_DURATIONS.sauce,   slots: 1, fixedCap: false },
  { key: 'top',     dur: STATION_DURATIONS.top,     slots: 1, fixedCap: false },
  { key: 'bake',    dur: STATION_DURATIONS.bake,    slots: 3, fixedCap: true  },
  { key: 'deliver', dur: STATION_DURATIONS.deliver, slots: 1, fixedCap: false },
];

export const ROUND_DEFS = [
  {
    title: 'Push Chaos',
    mode: 'push',
    caps: [99, 99, 99, 99, 99],
  },
  {
    title: 'Pull Discipline',
    mode: 'pull',
    caps: [2, 2, 2, 3, 2],
  },
  {
    title: 'Theory of Constraints',
    mode: 'pull',
    caps: [2, 2, 3, 3, 2],
  },
];

export const TOC_STEPS = [
  {
    tag: 'Identify',
    title: 'Find the Constraint',
    body: 'Observe which station has the longest queue. That is your system constraint.',
  },
  {
    tag: 'Exploit',
    title: 'Exploit the Constraint',
    body: 'Make sure the constraint never sits idle. Feed it continuously and clear blockers.',
  },
  {
    tag: 'Subordinate',
    title: 'Subordinate Everything',
    body: 'Slow upstream stations to feed the constraint at its exact pace. Upstream piles will drain.',
  },
  {
    tag: 'Elevate',
    title: 'Elevate the Constraint',
    body: 'Add capacity to the constraint station. Watch throughput climb beyond previous limits.',
  },
  {
    tag: 'Repeat',
    title: 'Repeat the Process',
    body: 'Elevating the constraint shifted it elsewhere. Start the cycle again — continuous improvement.',
  },
];

// ═══ FACTORY ═══

/**
 * Build a fresh SimState for the given round number (1, 2, or 3).
 * @param {1|2|3} roundNum
 * @returns {import('./types').SimState}
 */
export function freshSim(roundNum) {
  const roundIndex = roundNum - 1;
  const roundDef = ROUND_DEFS[roundIndex];

  const stations = STATION_DEFS.map((def, i) => ({
    key: def.key,
    dur: def.dur,
    slots: def.slots,
    cap: roundDef.caps[i],
    fixedCap: def.fixedCap,
    occupants: [],
    buffer: [],
  }));

  return {
    t: 0,
    round: roundNum,
    mode: roundDef.mode,
    delivered: 0,
    leadSum: 0,
    spawnTimer: 0,
    pizzas: [],
    stations,
    cfd: [],
    cfdTimer: 0,
    chartHistory: [],
    chartTimer: 0,
    toc: roundNum === 3,
    tocStep: -1,
    constraint: -1,
    exploit: false,
    subordinate: false,
    _nextId: 0,
    orders: [],
    orderCounter: 0,
    currentOrder: null,
  };
}

// ═══ CFD HELPERS ═══

/**
 * Take a CFD snapshot.
 * reached[i] = cumulative pizzas that entered station i or beyond + delivered.
 */
function takeCfdSample(t, pizzas, delivered) {
  const reached = [0, 0, 0, 0, 0];
  for (const pizza of pizzas) {
    for (let i = 0; i <= pizza.stage; i++) {
      reached[i]++;
    }
  }
  // All delivered pizzas passed through all 5 stages
  for (let i = 0; i < 5; i++) {
    reached[i] += delivered;
  }
  return { t, reached, done: delivered };
}

// ═══ SIMULATION STEP ═══

/**
 * Pure step function. Returns a new SimState; never mutates input.
 * @param {object} state - current SimState
 * @param {number} dt - delta time in seconds
 * @returns {object} new SimState
 */
export function step(state, dt) {
  // 1. Shallow-clone top-level state; deep-clone mutable arrays
  let delivered = state.delivered;
  let leadSum = state.leadSum;
  let _nextId = state._nextId;
  let spawnTimer = state.spawnTimer + dt;
  let cfdTimer = state.cfdTimer + dt;
  let chartTimer = (state.chartTimer ?? 0) + dt;
  const t = state.t + dt;
  const mode = state.mode;

  // Clone stations (deep enough to avoid mutating original buffers/occupants)
  const stations = state.stations.map(st => ({
    ...st,
    occupants: st.occupants.map(p => ({ ...p })),
    buffer: st.buffer.map(p => ({ ...p })),
  }));

  // Clone order state
  const orders = (state.orders ?? []).map(o => ({ ...o, sliceIds: [...o.sliceIds] }));
  let orderCounter = state.orderCounter ?? 0;
  let currentOrder = state.currentOrder
    ? { ...state.currentOrder, sliceIds: [...state.currentOrder.sliceIds] }
    : null;

  // Build a mutable working set of live pizzas (keyed by id for quick lookup)
  const pizzaMap = new Map();
  for (const st of stations) {
    for (const p of st.buffer)    pizzaMap.set(p.i, p);
    for (const p of st.occupants) pizzaMap.set(p.i, p);
  }

  // 2. Spawn timer
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer -= SPAWN_INTERVAL;
    const station0 = stations[0];
    if (station0.buffer.length < station0.cap) {
      const newPizza = {
        i: _nextId++,
        stage: 0,
        state: 'queue',
        born: t,
        reached: t,
        prog: 0,
      };

      // Assign to a customer order (1–3 slices per order, cycling).
      // Push the order on the FIRST slice so it appears in backlog immediately.
      if (!currentOrder) {
        const size = (orderCounter % 3) + 1;
        currentOrder = { id: orderCounter++, size, sliceIds: [], fulfilled: 0 };
        orders.push(currentOrder);
      }
      newPizza.orderId = currentOrder.id;
      currentOrder.sliceIds.push(newPizza.i);
      // Sync orders[] — the entry was cloned at step start, so we need to replace it
      const oiSync = orders.findIndex(o => o.id === currentOrder.id);
      if (oiSync >= 0) orders[oiSync] = { ...currentOrder, sliceIds: [...currentOrder.sliceIds] };
      if (currentOrder.sliceIds.length >= currentOrder.size) {
        currentOrder = null; // assembly complete
      }

      station0.buffer.push(newPizza);
      pizzaMap.set(newPizza.i, newPizza);
    }
  }

  // Track pizzas delivered this step (to remove from pizzaMap)
  const deliveredIds = new Set();

  // 3. Process each station
  for (let si = 0; si < stations.length; si++) {
    const st = stations[si];
    const isLast = si === 4;

    // a. Fill occupants from buffer
    if (isLast) {
      // Gate: only pick up a slice when every slice of its order is at stage 4
      // (deliver buffer or cooker) or has already been delivered (absent from pizzaMap).
      const pizzaArr = [...pizzaMap.values()]
      outer: while (st.occupants.length < st.slots) {
        for (let bi = 0; bi < st.buffer.length; bi++) {
          if (st.occupants.length >= st.slots) break outer
          const pizza = st.buffer[bi]
          if (isOrderReadyToDeliver(pizza.orderId, orders, pizzaArr)) {
            st.buffer.splice(bi, 1)
            pizza.state = 'working'
            pizza.prog = 0
            st.occupants.push(pizza)
            break // restart outer loop — buffer indices have shifted
          }
        }
        break // no ready pizza found this pass
      }
    } else {
      while (st.occupants.length < st.slots && st.buffer.length > 0) {
        const pizza = st.buffer.shift();
        pizza.state = 'working';
        pizza.prog = 0;
        st.occupants.push(pizza);
      }
    }

    // b. Advance working pizzas' progress
    for (const pizza of st.occupants) {
      pizza.prog += dt;
    }

    // c. Find and process done pizzas (snapshot to avoid iteration issues)
    const snapshot = st.occupants.slice();
    for (const pizza of snapshot) {
      if (pizza.prog < st.dur) continue;

      // Remove from occupants
      const idx = st.occupants.indexOf(pizza);
      if (idx !== -1) st.occupants.splice(idx, 1);

      if (isLast) {
        // Deliver
        delivered++;
        leadSum += t - pizza.born;
        deliveredIds.add(pizza.i);
        // Mark the order slice fulfilled
        if (pizza.orderId !== undefined) {
          const oi = orders.findIndex(o => o.id === pizza.orderId);
          if (oi >= 0) orders[oi].fulfilled++;
        }
      } else {
        // Try to move to next station's buffer
        const nextStation = stations[si + 1];
        const canMove =
          mode === 'push' || nextStation.buffer.length < nextStation.cap;

        if (canMove) {
          pizza.stage++;
          pizza.state = 'queue';
          pizza.prog = 0;
          pizza.reached = t;
          nextStation.buffer.push(pizza);
        } else {
          // WIP blocked — keep in occupants (blocks the slot)
          st.occupants.push(pizza);
        }
      }
    }
  }

  // 4. Rebuild pizzas array from stations (excluding delivered)
  const pizzas = [];
  for (const st of stations) {
    for (const p of st.buffer)    if (!deliveredIds.has(p.i)) pizzas.push(p);
    for (const p of st.occupants) if (!deliveredIds.has(p.i)) pizzas.push(p);
  }
  // Sort by id for determinism
  pizzas.sort((a, b) => a.i - b.i);

  // 5. CFD sample
  let cfd = state.cfd;
  if (cfdTimer >= CFD_INTERVAL) {
    cfdTimer -= CFD_INTERVAL;
    const sample = takeCfdSample(t, pizzas, delivered);
    cfd = [...state.cfd, sample];
  }

  // 6. Chart history sample
  let chartHistory = state.chartHistory ?? [];
  if (chartTimer >= CHART_INTERVAL) {
    chartTimer -= CHART_INTERVAL;
    const point = sampleChartPoint(t, { stations, pizzas, delivered, leadSum });
    chartHistory = [...chartHistory, point];
  }

  return {
    ...state,
    t,
    delivered,
    leadSum,
    spawnTimer,
    cfdTimer,
    chartTimer,
    pizzas,
    stations,
    cfd,
    chartHistory,
    _nextId,
    orders,
    orderCounter,
    currentOrder,
  };
}

// ═══ ANALYTICS ═══

/**
 * Returns the index (1..4) of the station with the deepest buffer.
 * Never returns 0. Ties broken by highest index.
 * @param {object[]} stations
 * @returns {number}
 */
export function detectConstraint(stations) {
  let maxLen = -1;
  let maxIdx = 1;
  for (let i = 1; i < stations.length; i++) {
    const len = stations[i].buffer.length;
    if (len > maxLen) {
      maxLen = len;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Total items waiting in buffers across all stations.
 * @param {object[]} stations
 * @returns {number}
 */
export function wasteCount(stations) {
  return stations.reduce((sum, st) => sum + st.buffer.length, 0);
}

/**
 * Total items currently being worked across all stations.
 * @param {object[]} stations
 * @returns {number}
 */
export function wipCount(stations) {
  return stations.reduce((sum, st) => sum + st.occupants.length, 0);
}

// ═══ TOC ACTIONS ═══

/**
 * Apply a ToC step to the state. Pure — returns new state.
 * @param {object} state
 * @param {0|1|2|3|4} stepIndex
 * @returns {object} new SimState
 */
export function applyTocAction(state, stepIndex) {
  // Deep-clone stations to avoid mutation
  const stations = state.stations.map(st => ({
    ...st,
    occupants: st.occupants.slice(),
    buffer: st.buffer.slice(),
  }));

  let { constraint, exploit, subordinate, tocStep } = state;

  switch (stepIndex) {
    case 0: // Identify
      constraint = detectConstraint(stations);
      tocStep = 0;
      break;

    case 1: // Exploit
      exploit = true;
      tocStep = 1;
      break;

    case 2: // Subordinate
      subordinate = true;
      tocStep = 2;
      stations[0] = { ...stations[0], cap: 1 };
      break;

    case 3: // Elevate
      tocStep = 3;
      if (constraint >= 0 && !stations[constraint].fixedCap) {
        stations[constraint] = {
          ...stations[constraint],
          slots: stations[constraint].slots + 1,
          cap: stations[constraint].cap + 1,
        };
      }
      break;

    case 4: // Repeat
      constraint = detectConstraint(stations);
      tocStep = 4;
      exploit = false;
      subordinate = false;
      break;

    default:
      break;
  }

  return {
    ...state,
    stations,
    constraint,
    exploit,
    subordinate,
    tocStep,
  };
}
