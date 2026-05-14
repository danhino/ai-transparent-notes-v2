import { PaneDiffState } from '../stores/uiStore';

interface Props {
  diff: PaneDiffState;
  onAccept: () => void;
  onRevert: () => void;
}

export function DiffBanner({ diff, onAccept, onRevert }: Props) {
  const { diffBlocks, countdown } = diff;
  const changeCount = diffBlocks.filter((b) => b.type !== 'equal').length;

  return (
    <div className="diff-banner">
      <span className="diff-banner-text">
        AI made {changeCount} change{changeCount !== 1 ? 's' : ''} &middot; Auto-accepting in {countdown}s...
      </span>
      <div className="diff-banner-actions">
        <button className="diff-revert" onClick={onRevert}>Revert</button>
        <button className="diff-accept" onClick={onAccept}>Accept all</button>
      </div>
    </div>
  );
}
