import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { READ_ONLY_CONTROL_HINT } from '../constants.js';
import type { Directory } from '../hooks/useExtensionMessages.js';
import { isBrowserRuntime } from '../runtime.js';
import { transport } from '../transport/index.js';
import { LaunchDrawer } from './LaunchDrawer.js';

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

  // The three controls are a small log cabin in the bottom-left corner (over
  // the side forest): one floor per control, the roof, chimney, balcony,
  // porch and firewood just decoration. The layout editor's toolbar sits to
  // its right in edit mode.
  const cabin = (agent: ReactNode, layout: ReactNode, settings: ReactNode) => (
    <div className="absolute bottom-10 left-10 z-44 cabin">
      <div className="cabin-chimney" aria-hidden />
      <div className="cabin-smoke" aria-hidden />
      <div className="cabin-roof" aria-hidden>
        <div className="cabin-gable" />
      </div>
      <div className="cabin-walls">
        {agent}
        <div className="cabin-rail" aria-hidden />
        {layout}
        <div className="cabin-eave" aria-hidden>
          <div className="cabin-lantern" />
        </div>
        {settings}
      </div>
      <div className="cabin-base" aria-hidden>
        <div className="cabin-firewood" />
        <div className="cabin-path" />
      </div>
    </div>
  );

  // View only: the same three controls, all disabled, the tooltip saying how
  // to get them back. Nothing here could do anything — the server refuses every
  // change from an untokened page.
  if (readOnly) {
    const disabled = (label: string, floor: string) => (
      <button
        key={label}
        className="cabin-plank"
        data-floor={floor}
        disabled
        title={READ_ONLY_CONTROL_HINT}
      >
        {label}
      </button>
    );
    return cabin(
      disabled('+ Agent', 'top'),
      disabled('Layout', 'mid'),
      disabled('Settings', 'porch'),
    );
  }

  const agentFloor = (
    <>
      {showUnavailable && (
        <button
          className="cabin-plank"
          data-floor="top"
          disabled
          title={terminalUnavailableReason ?? 'Terminal unavailable on this server.'}
        >
          + Agent
        </button>
      )}
      {canLaunch && (
        <div
          ref={launchRef}
          className="relative flex flex-col"
          // Hover is the desktop secondary gesture (long-press is the mobile
          // one): it opens the drawer without committing to a launch.
          onMouseEnter={() => setIsDrawerOpen(true)}
          onMouseLeave={() => setIsDrawerOpen(false)}
        >
          <button
            className="cabin-plank"
            data-floor="top"
            data-on={isDrawerOpen}
            onClick={handleAgentClick}
          >
            + Agent
          </button>
          <LaunchDrawer
            placement="right"
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
    </>
  );

  return cabin(
    agentFloor,
    <button
      className="cabin-plank"
      data-floor="mid"
      data-on={isEditMode}
      onClick={onToggleEditMode}
      title="Edit office layout"
    >
      Layout
    </button>,
    <button
      className="cabin-plank"
      data-floor="porch"
      data-on={isSettingsOpen}
      onClick={onToggleSettings}
      title="Settings"
    >
      Settings
    </button>,
  );
}
