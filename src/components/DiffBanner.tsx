import { PaneDiffState } from '../stores/uiStore';

interface Props {
  diff: PaneDiffState;
  onAccept: () => void;
  onRevert: () => void;
}

export function DiffBanner({ diff, onAccept, onRevert }: Props) {
  const { diffBlocks, countdown } = diff;
  const added = diffBlocks.filter((b) => b.type === 'added' || b.type === 'changed').length;
  const deleted = diffBlocks.filter((b) => b.type === 'deleted' || b.type === 'changed').length;

  return (
    <div className="diff-banner">
      <span style={{ color: 'var(--success)' }}>+{added}</span>
      <span style={{ color: 'var(--danger)' }}>-{deleted}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
        AI changes applied
      </span>
      <button className="diff-accept" onClick={onAccept}>
        Accept
      </button>
      <button className="diff-revert" onClick={onRevert}>
        Revert
      </button>
      <span className="diff-countdown">Auto-accept in {countdown}s</span>
    </div>
  );
}
