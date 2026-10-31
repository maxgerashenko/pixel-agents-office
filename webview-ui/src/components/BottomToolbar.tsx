import { useEffect, useRef, useState } from 'react';

import { READ_ONLY_CONTROL_HINT } from '../constants.js';
import type { Directory } from '../hooks/useExtensionMessages.js';
import { isBrowserRuntime } from '../runtime.js';
import { transport } from '../transport/index.js';
import { LaunchDrawer } from './LaunchDrawer.js';
import { Button } from './ui/Button.js';

interface BottomToolbarProps {
  /** View-only office (no server token): every control shows, disabled. */
  readOnly?: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
  directories: Directory[];
  /** Drawer's pinned `+ Directory` row — opens the Directory modal empty. */
  onAddDirectory: () => void;
  /** Pencil on a user-defined row — opens the modal pre-filled. */
  onEditDirectory: (directory: Directory) => void;
  /** Standalone: server has a working PTY, so agents can be launched here. */
  terminalAvailable: boolean;
  /** Why the terminal is off (shown on the disabled button's tooltip). */
  terminalUnavailableReason: string | null;
}

export function BottomToolbar({
  readOnly = false,
  isEditMode,
  onToggleEditMode,
  isSettingsOpen,
  onToggleSettings,
  directories,
  onAddDirectory,
  onEditDirectory,
  terminalAvailable,
  terminalUnavailableReason,
}: BottomToolbarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const launchRef = useRef<HTMLDivElement>(null);

  // Close the launch drawer on outside press (the dropdown convention here).
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handlePress = (e: PointerEvent) => {
      if (launchRef.current && !launchRef.current.contains(e.target as Node)) {
        setIsDrawerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePress);
    return () => document.removeEventListener('pointerdown', handlePress);
  }, [isDrawerOpen]);

  // A plain press never launches: it opens the drawer, and the launch happens
  // from a Directory row. Opening (not toggling) so a click that follows the
  // hover — which already opened the drawer — doesn't close it.
  const handleAgentClick = () => {
    setIsDrawerOpen(true);
  };

  const handleDirectorySelect = (directory: Directory) => {
    setIsDrawerOpen(false);
    transport.send({ type: 'launchAgent', directoryPath: directory.path });
  };

  // Standalone can launch agents whenever the server has a working PTY. When it
  // doesn't, show the button disabled with the reason rather than hiding it —
  // silently missing UI reads as a bug, and the cause (a native module that
  // couldn't install) is not something a user would otherwise ever discover.
  const canLaunch = !isBrowserRuntime || terminalAvailable;
  const showUnavailable = isBrowserRuntime && !terminalAvailable;

  // View only: the same three controls, all disabled, the tooltip saying how
  // to get them back. Nothing here could do anything — the server refuses every
  // change from an untokened page.
  if (readOnly) {
    return (
      <div className="absolute left-10 bottom-10 z-20 flex items-center gap-4 pixel-panel p-4">
        {['+ Agent', 'Layout', 'Settings'].map((label) => (
          <Button key={label} variant="disabled" disabled title={READ_ONLY_CONTROL_HINT}>
            {label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    // Bottom-left. The terminal panel docks on the right edge, so it never
    // reaches these buttons and no lift is needed.
    <div className="absolute left-10 bottom-10 z-20 flex items-center gap-4 pixel-panel p-4">
      {showUnavailable && (
        <Button
          variant="disabled"
          disabled
          title={terminalUnavailableReason ?? 'Terminal unavailable on this server.'}
        >
          + Agent
        </Button>
      )}
      {canLaunch && (
        <div
          ref={launchRef}
          className="relative"
          // Hover is the desktop secondary gesture (long-press is the mobile
          // one): it opens the drawer without committing to a launch.
          onMouseEnter={() => setIsDrawerOpen(true)}
          onMouseLeave={() => setIsDrawerOpen(false)}
        >
          <Button
            variant="accent"
            onClick={handleAgentClick}
            className={isDrawerOpen ? 'bg-accent-bright' : 'bg-accent hover:bg-accent-bright'}
          >
            + Agent
          </Button>
          <LaunchDrawer
            isOpen={isDrawerOpen}
            directories={directories}
            onSelect={handleDirectorySelect}
            onAddDirectory={() => {
              setIsDrawerOpen(false);
              onAddDirectory();
            }}
            onEditDirectory={(directory) => {
              setIsDrawerOpen(false);
              onEditDirectory(directory);
            }}
          />
        </div>
      )}
      <Button
        variant={isEditMode ? 'active' : 'default'}
        onClick={onToggleEditMode}
        title="Edit office layout"
      >
        Layout
      </Button>
      <Button
        variant={isSettingsOpen ? 'active' : 'default'}
        onClick={onToggleSettings}
        title="Settings"
      >
        Settings
      </Button>
    </div>
  );
}
