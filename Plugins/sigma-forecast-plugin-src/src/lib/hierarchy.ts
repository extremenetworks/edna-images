import type { ParsedRole, TreeNode } from '../types';

// Leaf-level role suffixes (individual contributors -- depth 3)
const LEAF_LEVELS = new Set(['ae', 'vae', 'cm']);

// Higher-level role suffixes mapped to their depth
const MANAGER_LEVELS: Record<string, number> = {
  rd: 2,
  vp: 1,
  avp: 1,
  svp: 1,
};

export function parseRole(role: string): ParsedRole {
  if (!role || !role.trim()) {
    return { orgPath: '', level: role, depth: 0 };
  }

  const trimmed = role.trim();
  const parts = trimmed.split('/');
  const lastPart = parts[parts.length - 1].trim().toLowerCase();

  if (LEAF_LEVELS.has(lastPart)) {
    return {
      orgPath: parts.slice(0, -1).join('/'),
      level: parts[parts.length - 1].trim(),
      depth: 3,
    };
  }

  const managerDepth = MANAGER_LEVELS[lastPart];
  if (managerDepth !== undefined) {
    return {
      orgPath: parts.slice(0, -1).join('/'),
      level: parts[parts.length - 1].trim(),
      depth: managerDepth,
    };
  }

  // No recognized suffix -- treat as top-level (global)
  return { orgPath: '', level: trimmed, depth: 0 };
}

export function buildTree(nodes: TreeNode[]): TreeNode | null {
  if (nodes.length === 0) return null;

  // Sort by depth ascending so we process parents before children
  const sorted = [...nodes].sort((a, b) => a.parsed.depth - b.parsed.depth);

  // Find root(s) at depth 0
  const roots = sorted.filter((n) => n.parsed.depth === 0);
  let root: TreeNode;

  if (roots.length === 1) {
    root = roots[0];
  } else if (roots.length > 1) {
    root = {
      id: 'synthetic-root',
      name: 'Global',
      role: 'Global',
      initials: 'GL',
      parsed: { orgPath: '', level: 'Global', depth: -1 },
      entered: {},
      rolledUp: {},
      submitted: null,
      hierarchyPath: null,
      channel: null,
      children: [...roots],
      isLeaf: false,
    };
  } else {
    root = sorted[0];
  }

  // Place all non-root nodes into the tree
  const placed: TreeNode[] = roots.length > 1 ? [root, ...roots] : [root];
  const remaining = sorted.filter((n) => !roots.includes(n) && n !== root);

  for (const node of remaining) {
    const parent = findBestParent(node, placed);
    if (parent) {
      parent.children.push(node);
    } else {
      root.children.push(node);
    }
    placed.push(node);
  }

  markLeaves(root);
  return root;
}

function findBestParent(node: TreeNode, candidates: TreeNode[]): TreeNode | null {
  const nodeDepth = node.parsed.depth;
  const nodeOrg = node.parsed.orgPath;

  // Find the candidate that is:
  // 1. At a strictly shallower depth (lower number)
  // 2. Whose orgPath is the longest prefix match of this node's full role path
  //
  // For a leaf "Region/Sub/LEAF" (orgPath "Region/Sub", depth 3):
  //   - "Region/Sub/MGR2" (orgPath "Region/Sub", depth 2) -> orgPath matches exactly -> best
  //   - "Region/MGR1" (orgPath "Region", depth 1) -> "Region" is prefix of "Region/Sub" -> fallback
  //
  // For "Region/Sub/MGR2" (orgPath "Region/Sub", depth 2):
  //   - "Region/MGR1" (orgPath "Region", depth 1) -> "Region" is prefix of "Region/Sub" -> match
  //
  // For "Region/MGR1" (orgPath "Region", depth 1):
  //   - top level (orgPath "", depth 0) -> empty is prefix of everything -> match

  let bestMatch: TreeNode | null = null;
  let bestScore = -1;

  for (const c of candidates) {
    if (c.parsed.depth >= nodeDepth) continue; // must be shallower

    const cOrg = c.parsed.orgPath;

    // Check if candidate's orgPath is a prefix of node's orgPath
    const isPrefix =
      cOrg === '' ||
      cOrg === nodeOrg ||
      nodeOrg.startsWith(cOrg + '/');

    if (!isPrefix) continue;

    // Score: prefer deeper parents (closest ancestor) and longer orgPath match
    const score = c.parsed.depth * 10000 + cOrg.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = c;
    }
  }

  return bestMatch;
}

function markLeaves(node: TreeNode): void {
  if (node.children.length === 0) {
    node.isLeaf = true;
  } else {
    node.isLeaf = false;
    for (const child of node.children) {
      markLeaves(child);
    }
  }
}

// Parse a hierarchy path entry like "Person A (Region)" into name and region
function parsePathEntry(entry: string): { name: string; region: string } {
  const match = entry.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), region: match[2].trim() };
  return { name: entry.trim(), region: '' };
}

// Build tree from explicit hierarchy path arrays.
// Each node's hierarchyPath is like:
// ["Person A (Top)", "Person B (Region)", "Person C (Subregion)", "Person D (Territory)"]
// The last entry is the person, each prior entry is an ancestor from root down.
// Positions are keyed by the full path prefix (not by name), so a person who reports
// to themselves appears twice:
// ["Person B (Region)"] and ["Person B (Region)", "Person B (Subregion)"].
export function buildTreeFromPaths(nodes: TreeNode[]): TreeNode | null {
  if (nodes.length === 0) return null;

  const keyOf = (path: string[], end: number) => path.slice(0, end + 1).join('\u0000');

  // Data nodes indexed by their own full path
  const nodeByPathKey = new Map<string, TreeNode>();
  for (const n of nodes) {
    if (n.hierarchyPath && n.hierarchyPath.length > 0) {
      nodeByPathKey.set(keyOf(n.hierarchyPath, n.hierarchyPath.length - 1), n);
    }
  }

  // Every tree position (data node or placeholder), keyed by path prefix
  const allNodes = new Map<string, TreeNode>();
  let root: TreeNode | null = null;

  for (const node of nodes) {
    const path = node.hierarchyPath;
    if (!path || path.length === 0) continue;

    let parentNode: TreeNode | null = null;

    for (let i = 0; i < path.length; i++) {
      const key = keyOf(path, i);
      let current = allNodes.get(key);

      if (!current) {
        const { name, region } = parsePathEntry(path[i]);
        const dataNode = nodeByPathKey.get(key);
        if (dataNode) {
          dataNode.parsed = region
            ? { orgPath: region, level: region, depth: i }
            : { ...dataNode.parsed, depth: i };
          current = dataNode;
        } else {
          // Placeholder for an ancestor with no data row in the dataset
          current = {
            id: `placeholder-${key}`,
            name,
            role: region || name,
            initials: getInitials(name),
            parsed: { orgPath: region, level: region, depth: i },
            entered: {},
            rolledUp: {},
            submitted: null,
            hierarchyPath: null,
            channel: null,
            children: [],
            isLeaf: false,
          };
        }
        allNodes.set(key, current);
        if (parentNode && !parentNode.children.includes(current)) {
          parentNode.children.push(current);
        }
      }

      if (i === 0 && !root) root = current;
      parentNode = current;
    }
  }

  if (!root) {
    // Fallback: if no root found, pick node with depth 0
    for (const n of allNodes.values()) {
      if (n.parsed.depth === 0) { root = n; break; }
    }
    if (!root) root = nodes[0];
  }

  markLeaves(root);
  return root;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || '??').toUpperCase();
}
