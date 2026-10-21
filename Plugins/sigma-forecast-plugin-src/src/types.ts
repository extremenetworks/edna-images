export interface ForecastRow {
  name: string;
  role: string;
  values: Record<string, number | null>;
  submitted: boolean | null;
  hierarchyPath: string[] | null;
  channel: string | null;
  /** Index of this row in the source element's data, for looking up extra columns */
  rowIndex: number;
}

export interface ParsedRole {
  orgPath: string;
  level: string;
  depth: number;
}

export interface TreeNode {
  id: string;
  name: string;
  role: string;
  initials: string;
  parsed: ParsedRole;
  entered: Record<string, number>;
  rolledUp: Record<string, number>;
  submitted: boolean | null;
  hierarchyPath: string[] | null;
  channel: string | null;
  /** Source data row index; null for placeholder ancestors with no data row */
  rowIndex: number | null;
  children: TreeNode[];
  isLeaf: boolean;
}

export interface MeasureColumn {
  key: string;
  colId: string;
  label: string;
}
