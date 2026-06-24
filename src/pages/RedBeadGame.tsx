import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRedBeadSim } from '../hooks/useRedBeadSim';
import { computeSegments } from '../sim/red-bead/redBeadSim';
import { createRedBeadScene } from '../scenes/red-bead/redBeadScene';
import type { RedBeadSceneHandle } from '../scenes/red-bead/redBeadScene';
import { ControlChart } from '../components/red-bead/ControlChart';
import { TallyPanel } from '../components/red-bead/TallyPanel';
import { InterventionPanel } from '../components/red-bead/InterventionPanel';
import { WorkerBoard } from '../components/red-bead/WorkerBoard';
import { EventLog } from '../components/red-bead/EventLog';
import type { LogEntry } from '../components/red-bead/EventLog';
import { WORKERS } from '../sim/red-bead/redBeadSim.types';

interface RedBeadGameProps {}

const EXHORT_MESSAGES = ['ZERO DEFECTS!', 'DO BETTER!', 'QUALITY IS JOB #1', 'TRY HARDER!'];

export default function RedBeadGame(_props: RedBeadGameProps) {
  const { state, pull, runBatch, reset, setIntervention } = useRedBeadSim();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RedBeadSceneHandle | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const [animating, setAnimating] = useState(false);
  const [exhortBanner, setExhortBanner] = useState<string | null>(null);

  // Refs used to sequence pull → state update → scene trigger
  const expectedPullCountRef = useRef<number>(-1);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((text: string, kind: LogEntry['kind'] = 'normal') => {
    const id = ++logIdRef.current;
    setLogEntries(prev => [{ id, text, kind }, ...prev].slice(0, 60));
  }, []);

  // Create/destroy scene
  useEffect(() => {
    if (!canvasRef.current) return;
    const handle = createRedBeadScene(canvasRef.current);
    sceneRef.current = handle;
    return () => {
      handle.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Sync scene state on every state change
  useEffect(() => {
    sceneRef.current?.setState({
      binFrac: state.bin.red / (state.bin.red + state.bin.white),
      paddleSize: state.paddleSize,
      lastTrueReds: state.results.length > 0 ? state.results[state.results.length - 1].trueReds : null,
      animating,
    });
  }, [state, animating]);

  // Called by handlePull; fires AFTER React processes the dispatched pull,
  // so state.results[length-1] is the real new record (not stale).
  useEffect(() => {
    if (state.results.length !== expectedPullCountRef.current) return;
    expectedPullCountRef.current = -1;

    const rec = state.results[state.results.length - 1];
    if (!rec) { setAnimating(false); return; }

    const workerName = state.interventions.workersOn && typeof rec.worker === 'number'
      ? WORKERS[rec.worker]
      : null;
    const logKind: LogEntry['kind'] = rec.tampered ? 'tamper' : 'normal';
    addLog(
      workerName
        ? `Pull ${state.results.length} · ${workerName} · ${rec.reds} red`
        : `Pull ${state.results.length} · ${rec.reds} red`,
      logKind,
    );

    const resetAnim = () => {
      if (animTimerRef.current != null) { clearTimeout(animTimerRef.current); animTimerRef.current = null; }
      setAnimating(false);
    };

    if (sceneRef.current) {
      sceneRef.current.triggerPull(rec.trueReds, resetAnim);
      // Safety timeout — re-enables buttons even if the scene callback never fires
      animTimerRef.current = window.setTimeout(resetAnim, 3500);
    } else {
      resetAnim();
    }
  // addLog is stable (useCallback []); state.results.length is the real dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.results.length]);

  const handlePull = useCallback(() => {
    if (animating) return;
    expectedPullCountRef.current = state.results.length + 1;
    setAnimating(true);
    pull();
  }, [animating, pull, state.results.length]);

  const handleRunBatch = useCallback(() => {
    if (animating) return;
    const before = state.results.length;
    runBatch(25);
    addLog(`Fast run: 25 pulls (${before + 1}–${before + 25})`, 'system');
  }, [animating, runBatch, state.results.length, addLog]);

  const handleReset = useCallback(() => {
    if (animating) return;
    expectedPullCountRef.current = -1;
    if (animTimerRef.current != null) { clearTimeout(animTimerRef.current); animTimerRef.current = null; }
    setAnimating(false);
    reset();
    setLogEntries([]);
    addLog('Reset — bin restored to initial composition', 'system');
  }, [animating, reset, addLog]);

  const handleExhort = useCallback(() => {
    const msg = EXHORT_MESSAGES[Math.floor(Math.random() * EXHORT_MESSAGES.length)];
    setExhortBanner(msg);
    addLog(`Exhort: "${msg}"`, 'system');
    setIntervention('workersOn', state.interventions.workersOn);
    setTimeout(() => setExhortBanner(null), 2000);
  }, [setIntervention, state.interventions.workersOn, addLog]);

  const segments = useMemo(
    () => computeSegments(state, {
      limitsFromData: state.interventions.limitsFromData,
      showRate: state.interventions.showRate,
    }),
    [state],
  );

  const results = state.results;
  const pulls = results.length;
  const totalReds = results.reduce((s, r) => s + r.reds, 0);
  const totalN = results.reduce((s, r) => s + r.n, 0);
  const average = pulls > 0 ? totalReds / pulls : null;
  const best = pulls > 0 ? Math.min(...results.map(r => r.reds)) : null;
  const worst = pulls > 0 ? Math.max(...results.map(r => r.reds)) : null;
  const defectRate = totalN > 0 ? totalReds / totalN : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg,#080817)', color: 'var(--text,#e2e8f0)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border,rgba(255,255,255,0.06))' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--rb-red,#e0473d)', marginBottom: 4 }}>
          Deming's Classic
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Red Bead Experiment</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0, height: 'calc(100vh - 65px)' }}>
        {/* Left: canvas + chart */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {/* 3D Scene */}
          <div style={{ position: 'relative', height: 340, background: 'radial-gradient(120% 80% at 50% 30%, #16222f 0%, #0a0f15 100%)', flexShrink: 0 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            {exhortBanner && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <span style={{
                  fontWeight: 700, fontSize: 32, color: '#fff',
                  textShadow: '0 0 30px rgba(224,71,61,0.8)',
                  background: 'rgba(224,71,61,0.16)', border: '1.5px solid var(--rb-red,#e0473d)',
                  padding: '14px 26px', borderRadius: 10, transform: 'rotate(-3deg)',
                }}>
                  {exhortBanner}
                </span>
              </div>
            )}
            {/* Bin readout */}
            <div style={{ position: 'absolute', left: 14, bottom: 12, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
              Bin: {state.bin.red.toLocaleString()} red / {(state.bin.red + state.bin.white).toLocaleString()} total
              ({(100 * state.bin.red / (state.bin.red + state.bin.white)).toFixed(1)}%)
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, padding: '14px 20px', background: 'var(--bg-surface,#0d1127)', borderBottom: '1px solid var(--border,rgba(255,255,255,0.06))' }}>
            <ActionBtn onClick={handlePull} disabled={animating} primary>Pull the paddle</ActionBtn>
            <ActionBtn onClick={handleRunBatch} disabled={animating}>Run 25 pulls</ActionBtn>
            <ActionBtn onClick={handleReset} disabled={animating}>Reset</ActionBtn>
          </div>

          {/* Tally */}
          <div style={{ padding: '14px 20px' }}>
            <TallyPanel
              pulls={pulls}
              average={average}
              best={best}
              worst={worst}
              totalReds={totalReds}
              defectRate={defectRate}
              cost={state.cost}
              morale={state.morale}
            />
          </div>

          {/* Control chart */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted,#64748b)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Control Chart
            </div>
            <div style={{ background: 'var(--bg-card,#111630)', borderRadius: 8, padding: 12 }}>
              <ControlChart
                segments={segments}
                results={results}
                showRate={state.interventions.showRate}
                quota={state.interventions.quota}
                changeMarks={state.changeMarks}
              />
            </div>
          </div>

          {/* Worker board */}
          {state.interventions.workersOn && (
            <div style={{ padding: '0 20px 20px' }}>
              <WorkerBoard results={results} />
            </div>
          )}
        </div>

        {/* Right: interventions + log */}
        <div style={{ borderLeft: '1px solid var(--border,rgba(255,255,255,0.06))', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, flexShrink: 0 }}>
            <InterventionPanel
              interventions={state.interventions}
              onSet={setIntervention}
              onExhort={handleExhort}
            />
          </div>
          <div style={{ borderTop: '1px solid var(--border,rgba(255,255,255,0.06))', padding: 16, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted,#64748b)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Event Log
            </div>
            <EventLog entries={logEntries} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, primary }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 16px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 600,
        background: primary ? 'var(--rb-red,#e0473d)' : 'var(--bg-card,#111630)',
        color: primary ? '#fff' : 'var(--text,#e2e8f0)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
