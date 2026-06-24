import { useReducer, useCallback } from 'react';
import {
  freshState,
  doPull,
  resetState,
  applyIntervention,
} from '../sim/red-bead/redBeadSim';
import type { RedBeadState, InterventionSet } from '../sim/red-bead/redBeadSim';

export type { RedBeadState };

type Action =
  | { type: 'PULL' }
  | { type: 'BATCH'; n: number }
  | { type: 'RESET' }
  | { type: 'SET_INTERVENTION'; key: keyof InterventionSet; value: unknown }
  | { type: 'SET_ANIMATING'; value: boolean };

function reducer(state: RedBeadState, action: Action): RedBeadState {
  switch (action.type) {
    case 'PULL': {
      const { nextState } = doPull(state, Math.random);
      return nextState;
    }
    case 'BATCH': {
      let s = state;
      for (let i = 0; i < action.n; i++) {
        s = doPull(s, Math.random).nextState;
      }
      return s;
    }
    case 'RESET':
      return resetState(state);
    case 'SET_INTERVENTION':
      return applyIntervention(state, action.key, action.value);
    case 'SET_ANIMATING':
      return { ...state, animating: action.value };
    default:
      return state;
  }
}

export interface RedBeadSimHandle {
  state: RedBeadState;
  pull: () => void;
  runBatch: (n: number) => void;
  reset: () => void;
  setIntervention: (key: keyof InterventionSet, value: unknown) => void;
}

export function useRedBeadSim(): RedBeadSimHandle {
  const [state, dispatch] = useReducer(reducer, undefined, freshState);

  const pull = useCallback(() => {
    dispatch({ type: 'SET_ANIMATING', value: true });
    dispatch({ type: 'PULL' });
    dispatch({ type: 'SET_ANIMATING', value: false });
  }, []);

  const runBatch = useCallback((n: number) => {
    dispatch({ type: 'BATCH', n });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setIntervention = useCallback(
    (key: keyof InterventionSet, value: unknown) => {
      dispatch({ type: 'SET_INTERVENTION', key, value });
    },
    [],
  );

  return { state, pull, runBatch, reset, setIntervention };
}
