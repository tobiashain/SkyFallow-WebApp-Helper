# AGENTS.md — ScheduleWebApp

## Workspace And Git Workflow

- `master` is merge-only: it advances through merged PRs, never through direct commits.
- Every change starts in a worktree at `G:\Projects\Skyfallow\worktrees\ScheduleWebApp\<feature>` on branch `feat/<feature>`. The `ScheduleWebApp` checkout stays on `master` and clean.
- Keep worktrees out of `.kilo/`: Kilo treats any path containing `.kilo/` as protected configuration and prompts for every edit.
- Create worktrees with `tools/agent-workflow/new-worktree.ps1 <feature>`. It fetches origin, mirrors local `master` to `origin/master` (aborting if `master` is ahead or diverged), creates the worktree from `origin/master`, and runs setup.
- Setup runs `npm ci`, `npm run build`, and `npm run lint`, then verifies the tree is clean. Build is the hard gate; lint is advisory because `master` already carries pre-existing lint errors, so fix lint in the files you touch and do not add new ones. `.kilo/setup-script.ps1` is a thin shim over `tools/agent-workflow/setup.ps1`. A failed setup leaves the worktree in place for inspection.
- Publish the branch after its first commit. Before opening a PR, re-run `npm run build` and `npm run lint` from the worktree. Merge only on the user's approval.
- To discard unmerged work, use `tools/agent-workflow/remove-worktree.ps1 <feature> -Abandon`; it refuses when there are uncommitted changes or unpushed commits unless `-Force` is given. After a merged PR, run it without switches: it verifies the PR is MERGED, fast-forwards `master`, and deletes the worktree, local branch, and remote branch.
- Run `tools/agent-workflow/worktree-status.ps1` when unsure about worktree, branch, or PR state.

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

- **Entrypoint**: `src/main.tsx` → `src/App.tsx`. Six tabs: Schedules, Timelines, Flag Registry, Quest Editor, Save Editor, Shop Editor.
- **No router, no API, no backend**. Entirely client-side. No tests, no CI.
- **All state persisted to `localStorage`** (keys: `bakedData`, `scheduleData`, `npc_timeline_table`, `flag_registry`, `quest_data`, `item_catalog`, `shop_definitions`).
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
