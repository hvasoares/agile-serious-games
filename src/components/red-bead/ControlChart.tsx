import type { ControlSegment, PullRecord, ChangeMark } from '../../sim/red-bead/redBeadSim.types';
import { detectSignals } from '../../sim/red-bead/redBeadSim';

interface ControlChartProps {
  segments: ControlSegment[];
  results: PullRecord[];
  showRate: boolean;
  quota: number;
  changeMarks: ChangeMark[];
}

const W = 680;
const H = 300;
const ML = 48;
const MR = 16;
const MT = 16;
const MB = 32;
const PW = W - ML - MR;
const PH = H - MT - MB;

function toY(v: number, yMin: number, yMax: number): number {
  return MT + PH - ((v - yMin) / (yMax - yMin)) * PH;
}

function toX(i: number, total: number): number {
  if (total <= 1) return ML + PW / 2;
  return ML + (i / (total - 1)) * PW;
}

export function ControlChart({ segments, results, showRate, quota, changeMarks }: ControlChartProps) {
  if (results.length === 0) {
    const center = 50 * 0.2;
    const sd = Math.sqrt(50 * 0.2 * 0.8);
    const ucl = center + 3 * sd;
    const lcl = Math.max(0, center - 3 * sd);
    const yMax = Math.ceil(ucl + 1);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <line x1={ML} y1={toY(ucl, 0, yMax)} x2={ML + PW} y2={toY(ucl, 0, yMax)} stroke="var(--rb-red,#e0473d)" strokeDasharray="6 3" strokeWidth={1.5} />
        <line x1={ML} y1={toY(center, 0, yMax)} x2={ML + PW} y2={toY(center, 0, yMax)} stroke="var(--text-muted,#64748b)" strokeWidth={1.5} />
        <line x1={ML} y1={toY(lcl, 0, yMax)} x2={ML + PW} y2={toY(lcl, 0, yMax)} stroke="var(--rb-red,#e0473d)" strokeDasharray="6 3" strokeWidth={1.5} />
        <text x={ML - 4} y={toY(ucl, 0, yMax) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted,#64748b)">{ucl.toFixed(1)}</text>
        <text x={ML - 4} y={toY(center, 0, yMax) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted,#64748b)">{center.toFixed(1)}</text>
        <text x={ML - 4} y={toY(lcl, 0, yMax) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted,#64748b)">{lcl.toFixed(1)}</text>
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--text-muted,#64748b)">Pull the paddle to begin</text>
      </svg>
    );
  }

  const total = results.length;
  const vals = showRate
    ? results.map(r => (r.reds / r.n) * 100)
    : results.map(r => r.reds);

  const allUcl = segments.map(s => s.ucl);
  const yMax = Math.ceil(Math.max(...allUcl, ...vals, quota || 0) + 2);
  const yMin = 0;

  // Collect flagged points per segment
  const flaggedSet = new Set<number>();
  for (const seg of segments) {
    if (seg.a1 <= seg.a0) continue;
    const segVals = vals.slice(seg.a0, seg.a1);
    const { flagged } = detectSignals(segVals, seg.center, (seg.ucl - seg.center) / 3);
    flagged.forEach((f, i) => { if (f) flaggedSet.add(seg.a0 + i); });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {/* Segment limit lines */}
      {segments.map((seg, si) => {
        const x0 = toX(seg.a0, total);
        const x1 = seg.a1 >= total ? ML + PW : toX(seg.a1, total);
        return (
          <g key={si}>
            <line x1={x0} y1={toY(seg.ucl, yMin, yMax)} x2={x1} y2={toY(seg.ucl, yMin, yMax)} stroke="var(--rb-red,#e0473d)" strokeDasharray="6 3" strokeWidth={1.5} />
            <line x1={x0} y1={toY(seg.center, yMin, yMax)} x2={x1} y2={toY(seg.center, yMin, yMax)} stroke="var(--text-muted,#64748b)" strokeWidth={1.5} />
            <line x1={x0} y1={toY(seg.lcl, yMin, yMax)} x2={x1} y2={toY(seg.lcl, yMin, yMax)} stroke="var(--rb-red,#e0473d)" strokeDasharray="6 3" strokeWidth={1.5} />
            <text x={ML - 4} y={toY(seg.ucl, yMin, yMax) + 4} textAnchor="end" fontSize={9} fill="var(--text-muted,#64748b)">{seg.ucl.toFixed(1)}</text>
            <text x={ML - 4} y={toY(seg.center, yMin, yMax) + 4} textAnchor="end" fontSize={9} fill="var(--text-muted,#64748b)">{seg.center.toFixed(1)}</text>
          </g>
        );
      })}

      {/* Quota line */}
      {quota > 0 && (
        <line x1={ML} y1={toY(quota, yMin, yMax)} x2={ML + PW} y2={toY(quota, yMin, yMax)}
          stroke="var(--rb-brass,#c6a15b)" strokeWidth={1.5} strokeDasharray="4 4" />
      )}

      {/* Change-mark vertical lines */}
      {changeMarks.filter(m => m.i > 0 && m.i < total).map((m, i) => (
        <g key={i}>
          <line x1={toX(m.i, total)} y1={MT} x2={toX(m.i, total)} y2={MT + PH} stroke="var(--rb-brass,#c6a15b)" strokeDasharray="4 4" strokeWidth={1} />
          <text x={toX(m.i, total) + 3} y={MT + 10} fontSize={9} fill="var(--rb-brass,#c6a15b)">{m.label}</text>
        </g>
      ))}

      {/* Data points */}
      {vals.map((v, i) => {
        const x = toX(i, total);
        const y = toY(v, yMin, yMax);
        const flagged = flaggedSet.has(i);
        return (
          <g key={i}>
            {flagged && <circle cx={x} cy={y} r={9} fill="none" stroke="var(--rb-red,#e0473d)" strokeWidth={1.5} />}
            <circle cx={x} cy={y} r={3.5} fill={flagged ? 'var(--rb-red,#e0473d)' : 'var(--cyan,#22d3ee)'} />
          </g>
        );
      })}

      {/* Connect dots */}
      {vals.length > 1 && (
        <polyline
          points={vals.map((v, i) => `${toX(i, total)},${toY(v, yMin, yMax)}`).join(' ')}
          fill="none" stroke="var(--cyan,#22d3ee)" strokeWidth={1} opacity={0.5}
        />
      )}

      {/* Y-axis label */}
      <text x={10} y={H / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted,#64748b)"
        transform={`rotate(-90, 10, ${H / 2})`}>
        {showRate ? '% defect' : 'reds'}
      </text>

      {/* X-axis pull numbers */}
      {[0, Math.floor(total / 2), total - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0).map(i => (
        <text key={i} x={toX(i, total)} y={MT + PH + 18} textAnchor="middle" fontSize={10} fill="var(--text-muted,#64748b)">{i + 1}</text>
      ))}
    </svg>
  );
}
