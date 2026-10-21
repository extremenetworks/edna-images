import React, { useState, useEffect } from 'react';
import type { TreeNode, MeasureColumn } from '../types';
import { TreeRow } from './TreeRow';
import { MobileCard } from './MobileCard';

const MOBILE_BREAKPOINT = 640;

interface Props {
  root: TreeNode;
  ancestors: TreeNode[];
  measureColumns: MeasureColumn[];
  expandedIds: Set<string>;
  onToggle: (nodeId: string) => void;
  onRowClick?: (node: TreeNode) => void;
  onForecastClick?: (node: TreeNode) => void;
  onFocus: (nodeId: string) => void;
  onClearFocus: () => void;
}

// Frozen column offsets: Name 260px, Status 56px, Notes 56px
const NOTES_LEFT = 316;
const NOTES_WIDTH = 56;

export function ForecastTable({ root, ancestors, measureColumns, expandedIds, onToggle, onRowClick, onForecastClick, onFocus, onClearFocus }: Props) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const flatRows = flattenTree(root, expandedIds, 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  // Forecast column sits after Notes when Notes is shown
  const forecastLeft = onRowClick ? NOTES_LEFT + NOTES_WIDTH : NOTES_LEFT;
  const lastFrozen = onForecastClick ? 'forecast' : onRowClick ? 'notes' : 'status';

  const breadcrumb = ancestors.length > 0 && (
    <FocusBar ancestors={ancestors} current={root} onFocus={onFocus} onClear={onClearFocus} />
  );

  if (isMobile) {
    return (
      <div className="forecast-root">
        {breadcrumb}
        <div className="mobile-wrapper">
          {flatRows.map((item) => (
            <MobileCard
              key={item.node.id}
              node={item.node}
              depth={item.depth}
              measureColumns={measureColumns}
              isExpanded={expandedIds.has(item.node.id)}
              onToggle={onToggle}
              onFocus={item.depth > 0 ? onFocus : undefined}
              onRowClick={onRowClick}
              onForecastClick={onForecastClick}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="forecast-root">
      {breadcrumb}
      <div className="forecast-table-wrapper">
        <table className="forecast-table">
          <thead>
            <tr>
              <th className="col-name th-sticky">Name</th>
              <th className={`col-status th-sticky${lastFrozen === 'status' ? ' frozen-edge' : ''}`}>Status</th>
              {onRowClick && (
                <th className={`col-notes th-sticky${lastFrozen === 'notes' ? ' frozen-edge' : ''}`}>Notes</th>
              )}
              {onForecastClick && (
                <th className="col-forecast th-sticky frozen-edge" style={{ left: forecastLeft }}>Forecast</th>
              )}
              {measureColumns.map((mc) => (
                <th key={mc.key} className="col-measure th-top">{mc.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flatRows.map((item, idx) => (
              <TreeRow
                key={item.node.id}
                node={item.node}
                depth={item.depth}
                measureColumns={measureColumns}
                isExpanded={expandedIds.has(item.node.id)}
                onToggle={onToggle}
                onRowClick={onRowClick}
                onForecastClick={onForecastClick}
                forecastLeft={forecastLeft}
                lastFrozen={lastFrozen}
                onFocus={item.depth > 0 ? onFocus : undefined}
                isHovered={hoveredIdx === idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FocusBar({ ancestors, current, onFocus, onClear }: {
  ancestors: TreeNode[];
  current: TreeNode;
  onFocus: (nodeId: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="focus-bar">
      <div className="focus-crumbs">
        {ancestors.map((a) => (
          <React.Fragment key={a.id}>
            <button className="focus-crumb" onClick={() => onFocus(a.id)} title={`Show ${a.name}'s hierarchy`}>
              {a.name}
            </button>
            <span className="focus-sep">›</span>
          </React.Fragment>
        ))}
        <span className="focus-current">{current.name}</span>
      </div>
      <button className="focus-clear" onClick={onClear} title="Show the full hierarchy">
        ✕ Show all
      </button>
    </div>
  );
}

interface FlatItem {
  node: TreeNode;
  depth: number;
}

function flattenTree(node: TreeNode, expandedIds: Set<string>, depth: number): FlatItem[] {
  const result: FlatItem[] = [{ node, depth }];
  if (expandedIds.has(node.id) && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...flattenTree(child, expandedIds, depth + 1));
    }
  }
  return result;
}
