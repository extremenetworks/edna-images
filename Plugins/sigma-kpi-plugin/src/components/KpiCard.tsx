import { useCallback, useRef, type MouseEvent } from 'react';
import { formatNumber } from '../format';
import { KpiLabel } from './KpiLabel';
import { useCountUp } from '../useCountUp';
import type { Comparison, Kpi, Layout, Theme } from '../types';

interface AnimatedValueProps {
  value: number;
  formatStr: string;
  duration: number;
  easing: (t: number) => number;
  delay: number;
  enabled: boolean;
  color: string;
}

function AnimatedValue({ value, formatStr, duration, easing, delay, enabled, color }: AnimatedValueProps) {
  const display = useCountUp(value, duration, easing, delay, enabled);
  return (
    <div className="kpi-value" style={{ color }}>
      {formatNumber(display, formatStr)}
    </div>
  );
}

function ComparisonLine({ comparison, defaultColor }: { comparison: Comparison; defaultColor: string }) {
  if (!comparison.text) return null;
  if (comparison.pill) {
    return (
      <div
        className="kpi-comparison kpi-comparison-pill"
        style={{ backgroundColor: comparison.pillBg || '#2a2f4a', color: comparison.pillColor || '#ffffff' }}
      >
        {comparison.text}
      </div>
    );
  }
  return (
    <div className="kpi-comparison" style={{ color: comparison.color || defaultColor }}>
      {comparison.text}
    </div>
  );
}

interface KpiCardProps {
  kpi: Kpi;
  index: number;
  theme: Theme;
  layout: Layout;
  easing: (t: number) => number;
  /** Render just value + comparisons in a row (used inside stacked cards). */
  inline?: boolean;
  onCardClick?: (kpi: Kpi) => void;
}

export function KpiCard({ kpi, index, theme, layout, easing, inline, onCardClick }: KpiCardProps) {
  const clickable = !!kpi.segmentValue && !!onCardClick;
  const ref = useRef<HTMLDivElement>(null);

  // Subtle 3D tilt toward the cursor on clickable cards.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (y - 0.5) * -8;
    const rotateY = (x - 0.5) * 8;
    el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = '';
  }, []);

  const value = (
    <AnimatedValue
      value={kpi.value}
      formatStr={kpi.formatStr}
      duration={layout.animDuration}
      easing={easing}
      delay={index * layout.animStagger}
      enabled={layout.animEnabled}
      color={theme.valueColor}
    />
  );
  const comparisons = kpi.comparisons.map((c, i) => (
    <ComparisonLine key={i} comparison={c} defaultColor={theme.compColor} />
  ));

  if (inline) {
    return (
      <div className="kpi-inline-row">
        {value}
        {comparisons}
      </div>
    );
  }

  return (
    <div
      ref={clickable ? ref : undefined}
      className={`kpi-card${clickable ? ' kpi-card-clickable' : ''}`}
      style={{
        backgroundColor: theme.bgColor,
        padding: layout.cardPadding != null ? `${layout.cardPadding}px` : `clamp(${Math.round(24 * 0.4)}px, 5cqi, 24px)`,
        gap: layout.contentGap,
        border: theme.borderWidth !== '0' ? `${theme.borderWidth} solid ${theme.borderColor}` : 'none',
        borderRadius: `${theme.borderRadius}px`,
      }}
      onClick={clickable ? () => onCardClick!(kpi) : undefined}
      onMouseMove={clickable ? handleMouseMove : undefined}
      onMouseLeave={clickable ? handleMouseLeave : undefined}
    >
      <KpiLabel
        label={kpi.label}
        color={theme.labelColor}
        description={kpi.description}
        showInfoIcon={layout.showInfoIcon}
      />
      {layout.cardLayout === 'grid' ? (
        <div className="kpi-card-grid-body">
          {value}
          <div className="kpi-comparisons kpi-comparisons-grid">{comparisons}</div>
        </div>
      ) : (
        <>
          {value}
          <div className="kpi-comparisons">{comparisons}</div>
        </>
      )}
    </div>
  );
}
