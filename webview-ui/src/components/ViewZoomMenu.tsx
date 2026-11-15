interface ViewZoomMenuProps {
  /** Current size step, 0 = the fitted size, negative = smaller. */
  step: number;
  /** Steps bigger than the fit on offer at this screen size. */
  maxSteps: number;
  /** Steps smaller than the fit on offer (a positive count). */
  minSteps: number;
  onStepChange: (step: number) => void;
}

/**
 * View mode's size menu, a small wooden sign post at the bottom right: + makes
 * the office bigger (less sky and ground either side), − smaller, down to the
 * fitted size. The camera is locked in view mode, so this is the only control
 * over size there. Hidden when the screen offers only one size.
 */
export function ViewZoomMenu({ step, maxSteps, minSteps, onStepChange }: ViewZoomMenuProps) {
  if (maxSteps + minSteps <= 0) return null;
  return (
    <div
      data-testid="view-zoom-menu"
      className="absolute right-10 z-10 flex flex-col items-center gap-4"
      style={{ bottom: 44 }}
    >
      <button
        type="button"
        className="cabin-plank"
        style={{ minWidth: 36 }}
        aria-label="Bigger office"
        title="Bigger office"
        disabled={step >= maxSteps}
        onClick={() => onStepChange(Math.min(maxSteps, step + 1))}
      >
        +
      </button>
      <div className="text-sm select-none" style={{ color: 'var(--cabin-text)' }}>
        {step + minSteps + 1}/{maxSteps + minSteps + 1}
      </div>
      <button
        type="button"
        className="cabin-plank"
        style={{ minWidth: 36 }}
        aria-label="Smaller office"
        title="Smaller office"
        disabled={step <= -minSteps}
        onClick={() => onStepChange(Math.max(-minSteps, step - 1))}
      >
        −
      </button>
    </div>
  );
}
