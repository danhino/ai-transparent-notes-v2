import { useState, useRef, useEffect, CSSProperties } from 'react';

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
  // Ref avoids stale closure in onDrop — state from dragStart render isn't visible
  // to onDrop's function reference without this
  const dragIndexRef = useRef<number | null>(null);
  const touchDragIndex = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Register touchmove with passive:false so preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onTouchMove(e: TouchEvent) {
      if (touchDragIndex.current === null) return;
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = target?.closest('[data-drag-index]');
      if (row) {
        const idx = parseInt(row.getAttribute('data-drag-index') ?? '-1');
        if (idx >= 0 && idx !== touchDragIndex.current) setDropIndex(idx);
      }
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  function commitDrop(src: number, target: number) {
    if (src === target) return;
    const newItems = [...items];
    const [moved] = newItems.splice(src, 1);
    newItems.splice(target, 0, moved);
    onReorder(newItems);
  }

  function handleTouchStart(index: number) {
    touchDragIndex.current = index;
    setDragIndex(index);
  }

  function handleTouchEnd() {
    const src = touchDragIndex.current;
    if (src !== null && dropIndex !== null) commitDrop(src, dropIndex);
    touchDragIndex.current = null;
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
    <div ref={containerRef} className="format-list draggable-list">
      {items.map((item, index) => {
        const isDragged = dragIndex === index;
        const isDropTarget = dropIndex === index && dragIndex !== index;
        return (
          <div
            key={item}
            data-drag-index={index}
            className="format-list-item"
            draggable
            onDragStart={(e) => {
              // setData required for drop to fire in WebView2 — without it the
              // browser silently treats the operation as cancelled
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
              dragIndexRef.current = index;
              setDragIndex(index);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              if (index !== dragIndexRef.current) setDropIndex(index);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (index !== dragIndexRef.current) setDropIndex(index);
            }}
            onDragLeave={(e) => {
              // Only clear when the cursor truly leaves this item, not when it
              // crosses into a child element (span, button)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropIndex(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const src = dragIndexRef.current;
              if (src === null || src === index) {
                dragIndexRef.current = null;
                setDragIndex(null);
                setDropIndex(null);
                return;
              }
              commitDrop(src, index);
              dragIndexRef.current = null;
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              dragIndexRef.current = null;
              setDragIndex(null);
              setDropIndex(null);
            }}
            onTouchStart={() => handleTouchStart(index)}
            onTouchEnd={handleTouchEnd}
            style={{
              justifyContent: 'space-between',
              opacity: isDragged ? 0.4 : 1,
              borderTop: isDropTarget ? '2px solid var(--accent)' : '2px solid transparent',
              userSelect: 'none',
              cursor: 'default',
              background: isDragged ? 'rgba(255,255,255,0.03)' : 'transparent',
              transition: 'opacity 0.1s, border-color 0.1s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="drag-handle" title="Drag to reorder">⠿</span>
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
