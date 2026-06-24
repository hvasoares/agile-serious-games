import { useState, useEffect, useRef, useCallback } from 'react';
import {
  newTroop, step, setToggle as setToggleFn,
} from '../sim/herbie-hike/herbieSim';
import { createHerbieScene } from '../scenes/herbie-hike/herbieScene';
import type { HikeState, HikeToggles, HikeSceneHandle } from '../sim/herbie-hike/herbieSim';

export interface HoverInfo {
  scoutId: number;
  x: number;
  y: number;
}

export interface HerbieSim {
  hikeState: HikeState | null;
  running: boolean;
  hoverInfo: HoverInfo | null;
  sceneRef: React.RefObject<HikeSceneHandle | null>;
  play: () => void;
  pause: () => void;
  newTroop: () => void;
  setToggle: (key: keyof HikeToggles, value: boolean) => void;
}

export function useHerbieSim(canvasRef: React.RefObject<HTMLCanvasElement | null>): HerbieSim {
  const [hikeState, setHikeState] = useState<HikeState | null>(null);
  const [running, setRunning] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const simRef = useRef<HikeState | null>(null);
  const sceneRef = useRef<HikeSceneHandle | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(true);
  const lastTRef = useRef<number>(0);
  const hudTickRef = useRef(0);
  const trailLengthRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = createHerbieScene(canvas, {
      onHover: (scoutId, x, y) => {
        setHoverInfo(scoutId !== null ? { scoutId, x, y } : null);
      },
    });
    sceneRef.current = handle;

    const L = handle.getTrailLength();
    trailLengthRef.current = L;
    const initial = newTroop(Math.random, L);
    simRef.current = initial;
    setHikeState(initial);

    lastTRef.current = performance.now();

    const tick = (now: number): void => {
      rafRef.current = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
      lastTRef.current = now;

      const cur = simRef.current;
      if (!cur) return;

      const next = runningRef.current && cur.playing ? step(cur, dt) : cur;
      simRef.current = next;
      sceneRef.current?.setState(next);

      hudTickRef.current++;
      if (hudTickRef.current % 4 === 0) setHikeState(next);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      handle.dispose();
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback((): void => {
    runningRef.current = true;
    setRunning(true);
  }, []);

  const pause = useCallback((): void => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const doNewTroop = useCallback((): void => {
    const next = newTroop(Math.random, trailLengthRef.current);
    simRef.current = next;
    runningRef.current = true;
    setRunning(true);
    setHikeState(next);
  }, []);

  const doSetToggle = useCallback((key: keyof HikeToggles, value: boolean): void => {
    const cur = simRef.current;
    if (!cur) return;
    const next = setToggleFn(cur, key, value, Math.random);
    simRef.current = next;
    setHikeState(next);
  }, []);

  return {
    hikeState,
    running,
    hoverInfo,
    sceneRef,
    play,
    pause,
    newTroop: doNewTroop,
    setToggle: doSetToggle,
  };
}
