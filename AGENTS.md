# AGENTS.md — ScheduleWebApp

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | `tsc -b && vite build` (typecheck + build — run both) |
| `npm run lint` | ESLint flat config |
| `npm run preview` | Vite preview |

## TypeScript quirks

- `verbatimModuleSyntax` → use `import type` for type-only imports.
- `erasableSyntaxOnly` → no enums, no namespaces, no parameter properties.
- `tsc -b` uses project references (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`).

## Architecture

- **Entrypoint**: `src/main.tsx` → `src/App.tsx`. Four tabs: Schedules, Timelines, Flag Registry, Save Editor.
- **No router, no API, no backend**. Entirely client-side. No tests, no CI.
- **All state persisted to `localStorage`** (keys: `bakedData`, `scheduleData`, `npc_timeline_table`, `flag_registry`).
- Import/export JSON via drag-and-drop (`FileImporter`) or `showSaveFilePicker` / download fallback.

## Data flow

1. User drops `npc_nav_baked.json` → `transformBakedData` converts to `TransformedScene[]` (scenes, NPCs, targets).
2. Optional: drop existing `npc_schedules.json` or `npc_timeline_table.json` to continue editing.
3. Export reflects the internal state back to JSON.

## Shared condition system

`src/types.ts` defines `Condition` union with types: `DayCondition`, `WeekdayCondition`, `FlagCondition`, `FriendshipCondition`, `AndCondition`, `OrCondition`, `NotCondition`. Timeline editor adds flattened convenience types (`DayFromCondition`, `HourRangeCondition`, `SeenFirstCondition`) merged into the tree on export.

## Conventions

- Sass (SCSS) per-component — files co-located with components (e.g. `src/Schedules/scheduleEditor.scss`).
- React Compiler (babel-plugin-react-compiler) via vite plugin.
- React 19, TypeScript ~6.0, Vite 8.
- Flag IDs: lowercase + underscores only. Prefix convention: `e_` event, `w_` world, `q_` quest, `n_` npc.
- No test framework is set up — do not add tests.
