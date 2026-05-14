import { useRef, useState, useCallback } from 'react';
import { Pane } from './Pane';
import { useSettingsStore } from '../stores/settingsStore';
import { Layout } from '../types';

// ─── Draggable splitter ───────────────────────────────────────────────────────

interface SplitterHProps {
  onDrag: (delta: number) => void;
}

function SplitterH({ onDrag }: SplitterHProps) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      setDragging(true);

      function onMove(ev: MouseEvent) {
        onDrag(ev.clientX - startXRef.current);
        startXRef.current = ev.clientX;
      }
      function onUp() {
        setDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [onDrag]
  );

  return (
    <div
      className={`splitter-h${dragging ? ' dragging' : ''}`}
      onMouseDown={handleMouseDown}
    />
  );
}

interface SplitterVProps {
  onDrag: (delta: number) => void;
}

function SplitterV({ onDrag }: SplitterVProps) {
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startYRef.current = e.clientY;
      setDragging(true);

      function onMove(ev: MouseEvent) {
        onDrag(ev.clientY - startYRef.current);
        startYRef.current = ev.clientY;
      }
      function onUp() {
        setDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [onDrag]
  );

  return (
    <div
      className={`splitter-v${dragging ? ' dragging' : ''}`}
      onMouseDown={handleMouseDown}
    />
  );
}

// ─── Layout implementations ───────────────────────────────────────────────────

function SingleLayout() {
  return (
    <div className="pane-row">
      <Pane paneIndex={0} />
    </div>
  );
}

function SideBySideLayout() {
  const [leftFlex, setLeftFlex] = useState(1);
  const [rightFlex, setRightFlex] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleDrag(delta: number) {
    const w = containerRef.current?.clientWidth ?? 800;
    const ratio = delta / w;
    setLeftFlex((f) => Math.max(0.1, f + ratio));
    setRightFlex((f) => Math.max(0.1, f - ratio));
  }

  return (
    <div className="pane-row" ref={containerRef}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: leftFlex, minWidth: 0 }}>
        <Pane paneIndex={0} />
      </div>
      <SplitterH onDrag={handleDrag} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: rightFlex, minWidth: 0 }}>
        <Pane paneIndex={1} />
      </div>
    </div>
  );
}

function TopBottomLayout() {
  const [topFlex, setTopFlex] = useState(1);
  const [bottomFlex, setBottomFlex] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleDrag(delta: number) {
    const h = containerRef.current?.clientHeight ?? 600;
    const ratio = delta / h;
    setTopFlex((f) => Math.max(0.1, f + ratio));
    setBottomFlex((f) => Math.max(0.1, f - ratio));
  }

  return (
    <div className="pane-col" ref={containerRef} style={{ flex: 1 }}>
      <div style={{ display: 'flex', flex: topFlex, minHeight: 0 }}>
        <Pane paneIndex={0} />
      </div>
      <SplitterV onDrag={handleDrag} />
      <div style={{ display: 'flex', flex: bottomFlex, minHeight: 0 }}>
        <Pane paneIndex={2} />
      </div>
    </div>
  );
}

function GridLayout() {
  const [leftFlex, setLeftFlex] = useState(1);
  const [rightFlex, setRightFlex] = useState(1);
  const [topFlex, setTopFlex] = useState(1);
  const [bottomFlex, setBottomFlex] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleHDrag(delta: number) {
    const w = containerRef.current?.clientWidth ?? 800;
    const ratio = delta / w;
    setLeftFlex((f) => Math.max(0.1, f + ratio));
    setRightFlex((f) => Math.max(0.1, f - ratio));
  }

  function handleVDrag(delta: number) {
    const h = containerRef.current?.clientHeight ?? 600;
    const ratio = delta / h;
    setTopFlex((f) => Math.max(0.1, f + ratio));
    setBottomFlex((f) => Math.max(0.1, f - ratio));
  }

  return (
    <div className="pane-col" ref={containerRef} style={{ flex: 1 }}>
      {/* Top row */}
      <div className="pane-row" style={{ flex: topFlex }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: leftFlex, minWidth: 0 }}>
          <Pane paneIndex={0} />
        </div>
        <SplitterH onDrag={handleHDrag} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: rightFlex, minWidth: 0 }}>
          <Pane paneIndex={1} />
        </div>
      </div>

      <SplitterV onDrag={handleVDrag} />

      {/* Bottom row */}
      <div className="pane-row" style={{ flex: bottomFlex }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: leftFlex, minWidth: 0 }}>
          <Pane paneIndex={2} />
        </div>
        <SplitterH onDrag={handleHDrag} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: rightFlex, minWidth: 0 }}>
          <Pane paneIndex={3} />
        </div>
      </div>
    </div>
  );
}

// ─── PaneSystem ───────────────────────────────────────────────────────────────

const LAYOUT_COMPONENTS: Record<Layout, () => React.ReactElement> = {
  single: SingleLayout,
  'side-by-side': SideBySideLayout,
  'top-bottom': TopBottomLayout,
  grid: GridLayout,
};

export function PaneSystem() {
  const layout = useSettingsStore((s) => s.settings.layout);
  const Component = LAYOUT_COMPONENTS[layout];
  return (
    <div className="pane-system">
      <Component />
    </div>
  );
}
