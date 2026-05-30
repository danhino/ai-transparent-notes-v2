import { useState, useEffect, useRef } from 'react';

function JsonTreeNode({ nodeKey, value, depth }: {
  nodeKey: string | null;
  value: unknown;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  const keyEl = nodeKey !== null
    ? <span style={{ color: '#7ab8ff' }}>"{nodeKey}": </span>
    : null;

  if (value === null)
    return <div style={{ paddingLeft: depth * 16 }}>{keyEl}<span style={{ color: '#888' }}>null</span></div>;
  if (typeof value === 'boolean')
    return <div style={{ paddingLeft: depth * 16 }}>{keyEl}<span style={{ color: '#f97316' }}>{String(value)}</span></div>;
  if (typeof value === 'number')
    return <div style={{ paddingLeft: depth * 16 }}>{keyEl}<span style={{ color: '#6ee7b7' }}>{value}</span></div>;
  if (typeof value === 'string')
    return <div style={{ paddingLeft: depth * 16 }}>{keyEl}<span style={{ color: '#fbbf24' }}>"{value}"</span></div>;

  if (Array.isArray(value)) {
    return (
      <div>
        <div
          style={{ paddingLeft: depth * 16, cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? '▶ ' : '▼ '}{keyEl}[{value.length}]
        </div>
        {!collapsed && value.map((item, i) => (
          <JsonTreeNode key={i} nodeKey={String(i)} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object);
    return (
      <div>
        <div
          style={{ paddingLeft: depth * 16, cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? '▶ ' : '▼ '}{keyEl}&#123;{keys.length} keys&#125;
        </div>
        {!collapsed && keys.map(k => (
          <JsonTreeNode
            key={k}
            nodeKey={k}
            value={(value as Record<string, unknown>)[k]}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  return null;
}

export function JsonTreeView({ content }: { content: string }) {
  const [state, setState] = useState<
    { ok: true; value: unknown } | { ok: false; error: string } | null
  >(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try { setState({ ok: true, value: JSON.parse(content) }); }
      catch (e) { setState({ ok: false, error: (e as Error).message }); }
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content]);

  if (!state) return <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px' }}>Parsing…</div>;
  if (!state.ok) return <div style={{ fontSize: 11, color: 'var(--danger)', padding: '8px' }}>Invalid JSON: {state.error}</div>;

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
      <JsonTreeNode nodeKey={null} value={state.value} depth={0} />
    </div>
  );
}
