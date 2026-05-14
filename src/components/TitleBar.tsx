import { getCurrentWindow } from '@tauri-apps/api/window';
import { useUiStore } from '../stores/uiStore';

export function TitleBar() {
  const platform = useUiStore((s) => s.platform);
  const win = getCurrentWindow();

  const minimize = () => void win.minimize();
  const maximize = () => void win.toggleMaximize();
  const close = () => void win.close();

  return (
    <div className="titlebar">
      {/* macOS: leave space for native traffic lights */}
      <div
        className="titlebar-drag"
        data-tauri-drag-region
        style={{ paddingLeft: platform === 'macos' ? 72 : 12 }}
      >
        AI Transparent Notes
      </div>

      {/* Windows/Linux: custom window controls */}
      {platform !== 'macos' && (
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={minimize} title="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button className="titlebar-btn" onClick={maximize} title="Maximize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" />
            </svg>
          </button>
          <button className="titlebar-btn close" onClick={close} title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="0.7" y1="0.7" x2="9.3" y2="9.3" stroke="currentColor" strokeWidth="1.4" />
              <line x1="9.3" y1="0.7" x2="0.7" y2="9.3" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
