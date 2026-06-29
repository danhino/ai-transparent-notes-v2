import { useState, useRef, useEffect } from 'react';

export function useResizable(lsKey: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(lsKey);
    return stored ? parseInt(stored, 10) : defaultWidth;
  });
  const [isDraggingState, setIsDraggingState] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  minRef.current = min;
  maxRef.current = max;

  const onResizerMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = wrapperRef.current?.offsetWidth ?? width;
    setIsDraggingState(true);
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.max(minRef.current, Math.min(maxRef.current, startWidth.current + (e.clientX - startX.current)));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setIsDraggingState(false);
      const finalWidth = wrapperRef.current?.offsetWidth;
      if (finalWidth) localStorage.setItem(lsKey, String(finalWidth));
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [lsKey]);

  return { width, wrapperRef, isDraggingState, onResizerMouseDown };
}
