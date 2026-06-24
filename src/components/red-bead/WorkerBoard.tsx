import type { PullRecord } from '../../sim/red-bead/redBeadSim.types';
import { WORKERS, WORKER_COLORS } from '../../sim/red-bead/redBeadSim.types';

interface WorkerBoardProps {
  results: PullRecord[];
}

export function WorkerBoard({ results }: WorkerBoardProps) {
  const stats = WORKERS.map((name, idx) => {
    const pulls = results.filter(r => r.worker === idx);
    const avg = pulls.length > 0
      ? pulls.reduce((s, r) => s + r.reds, 0) / pulls.length
      : null;
    return { name, idx, pulls: pulls.length, avg };
  });

  const sorted = [...stats].sort((a, b) => {
    if (a.avg === null && b.avg === null) return 0;
    if (a.avg === null) return 1;
    if (b.avg === null) return -1;
    return a.avg - b.avg;
  });

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted,#64748b)', marginBottom: 8 }}>Worker Rankings</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={th}>Worker</th>
            <th style={th}>Pulls</th>
            <th style={th}>Average</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(w => (
            <tr key={w.idx}>
              <td style={{ ...td, color: WORKER_COLORS[w.idx], fontWeight: 600 }}>{w.name}</td>
              <td style={{ ...td, textAlign: 'center' }}>{w.pulls}</td>
              <td style={{ ...td, textAlign: 'center' }}>{w.avg !== null ? w.avg.toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  color: 'var(--text-muted,#64748b)',
  fontWeight: 500,
  borderBottom: '1px solid var(--border,rgba(255,255,255,0.06))',
};

const td: React.CSSProperties = {
  padding: '4px 8px',
  color: 'var(--text,#e2e8f0)',
  borderBottom: '1px solid var(--border,rgba(255,255,255,0.06))',
};
