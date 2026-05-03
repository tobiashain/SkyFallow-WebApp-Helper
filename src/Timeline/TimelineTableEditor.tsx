import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  TimelineEntry,
  ExportedTimelineEntry,
  TimelineTableFile,
} from "./timelineTableEditorTypes";
import type { FlagRegistry } from "../FlagRegistry/flagTypes";
import {
  normalizeEntry,
  unflattenEntry,
  emptyEntry,
  exportJson,
} from "./timelineUtils";
import { TimelineEntryRow } from "./TimelineEntryRow";
import "./TimelineTableEditor.scss";

const STORAGE_KEY = "npc_timeline_table";

function readFlagOptions(): string[] {
  try {
    const raw = localStorage.getItem("flag_registry");
    if (!raw) return [];
    const registry: FlagRegistry = JSON.parse(raw);
    return registry.flags?.map((f) => f.id) ?? [];
  } catch {
    return [];
  }
}

interface Props {
  npcOptions: string[];
}

export function TimelineTableEditor({ npcOptions }: Props) {
  const [table, setTable] = useState<Record<string, TimelineEntry[]>>({});
  const [fallbacks, setFallbacks] = useState<Record<string, string[]>>({});
  const [selectedNpc, setSelectedNpc] = useState<string>("");
  const [newNpcId, setNewNpcId] = useState("");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set(),
  );
  const [newFallback, setNewFallback] = useState<Record<string, string>>({});

  const allNpcIds = useMemo(
    () => [...new Set([...Object.keys(table), ...npcOptions])],
    [table, npcOptions],
  );
  const flagOptions = useMemo(() => readFlagOptions(), []);

  // ── Persistence ────────────────────────────────────────────────────────
  // Helper: write current state to localStorage
  const persist = useCallback(
    (t: Record<string, TimelineEntry[]>, f: Record<string, string[]>) => {
      const data = {
        timeline_table: t,
        fallback_table: f,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
    [],
  );

  // Load once on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          if (parsed.timeline_table) {
            const normTable: Record<string, TimelineEntry[]> = {};
            for (const [npcId, entries] of Object.entries(
              parsed.timeline_table,
            )) {
              normTable[npcId] = (entries as any[]).map((entry) =>
                normalizeEntry(entry as TimelineEntry | ExportedTimelineEntry),
              );
            }
            setTable(normTable);
          }
          if (parsed.fallback_table) {
            setFallbacks(parsed.fallback_table);
          }
        }
      } catch {
        // ignore corrupted data
      }
    }
  }, []);

  // ── NPC CRUD ──────────────────────────────────────────────────────────
  const addNpc = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed || table[trimmed]) return;
    setTable((prev) => {
      const next = { ...prev, [trimmed]: [] };
      persist(next, fallbacks);
      return next;
    });
    setFallbacks((prev) => {
      const next = { ...prev, [trimmed]: [] };
      persist(table, next);
      return next;
    });
    setSelectedNpc(trimmed);
    setNewNpcId("");
  };

  const removeNpc = (id: string) => {
    setTable((prev) => {
      const next = { ...prev };
      delete next[id];
      persist(next, fallbacks);
      return next;
    });
    setFallbacks((prev) => {
      const next = { ...prev };
      delete next[id];
      persist(table, next);
      return next;
    });
    if (selectedNpc === id) setSelectedNpc("");
  };

  // ── Entry CRUD ─────────────────────────────────────────────────────────
  const addEntry = (npcId: string) => {
    setTable((prev) => {
      const next = {
        ...prev,
        [npcId]: [...(prev[npcId] ?? []), emptyEntry()],
      };
      persist(next, fallbacks);
      return next;
    });
  };

  const updateEntry = (npcId: string, idx: number, entry: TimelineEntry) => {
    setTable((prev) => {
      const entries = [...(prev[npcId] ?? [])];
      entries[idx] = entry;
      const next = { ...prev, [npcId]: entries };
      persist(next, fallbacks);
      return next;
    });
  };

  const deleteEntry = (npcId: string, idx: number) => {
    setTable((prev) => {
      const entries = [...(prev[npcId] ?? [])];
      entries.splice(idx, 1);
      const next = { ...prev, [npcId]: entries };
      persist(next, fallbacks);
      return next;
    });
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      next.delete(`${npcId}-${idx}`);
      return next;
    });
  };

  const toggleExpanded = (key: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Fallback CRUD ──────────────────────────────────────────────────────
  const addFallback = (npcId: string) => {
    const val = (newFallback[npcId] ?? "").trim();
    if (!val) return;
    setFallbacks((prev) => {
      const next = {
        ...prev,
        [npcId]: [...(prev[npcId] ?? []), val],
      };
      persist(table, next);
      return next;
    });
    setNewFallback((prev) => ({ ...prev, [npcId]: "" }));
  };

  const removeFallback = (npcId: string, idx: number) => {
    setFallbacks((prev) => {
      const arr = [...(prev[npcId] ?? [])];
      arr.splice(idx, 1);
      const next = { ...prev, [npcId]: arr };
      persist(table, next);
      return next;
    });
  };

  // ── Import / Export ────────────────────────────────────────────────────
  const handleImport = (raw: unknown) => {
    const data = raw as TimelineTableFile;
    let newTable = table;
    let newFallbacks = fallbacks;
    if (data.timeline_table) {
      const normTable: Record<string, TimelineEntry[]> = {};
      for (const [npcId, entries] of Object.entries(data.timeline_table)) {
        normTable[npcId] = (entries as any[]).map((entry) =>
          normalizeEntry(entry as TimelineEntry | ExportedTimelineEntry),
        );
      }
      newTable = normTable;
    }
    if (data.fallback_table) {
      newFallbacks = data.fallback_table;
    }
    setTable(newTable);
    setFallbacks(newFallbacks);
    persist(newTable, newFallbacks);
  };

  const handleExport = async () => {
    const exportTimelineTable: Record<string, ExportedTimelineEntry[]> = {};
    for (const [npcId, entries] of Object.entries(table)) {
      exportTimelineTable[npcId] = entries.map(unflattenEntry);
    }

    const data = {
      timeline_table: exportTimelineTable,
      fallback_table: fallbacks,
    };

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "npc_timeline_table.json",
          types: [
            {
              description: "JSON file",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        return;
      } catch {
        /* user cancelled */
      }
    }
    exportJson(data, "npc_timeline_table.json");
  };

  // ── Derived data for the selected NPC ─────────────────────────────────
  const currentEntries = selectedNpc ? (table[selectedNpc] ?? []) : [];
  const positiveEntries = currentEntries.filter((e) => e.weight !== -1);
  const totalWeight = positiveEntries.reduce((s, e) => s + (e.weight || 0), 0);
  const currentFallbacks = selectedNpc ? (fallbacks[selectedNpc] ?? []) : [];
  const timelineOptions = useMemo(
    () => currentEntries.map((e) => e.timeline).filter(Boolean),
    [currentEntries],
  );

  return (
    <div className="tl-editor">
      {/* ── Sidebar ── */}
      <aside className="tl-sidebar">
        <div className="tl-sidebar__header">
          <span className="tl-sidebar__title">NPCs</span>
          <div className="tl-sidebar__add">
            {npcOptions.length > 0 ? (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addNpc(e.target.value);
                }}
              >
                <option value="">+ add NPC</option>
                {npcOptions
                  .filter((id) => !table[id])
                  .map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="tl-sidebar__manual-add">
                <input
                  type="text"
                  placeholder="npc_id"
                  value={newNpcId}
                  onChange={(e) => setNewNpcId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNpc(newNpcId);
                  }}
                />
                <button onClick={() => addNpc(newNpcId)}>+</button>
              </div>
            )}
          </div>
        </div>

        {Object.keys(table).map((id) => (
          <div
            key={id}
            className={`tl-npc-item ${selectedNpc === id ? "tl-npc-item--active" : ""}`}
            onClick={() => setSelectedNpc(id)}
          >
            <span className="tl-npc-item__id">{id}</span>
            <span className="tl-npc-item__count">
              {(table[id] ?? []).length}
            </span>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                removeNpc(id);
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {Object.keys(table).length === 0 && (
          <p className="tl-sidebar__empty">No NPCs yet.</p>
        )}
      </aside>

      {/* ── Main panel ── */}
      <div className="tl-main">
        {!selectedNpc ? (
          <div className="tl-main__placeholder">
            <span>← Select or add an NPC to edit their timelines</span>
          </div>
        ) : (
          <>
            <div className="tl-main__toolbar">
              <h3 className="tl-main__npc-title">{selectedNpc}</h3>
              {totalWeight > 0 && (
                <div
                  className="tl-weight-bar"
                  title="Relative weights (forced -1 excluded)"
                >
                  {positiveEntries.map((e, i) => (
                    <div
                      key={i}
                      className="tl-weight-bar__segment"
                      style={{ flex: e.weight }}
                      title={`${e.timeline || "?"}: w${e.weight} (${Math.round((e.weight / totalWeight) * 100)}%)`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="tl-entries">
              {currentEntries.length === 0 && (
                <p className="tl-entries__empty">
                  No timelines yet for this NPC.
                </p>
              )}
              {currentEntries.map((entry, idx) => (
                <TimelineEntryRow
                  key={idx}
                  entry={entry}
                  index={idx}
                  isExpanded={expandedEntries.has(`${selectedNpc}-${idx}`)}
                  onToggle={() => toggleExpanded(`${selectedNpc}-${idx}`)}
                  onChange={(e) => updateEntry(selectedNpc, idx, e)}
                  onDelete={() => deleteEntry(selectedNpc, idx)}
                  npcOptions={allNpcIds}
                  flagOptions={flagOptions}
                  timelineOptions={timelineOptions}
                />
              ))}
              <button
                className="add-entry-btn"
                onClick={() => addEntry(selectedNpc)}
              >
                + Add Timeline Entry
              </button>
            </div>

            <div className="tl-fallbacks">
              <h4 className="tl-fallbacks__title">Fallback Timelines</h4>
              <p className="tl-fallbacks__hint">
                Played when no entries match. Picked at random.
              </p>
              <div className="tl-fallbacks__list">
                {currentFallbacks.map((fb, i) => (
                  <div key={i} className="tl-fallbacks__item">
                    <span>{fb}</span>
                    <button
                      className="delete-btn"
                      onClick={() => removeFallback(selectedNpc, i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="tl-fallbacks__add">
                <input
                  type="text"
                  placeholder="fallback_timeline_id"
                  value={newFallback[selectedNpc] ?? ""}
                  onChange={(e) =>
                    setNewFallback((prev) => ({
                      ...prev,
                      [selectedNpc]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addFallback(selectedNpc);
                  }}
                />
                <button onClick={() => addFallback(selectedNpc)}>Add</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="tl-footer">
        <label className="tl-import-label">
          Import npc_timeline_table.json
          <input
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  handleImport(JSON.parse(ev.target?.result as string));
                } catch {
                  alert("Invalid JSON");
                }
              };
              reader.readAsText(file);
            }}
          />
        </label>
        <button className="tl-export-btn" onClick={handleExport}>
          Export npc_timeline_table.json
        </button>
      </div>
    </div>
  );
}
