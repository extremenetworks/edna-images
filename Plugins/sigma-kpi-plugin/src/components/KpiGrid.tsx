import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { KpiCard } from './KpiCard';
import { KpiLabel } from './KpiLabel';
import { easeOutExpo } from '../useCountUp';
import type { Kpi, Layout, Theme } from '../types';

const SINGLE_COL_BREAKPOINT = 500;

/** Groups KPIs flagged "Stack With Previous" into the preceding card. */
function groupStacked(kpis: Kpi[]): Kpi[][] {
  const groups: Kpi[][] = [];
  for (const kpi of kpis) {
    if (kpi.stacked && groups.length > 0) groups[groups.length - 1].push(kpi);
    else groups.push([kpi]);
  }
  return groups;
}

interface KpiGridProps {
  kpis: Kpi[];
  theme: Theme;
  layout: Layout;
  onCardClick?: (kpi: Kpi) => void;
}

export function KpiGrid({ kpis, theme, layout, onCardClick }: KpiGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [singleCol, setSingleCol] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSingleCol(entry.contentRect.width < SINGLE_COL_BREAKPOINT);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cssVars = {
    '--value-size': `${theme.valueFontSize}px`,
    '--comp-size': `${theme.compFontSize}px`,
    '--label-size': `${theme.labelFontSize}px`,
  } as CSSProperties;
  const minWidth = `min(${layout.minCardWidth}px, 100%)`;
  const groups = groupStacked(kpis);
  const manyCards = kpis.length > 4;

  const columns = singleCol ? '1fr' : `repeat(auto-fit, minmax(${minWidth}, 1fr))`;

  return (
    <div
      ref={gridRef}
      className="kpi-grid"
      style={{
        ...cssVars,
        display: 'grid',
        gridTemplateColumns: columns,
        gap: layout.cardGap,
        padding: layout.containerPadding,
        width: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        alignContent: manyCards ? 'start' : 'stretch',
      }}
    >
      {groups.map((group, gi) =>
        group.length === 1 ? (
          <KpiCard
            key={group[0].id}
            kpi={group[0]}
            index={gi}
            theme={theme}
            layout={layout}
            easing={easeOutExpo}
            onCardClick={onCardClick}
          />
        ) : (
          <div
            key={`group-${gi}`}
            className="kpi-card kpi-stacked-card"
            style={{
              ...(layout.cardPadding != null ? { padding: layout.cardPadding } : {}),
              ['--row-gap' as string]: `${layout.contentGap}px`,
              backgroundColor: theme.bgColor,
              border: theme.borderWidth !== '0' ? `${theme.borderWidth} solid ${theme.borderColor}` : 'none',
              borderRadius: `${theme.borderRadius}px`,
            }}
          >
            {group.map((kpi, ki) => (
              <div key={kpi.id} className="kpi-stacked-row">
                <KpiLabel
                  label={kpi.label}
                  color={theme.labelColor}
                  description={kpi.description}
                  showInfoIcon={layout.showInfoIcon}
                />
                <div className="kpi-inline-row">
                  <KpiCard kpi={kpi} index={gi + ki} theme={theme} layout={layout} easing={easeOutExpo} inline />
                </div>
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
