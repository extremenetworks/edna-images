import React from 'react';
import { formatCompact, formatWoW } from '../lib/format';

/** Booked + open funnel against a forecast value, drawn as a stacked coverage bar. */
export interface CoverageData {
  closed: number;
  open: number;
  total: number;
  /** Name of the forecast value in the tooltip, e.g. MLV or M1 */
  label: string;
}

interface Props {
  entered: number | null;
  rolledUp: number | null;
  isAggregate: boolean;
  isWoW?: boolean;
  /** Change since the previous week, shown as an arrow */
  delta: number | null;
  coverage: CoverageData | null;
}

export function DualValueCell({ entered, rolledUp, isAggregate, isWoW, delta, coverage }: Props) {
  if (entered === null && rolledUp === null) {
    return <span className="value-dash">-</span>;
  }

  const fmt = isWoW ? formatWoW : formatCompact;
  const showDelta = delta !== null && delta !== 0;
  const showBar = coverage !== null && coverage.total > 0;

  if (!isAggregate || rolledUp === null) {
    return (
      <div className="value-single">
        <span className={`value-primary ${isWoW ? getWoWClass(entered) : ''}`}>
          {fmt(entered)}
          {showDelta && <WoWBadge delta={delta!} />}
        </span>
        {showBar && <CoverageBar closed={coverage!.closed} open={coverage!.open} mlv={coverage!.total} label={coverage!.label} />}
      </div>
    );
  }

  return (
    <div className="value-dual">
      <span className={`value-primary ${isWoW ? getWoWClass(entered) : ''}`}>
        {fmt(entered)}
        {showDelta && <WoWBadge delta={delta!} />}
      </span>
      <span className="value-rollup">
        {fmt(rolledUp)}
      </span>
      {showBar && <CoverageBar closed={coverage!.closed} open={coverage!.open} mlv={coverage!.total} label={coverage!.label} />}
    </div>
  );
}

function WoWBadge({ delta }: { delta: number }) {
  const isUp = delta > 0;
  const arrow = isUp ? '▲' : '▼';
  const cls = isUp ? 'wow-arrow-up' : 'wow-arrow-down';

  return (
    <span className={`wow-arrow ${cls}`} title={formatWoW(delta)}>
      {arrow}
    </span>
  );
}

function CoverageBar({ closed, open, mlv, label }: { closed: number; open: number; mlv: number; label: string }) {
  if (mlv <= 0) return null;

  const closedPct = Math.min(Math.max((closed / mlv) * 100, 0), 100);
  const openPct = Math.min(Math.max((open / mlv) * 100, 0), 100 - closedPct);
  const totalCoverage = Math.round(closedPct + openPct);

  const tooltip = `Booked: ${formatCompact(closed)} (${Math.round(closedPct)}%)\nOpen: ${formatCompact(open)} (${Math.round(openPct)}%)\n${label}: ${formatCompact(mlv)}\nCoverage: ${totalCoverage}%`;

  return (
    <div className="stacked-bar-container" title={tooltip}>
      <div className="stacked-bar">
        {closedPct > 0 && (
          <div className="bar-segment bar-booked" style={{ width: `${closedPct}%` }} />
        )}
        {openPct > 0 && (
          <div className="bar-segment bar-open" style={{ width: `${openPct}%` }} />
        )}
      </div>
      <span className="progress-label">{totalCoverage}%</span>
    </div>
  );
}

function getWoWClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? 'wow-positive' : 'wow-negative';
}
