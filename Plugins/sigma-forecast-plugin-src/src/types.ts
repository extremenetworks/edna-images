export interface ForecastRow {
  name: string;
  role: string;
  values: Record<string, number | null>;
  submitted: boolean | null;
  hierarchyPath: string[] | null;
  channel: string | null;
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
  children: TreeNode[];
  isLeaf: boolean;
}

export interface MeasureColumn {
  key: string;
  colId: string;
  label: string;
}
