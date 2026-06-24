import { useRef } from 'react';
import { useHerbieSim } from '../hooks/useHerbieSim';
import { computeStats } from '../sim/herbie-hike/herbieSim';
import { N } from '../sim/herbie-hike/herbieSim.types';
import type { HikeToggles, HikeState, ScoutState } from '../sim/herbie-hike/herbieSim';

// ── sub-components ────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  value: string;
  colorClass?: string;
  barPct?: number;
  barColor?: string;
}

function StatChip({ label, value, colorClass = '', barPct, barColor }: ChipProps) {
  return (
    <div style={{
      flex: '1 1 92px', minWidth: 90,
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(155,168,143,0.18)',
      borderRadius: 11, padding: '9px 11px',
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9BA890' }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        fontSize: 17, fontWeight: 600, marginTop: 3,
        color: colorClass === 'clay' ? '#E2643B' : colorClass === 'blaze' ? '#E0B447' : colorClass === 'moss' ? '#74BC93' : '#ECE7D7',
      }}>
        {value}
      </div>
      {barPct !== undefined && (
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.09)', marginTop: 8, overflow: 'hidden' }}>
          <i style={{
            display: 'block', height: '100%',
            width: `${barPct}%`,
            borderRadius: 3,
            background: barColor ?? '#74BC93',
            transition: 'width .12s linear',
          }} />
        </div>
      )}
    </div>
  );
}

interface NoteTextProps { toggles: HikeToggles | undefined }

function NoteText({ toggles }: NoteTextProps) {
  if (!toggles) return null;
  const { shareLoad, slowestFront, regroup } = toggles;
  let tag: string, body: string;

  if (shareLoad && slowestFront) {
    tag = 'Constraint managed.';
    body = "The load is shared and the slowest scout leads. The troop stays tight and moves faster — the new limit is whoever has the heaviest body, which can't be shared away.";
  } else if (shareLoad) {
    tag = 'Elevate the constraint.';
    body = "Pack weight is spread from the heaviest onto lighter-bodied scouts, so totals even out. Everyone's pace rises toward the middle and the time to B drops.";
  } else if (slowestFront) {
    tag = 'Subordinate to the pace.';
    body = 'The slowest scout leads and the troop walks single file behind, so no one can pass and the group stays together. They still finish only as fast as the slowest can walk.';
  } else if (regroup) {
    tag = 'Nobody gets lost.';
    body = `Faster scouts pass and pull ahead, but if the line stretches past 25 m the leader halts and waits for the troop to close up before moving on.`;
  } else {
    tag = 'Off they go.';
    body = "Each scout walks their own pace and faster ones pass, so the slowest drifts to the back and the line strings out down the trail.";
  }

  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#ECE7D7' }}>
      <span style={{ color: '#E0B447', fontWeight: 650 }}>{tag}</span>{' '}{body}
    </div>
  );
}

interface InspectTooltipProps {
  scouts: ScoutState[];
  theSlowestId: number;
  scoutId: number;
  x: number;
  y: number;
  canvasRect: DOMRect | null;
}

