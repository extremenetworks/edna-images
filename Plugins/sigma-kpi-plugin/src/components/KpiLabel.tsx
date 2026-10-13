import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

interface KpiLabelProps {
  label: string;
  color: string;
  description?: string;
  showInfoIcon: boolean;
}

const TOOLTIP_GAP = 6;
const VIEWPORT_PAD = 8;

/** KPI title with an optional info icon that reveals the description on hover. */
export function KpiLabel({ label, color, description, showInfoIcon }: KpiLabelProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });

  // Position after the tooltip renders so we can measure it and keep it inside the iframe.
  useLayoutEffect(() => {
    if (!open || !iconRef.current || !tipRef.current) return;
    const icon = iconRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = icon.left + icon.width / 2 - tip.width / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - tip.width - VIEWPORT_PAD));
    let top = icon.bottom + TOOLTIP_GAP;
    if (top + tip.height > vh - VIEWPORT_PAD) top = Math.max(VIEWPORT_PAD, icon.top - tip.height - TOOLTIP_GAP);
    setPos({ left, top, visibility: 'visible' });
  }, [open, description]);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => {
    setOpen(false);
    setPos({ visibility: 'hidden' });
  }, []);
  // Keep the card's click handler (segment selection) from firing when using the icon.
  const stop = useCallback((e: MouseEvent) => e.stopPropagation(), []);

  const hasIcon = showInfoIcon && !!description;

  return (
    <div className="kpi-label" style={{ color }}>
      {label}
      {hasIcon && (
        <span
          ref={iconRef}
          className="kpi-info-icon"
          role="img"
          aria-label={description}
          tabIndex={0}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          onClick={stop}
        >
          <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="7.25" y="7" width="1.5" height="5" rx="0.75" fill="currentColor" />
            <circle cx="8" cy="4.75" r="1" fill="currentColor" />
          </svg>
        </span>
      )}
      {hasIcon &&
        open &&
        createPortal(
          <div ref={tipRef} className="kpi-tooltip" role="tooltip" style={pos}>
            {description}
          </div>,
          document.body,
        )}
    </div>
  );
}
