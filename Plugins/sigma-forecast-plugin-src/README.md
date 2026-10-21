# Sigma Forecast Plugin — Hierarchical Forecast View

A Sigma Computing plugin that renders forecast data as an interactive, hierarchical tree table. Every level of the org can see both the **entered forecast** at their level and the **rolled-up forecast** from their direct reports.

This folder is the **source code**. The built plugin that Sigma loads lives in `../sigma-forecast-plugin/`.

## Features

- **Hierarchical tree view** with expand/collapse, built from a JSON hierarchy path (preferred) or a role string
- **Forecast measures** (Low, MLV, High, M1–M3): rows with reports show the value entered at that level (bold) and the sum of the direct reports' entries (gray)
- **Funnel measures** (Booked, Open Funnel): a straight subtotal of the person's own pipeline plus everyone below them, shown as a single number
- **Week-over-week arrows** on Low, MLV and High from optional previous-week columns (the previous-week columns themselves are hidden)
- **Stacked coverage bar** on MLV: booked (green) and open funnel (blue) as a share of MLV
- **Focus view**: click a name to show only that person's subtree; a breadcrumb bar shows the levels above, with **Show all** to return
- **Notes column**: a note icon per person fires a Sigma action and sets a workbook control to that person's name
- **Custom column labels** set in the editor panel
- **Self-reports**: a person who reports to themselves appears at both positions
- **Channel breakout** (optional): rows for the same person with different channel values (e.g. MSP / Non-MSP) are grouped under one total
- **RLS-compatible**, **mobile card layout** below 640px, and **deduplication** to the latest entry per person

## Editor Panel

| Field | Required | Description |
|-------|----------|-------------|
| Source | Yes | The Sigma table element to read |
| Name | Yes | Display name |
| Role / Hierarchy Path | Yes (one) | JSON array path (preferred) or role string |
| Created Date | Recommended | Picks the latest entry per person |
| Booked, Open Funnel | Optional | Funnel actuals (subtotaled up the tree) |
| Low, MLV, High, M1–M3 | Optional | Forecast values entered at each level |
| Prev Wk Low / MLV / High | Optional | Previous-week values for the WoW arrows (hidden columns) |
| Submitted This Week | Optional | Boolean for the status dot |
| Channel | Optional | Channel breakout |
| Column Labels | Optional | Rename any measure column; blank keeps the default |
| Selected Username Variable | Optional | Workbook control set to the person whose note icon was clicked |
| On Row Click | Optional | Action fired by the note icon. The Notes column only appears when this or the variable is set |

### Hierarchy path format (preferred)

A JSON array from the top of the visible hierarchy down to the person, each entry `Name (Region)`:

```json
["Person A (Top)", "Person B (Region)", "Person C (Subregion)"]
```

Ancestors without their own data row are added as placeholder rows. Tree positions are keyed by the full path, so the same person can appear more than once.

### Role string format (fallback)

A `/`-separated path whose last segment is a level code (e.g. `Region/Subregion/<code>`). Leaf codes sit at depth 3, higher-level codes at depth 1–2, and a value with no recognized code is treated as the top level. The codes are defined in `src/lib/hierarchy.ts`. Everything before the last `/` is the org-unit path used to find the parent.

## Development

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5174
```

Point the plugin at `http://localhost:5174` in Sigma (Administration > Plugins) for local development. Hard-refresh Sigma (Cmd+Shift+R) after changes.

## Deploying

```bash
npm run build      # outputs to dist/
cp -r dist/* ../sigma-forecast-plugin/
```

Commit the new files in `../sigma-forecast-plugin/` **without deleting the old `assets/index-*.js` / `index-*.css` files**. The host caches `index.html`; if the files it points to are removed, the plugin loads with no styling.

## SDK notes

- `useVariable` and `useActionTrigger` must be given the **value** stored in the config field (the control / trigger ID), not the config key name. Passing the key name gives "Control variable name: … not found" and the action never fires.
- Read editor-panel text fields with `useConfig('key')` so edits re-render reliably.
- `border-collapse: separate` is required for the frozen columns (`position: sticky`) to work inside Sigma's iframe.