function InspectTooltip({ scouts, theSlowestId, scoutId, x, y, canvasRect }: InspectTooltipProps) {
  const s = scouts[scoutId];
  if (!s || !canvasRect) return null;
  return (
    <div style={{
      position: 'absolute',
      left: x - canvasRect.left,
      top: y - canvasRect.top,
      transform: 'translate(-50%, -135%)',
      pointerEvents: 'none',
      background: 'rgba(18,26,21,.96)',
      border: '1px solid rgba(155,168,143,0.18)',
      borderRadius: 8, padding: '6px 9px',
      fontSize: 11, color: '#ECE7D7',
      whiteSpace: 'nowrap', zIndex: 6,
      lineHeight: 1.4,
      boxShadow: '0 6px 18px rgba(0,0,0,.4)',
    }}>
      <span style={{ color: '#E2643B', fontWeight: 600 }}>{Math.round(s.body + s.pack)} kg</span>
      {' '}total · {s.vel.toFixed(1)} m/s
      <br />
      <span style={{ color: '#9BA890' }}>
        body {Math.round(s.body)} · pack {Math.round(s.pack)}
        {s.id === theSlowestId ? ' · slowest' : ''}
      </span>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function HerbieHikeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { hikeState, running, hoverInfo, play, pause, newTroop, setToggle } = useHerbieSim(canvasRef);

  const stats = hikeState ? computeStats(hikeState) : null;
  const toggles = hikeState?.toggles;

  const arrivedPct = stats ? 4 + (stats.arrivedCount / N) * 96 : 4;
  const arrivedBarColor = stats?.arrivedCount === N ? '#74BC93' : '#E0B447';

  const spreadRef = stats?.spread ?? 0;
  const spreadLimit = toggles?.regroup ? 25 : 118 * 0.55;
  const spreadFrac = Math.min(1, spreadRef / spreadLimit);
  const spreadColor = stats?.waiting ? 'clay' : spreadFrac < 0.55 ? 'moss' : spreadFrac < 0.85 ? 'blaze' : 'clay';

  const canvasRect = stageRef.current?.getBoundingClientRect() ?? null;

  const tgl = (key: keyof HikeToggles) => (
    <button
      onClick={() => setToggle(key, !(toggles?.[key] ?? false))}
      style={{
        font: 'inherit', fontSize: 12.5, fontWeight: 550,
        color: toggles?.[key] ? '#74BC93' : '#ECE7D7',
        background: toggles?.[key] ? 'rgba(116,188,147,.12)' : 'rgba(255,255,255,.05)',
        border: `1px solid ${toggles?.[key] ? '#74BC93' : 'rgba(155,168,143,0.18)'}`,
        padding: '9px 13px', borderRadius: 10, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 7,
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: toggles?.[key] ? '#74BC93' : '#9BA890',
        display: 'inline-block',
      }} />
      {key === 'highlight' && 'Highlight slowest'}
      {key === 'slowestFront' && 'Slowest to front'}
      {key === 'inspect' && 'Inspect weights'}
      {key === 'shareLoad' && 'Share the load'}
      {key === 'regroup' && 'Keep together (25 m)'}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      color: '#ECE7D7', background: '#0d130f',
    }}>
      {/* stage */}
      <div ref={stageRef} style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        />
        <div style={{
          position: 'absolute', left: 12, bottom: 10,
          fontSize: 10.5, letterSpacing: '.03em',
          color: 'rgba(236,231,215,.7)',
          textShadow: '0 1px 4px rgba(0,0,0,.6)', pointerEvents: 'none',
        }}>
          drag to orbit · scroll to zoom
        </div>

        {hoverInfo && toggles?.inspect && (
          <InspectTooltip
            scouts={hikeState!.scouts}
            theSlowestId={hikeState!.theSlowestId}
            scoutId={hoverInfo.scoutId}
            x={hoverInfo.x}
            y={hoverInfo.y}
            canvasRect={canvasRect}
          />
        )}

        {stats?.waiting && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(226,100,59,.94)', color: '#1a0f09', fontWeight: 650,
            fontSize: 11.5, padding: '6px 13px', borderRadius: 999, zIndex: 6,
            pointerEvents: 'none', boxShadow: '0 6px 18px rgba(0,0,0,.4)',
          }}>
            Holding — waiting for the troop to close up
          </div>
        )}
      </div>

      {/* deck */}
      <div style={{
        flex: '0 0 auto',
        background: 'linear-gradient(180deg, #1A251E, #131C16)',
        borderTop: '1px solid rgba(155,168,143,0.18)',
        padding: '13px 16px 15px', display: 'grid', gap: 11,
        boxShadow: '0 -10px 30px rgba(0,0,0,.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#E2643B', fontWeight: 700 }}>
              Theory of Constraints · The Goal
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 650, letterSpacing: '-.01em' }}>
              The Boy Scout Hike
            </h1>
          </div>
          <div style={{ fontSize: 11.5, color: '#9BA890', maxWidth: 250 }}>
            Open trail, A&nbsp;to&nbsp;B. The heavier the pack, the slower the scout.
          </div>
        </div>

        {/* stats chips */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <StatChip
            label="Arrived at B"
            value={`${stats?.arrivedCount ?? 0} / ${N}`}
            colorClass="blaze"
            barPct={arrivedPct}
            barColor={arrivedBarColor}
          />
          <StatChip
            label="Troop spread"
            value={`${(stats?.spread ?? 0).toFixed(1)} m`}
            colorClass={spreadColor}
          />
          <StatChip
            label="Pace range"
            value={stats ? `${stats.velMin.toFixed(1)}–${stats.velMax.toFixed(1)}` : '—'}
          />
          <StatChip
            label="Time to B"
            value={`${(stats?.elapsed ?? 0).toFixed(1)}s`}
            colorClass={stats?.arrivedCount === N ? 'moss' : 'blaze'}
          />
          <StatChip
            label="Regroup halts"
            value={toggles?.regroup ? String(stats?.halts ?? 0) : '—'}
            colorClass={toggles?.regroup && (stats?.halts ?? 0) > 0 ? 'clay' : ''}
          />
        </div>

        <NoteText toggles={toggles} />

        {/* controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            onClick={running ? pause : play}
            style={{
              font: 'inherit', fontSize: 12.5, fontWeight: 650,
              color: '#1a0f09',
              background: '#E2643B', border: '1px solid #E2643B',
              padding: '9px 13px', borderRadius: 10, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a0f09', display: 'inline-block' }} />
            {running ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={newTroop}
            style={{
              font: 'inherit', fontSize: 12.5, fontWeight: 550, color: '#ECE7D7',
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(155,168,143,0.18)',
              padding: '9px 13px', borderRadius: 10, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9BA890', display: 'inline-block' }} />
            New troop
          </button>
        </div>

        {/* toggles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {tgl('highlight')}
          {tgl('slowestFront')}
          {tgl('inspect')}
          {tgl('shareLoad')}
          {tgl('regroup')}
        </div>
      </div>
    </div>
  );
}
