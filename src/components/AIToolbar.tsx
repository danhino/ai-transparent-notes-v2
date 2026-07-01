import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, MoreHorizontal } from 'lucide-react';

type AiAction = 'fix' | 'polish' | 'rephrase' | 'convo' | 'spellcheck' | 'suggest' | 'apply' | 'compare';

interface Props {
  disabled: boolean;
  onOpenPalette: () => void;
  onAction: (action: AiAction) => void;
  isHtmlViewer: boolean;
}

export const AIToolbar = memo(function AIToolbar({ disabled, onOpenPalette, onAction, isHtmlViewer }: Props) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleOverflowToggle() {
    if (overflowOpen) {
      setOverflowOpen(false);
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
    }
    setOverflowOpen(true);
  }

  useEffect(() => {
    if (!overflowOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOverflowOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [overflowOpen]);

  return (
    <div className="ai-toolbar">
      <button
        className="ai-btn ai-btn-primary ai-trigger-btn"
        disabled={disabled}
        onClick={onOpenPalette}
        title="AI command palette (Ctrl+K)"
      >
        <Sparkles size={13} />
        <span>AI</span>
        <kbd className="ai-trigger-kbd">Ctrl+K</kbd>
      </button>

      <button
        ref={buttonRef}
        className="ai-btn"
        disabled={disabled}
        onClick={handleOverflowToggle}
        title="More actions"
      >
        <MoreHorizontal size={14} />
      </button>

      {overflowOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          className="ai-overflow-menu"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)' }}
        >
          <button
            className="ai-overflow-item"
            onClick={() => { onAction('compare'); setOverflowOpen(false); }}
          >
            Compare
          </button>
          <button
            className="ai-overflow-item"
            onClick={() => { onAction('spellcheck'); setOverflowOpen(false); }}
          >
            Spell check
          </button>
          {isHtmlViewer && (
            <button
              className="ai-overflow-item"
              onClick={() => { onAction('apply'); setOverflowOpen(false); }}
            >
              Open HTML preview
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});
