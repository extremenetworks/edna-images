import type { TreeNode } from '../types';

// Funnel keys roll up as own + subtree; includes the monthly funnel used by M1-M3 coverage
const FUNNEL_KEYS = new Set(['closed', 'open', 'closedM1', 'closedM2', 'closedM3', 'openM1', 'openM2', 'openM3']);

export function computeRollups(node: TreeNode, measureKeys: string[]): void {
  for (const child of node.children) {
    computeRollups(child, measureKeys);
  }

  if (node.children.length > 0) {
    for (const key of measureKeys) {
      // Funnel keys (closed/open): subtree total = the node's own pipeline
      // (opportunities a person owns themselves) + each child's subtree total.
      // Forecast keys: sum of direct children's entered values (what each level called).
      const isFunnel = FUNNEL_KEYS.has(key);
      const own = isFunnel ? node.entered[key] : undefined;
      let sum = own != null && !isNaN(own) ? own : 0;
      let hasAny = own != null && !isNaN(own);
      for (const child of node.children) {
        const val = isFunnel
          ? (child.children.length > 0 ? child.rolledUp[key] : child.entered[key])
          : child.entered[key];
        if (val != null && !isNaN(val)) {
          sum += val;
          hasAny = true;
        }
      }
      if (hasAny) {
        node.rolledUp[key] = sum;
      }
    }
  }
}
