import { useState, useRef, CSSProperties } from 'react';

interface DraggableListProps {
  items: string[];
  getLabel?: (item: string) => string;
  onReorder: (newItems: string[]) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function DraggableList({ items, getLabel, onReorder, onRemove, onMoveUp, onMoveDown }: DraggableListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Refs hold live values so the pointerUp handler never reads stale closure state
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function startDrag(e: React.PointerEvent, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragIndexRef.current = index;
    dropIndexRef.current = null;
    setDragIndex(index);
    setDropIndex(null);
    // Capture so pointermove fires on the container even when cursor leaves it
    try { containerRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragIndexRef.current === null) return;
    e.preventDefault();
    // elementFromPoint is layout-based (ignores pointer capture) — returns the real target
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest('[data-drag-index]');
    if (row && containerRef.current?.contains(row)) {
      const idx = parseInt(row.getAttribute('data-drag-index') ?? '-1');
      if (idx >= 0 && idx !== dragIndexRef.current) {
        dropIndexRef.current = idx;
        setDropIndex(idx);
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragIndexRef.current === null) return;
    e.preventDefault();
    const src = dragIndexRef.current;
    const target = dropIndexRef.current;
    dragIndexRef.current = null;
    dropIndexRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
    if (src !== null && target !== null && src !== target) {
      const newItems = [...items];
      const [moved] = newItems.splice(src, 1);
      newItems.splice(target, 0, moved);
      onReorder(newItems);
    }
  }

  function cancelDrag() {
    dragIndexRef.current = null;
    dropIndexRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
  }

  const btnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: 12, padding: '0 3px', lineHeight: 1,
  };
  const removeBtnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--danger)', fontSize: 14, padding: '0 3px', lineHeight: 1,
  };

  return (
    <div
      ref={containerRef}
      className="format-list draggable-list"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelDrag}
      style={{ touchAction: 'none', cursor: dragIndex !== null ? 'grabbing' : undefined }}
    >
      {items.map((item, index) => {
        const isDragged = dragIndex === index;
        const isDropTarget = dropIndex === index && dragIndex !== index;
        return (
          <div
            key={item}
            data-drag-index={index}
            className="format-list-item"
            style={{
              justifyContent: 'space-between',
              opacity: isDragged ? 0.4 : 1,
              borderTop: isDropTarget ? '2px solid var(--accent)' : '2px solid transparent',
              userSelect: 'none',
              background: isDragged ? 'rgba(255,255,255,0.03)' : 'transparent',
              transition: 'opacity 0.1s, border-color 0.1s',
              cursor: dragIndex !== null ? 'grabbing' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                className="drag-handle"
                title="Drag to reorder"
                style={{ cursor: dragIndex !== null ? 'grabbing' : 'grab' }}
                onPointerDown={(e) => startDrag(e, index)}
              >
                ⠿
              </span>
              <span>{getLabel ? getLabel(item) : item}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button style={btnStyle} disabled={index === 0} onClick={(e) => { e.stopPropagation(); onMoveUp(index); }} title="Move up">▲</button>
              <button style={btnStyle} disabled={index === items.length - 1} onClick={(e) => { e.stopPropagation(); onMoveDown(index); }} title="Move down">▼</button>
              <button style={removeBtnStyle} onClick={(e) => { e.stopPropagation(); onRemove(index); }} title="Remove">×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
