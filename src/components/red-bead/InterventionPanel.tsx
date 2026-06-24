import type { InterventionSet, PaddleSize } from '../../sim/red-bead/redBeadSim.types';

interface InterventionPanelProps {
  interventions: InterventionSet;
  onSet: (key: keyof InterventionSet, value: unknown) => void;
  onExhort: () => void;
}

export function InterventionPanel({ interventions, onSet, onExhort }: InterventionPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Group label="A — Change the System">
        <Row label="Supplier quality (% red)">
          <input type="range" min={0} max={40} step={1}
            value={Math.round(interventions.supplierPct * 100)}
            onChange={e => onSet('supplierPct', Number(e.target.value))} />
          <span style={valStyle}>{Math.round(interventions.supplierPct * 100)}%</span>
        </Row>
        <Row label="Remove red beads">
          <Toggle checked={interventions.removeReds} onChange={v => onSet('removeReds', v)} />
        </Row>
        <Row label="Paddle size">
          <Segment
            options={[50, 25, 10] as PaddleSize[]}
            value={interventions.paddleSize}
            onChange={v => onSet('paddleSize', v)}
          />
        </Row>
      </Group>

      <Group label="B — Inspect &amp; Sort">
        <Row label="Pull twice, keep better">
          <Toggle checked={interventions.keepBest} onChange={v => onSet('keepBest', v)} />
        </Row>
        <Row label="Re-pull the reds">
          <Segment
            options={[0, 1, 2]}
            labels={['off', '1 pass', '2 pass']}
            value={interventions.reworkPasses}
            onChange={v => onSet('reworkPasses', v)}
          />
        </Row>
      </Group>

      <Group label="C — Management Theater">
        <Row label="Exhort the workers">
          <button style={btnStyle} onClick={onExhort}>Exhort!</button>
        </Row>
        <Row label="Incentives &amp; blame">
          <Toggle checked={interventions.incentives} onChange={v => onSet('incentives', v)} />
        </Row>
        <Row label="Set a quota">
          <input type="range" min={0} max={20} step={1}
            value={interventions.quota}
            onChange={e => onSet('quota', Number(e.target.value))} />
          <span style={valStyle}>{interventions.quota === 0 ? 'off' : interventions.quota}</span>
        </Row>
        <Row label="Tamper after every pull">
          <Toggle checked={interventions.tampering} onChange={v => onSet('tampering', v)} />
        </Row>
      </Group>

      <Group label="D — Chart Options">
        <Row label="Limits from the data">
          <Toggle checked={interventions.limitsFromData} onChange={v => onSet('limitsFromData', v)} />
        </Row>
        <Row label="Show as defect rate (%)">
          <Toggle checked={interventions.showRate} onChange={v => onSet('showRate', v)} />
        </Row>
        <Row label="Six willing workers">
          <Toggle checked={interventions.workersOn} onChange={v => onSet('workersOn', v)} />
        </Row>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rb-brass,#c6a15b)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--text,#e2e8f0)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        padding: '3px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 12,
        background: checked ? 'var(--accent,#6366f1)' : 'var(--bg-card,#111630)',
        color: 'var(--text,#e2e8f0)',
      }}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  );
}

function Segment<T>({ options, labels, value, onChange }: {
  options: T[];
  labels?: string[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map((opt, i) => (
        <button key={i} onClick={() => onChange(opt)}
          style={{
            padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
            background: value === opt ? 'var(--accent,#6366f1)' : 'var(--bg-card,#111630)',
            color: 'var(--text,#e2e8f0)',
          }}
        >
          {labels ? labels[i] : String(opt)}
        </button>
      ))}
    </div>
  );
}

const valStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted,#64748b)', minWidth: 28, textAlign: 'right' };
const btnStyle: React.CSSProperties = { padding: '3px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, background: 'var(--amber,#f59e0b)', color: '#000', fontWeight: 600 };
