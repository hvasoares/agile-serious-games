export interface LogEntry {
  id: number;
  text: string;
  kind: 'normal' | 'tamper' | 'system';
}

interface EventLogProps {
  entries: LogEntry[];
}

export function EventLog({ entries }: EventLogProps) {
  return (
    <div style={{
      maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse',
      gap: 2, fontSize: 12,
    }}>
      {[...entries].reverse().map(e => (
        <div key={e.id} style={{ color: entryColor(e.kind), padding: '2px 0' }}>
          {e.text}
        </div>
      ))}
    </div>
  );
}

function entryColor(kind: LogEntry['kind']): string {
  if (kind === 'tamper') return 'var(--rb-red,#e0473d)';
  if (kind === 'system') return 'var(--rb-brass,#c6a15b)';
  return 'var(--text-muted,#64748b)';
}
