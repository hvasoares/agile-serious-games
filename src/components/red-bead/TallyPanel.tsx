interface TallyPanelProps {
  pulls: number;
  average: number | null;
  best: number | null;
  worst: number | null;
  totalReds: number;
  defectRate: number | null;
  cost: number;
  morale: number;
}

export function TallyPanel({ pulls, average, best, worst, totalReds, defectRate, cost, morale }: TallyPanelProps) {
  const fmt = (v: number | null, decimals = 1) =>
    v === null ? '—' : v.toFixed(decimals);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      <Stat label="Pulls" value={String(pulls)} />
      <Stat label="Average" value={fmt(average)} />
      <Stat label="Best" value={fmt(best, 0)} />
      <Stat label="Worst" value={fmt(worst, 0)} />
      <Stat label="Total reds" value={String(totalReds)} />
      <Stat label="Defect %" value={defectRate !== null ? `${(defectRate * 100).toFixed(1)}%` : '—'} />
      <Stat label="Cost" value={`$${cost}`} />
      <Stat label="Morale" value={`${morale.toFixed(0)}%`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card,#111630)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted,#64748b)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text,#e2e8f0)' }}>{value}</div>
    </div>
  );
}
